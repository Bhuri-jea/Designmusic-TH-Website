begin;

-- Booking contact details are immutable snapshots supplied for this appointment.
-- Account email remains the buyer-notification destination and is not used as a
-- fallback for legacy rows.
drop function if exists public.create_booking(uuid,uuid,text,timestamptz,timestamptz,text,text,text,text);
create function public.create_booking(
 p_customer_id uuid, p_request_key uuid, p_fingerprint text,
 p_start_at timestamptz, p_end_at timestamptz, p_instrument text,
 p_service text, p_contact_name text, p_contact_information text,
 p_notes text, p_locale text default 'en'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.bookings; created public.bookings; customer public.customers; snapshot jsonb;
begin
 if p_customer_id is null or p_request_key is null or p_fingerprint !~ '^[0-9a-f]{64}$'
    or p_start_at is null or not isfinite(p_start_at) or p_end_at <> p_start_at + interval '1 hour'
    or p_instrument not in ('soprano','alto','tenor','baritone','bassoon','other')
    or p_service not in ('basic','standard','overhaul','assessment') or (p_instrument='bassoon' and p_service='basic')
    or p_contact_name is null or length(btrim(p_contact_name)) not between 1 and 120
    or translate(p_contact_name,chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]'
    or p_contact_information is null or length(btrim(p_contact_information)) not between 1 and 500
    or translate(p_contact_information,chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]'
    or p_notes is null or length(p_notes)>2000 or translate(p_notes,chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]'
    or p_locale not in ('en','ja','zh-CN','th') then raise exception 'invalid_booking' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer_id::text||':'||p_request_key::text,0));
 select * into existing from public.bookings where customer_id=p_customer_id and request_key=p_request_key for update;
 if found then
  if existing.fingerprint<>p_fingerprint then raise exception 'booking_request_key_conflict' using errcode='23505',constraint='bookings_customer_request_key'; end if;
  return public.booking_record(existing.id);
 end if;
 if not public.booking_slot_allowed(p_start_at,p_end_at) then raise exception 'invalid_booking_slot' using errcode='22023'; end if;
 select * into customer from public.customers where id=p_customer_id for share;
 if not found then raise exception 'customer_not_found' using errcode='P0002'; end if;
 snapshot:=jsonb_build_object('name',btrim(p_contact_name),'email',customer.email,'contactName',btrim(p_contact_name),'contactInformation',btrim(p_contact_information),'accountEmail',customer.email);
 insert into public.bookings(customer_id,request_key,fingerprint,start_at,end_at,instrument,service,notes,locale,customer_snapshot)
 values(p_customer_id,p_request_key,p_fingerprint,p_start_at,p_end_at,p_instrument,p_service,p_notes,p_locale,snapshot) returning * into created;
 insert into public.outbox(topic,dedupe_key,payload)
 select topic,'booking:'||created.id||':'||audience,
  jsonb_build_object('bookingId',created.id,'startAt',created.start_at,'endAt',created.end_at,'timeZone','Asia/Bangkok','customer',snapshot,
   'instrument',created.instrument,'service',created.service,'notes',created.notes,'locale',created.locale,
   'recipient',case when audience='buyer' then customer.email else null end)
 from (values ('booking_buyer','buyer'),('booking_seller','seller'),('booking_google','google')) jobs(topic,audience)
 on conflict(dedupe_key) do nothing;
 return public.booking_record(created.id);
end; $$;
revoke all on function public.create_booking(uuid,uuid,text,timestamptz,timestamptz,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_booking(uuid,uuid,text,timestamptz,timestamptz,text,text,text,text,text,text) to service_role;

commit;
