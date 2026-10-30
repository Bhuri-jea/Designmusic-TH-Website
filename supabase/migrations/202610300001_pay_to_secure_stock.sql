begin;

-- Preserve the existing held-session implementation for sessions opened before
-- this migration and for the rollback-safe SQL fixtures that omit stockPolicy.
alter function public.reserve_order(uuid,uuid,text,text,jsonb,bigint,text,jsonb)
  rename to reserve_order_with_hold;

create function public.reserve_order(
  p_customer_id uuid,p_request_key uuid,p_fingerprint text,p_currency text,
  p_lines jsonb,p_amount_total bigint,p_locale text,p_checkout_parameters jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; reservation public.stock_reservations;
begin
  result:=public.reserve_order_with_hold(p_customer_id,p_request_key,p_fingerprint,
    p_currency,p_lines,p_amount_total,p_locale,p_checkout_parameters);
  if p_checkout_parameters->>'stockPolicy' is distinct from 'pay_to_secure' then
    return result;
  end if;
  if result->'checkoutParameters'->>'stockPolicy' is distinct from 'pay_to_secure' then
    raise exception 'stock_policy_conflict' using errcode='23514';
  end if;
  -- Both operations occur in the same transaction. Other sessions never see
  -- the temporary hold created by the validated legacy order constructor.
  for reservation in select * from public.stock_reservations
    where order_id=(result->>'id')::uuid and status='reserved' order by sku for update loop
    update public.inventory set reserved=reserved-reservation.quantity,updated_at=now()
      where sku=reservation.sku;
    delete from public.stock_reservations
      where order_id=reservation.order_id and sku=reservation.sku;
  end loop;
  return result;
end $$;

-- The outer function is the public service-role RPC. Keep the old base event
-- handler for held orders and for successful paid allocation after creating an
-- ephemeral reservation inside this same transaction.
create or replace function public.apply_stripe_event(
  p_event_id text,p_event_type text,p_order_id uuid,p_session_id text,
  p_currency text,p_amount_total bigint,p_payment_status text,
  p_shipping jsonb,p_event_created timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; line record; inv public.inventory; shortage boolean:=false;
        paid_event boolean; prior_event public.stripe_events; applied jsonb;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.checkout_parameters->>'stockPolicy' is distinct from 'pay_to_secure' then
    perform public.apply_stripe_event_before_refunds(p_event_id,p_event_type,p_order_id,
      p_session_id,p_currency,p_amount_total,p_payment_status,p_shipping,p_event_created);
  else
    paid_event:=p_event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded')
      and p_payment_status='paid';
    if paid_event and o.status in ('pending','failed','expired') then
      if p_event_id is null or btrim(p_event_id)='' or p_event_created is null
        or o.checkout_session_id is null or o.checkout_session_id is distinct from p_session_id
        or o.currency is distinct from p_currency or o.amount_total is distinct from p_amount_total then
        raise exception 'payment_metadata_mismatch' using errcode='23514',constraint='orders_payment_metadata';
      end if;
      select * into prior_event from public.stripe_events where event_id=p_event_id;
      if found then
        if prior_event.order_id is distinct from p_order_id then
          raise exception 'payment_event_conflict' using errcode='23514';
        end if;
        return public.order_record(p_order_id);
      end if;
      if o.status='expired' then shortage:=true; end if;
      for line in select sku,quantity from public.order_items where order_id=o.id order by sku loop
        select * into inv from public.inventory where sku=line.sku for update;
        if not found or inv.on_hand-inv.reserved<line.quantity
          or inv.lifecycle<>'active' or inv.product_lifecycle<>'published'
          or inv.sales_mode<>'checkout' then
          shortage:=true;
        end if;
      end loop;
      if shortage then
        insert into public.stripe_events(event_id,event_type,order_id,event_created)
          values(p_event_id,p_event_type,p_order_id,p_event_created) on conflict do nothing;
        if not found then raise exception 'payment_event_conflict' using errcode='23514'; end if;
        update public.orders set status='review',checkout_url=null,
          cancellation_status='review',
          cancellation_reason='Payment received, but ordered stock is unavailable. Seller review and refund required.',
          shipping_snapshot=p_shipping,paid_at=p_event_created,
          paid_at_estimated=p_event_id like 'reconcile:%' where id=o.id;
        insert into public.shipments(order_id,recipient,address,status,hold,hold_reason)
          values(o.id,coalesce(p_shipping->'recipient','{}'::jsonb),
            coalesce(p_shipping->'address','{}'::jsonb),'needs_address',true,
            'Payment received but stock allocation failed; review and refund')
          on conflict(order_id) do update set hold=true,
            hold_reason='Payment received but stock allocation failed; review and refund';
        insert into public.outbox(topic,dedupe_key,status,payload,last_error)
          values('checkout_review','checkout:'||o.id||':paid-stock','review',
            jsonb_build_object('orderId',o.id,'reason','Payment received but ordered stock was unavailable. Review and refund.'),
            'paid_stock_unavailable') on conflict(dedupe_key) do nothing;
        insert into public.outbox(topic,dedupe_key,payload)
          select topic,'order:'||o.id||':stock-review:'||audience,
            jsonb_build_object('orderId',o.id,'recipient',case when audience='buyer'
              then o.checkout_parameters->>'customerEmail' else null end,
              'locale',o.locale,'currency',o.currency,'amountTotal',o.amount_total,
              'items',public.order_record(o.id)->'items','stockReview',true)
          from (values ('order_paid_buyer','buyer'),('order_paid_seller','seller')) as notice(topic,audience)
          on conflict(dedupe_key) do nothing;
      else
        for line in select sku,quantity from public.order_items where order_id=o.id order by sku loop
          update public.inventory set reserved=reserved+line.quantity,updated_at=now() where sku=line.sku;
          insert into public.stock_reservations(order_id,sku,quantity)
            values(o.id,line.sku,line.quantity);
        end loop;
        applied:=public.apply_stripe_event_before_refunds(p_event_id,p_event_type,p_order_id,
          p_session_id,p_currency,p_amount_total,p_payment_status,p_shipping,p_event_created);
        if applied->>'duplicate'='true' then
          raise exception 'payment_event_conflict' using errcode='23514';
        end if;
      end if;
    else
      perform public.apply_stripe_event_before_refunds(p_event_id,p_event_type,p_order_id,
        p_session_id,p_currency,p_amount_total,p_payment_status,p_shipping,p_event_created);
    end if;
  end if;
  update public.orders set paid_at=p_event_created,paid_at_estimated=p_event_id like 'reconcile:%'
    where id=p_order_id and status='paid'
      and (paid_at is null or paid_at_estimated and p_event_id not like 'reconcile:%');
  return public.order_record(p_order_id);
end $$;

-- Paid stock reviews can be cancelled and refunded by the same verified Stripe
-- flow as ordinary paid orders. There are no units to restock in this state.
create or replace function public.begin_order_cancellation(
  p_order_id uuid,p_reason text,p_restock jsonb,p_actor text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;s public.shipments;c public.order_cancellations;r record;qty integer;
begin
 if coalesce(btrim(p_reason),'')='' or length(p_reason)>1000 or coalesce(btrim(p_actor),'')=''
   or jsonb_typeof(p_restock)<>'object' or p_restock is null then
   raise exception 'invalid_cancellation' using errcode='22023';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'order_not_found' using errcode='P0002';end if;
 select * into c from public.order_cancellations where order_id=p_order_id;
 if found then
  if c.reason<>btrim(p_reason) or c.restock<>p_restock then
    raise exception 'cancellation_changed' using errcode='23514';end if;
  return to_jsonb(c)||jsonb_build_object('order',public.order_record(p_order_id));
 end if;
 select * into s from public.shipments where order_id=p_order_id for update;
 if s.status='shipped' or not (
   o.status in ('paid','pending','failed') and o.cancellation_status='none'
   or o.status='review' and o.paid_at is not null and o.cancellation_status='review'
 ) then raise exception 'order_not_cancellable' using errcode='23514';end if;
 for r in select key,value from jsonb_each(p_restock) loop
  if r.value::text !~ '^[0-9]+$' then raise exception 'invalid_restock' using errcode='22023';end if;
  select quantity into qty from public.order_items where order_id=p_order_id and sku=r.key;
  if qty is null or (r.value::text)::integer>qty then raise exception 'invalid_restock' using errcode='22023';end if;
  if (o.status<>'paid' and (r.value::text)::integer>0) then
    raise exception 'invalid_restock' using errcode='22023';end if;
 end loop;
 insert into public.order_cancellations(order_id,reason,restock,actor)
   values(p_order_id,btrim(p_reason),p_restock,p_actor) returning * into c;
 update public.orders set cancellation_status='requested',cancellation_reason=btrim(p_reason) where id=p_order_id;
 update public.shipments set hold=true,hold_reason=btrim(p_reason) where order_id=p_order_id;
 return to_jsonb(c)||jsonb_build_object('order',public.order_record(p_order_id));
end $$;

revoke all on function public.reserve_order(uuid,uuid,text,text,jsonb,bigint,text,jsonb),
  public.reserve_order_with_hold(uuid,uuid,text,text,jsonb,bigint,text,jsonb),
  public.apply_stripe_event(text,text,uuid,text,text,bigint,text,jsonb,timestamptz),
  public.begin_order_cancellation(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.reserve_order(uuid,uuid,text,text,jsonb,bigint,text,jsonb),
  public.apply_stripe_event(text,text,uuid,text,text,bigint,text,jsonb,timestamptz),
  public.begin_order_cancellation(uuid,text,jsonb,text) to service_role;

commit;
