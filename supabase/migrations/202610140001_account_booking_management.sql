alter table public.customers
  add column if not exists shipping_address jsonb;

alter table public.bookings
  add column if not exists version integer not null default 1,
  add column if not exists last_change_key uuid;

create or replace function public.update_customer_profile(
  p_customer_id uuid,
  p_name text,
  p_phone text,
  p_shipping_address jsonb
) returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_row public.customers;
begin
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) > 120
     or length(coalesce(p_phone, '')) > 40 then
    raise exception 'invalid_profile' using errcode = '22023';
  end if;
  if p_shipping_address is not null and (
    jsonb_typeof(p_shipping_address) <> 'object'
    or (p_shipping_address - array['line1','line2','city','state','postal_code','country']) <> '{}'::jsonb
    or jsonb_typeof(p_shipping_address->'line1') is distinct from 'string'
    or jsonb_typeof(p_shipping_address->'city') is distinct from 'string'
    or jsonb_typeof(p_shipping_address->'postal_code') is distinct from 'string'
    or jsonb_typeof(p_shipping_address->'country') is distinct from 'string'
    or (p_shipping_address ? 'line2' and jsonb_typeof(p_shipping_address->'line2') is distinct from 'string')
    or (p_shipping_address ? 'state' and jsonb_typeof(p_shipping_address->'state') is distinct from 'string')
    or nullif(btrim(p_shipping_address->>'line1'), '') is null
    or length(p_shipping_address->>'line1') > 200
    or nullif(btrim(p_shipping_address->>'city'), '') is null
    or length(p_shipping_address->>'city') > 120
    or nullif(btrim(p_shipping_address->>'postal_code'), '') is null
    or length(p_shipping_address->>'postal_code') > 32
    or not coalesce(p_shipping_address->>'country' ~ '^[A-Z]{2}$', false)
    or length(coalesce(p_shipping_address->>'line2', '')) > 200
    or length(coalesce(p_shipping_address->>'state', '')) > 120
    or exists (
      select 1
      from jsonb_each_text(
        case when jsonb_typeof(p_shipping_address) = 'object' then p_shipping_address else '{}'::jsonb end
      ) as field(key, value)
      where field.value ~ '[[:cntrl:]]'
    )
  ) then
    raise exception 'invalid_shipping_address' using errcode = '22023';
  end if;

  update public.customers
     set name = btrim(p_name),
         phone = nullif(btrim(p_phone), ''),
         shipping_address = p_shipping_address,
         updated_at = now()
   where id = p_customer_id
  returning * into customer_row;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
  return customer_row;
end;
$$;

create or replace function public.reschedule_booking(
  p_customer_id uuid,
  p_booking_id uuid,
  p_change_key uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings;
  customer_row public.customers;
  local_start timestamp;
  local_today date;
  next_version integer;
begin
  if p_customer_id is null or p_booking_id is null or p_change_key is null
     or p_start_at is null or not isfinite(p_start_at)
     or p_end_at is null or not isfinite(p_end_at)
     or p_end_at <> p_start_at + interval '1 hour' then
    raise exception 'invalid_booking' using errcode = '22023';
  end if;

  select * into booking_row from public.bookings where id = p_booking_id for update;
  if not found or booking_row.customer_id <> p_customer_id then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  if booking_row.last_change_key = p_change_key then
    if booking_row.start_at <> p_start_at or booking_row.end_at <> p_end_at then
      raise exception 'booking_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'id', booking_row.id, 'customerId', booking_row.customer_id, 'requestKey', booking_row.request_key,
      'fingerprint', booking_row.fingerprint, 'startAt', booking_row.start_at, 'endAt', booking_row.end_at,
      'instrument', booking_row.instrument, 'service', booking_row.service, 'notes', booking_row.notes,
      'locale', booking_row.locale, 'status', booking_row.status, 'createdAt', booking_row.created_at
    );
  end if;
  if booking_row.status <> 'confirmed' or booking_row.start_at <= now() then
    raise exception 'booking_not_modifiable' using errcode = '22023';
  end if;

  local_start := p_start_at at time zone 'Asia/Bangkok';
  local_today := (now() at time zone 'Asia/Bangkok')::date;
  if local_start::date < local_today + 1 or local_start::date > local_today + 14
     or extract(dow from local_start) = 0
     or extract(hour from local_start) not in (10,11,13,14,15,16,17)
     or date_trunc('hour', local_start) <> local_start then
    raise exception 'invalid_booking_slot' using errcode = '22023';
  end if;
  if booking_row.start_at = p_start_at then
    return jsonb_build_object(
      'id', booking_row.id, 'customerId', booking_row.customer_id, 'requestKey', booking_row.request_key,
      'fingerprint', booking_row.fingerprint, 'startAt', booking_row.start_at, 'endAt', booking_row.end_at,
      'instrument', booking_row.instrument, 'service', booking_row.service, 'notes', booking_row.notes,
      'locale', booking_row.locale, 'status', booking_row.status, 'createdAt', booking_row.created_at
    );
  end if;

  select * into customer_row from public.customers where id = p_customer_id for share;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
  next_version := booking_row.version + 1;
  update public.bookings
     set start_at = p_start_at, end_at = p_end_at, last_change_key = p_change_key, version = next_version
   where id = p_booking_id
  returning * into booking_row;

  insert into public.outbox(topic, dedupe_key, payload)
  values (
    'booking_google',
    'booking:' || booking_row.id || ':change:' || p_change_key,
    jsonb_build_object(
      'bookingId', booking_row.id, 'startAt', booking_row.start_at, 'endAt', booking_row.end_at,
      'timeZone', 'Asia/Bangkok', 'customer', jsonb_build_object(
        'name', customer_row.name, 'email', customer_row.email, 'phone', customer_row.phone
      ), 'instrument', booking_row.instrument, 'service', booking_row.service, 'notes', booking_row.notes,
      'locale', booking_row.locale, 'status', booking_row.status, 'version', next_version
    )
  );
  return jsonb_build_object(
    'id', booking_row.id, 'customerId', booking_row.customer_id, 'requestKey', booking_row.request_key,
    'fingerprint', booking_row.fingerprint, 'startAt', booking_row.start_at, 'endAt', booking_row.end_at,
    'instrument', booking_row.instrument, 'service', booking_row.service, 'notes', booking_row.notes,
    'locale', booking_row.locale, 'status', booking_row.status, 'createdAt', booking_row.created_at
  );
end;
$$;

create or replace function public.cancel_booking(p_customer_id uuid, p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings;
  customer_row public.customers;
  next_version integer;
begin
  if p_customer_id is null or p_booking_id is null then
    raise exception 'invalid_booking' using errcode = '22023';
  end if;

  select * into booking_row from public.bookings where id = p_booking_id for update;
  if not found or booking_row.customer_id <> p_customer_id then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  if booking_row.status = 'cancelled' then
    return jsonb_build_object(
      'id', booking_row.id, 'customerId', booking_row.customer_id, 'requestKey', booking_row.request_key,
      'fingerprint', booking_row.fingerprint, 'startAt', booking_row.start_at, 'endAt', booking_row.end_at,
      'instrument', booking_row.instrument, 'service', booking_row.service, 'notes', booking_row.notes,
      'locale', booking_row.locale, 'status', booking_row.status, 'createdAt', booking_row.created_at
    );
  end if;
  if booking_row.start_at <= now() then
    raise exception 'booking_not_modifiable' using errcode = '22023';
  end if;

  select * into customer_row from public.customers where id = p_customer_id for share;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
  next_version := booking_row.version + 1;
  update public.bookings
     set status = 'cancelled', version = next_version
   where id = p_booking_id
  returning * into booking_row;

  insert into public.outbox(topic, dedupe_key, payload)
  values (
    'booking_google',
    'booking:' || booking_row.id || ':cancel',
    jsonb_build_object(
      'bookingId', booking_row.id, 'startAt', booking_row.start_at, 'endAt', booking_row.end_at,
      'timeZone', 'Asia/Bangkok', 'customer', jsonb_build_object(
        'name', customer_row.name, 'email', customer_row.email, 'phone', customer_row.phone
      ), 'instrument', booking_row.instrument, 'service', booking_row.service, 'notes', booking_row.notes,
      'locale', booking_row.locale, 'status', booking_row.status, 'version', next_version
    )
  );
  return jsonb_build_object(
    'id', booking_row.id, 'customerId', booking_row.customer_id, 'requestKey', booking_row.request_key,
    'fingerprint', booking_row.fingerprint, 'startAt', booking_row.start_at, 'endAt', booking_row.end_at,
    'instrument', booking_row.instrument, 'service', booking_row.service, 'notes', booking_row.notes,
    'locale', booking_row.locale, 'status', booking_row.status, 'createdAt', booking_row.created_at
  );
end;
$$;

revoke all on function public.update_customer_profile(uuid,text,text,jsonb),
  public.reschedule_booking(uuid,uuid,uuid,timestamptz,timestamptz),
  public.cancel_booking(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.update_customer_profile(uuid,text,text,jsonb),
  public.reschedule_booking(uuid,uuid,uuid,timestamptz,timestamptz),
  public.cancel_booking(uuid,uuid)
  to service_role;
