begin;
create table public.booking_day_overrides (
 booking_date date primary key,
 hours jsonb not null check (jsonb_typeof(hours)='object'),
 updated_at timestamptz not null default now()
);
alter table public.booking_day_overrides enable row level security;
revoke all on public.booking_day_overrides from public,anon,authenticated;
grant all on public.booking_day_overrides to service_role;

create or replace function public.booking_date_hours() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(booking_date::text,hours),'{}'::jsonb)
 from public.booking_day_overrides
 where booking_date between (now() at time zone 'Asia/Bangkok')::date+1 and (now() at time zone 'Asia/Bangkok')::date+31
$$;
create or replace function public.admin_set_booking_date(p_date date,p_hours jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare entry record;
begin
 if p_date is null or p_date<(now() at time zone 'Asia/Bangkok')::date+1
    or p_date>(now() at time zone 'Asia/Bangkok')::date+31 then
  raise exception 'invalid_booking_date' using errcode='22023';
 end if;
 if p_hours is null then
  delete from public.booking_day_overrides where booking_date=p_date;
 else
  if jsonb_typeof(p_hours)<>'object' then raise exception 'invalid_booking_hours' using errcode='22023';end if;
  for entry in select key,value from jsonb_each(p_hours) loop
   if entry.key !~ '^(0[8-9]|1[0-9]):(00|30)$'
      or entry.value not in ('"available"'::jsonb,'"contact_directly"'::jsonb) then
    raise exception 'invalid_booking_hours' using errcode='22023';
   end if;
  end loop;
  insert into public.booking_day_overrides(booking_date,hours) values(p_date,p_hours)
  on conflict(booking_date) do update set hours=excluded.hours,updated_at=now();
 end if;
 return public.booking_date_hours();
end;
$$;
revoke all on function public.booking_date_hours(),public.admin_set_booking_date(date,jsonb) from public,anon,authenticated;
grant execute on function public.booking_date_hours(),public.admin_set_booking_date(date,jsonb) to service_role;

create or replace function public.booking_slot_allowed(p_start_at timestamptz, p_end_at timestamptz)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare local_start timestamp; local_end timestamp; weekly jsonb; day_hours jsonb;
begin
  if p_start_at is null or p_end_at is null or p_end_at <> p_start_at + interval '1 hour' then return false; end if;
  local_start := p_start_at at time zone 'Asia/Bangkok';
  local_end := p_end_at at time zone 'Asia/Bangkok';
  if local_start::date < (now() at time zone 'Asia/Bangkok')::date + 1
     or local_start::date > (now() at time zone 'Asia/Bangkok')::date + 31
     or local_start::date <> (local_end - interval '1 microsecond')::date
     or extract(minute from local_start)::integer not in (0, 30)
     or extract(second from local_start) <> 0 then return false; end if;
  select weekly_hours into weekly from public.booking_settings where singleton = true;
  select hours into day_hours from public.booking_day_overrides where booking_date=local_start::date;
  if not found then day_hours := weekly -> extract(dow from local_start)::integer::text;end if;
  return coalesce(day_hours -> to_char(local_start, 'HH24:MI') = '"available"'::jsonb
     and day_hours -> to_char(local_start + interval '30 minutes', 'HH24:MI') in ('"available"'::jsonb, '"contact_directly"'::jsonb), false);
end;
$$;
commit;
