begin;

-- Keep all calendar readers and database-side booking validation on the same
-- inclusive Bangkok-local window: today through the date two months ahead.
create or replace function public.booking_date_hours() returns jsonb
language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_object_agg(booking_date::text, hours), '{}'::jsonb)
 from public.booking_day_overrides
 where booking_date between (now() at time zone 'Asia/Bangkok')::date
   and ((now() at time zone 'Asia/Bangkok')::date + interval '2 months')::date
$$;

create or replace function public.admin_set_booking_date(p_date date, p_hours jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare entry record;
begin
 if p_date is null
    or p_date < (now() at time zone 'Asia/Bangkok')::date
    or p_date > ((now() at time zone 'Asia/Bangkok')::date + interval '2 months')::date then
  raise exception 'invalid_booking_date' using errcode='22023';
 end if;
 if p_hours is null then
  delete from public.booking_day_overrides where booking_date=p_date;
 else
  if jsonb_typeof(p_hours) is distinct from 'object' then raise exception 'invalid_booking_hours' using errcode='22023'; end if;
  for entry in select key, value from jsonb_each(p_hours) loop
   if entry.key !~ '^(0[8-9]|1[0-9]):(00|30)$'
      or entry.value not in ('"available"'::jsonb, '"contact_directly"'::jsonb) then
    raise exception 'invalid_booking_hours' using errcode='22023';
   end if;
  end loop;
  insert into public.booking_day_overrides(booking_date, hours) values(p_date, p_hours)
  on conflict(booking_date) do update set hours=excluded.hours, updated_at=now();
 end if;
 return public.booking_date_hours();
end;
$$;

create or replace function public.booking_slot_allowed(p_start_at timestamptz, p_end_at timestamptz)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare local_start timestamp; local_end timestamp; weekly jsonb; day_hours jsonb;
begin
 if p_start_at is null or p_end_at is null or p_end_at <> p_start_at + interval '1 hour'
    or p_start_at <= now() then return false; end if;
 local_start := p_start_at at time zone 'Asia/Bangkok';
 local_end := p_end_at at time zone 'Asia/Bangkok';
 if local_start::date < (now() at time zone 'Asia/Bangkok')::date
    or local_start::date > ((now() at time zone 'Asia/Bangkok')::date + interval '2 months')::date
    or local_start::date <> (local_end - interval '1 microsecond')::date
    or extract(minute from local_start)::integer not in (0, 30)
    or extract(second from local_start) <> 0 then return false; end if;
 select weekly_hours into weekly from public.booking_settings where singleton = true;
 select hours into day_hours from public.booking_day_overrides where booking_date=local_start::date;
 if not found then day_hours := weekly -> extract(dow from local_start)::integer::text; end if;
 return coalesce(day_hours -> to_char(local_start, 'HH24:MI') = '"available"'::jsonb
    and day_hours -> to_char(local_start + interval '30 minutes', 'HH24:MI') in ('"available"'::jsonb, '"contact_directly"'::jsonb), false);
end;
$$;

-- The original create_booking function predates the calendar rules and uses a
-- hard-coded 14-day window and hourly starts. Keep its identity, snapshot,
-- retry and outbox behavior while routing slot eligibility through the shared
-- weekly/day-override validator above.
create or replace function public.create_booking(
 p_customer_id uuid, p_request_key uuid, p_fingerprint text,
 p_start_at timestamptz, p_end_at timestamptz, p_instrument text,
 p_service text, p_notes text, p_locale text default 'en'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.bookings; created public.bookings; customer public.customers; snapshot jsonb;
begin
 if p_customer_id is null or p_request_key is null or p_fingerprint is null
    or p_fingerprint !~ '^[0-9a-f]{64}$'
    or p_start_at is null or not isfinite(p_start_at)
    or p_end_at is null or not isfinite(p_end_at)
    or p_end_at <> p_start_at + interval '1 hour'
    or p_instrument is null or p_instrument not in ('soprano','alto','tenor','baritone','bassoon','other')
    or p_service is null or p_service not in ('basic','standard','overhaul','assessment')
    or (p_instrument='bassoon' and p_service='basic')
    or p_notes is null or length(p_notes)>2000
    or translate(p_notes, chr(9)||chr(10)||chr(13), '') ~ '[[:cntrl:]]'
    or p_locale is null or p_locale not in ('en','ja','zh-CN','th') then
  raise exception 'invalid_booking' using errcode='22023';
 end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer_id::text||':'||p_request_key::text,0));
 select * into existing from public.bookings
  where customer_id=p_customer_id and request_key=p_request_key for update;
 if found then
  if existing.fingerprint<>p_fingerprint or existing.start_at<>p_start_at or existing.end_at<>p_end_at
     or existing.instrument<>p_instrument or existing.service<>p_service
     or existing.notes<>p_notes or existing.locale<>p_locale then
   raise exception 'booking_request_key_conflict' using errcode='23505', constraint='bookings_customer_request_key';
  end if;
  return public.booking_record(existing.id);
 end if;

 if not public.booking_slot_allowed(p_start_at,p_end_at) then
  raise exception 'invalid_booking_slot' using errcode='22023';
 end if;
 select * into customer from public.customers where id=p_customer_id for share;
 if not found then raise exception 'customer_not_found' using errcode='P0002'; end if;
 snapshot := jsonb_build_object('name',customer.name,'email',customer.email,'phone',customer.phone);
 insert into public.bookings(customer_id,request_key,fingerprint,start_at,end_at,instrument,service,notes,locale,customer_snapshot)
 values(p_customer_id,p_request_key,p_fingerprint,p_start_at,p_end_at,p_instrument,p_service,p_notes,p_locale,snapshot)
 returning * into created;
 insert into public.outbox(topic,dedupe_key,payload)
 select topic,'booking:'||created.id||':'||audience,
  jsonb_build_object('bookingId',created.id,'startAt',created.start_at,'endAt',created.end_at,'timeZone','Asia/Bangkok',
   'customer',snapshot,'instrument',created.instrument,'service',created.service,'notes',created.notes,'locale',created.locale,
   'recipient',case when audience='buyer' then customer.email else null end)
 from (values ('booking_buyer','buyer'),('booking_seller','seller'),('booking_google','google')) as jobs(topic,audience)
 on conflict (dedupe_key) do nothing;
 return public.booking_record(created.id);
end;
$$;

revoke all on function public.booking_date_hours(), public.admin_set_booking_date(date,jsonb),
  public.booking_slot_allowed(timestamptz,timestamptz),
  public.create_booking(uuid,uuid,text,timestamptz,timestamptz,text,text,text,text) from public, anon, authenticated;
grant execute on function public.booking_date_hours(), public.admin_set_booking_date(date,jsonb),
  public.booking_slot_allowed(timestamptz,timestamptz),
  public.create_booking(uuid,uuid,text,timestamptz,timestamptz,text,text,text,text) to service_role;

commit;
