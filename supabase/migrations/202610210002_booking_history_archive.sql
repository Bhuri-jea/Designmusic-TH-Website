alter table public.bookings
  add column if not exists archived_at timestamptz;

create index if not exists bookings_customer_history_idx
  on public.bookings (customer_id, created_at desc)
  where archived_at is null;

create or replace function public.archive_cancelled_booking(p_customer_id uuid, p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings;
begin
  if p_customer_id is null or p_booking_id is null then
    raise exception 'invalid_booking' using errcode = '22023';
  end if;

  select * into booking_row
    from public.bookings
   where id = p_booking_id
   for update;
  if not found or booking_row.customer_id <> p_customer_id then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  if booking_row.status <> 'cancelled' then
    raise exception 'booking_not_archivable' using errcode = '22023';
  end if;
  if booking_row.archived_at is null then
    update public.bookings set archived_at = now()
     where id = p_booking_id
     returning * into booking_row;
  end if;
  return jsonb_build_object(
    'id', booking_row.id, 'customerId', booking_row.customer_id,
    'status', booking_row.status, 'archivedAt', booking_row.archived_at
  );
end;
$$;

revoke all on function public.archive_cancelled_booking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.archive_cancelled_booking(uuid, uuid) to service_role;
