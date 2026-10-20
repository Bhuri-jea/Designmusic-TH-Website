create or replace function public.admin_shipping_record(p_order_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'order_id',o.id,'payment_status',o.status,'status',s.status,
  'recipient',s.recipient,'address',s.address,'tracking_number',s.tracking_number,
  'hold',s.hold,'hold_reason',s.hold_reason,
  'hold_history',coalesce((select jsonb_agg(jsonb_build_object(
    'hold',e.hold,'reason',e.reason,'actor',e.actor,'created_at',e.created_at
  ) order by e.created_at desc,e.id desc) from public.shipment_hold_events e
    where e.order_id=o.id),'[]'::jsonb),
  'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.name,'sku',i.sku,
    'options',i.options,'quantity',i.quantity) order by i.sku)
    from public.order_items i where i.order_id=o.id),'[]'::jsonb))
 from public.orders o join public.shipments s on s.order_id=o.id where o.id=p_order_id
$$;
revoke all on function public.admin_shipping_record(uuid) from public,anon,authenticated;
grant execute on function public.admin_shipping_record(uuid) to service_role;
