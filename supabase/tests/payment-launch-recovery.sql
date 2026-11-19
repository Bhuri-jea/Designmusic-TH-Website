begin;
create function pg_temp.recovery_order(buyer uuid,paid boolean) returns uuid language plpgsql as $$
declare o jsonb;oid uuid;expiry timestamptz:=now()+interval '1 hour';
begin
 o:=public.reserve_order(buyer,gen_random_uuid(),repeat('a',64),'thb',
 '[{"sku":"endplug-plain","productId":"saxophone-end-plug","variant":"plain","options":{},"quantity":1,"name":"End plug","unitAmount":2500}]',2500,'th',
 jsonb_build_object('expiresAt',extract(epoch from expiry)::bigint,'shippingCountry','TH','fulfillmentMethod','pickup','shippingAmount',0,'estimatedWeightGrams',0,'stockPolicy','pay_to_secure'));
 oid:=(o->>'id')::uuid;
 perform public.attach_checkout_session(oid,'cs_recovery_'||replace(oid::text,'-',''),'https://checkout.stripe.com/c/test',expiry);
 if paid then perform public.apply_stripe_event('paid:'||oid,'checkout.session.completed',oid,'cs_recovery_'||replace(oid::text,'-',''),'thb',2500,'paid','{}',now());end if;
 perform public.link_order_payment(oid,'pi_'||replace(oid::text,'-',''));
 return oid;
end $$;
do $$
declare buyer uuid;oid uuid;op jsonb;before_stock integer;lines jsonb;params jsonb;
begin
 insert into public.customers(google_subject,email,name) values('launch-recovery-'||gen_random_uuid(),'recovery@example.test','Recovery') returning id into buyer;
 update public.inventory set on_hand=100,reserved=0,lifecycle='active',product_lifecycle='published',sales_mode='checkout',price_usd_minor=1500,price_jpy=2500,price_thb_minor=2500,weight_grams=100 where sku='endplug-plain';
 oid:=pg_temp.recovery_order(buyer,true);
 op:=public.begin_order_cancellation(oid,'Stale pending form','{"endplug-plain":0}','admin','pending');
 if op->>'restockReviewRequired' is distinct from 'true' or exists(select 1 from public.order_cancellations where order_id=oid) then raise exception 'stale pending form created cancellation against paid allocation';end if;
 perform public.record_order_refund('re_partial_'||replace(oid::text,'-',''),oid,'pi_'||replace(oid::text,'-',''),500,'thb','succeeded',now(),null);
 op:=public.begin_order_cancellation(oid,'Refund remainder','{"endplug-plain":1}','admin');
 perform public.prepare_order_refund(oid,2000,null,null);
 perform public.record_order_refund('re_remaining_'||replace(oid::text,'-',''),oid,'pi_'||replace(oid::text,'-',''),2000,'thb','succeeded',now(),(op->>'id')::uuid);
 if (select on_hand from public.inventory where sku='endplug-plain')<>100 then raise exception 'partial refund adoption did not restore stock exactly once';end if;
 -- A cancellation started before allocation must expose an explicit restock review.
 oid:=pg_temp.recovery_order(buyer,false);
 op:=public.begin_order_cancellation(oid,'Payment race','{"endplug-plain":0}','admin');
 perform public.apply_stripe_event('paid:'||oid,'checkout.session.completed',oid,'cs_recovery_'||replace(oid::text,'-',''),'thb',2500,'paid','{}',now());
 begin
  perform public.prepare_order_refund(oid,2500,2500,0);
  raise exception 'unreviewed late allocation can refund';
 exception when check_violation then null;end;
 if exists(select 1 from jsonb_array_elements(public.recoverable_order_cancellations()) c where c->>'order_id'=oid::text) then raise exception 'cron can bypass restock review';end if;
 perform public.record_order_refund('re_race_partial_'||replace(oid::text,'-',''),oid,'pi_'||replace(oid::text,'-',''),500,'thb','succeeded',now(),null);
 op:=public.begin_order_cancellation(oid,'Payment race','{"endplug-plain":1}','admin');
 perform public.prepare_order_refund(oid,2000,null,null);
 perform public.record_order_refund('re_race_'||replace(oid::text,'-',''),oid,'pi_'||replace(oid::text,'-',''),2000,'thb','succeeded',now(),(op->>'id')::uuid);
 if (select on_hand from public.inventory where sku='endplug-plain')<>100 then raise exception 'reviewed late allocation did not restore stock';end if;
 begin
  perform public.begin_order_cancellation(oid,'Payment race','{"endplug-plain":0}','admin');
  raise exception 'prepared cancellation restock changed';
 exception when check_violation then null;end;
 perform public.mark_order_reconciliation_attempt(oid);
 if (select reconciliation_checked_at from public.orders where id=oid) is null then raise exception 'reconciliation attempt was not persisted';end if;
 if has_function_privilege('authenticated','public.mark_order_reconciliation_attempt(uuid)','execute') then raise exception 'customer may change reconciliation scheduling';end if;
 -- Exercise the real preserved constructor and quote-table constraint at 20 SKUs.
 insert into public.inventory(sku,on_hand,reserved) select 'launch-limit-'||i,1,0 from generate_series(1,20) i;
 select jsonb_agg(jsonb_build_object('sku','launch-limit-'||i,'productId','limit','variant','launch-limit-'||i,'options','{}'::jsonb,'quantity',1,'name','Limit item','unitAmount',1)) into lines from generate_series(1,20) i;
 params:=jsonb_build_object('expiresAt',extract(epoch from now()+interval '1 hour')::bigint,'shippingCountry','TH','fulfillmentMethod','pickup','shippingAmount',0,'estimatedWeightGrams',0,'stockPolicy','pay_to_secure');
 op:=public.reserve_order(buyer,gen_random_uuid(),repeat('b',64),'thb',lines,20,'th',params);
 if jsonb_array_length(op->'items')<>20 then raise exception 'twenty-line order rejected';end if;
 op:=public.create_shipping_quote(buyer,gen_random_uuid(),repeat('c',64),repeat('d',64),'thb','th',lines,20,3000,'TH','{"country":"TH","line1":"Test","city":"Bangkok","postal_code":"10120"}','{"name":"Recovery"}');
 if jsonb_array_length(op->'items')<>20 then raise exception 'twenty-line quote rejected';end if;
end $$;
rollback;
