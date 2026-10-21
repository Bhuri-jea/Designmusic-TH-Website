begin;
-- Extend the 007 wrapper using its existing pre-refund projection; do not rename
-- it again or expose customer contact details through public order responses.
create or replace function public.admin_shipping_record(p_order_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select public.admin_shipping_record_before_refunds(p_order_id)||jsonb_build_object(
  'cancellation_status',o.cancellation_status,'cancellation_reason',o.cancellation_reason,
  'refunded_amount',public.order_record(o.id)->'refundedAmount','refund_status',public.order_record(o.id)->'refundStatus',
  'customerEmail',cu.email)
 from public.orders o join public.customers cu on cu.id=o.customer_id where o.id=p_order_id
$$;

create or replace function public.admin_cancellation_queue() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.order_record(o.id)||jsonb_build_object('cancellation',to_jsonb(c),'customerEmail',cu.email)
  order by o.created_at desc),'[]'::jsonb)
 from public.orders o join public.customers cu on cu.id=o.customer_id
 left join public.order_cancellations c on c.order_id=o.id
 where c.order_id is not null or o.cancellation_status<>'none'
  or (o.status in ('pending','failed','review') and o.expires_at>now()-interval '30 days')
$$;
revoke all on function public.admin_shipping_record(uuid),public.admin_cancellation_queue() from public,anon,authenticated;
grant execute on function public.admin_shipping_record(uuid),public.admin_cancellation_queue() to service_role;
commit;
