begin;

do $$
declare buyer uuid; first_order jsonb; second_order jsonb; legacy_order jsonb;
        first_id uuid; second_id uuid; legacy_id uuid; expiry timestamptz;
        lines jsonb := '[{"sku":"endplug-plain","productId":"saxophone-end-plug","variant":"plain","options":{},"quantity":1,"name":"Saxophone End Plug","unitAmount":2500}]'::jsonb;
        params jsonb; result jsonb;
begin
  insert into public.customers(google_subject,email,name)
  values ('pay-stock-'||gen_random_uuid(),'pay-stock@example.test','Stock test') returning id into buyer;
  update public.inventory set on_hand=2,reserved=0 where sku='endplug-plain';
  expiry:=now()+interval '45 minutes';
  params:=jsonb_build_object('customerEmail','pay-stock@example.test','successUrl','https://example.test/success',
    'cancelUrl','https://example.test/cancel','allowedCountries',jsonb_build_array('TH'),
    'expiresAt',extract(epoch from expiry)::bigint,'shippingCountry','TH','fulfillmentMethod','pickup',
    'shippingAmount',0,'estimatedWeightGrams',100,'stockPolicy','pay_to_secure');

  first_order:=public.reserve_order(buyer,gen_random_uuid(),repeat('a',64),'thb',lines,2500,'th',params);
  first_id:=(first_order->>'id')::uuid;
  second_order:=public.reserve_order(buyer,gen_random_uuid(),repeat('b',64),'thb',lines,2500,'th',params);
  second_id:=(second_order->>'id')::uuid;
  if (select reserved from public.inventory where sku='endplug-plain')<>0
     or exists(select 1 from public.stock_reservations where order_id in (first_id,second_id)) then
    raise exception 'unpaid checkout held stock';
  end if;
  perform public.attach_checkout_session(first_id,'cs_stock_first','https://checkout.stripe.com/c/test',expiry);
  perform public.attach_checkout_session(second_id,'cs_stock_second','https://checkout.stripe.com/c/test',expiry);
  perform public.apply_stripe_event('evt_stock_first','checkout.session.completed',first_id,
    'cs_stock_first','thb',2500,'paid','{}'::jsonb,now());
  if (select on_hand from public.inventory where sku='endplug-plain')<>1
     or (select status from public.stock_reservations where order_id=first_id)<>'committed' then
    raise exception 'paid order did not allocate exactly one unit';
  end if;
  perform public.apply_stripe_event('evt_stock_first','checkout.session.completed',first_id,
    'cs_stock_first','thb',2500,'paid','{}'::jsonb,now());
  if (select on_hand from public.inventory where sku='endplug-plain')<>1 then
    raise exception 'duplicate event allocated stock twice';
  end if;

  -- A legacy session retains its hold. The second new-policy session can still
  -- receive payment, but no unit remains to allocate after the legacy hold.
  legacy_order:=public.reserve_order(buyer,gen_random_uuid(),repeat('c',64),'thb',lines,2500,'th',params-'stockPolicy');
  legacy_id:=(legacy_order->>'id')::uuid;
  if (select reserved from public.inventory where sku='endplug-plain')<>1 then
    raise exception 'legacy checkout lost its hold';
  end if;
  perform public.apply_stripe_event('evt_stock_second','checkout.session.completed',second_id,
    'cs_stock_second','thb',2500,'paid','{}'::jsonb,now());
  if (select status from public.orders where id=second_id)<>'review'
     or (select hold from public.shipments where order_id=second_id) is not true
     or (select on_hand from public.inventory where sku='endplug-plain')<>1 then
    raise exception 'oversold payment was not held for review';
  end if;
  result:=public.begin_order_cancellation(second_id,'Stock unavailable','{"endplug-plain":0}'::jsonb,'test-admin');
  if result->'order'->>'cancellationStatus'<>'requested' then
    raise exception 'oversold paid review cannot enter refund workflow';
  end if;
  perform public.link_order_payment(second_id,'pi_stock_second');
  perform public.prepare_order_refund(second_id,2500,2500,0);
  perform public.record_order_refund('re_stock_second',second_id,'pi_stock_second',2500,'thb',
    'succeeded',now(),(result->>'id')::uuid);
  if (select cancellation_status from public.orders where id=second_id)<>'cancelled'
    or (select on_hand from public.inventory where sku='endplug-plain')<>1 then
    raise exception 'oversold refund changed stock or did not close cancellation';
  end if;
  perform public.attach_checkout_session(legacy_id,'cs_stock_legacy','https://checkout.stripe.com/c/test',expiry);
  perform public.apply_stripe_event('evt_stock_legacy','checkout.session.expired',legacy_id,
    'cs_stock_legacy','thb',2500,'unpaid','{}'::jsonb,now());
  if (select reserved from public.inventory where sku='endplug-plain')<>0 then
    raise exception 'legacy expiry failed to release hold';
  end if;
  perform public.apply_stripe_event('evt_stock_second_exp','checkout.session.expired',second_id,
    'cs_stock_second','thb',2500,'unpaid','{}'::jsonb,now());
  if (select status from public.orders where id=second_id)<>'review' then
    raise exception 'late expiry hid paid review';
  end if;
end $$;

rollback;
