-- Preserve quote and payment history while exposing linked order/refund state.
-- Apply after 202610210010_refund_allocation.sql. Existing function grants remain intact.
create or replace function public.shipping_quote_record(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',q.id,'customerId',q.customer_id,'requestKey',q.request_key,'cartFingerprint',q.cart_fingerprint,
  'status',q.status,'currency',q.currency,'locale',q.locale,'items',q.items,
  'amountSubtotal',q.subtotal,'shippingAmount',q.shipping_amount,
  'amountTotal',case when q.shipping_amount is null then null else q.subtotal+q.shipping_amount end,
  'weightGrams',q.weight_grams,'country',q.country,'address',q.address,'recipient',q.recipient,
  'createdAt',q.created_at,'expiresAt',q.expires_at,'orderId',q.order_id,'orderStatus',o.status,
  'linkedOrderCancellationStatus',o.cancellation_status,
  'linkedOrderRefundStatus',public.order_record(o.id)->>'refundStatus',
  'linkedOrderRefundedAmount',public.order_record(o.id)->'refundedAmount',
  'sellerNote',q.seller_note,'version',q.version,
  'referenceThbRate',q.reference_thb_rate,'referenceFxDate',q.reference_fx_date,
  'shippingService',case when q.country='TH' then 'ems_local' else 'ems_world' end,
  'customerName',q.recipient->>'name','customerEmail',c.email)
 from public.shipping_quotes q join public.customers c on c.id=q.customer_id
 left join public.orders o on o.id=q.order_id where q.id=p_id
$$;
