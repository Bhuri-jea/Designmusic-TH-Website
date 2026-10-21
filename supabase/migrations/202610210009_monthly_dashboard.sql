-- Revenue periods use Bangkok payment/refund dates. Frozen FX is a reference,
-- never a claim about net bank settlement or tax/accounting profit.
begin;
create or replace function public.admin_monthly_dashboard(p_month date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; period_start timestamptz; period_end timestamptz;
begin
 if p_month is null or extract(day from p_month)<>1 then raise exception 'invalid_month' using errcode='22023';end if;
 period_start := p_month::timestamp at time zone 'Asia/Bangkok';
 period_end := (p_month + interval '1 month')::timestamp at time zone 'Asia/Bangkok';
 with order_values as (
  select o.*,case when o.currency='thb' then 1::numeric
   when o.checkout_parameters->>'referenceThbRate' ~ '^[0-9]+([.][0-9]+)?$'
    then nullif((o.checkout_parameters->>'referenceThbRate')::numeric,0) else null end as fx,
   case when o.currency='jpy' then 1::numeric else 100::numeric end as scale
  from public.orders o
 ), payments as (
  select currency,count(*) as paid_orders,count(*) filter(where paid_at_estimated) as estimated_orders,
   sum(amount_total-shipping_minor) as merchandise_minor,sum(shipping_minor) as shipping_minor,
   count(*) filter(where fx is null) as missing_fx,
   sum((amount_total-shipping_minor)*fx/scale) as merchandise_thb,
   sum(shipping_minor*fx/scale) as shipping_thb
  from order_values where status='paid' and paid_at>=period_start and paid_at<period_end group by currency
 ), refunds as (
  select r.currency,count(distinct r.order_id) as refunded_orders,sum(r.amount) as refund_minor,
   sum(coalesce(r.merchandise_minor,0)) as merchandise_refund_minor,
   sum(coalesce(r.shipping_minor,0)) as shipping_refund_minor,
   count(*) filter(where r.merchandise_minor is null or r.shipping_minor is null) as unallocated_refunds,
   count(*) filter(where o.fx is null) as missing_fx,
   sum(coalesce(r.merchandise_minor,0)*o.fx/o.scale) as merchandise_thb,
   sum(coalesce(r.shipping_minor,0)*o.fx/o.scale) as shipping_thb,
   sum(r.amount*o.fx/o.scale) as refund_thb
  from public.order_refunds r join order_values o on o.id=r.order_id
  where r.status='succeeded' and r.created_at>=period_start and r.created_at<period_end group by r.currency
 )
 select jsonb_agg(jsonb_build_object(
  'currency',c.currency,'paidOrders',coalesce(p.paid_orders,0),'estimatedPaidDates',coalesce(p.estimated_orders,0),
  'unknownPaidDates',(select count(*) from order_values unknown_order where unknown_order.currency=c.currency and unknown_order.status='paid' and unknown_order.paid_at is null),
  'merchandiseGrossMinor',coalesce(p.merchandise_minor,0),
  'merchandiseNetMinor',coalesce(p.merchandise_minor,0)-coalesce(r.merchandise_refund_minor,0),
  'shippingCollectedMinor',coalesce(p.shipping_minor,0),'shippingRefundedMinor',coalesce(r.shipping_refund_minor,0),
  'refundMinor',coalesce(r.refund_minor,0),'refundedOrders',coalesce(r.refunded_orders,0),
  'unallocatedRefunds',coalesce(r.unallocated_refunds,0),'missingReferenceRates',coalesce(p.missing_fx,0)+coalesce(r.missing_fx,0),
  'merchandiseNetReferenceTHB',case when coalesce(p.missing_fx,0)+coalesce(r.missing_fx,0)=0 then round(coalesce(p.merchandise_thb,0)-coalesce(r.merchandise_thb,0),2) else null end,
  'shippingCollectedReferenceTHB',case when coalesce(p.missing_fx,0)=0 then round(coalesce(p.shipping_thb,0),2) else null end,
  'refundReferenceTHB',case when coalesce(r.missing_fx,0)=0 then round(coalesce(r.refund_thb,0),2) else null end
 ) order by c.currency) into result
 from (values('thb'),('usd'),('jpy')) c(currency)
 left join payments p on p.currency=c.currency left join refunds r on r.currency=c.currency;
 return coalesce(result,'[]'::jsonb);
end;$$;
revoke all on function public.admin_monthly_dashboard(date) from public,anon,authenticated;
grant execute on function public.admin_monthly_dashboard(date) to service_role;
commit;
