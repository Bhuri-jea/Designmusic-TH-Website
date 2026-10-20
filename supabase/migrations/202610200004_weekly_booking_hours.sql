create table if not exists public.booking_settings (
  singleton boolean primary key default true check (singleton),
  weekly_hours jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.booking_settings (singleton, weekly_hours)
select true, jsonb_object_agg(days.day_no::text, coalesce(hours.day_hours, '{}'::jsonb))
from generate_series(0, 6) as days(day_no)
cross join lateral (
  select jsonb_object_agg(to_char(make_time(hour_no, minute_no, 0), 'HH24:MI'), '"available"'::jsonb) as day_hours
  from generate_series(8, 17) as hours(hour_no)
  cross join (values (0), (30)) as minutes(minute_no)
  where days.day_no between 1 and 5
) as hours
on conflict (singleton) do nothing;

alter table public.booking_settings enable row level security;
revoke all on public.booking_settings from public, anon, authenticated;
grant all on public.booking_settings to service_role;

create or replace function public.booking_weekly_hours()
returns jsonb language sql security definer set search_path = ''
as $$ select weekly_hours from public.booking_settings where singleton = true; $$;

create or replace function public.admin_set_booking_hours(p_weekly_hours jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare day_entry record; slot_entry record;
begin
  if jsonb_typeof(p_weekly_hours) is distinct from 'object' then
    raise exception 'invalid_booking_hours' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_weekly_hours)) <> 7 then
    raise exception 'invalid_booking_hours' using errcode = '22023';
  end if;
  for day_entry in select key, value from jsonb_each(p_weekly_hours) loop
    if day_entry.key !~ '^[0-6]$' or jsonb_typeof(day_entry.value) is distinct from 'object' then
      raise exception 'invalid_booking_hours' using errcode = '22023';
    end if;
    for slot_entry in select key, value from jsonb_each(day_entry.value) loop
      if slot_entry.key !~ '^(0[8-9]|1[0-9]):(00|30)$'
         or substring(slot_entry.key, 1, 2)::integer > 19
         or slot_entry.value not in ('"available"'::jsonb, '"contact_directly"'::jsonb) then
        raise exception 'invalid_booking_hours' using errcode = '22023';
      end if;
    end loop;
  end loop;
  insert into public.booking_settings(singleton, weekly_hours, updated_at)
  values (true, p_weekly_hours, now())
  on conflict (singleton) do update set weekly_hours = excluded.weekly_hours, updated_at = now();
  return p_weekly_hours;
end;
$$;

create or replace function public.booking_slot_allowed(p_start_at timestamptz, p_end_at timestamptz)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare local_start timestamp; local_end timestamp; weekly jsonb; day_hours jsonb;
begin
  if p_start_at is null or p_end_at is null or p_end_at <> p_start_at + interval '1 hour' then return false; end if;
  local_start := p_start_at at time zone 'Asia/Bangkok';
  local_end := p_end_at at time zone 'Asia/Bangkok';
  if local_start::date < (now() at time zone 'Asia/Bangkok')::date + 1
     or local_start::date > (now() at time zone 'Asia/Bangkok')::date + 90
     or local_start::date <> (local_end - interval '1 microsecond')::date
     or extract(minute from local_start)::integer not in (0, 30)
     or extract(second from local_start) <> 0 then return false; end if;
  select weekly_hours into weekly from public.booking_settings where singleton = true;
  day_hours := weekly -> extract(dow from local_start)::integer::text;
  return coalesce(day_hours -> to_char(local_start, 'HH24:MI') = '"available"'::jsonb
     and day_hours -> to_char(local_start + interval '30 minutes', 'HH24:MI') in ('"available"'::jsonb, '"contact_directly"'::jsonb), false);
end;
$$;

create or replace function public.enforce_booking_hours()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'confirmed' and not public.booking_slot_allowed(new.start_at, new.end_at) then
    raise exception 'invalid_booking_slot' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_enforce_weekly_hours on public.bookings;
create trigger bookings_enforce_weekly_hours
before insert or update of start_at, end_at, status on public.bookings
for each row execute function public.enforce_booking_hours();

alter table public.bookings
  add constraint bookings_active_no_overlap
  exclude using gist (tstzrange(start_at, end_at, '[)') with &&)
  where (status = 'confirmed');

create or replace function public.reschedule_booking(
  p_customer_id uuid, p_booking_id uuid, p_change_key uuid, p_start_at timestamptz, p_end_at timestamptz
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare booking_row public.bookings; customer_row public.customers; next_version integer;
begin
  if p_customer_id is null or p_booking_id is null or p_change_key is null
     or p_start_at is null or not isfinite(p_start_at)
     or p_end_at is null or not isfinite(p_end_at)
     or p_end_at <> p_start_at + interval '1 hour' then
    raise exception 'invalid_booking' using errcode = '22023';
  end if;
  select * into booking_row from public.bookings where id = p_booking_id for update;
  if not found or booking_row.customer_id <> p_customer_id then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
  if booking_row.last_change_key = p_change_key then
    if booking_row.start_at <> p_start_at or booking_row.end_at <> p_end_at then raise exception 'booking_conflict' using errcode = '23505'; end if;
    return jsonb_build_object('id', booking_row.id, 'customerId', booking_row.customer_id, 'requestKey', booking_row.request_key,
      'fingerprint', booking_row.fingerprint, 'startAt', booking_row.start_at, 'endAt', booking_row.end_at,
      'instrument', booking_row.instrument, 'service', booking_row.service, 'notes', booking_row.notes,
      'locale', booking_row.locale, 'status', booking_row.status, 'createdAt', booking_row.created_at);
  end if;
  if booking_row.status <> 'confirmed' or booking_row.start_at <= now() then raise exception 'booking_not_modifiable' using errcode = '22023'; end if;
  if not public.booking_slot_allowed(p_start_at, p_end_at) then raise exception 'invalid_booking_slot' using errcode = '22023'; end if;
  if booking_row.start_at = p_start_at then
    return jsonb_build_object('id', booking_row.id, 'customerId', booking_row.customer_id, 'requestKey', booking_row.request_key,
      'fingerprint', booking_row.fingerprint, 'startAt', booking_row.start_at, 'endAt', booking_row.end_at,
      'instrument', booking_row.instrument, 'service', booking_row.service, 'notes', booking_row.notes,
      'locale', booking_row.locale, 'status', booking_row.status, 'createdAt', booking_row.created_at);
  end if;
  select * into customer_row from public.customers where id = p_customer_id for share;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
  next_version := booking_row.version + 1;
  update public.bookings set start_at = p_start_at, end_at = p_end_at, last_change_key = p_change_key, version = next_version
   where id = p_booking_id returning * into booking_row;
  insert into public.outbox(topic, dedupe_key, payload)
  values ('booking_google', 'booking:' || booking_row.id || ':change:' || p_change_key,
    jsonb_build_object('bookingId', booking_row.id, 'startAt', booking_row.start_at, 'endAt', booking_row.end_at,
      'timeZone', 'Asia/Bangkok', 'customer', jsonb_build_object('name', customer_row.name, 'email', customer_row.email, 'phone', customer_row.phone),
      'instrument', booking_row.instrument, 'service', booking_row.service, 'notes', booking_row.notes,
      'locale', booking_row.locale, 'status', booking_row.status, 'version', next_version));
  return jsonb_build_object('id', booking_row.id, 'customerId', booking_row.customer_id, 'requestKey', booking_row.request_key,
    'fingerprint', booking_row.fingerprint, 'startAt', booking_row.start_at, 'endAt', booking_row.end_at,
    'instrument', booking_row.instrument, 'service', booking_row.service, 'notes', booking_row.notes,
    'locale', booking_row.locale, 'status', booking_row.status, 'createdAt', booking_row.created_at);
end;
$$;

revoke all on function public.booking_weekly_hours(), public.admin_set_booking_hours(jsonb),
  public.booking_slot_allowed(timestamptz,timestamptz), public.enforce_booking_hours(),
  public.reschedule_booking(uuid,uuid,uuid,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.booking_weekly_hours(), public.admin_set_booking_hours(jsonb),
  public.booking_slot_allowed(timestamptz,timestamptz), public.reschedule_booking(uuid,uuid,uuid,timestamptz,timestamptz) to service_role;

