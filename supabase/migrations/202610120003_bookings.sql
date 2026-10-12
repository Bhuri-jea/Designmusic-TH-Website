create table if not exists public.bookings (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customers(id),
 request_key uuid not null,
 fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
 start_at timestamptz not null,
 end_at timestamptz not null check (end_at = start_at + interval '1 hour'),
 instrument text not null check (instrument in ('soprano','alto','tenor','baritone','bassoon','other')),
 service text not null check (service in ('basic','standard','overhaul','assessment')),
 notes text not null default '' check (length(notes)<=2000),
 locale text not null default 'en' check (locale in ('en','ja','zh-CN','th')),
 customer_snapshot jsonb not null,
 status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
 created_at timestamptz not null default now(),
 constraint bookings_customer_request_key unique(customer_id,request_key),
 constraint bookings_bassoon_service check (not (instrument='bassoon' and service='basic'))
);
create unique index if not exists bookings_active_slot on public.bookings(start_at) where status='confirmed';
alter table public.bookings enable row level security;
revoke all on table public.bookings from public, anon, authenticated;
grant all on table public.bookings to service_role;

create or replace function public.booking_record(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'customerId',customer_id,'requestKey',request_key,'fingerprint',fingerprint,
 'startAt',start_at,'endAt',end_at,'instrument',instrument,'service',service,'notes',notes,'locale',locale,
 'status',status,'createdAt',created_at) from public.bookings where id=p_id;
$$;

create or replace function public.create_booking(p_customer_id uuid,p_request_key uuid,p_fingerprint text,
 p_start_at timestamptz,p_end_at timestamptz,p_instrument text,p_service text,p_notes text,p_locale text default 'en')
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.bookings; created public.bookings; customer public.customers; local_start timestamp; local_today date; snapshot jsonb;
begin
 if p_customer_id is null or p_request_key is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' or
 p_start_at is null or not isfinite(p_start_at) or p_end_at is null or not isfinite(p_end_at) or p_end_at<>p_start_at+interval '1 hour' or
 p_instrument is null or p_instrument not in ('soprano','alto','tenor','baritone','bassoon','other') or
 p_service is null or p_service not in ('basic','standard','overhaul','assessment') or (p_instrument='bassoon' and p_service='basic') or
 p_notes is null or length(p_notes)>2000 or translate(p_notes,chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]' or
 p_locale is null or p_locale not in ('en','ja','zh-CN','th') then
 raise exception 'invalid_booking' using errcode='22023'; end if;
 -- Identical retries retain the original contact/locale snapshot even after the booking date or profile changes.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer_id::text||':'||p_request_key::text,0));
 select * into existing from public.bookings where customer_id=p_customer_id and request_key=p_request_key for update;
 if found then
   if existing.fingerprint<>p_fingerprint or existing.start_at<>p_start_at or existing.end_at<>p_end_at or
   existing.instrument<>p_instrument or existing.service<>p_service or existing.notes<>p_notes or existing.locale<>p_locale then
     raise exception 'booking_request_key_conflict' using errcode='23505',constraint='bookings_customer_request_key';
   end if;
   return public.booking_record(existing.id);
 end if;
 local_start := p_start_at at time zone 'Asia/Bangkok';
 local_today := (now() at time zone 'Asia/Bangkok')::date;
 if local_start::date<local_today+1 or local_start::date>local_today+14 or extract(dow from local_start)=0 or
 extract(hour from local_start) not in (10,11,13,14,15,16,17) or date_trunc('hour',local_start)<>local_start then
 raise exception 'invalid_booking_slot' using errcode='22023'; end if;
 select * into customer from public.customers where id=p_customer_id for share;
 if not found then raise exception 'customer_not_found' using errcode='P0002'; end if;
 snapshot := jsonb_build_object('name',customer.name,'email',customer.email,'phone',customer.phone);
 insert into public.bookings(customer_id,request_key,fingerprint,start_at,end_at,instrument,service,notes,locale,customer_snapshot)
 values(p_customer_id,p_request_key,p_fingerprint,p_start_at,p_end_at,p_instrument,p_service,p_notes,p_locale,snapshot) returning * into created;
 insert into public.outbox(topic,dedupe_key,payload)
 select topic,'booking:'||created.id||':'||audience,
 jsonb_build_object('bookingId',created.id,'startAt',created.start_at,'endAt',created.end_at,'timeZone','Asia/Bangkok',
 'customer',snapshot,'instrument',created.instrument,'service',created.service,'notes',created.notes,'locale',created.locale,
 'recipient',case when audience='buyer' then customer.email else null end)
 from (values ('booking_buyer','buyer'),('booking_seller','seller'),('booking_google','google')) as jobs(topic,audience);
 return public.booking_record(created.id);
end; $$;
revoke all on function public.booking_record(uuid),public.create_booking(uuid,uuid,text,timestamptz,timestamptz,text,text,text,text) from public,anon,authenticated;
grant execute on function public.booking_record(uuid),public.create_booking(uuid,uuid,text,timestamptz,timestamptz,text,text,text,text) to service_role;
