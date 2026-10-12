create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  request_key uuid not null,
  fingerprint text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  instrument text not null check (instrument in ('soprano','alto','tenor','baritone','bassoon','other')),
  service text not null check (service in ('basic','standard','overhaul','assessment')),
  notes text not null default '' check (length(notes) <= 2000),
  locale text not null check (locale in ('en','ja','zh-CN','th')),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(),
  constraint bookings_customer_request_key unique (customer_id, request_key),
  constraint bookings_valid_duration check (end_at = start_at + interval '1 hour')
);

create unique index bookings_active_slot_unique
  on public.bookings (start_at)
  where status = 'confirmed';

alter table public.bookings enable row level security;
revoke all on public.bookings from public, anon, authenticated;
grant all on public.bookings to service_role;

create or replace function public.create_booking(
  p_customer_id uuid,
  p_request_key uuid,
  p_fingerprint text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_instrument text,
  p_service text,
  p_notes text,
  p_locale text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.bookings;
  created public.bookings;
  customer public.customers;
  booking_payload jsonb;
begin
  if p_request_key is null or p_fingerprint is null or length(p_fingerprint) <> 64
     or p_start_at is null or p_end_at is null or p_end_at <> p_start_at + interval '1 hour'
     or p_instrument not in ('soprano','alto','tenor','baritone','bassoon','other')
     or p_service not in ('basic','standard','overhaul','assessment')
     or length(coalesce(p_notes,'')) > 2000
     or p_locale not in ('en','ja','zh-CN','th') then
    raise exception 'invalid_booking' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text || ':' || p_request_key::text, 0));
  select * into existing
    from public.bookings
    where customer_id = p_customer_id and request_key = p_request_key
    for update;
  if found then
    if existing.fingerprint <> p_fingerprint then
      raise exception 'booking_request_key_conflict' using errcode = '23505', constraint = 'bookings_customer_request_key';
    end if;
    return jsonb_build_object(
      'id', existing.id, 'customerId', existing.customer_id, 'requestKey', existing.request_key,
      'fingerprint', existing.fingerprint, 'startAt', existing.start_at, 'endAt', existing.end_at,
      'instrument', existing.instrument, 'service', existing.service, 'notes', existing.notes,
      'locale', existing.locale, 'status', existing.status, 'createdAt', existing.created_at
    );
  end if;

  select * into customer from public.customers where id = p_customer_id;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;

  insert into public.bookings (
    customer_id, request_key, fingerprint, start_at, end_at, instrument, service, notes, locale
  ) values (
    p_customer_id, p_request_key, p_fingerprint, p_start_at, p_end_at,
    p_instrument, p_service, btrim(coalesce(p_notes,'')), p_locale
  ) returning * into created;

  booking_payload := jsonb_build_object(
    'bookingId', created.id,
    'startAt', created.start_at,
    'endAt', created.end_at,
    'timeZone', 'Asia/Bangkok',
    'customer', jsonb_build_object('name', customer.name, 'email', customer.email, 'phone', customer.phone),
    'instrument', created.instrument,
    'service', created.service,
    'notes', created.notes,
    'locale', created.locale,
    'recipient', customer.email
  );
  insert into public.outbox(topic, dedupe_key, payload)
  values
    ('booking_google', 'booking:' || created.id || ':google', booking_payload),
    ('booking_buyer', 'booking:' || created.id || ':buyer', booking_payload),
    ('booking_seller', 'booking:' || created.id || ':seller', booking_payload)
  on conflict (dedupe_key) do nothing;

  return jsonb_build_object(
    'id', created.id, 'customerId', created.customer_id, 'requestKey', created.request_key,
    'fingerprint', created.fingerprint, 'startAt', created.start_at, 'endAt', created.end_at,
    'instrument', created.instrument, 'service', created.service, 'notes', created.notes,
    'locale', created.locale, 'status', created.status, 'createdAt', created.created_at
  );
end;
$$;

revoke all on function public.create_booking(uuid,uuid,text,timestamptz,timestamptz,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_booking(uuid,uuid,text,timestamptz,timestamptz,text,text,text,text)
  to service_role;
