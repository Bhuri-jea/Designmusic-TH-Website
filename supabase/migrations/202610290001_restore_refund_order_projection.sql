begin;

-- An older order migration can replace the refund-aware projection if SQL files
-- are applied out of order. Keep the existing base projection and add the
-- current payment/cancellation fields back without changing any order data.
do $$
begin
  if to_regprocedure('public.order_record_before_refunds(uuid)') is null then
    raise exception 'order_record_before_refunds_missing';
  end if;
end $$;

create or replace function public.order_record(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.order_record_before_refunds(p_id) || jsonb_build_object(
    'paidAt', o.paid_at,
    'paidAtEstimated', o.paid_at_estimated,
    'paymentIntentId', o.payment_intent_id,
    'cancellationStatus', o.cancellation_status,
    'cancellationReason', o.cancellation_reason,
    'refundedAmount', coalesce((
      select sum(r.amount) from public.order_refunds r
      where r.order_id = o.id and r.status = 'succeeded'
    ), 0),
    'refundStatus', case
      when coalesce((
        select sum(r.amount) from public.order_refunds r
        where r.order_id = o.id and r.status = 'succeeded'
      ), 0) = o.amount_total then 'succeeded'
      when exists (
        select 1 from public.order_refunds r
        where r.order_id = o.id and r.status in ('pending', 'requires_action')
      ) then 'pending'
      when exists (
        select 1 from public.order_refunds r
        where r.order_id = o.id and r.status = 'failed'
      ) then 'failed'
      when exists (
        select 1 from public.order_refunds r
        where r.order_id = o.id and r.status = 'succeeded'
      ) then 'succeeded'
      else null
    end
  )
  from public.orders o where o.id = p_id
$$;

revoke all on function public.order_record(uuid) from public, anon, authenticated;
grant execute on function public.order_record(uuid) to service_role;

commit;
