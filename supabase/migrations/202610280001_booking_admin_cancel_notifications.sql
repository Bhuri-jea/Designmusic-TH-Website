begin;

alter table public.bookings
  add column cancelled_by text,
  add column cancellation_reason text,
  add column cancelled_at timestamptz,
  add column cancelled_by_subject text,
  add constraint bookings_cancelled_by_check check (cancelled_by is null or cancelled_by in ('customer', 'admin')),
  add constraint bookings_cancellation_reason_check check (cancellation_reason is null or length(cancellation_reason) <= 500);

create or replace function public.booking_record(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'id', id, 'customerId', customer_id, 'requestKey', request_key, 'fingerprint', fingerprint,
  'startAt', start_at, 'endAt', end_at, 'instrument', instrument, 'service', service,
  'notes', notes, 'locale', locale, 'status', status, 'createdAt', created_at,
  'cancelledBy', cancelled_by, 'cancellationReason', cancellation_reason
 ) from public.bookings where id = p_id;
$$;

-- All three messages are written atomically with the booking change. Retries use
-- distinct dedupe keys; a repeated mutation cannot send another notification.
create function public.enqueue_booking_change(
 p_booking public.bookings, p_customer public.customers, p_event text,
 p_dedupe text, p_previous_start timestamptz default null
) returns void language plpgsql security definer set search_path = '' as $$
declare snapshot jsonb;
begin
 if p_event not in ('rescheduled', 'cancelled') or p_dedupe is null then
  raise exception 'invalid_booking_event' using errcode = '22023';
 end if;
 snapshot := coalesce(p_booking.customer_snapshot, '{}'::jsonb);
 insert into public.outbox(topic, dedupe_key, payload)
 select job.topic, p_dedupe || ':' || job.audience,
  jsonb_build_object(
   'bookingId', p_booking.id, 'startAt', p_booking.start_at, 'endAt', p_booking.end_at,
   'previousStartAt', p_previous_start, 'timeZone', 'Asia/Bangkok',
   'customer', snapshot, 'instrument', p_booking.instrument, 'service', p_booking.service,
   'notes', p_booking.notes, 'locale', p_booking.locale, 'status', p_booking.status,
   'version', p_booking.version, 'event', p_event,
   'cancelledBy', p_booking.cancelled_by, 'cancellationReason', p_booking.cancellation_reason,
   'recipient', case when job.audience = 'buyer' then p_customer.email else null end
  )
 from (values ('booking_buyer','buyer'), ('booking_seller','seller'), ('booking_google','google')) job(topic,audience)
 on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function public.reschedule_booking(
 p_customer_id uuid, p_booking_id uuid, p_change_key uuid,
 p_start_at timestamptz, p_end_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking_row public.bookings; customer_row public.customers; previous_start timestamptz;
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
  return public.booking_record(p_booking_id);
 end if;
 if booking_row.status <> 'confirmed' or booking_row.start_at <= now() then
  raise exception 'booking_not_modifiable' using errcode = '23514';
 end if;
 if not public.booking_slot_allowed(p_start_at, p_end_at) then
  raise exception 'invalid_booking_slot' using errcode = '22023';
 end if;
 if booking_row.start_at = p_start_at then return public.booking_record(p_booking_id); end if;
 select * into customer_row from public.customers where id = p_customer_id for share;
 if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
 previous_start := booking_row.start_at;
 update public.bookings
 set start_at = p_start_at, end_at = p_end_at, last_change_key = p_change_key, version = version + 1
 where id = p_booking_id returning * into booking_row;
 perform public.enqueue_booking_change(
  booking_row, customer_row, 'rescheduled',
  'booking:' || booking_row.id || ':change:' || p_change_key, previous_start
 );
 return public.booking_record(p_booking_id);
end;
$$;

create or replace function public.cancel_booking(p_customer_id uuid, p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking_row public.bookings; customer_row public.customers;
begin
 if p_customer_id is null or p_booking_id is null then
  raise exception 'invalid_booking' using errcode = '22023';
 end if;
 select * into booking_row from public.bookings where id = p_booking_id for update;
 if not found or booking_row.customer_id <> p_customer_id then
  raise exception 'booking_not_found' using errcode = 'P0002';
 end if;
 if booking_row.status = 'cancelled' then return public.booking_record(p_booking_id); end if;
 if booking_row.status <> 'confirmed' or booking_row.start_at <= now() then
  raise exception 'booking_not_modifiable' using errcode = '23514';
 end if;
 select * into customer_row from public.customers where id = p_customer_id for share;
 if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
 update public.bookings
 set status = 'cancelled', cancelled_by = 'customer', cancellation_reason = null,
     cancelled_at = now(), version = version + 1
 where id = p_booking_id returning * into booking_row;
 perform public.enqueue_booking_change(
  booking_row, customer_row, 'cancelled', 'booking:' || booking_row.id || ':cancel'
 );
 return public.booking_record(p_booking_id);
end;
$$;

create function public.admin_cancel_booking(p_booking_id uuid, p_reason text, p_actor text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking_row public.bookings; customer_row public.customers;
begin
 if p_booking_id is null or p_reason is null or length(btrim(p_reason)) not between 1 and 500
    or translate(p_reason, chr(9)||chr(10)||chr(13), '') ~ '[[:cntrl:]]'
    or p_actor is null or length(btrim(p_actor)) not between 1 and 255 then
  raise exception 'invalid_booking' using errcode = '22023';
 end if;
 select * into booking_row from public.bookings where id = p_booking_id for update;
 if not found then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
 if booking_row.status = 'cancelled' then return public.booking_record(p_booking_id); end if;
 if booking_row.status <> 'confirmed' or booking_row.start_at <= now() then
  raise exception 'booking_not_modifiable' using errcode = '23514';
 end if;
 select * into customer_row from public.customers where id = booking_row.customer_id for share;
 if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
 update public.bookings
 set status = 'cancelled', cancelled_by = 'admin', cancellation_reason = btrim(p_reason),
     cancelled_at = now(), cancelled_by_subject = btrim(p_actor), version = version + 1
 where id = p_booking_id returning * into booking_row;
 perform public.enqueue_booking_change(
  booking_row, customer_row, 'cancelled', 'booking:' || booking_row.id || ':cancel'
 );
 return public.booking_record(p_booking_id);
end;
$$;

revoke all on function public.booking_record(uuid),
 public.enqueue_booking_change(public.bookings,public.customers,text,text,timestamptz),
 public.reschedule_booking(uuid,uuid,uuid,timestamptz,timestamptz),
 public.cancel_booking(uuid,uuid),
 public.admin_cancel_booking(uuid,text,text) from public, anon, authenticated;
grant execute on function public.booking_record(uuid),
 public.reschedule_booking(uuid,uuid,uuid,timestamptz,timestamptz),
 public.cancel_booking(uuid,uuid),
 public.admin_cancel_booking(uuid,text,text) to service_role;

commit;
