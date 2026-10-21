\set ON_ERROR_STOP on
begin;
-- Fixtures live only inside this transaction; every order uses the real reservation/payment functions.
create function pg_temp.refund_paid_order(p_customer uuid,p_quantity integer default 2,p_paid boolean default true) returns uuid language plpgsql as $$
declare o jsonb; oid uuid; session_id text; expires timestamptz:=now()+interval '1 hour';
begin
 o:=public.reserve_order(p_customer,gen_random_uuid(),repeat('a',64),'thb',jsonb_build_array(jsonb_build_object(
 'sku','endplug-plain','productId','saxophone-end-plug','variant','plain','options','{}'::jsonb,'quantity',p_quantity,'name','End plug','unitAmount',2500)),p_quantity*2500,'th',jsonb_build_object(
 'expiresAt',extract(epoch from expires)::bigint,'shippingCountry','TH','fulfillmentMethod','pickup','shippingAmount',0,'estimatedWeightGrams',100));
 oid:=(o->>'id')::uuid;session_id:='cs_refund_test_'||replace(oid::text,'-','');
 perform public.attach_checkout_session(oid,session_id,'https://checkout.stripe.com/c/test',expires);
 if not p_paid then return oid;end if;
 perform public.apply_stripe_event('paid:'||oid,'checkout.session.completed',oid,session_id,'thb',p_quantity*2500,'paid',
 '{"recipient":{"name":"Refund buyer"},"address":{"line1":"1 Test","city":"Bangkok","postal_code":"10120","country":"TH"}}',now());
 perform public.link_order_payment(oid,'pi_'||replace(oid::text,'-',''));
 return oid;
end; $$;

do $$
declare buyer uuid; oid uuid; unpaid_id uuid; failed_id uuid; external_id uuid; op jsonb; operation uuid; before_stock integer; pi text; refund_id text;
begin
 insert into public.customers(google_subject,email,name) values('refund-sql-'||gen_random_uuid(),'refund@example.test','Refund buyer') returning id into buyer;
 update public.inventory set on_hand=200,reserved=0 where sku='endplug-plain';
 oid:=pg_temp.refund_paid_order(buyer);pi:='pi_'||replace(oid::text,'-','');refund_id:='re_'||replace(oid::text,'-','');
 if (select on_hand from public.inventory where sku='endplug-plain')<>198 then raise exception 'payment did not commit exact stock';end if;
 begin
  perform public.begin_order_cancellation(oid,'Invalid restock','{"endplug-plain":3}','test-admin');
  raise exception 'excess restock accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.begin_order_cancellation(oid,'Invalid SKU','{"endplug-custom":1}','test-admin');
  raise exception 'foreign SKU restock accepted';
 exception when invalid_parameter_value then null;end;
 op:=public.begin_order_cancellation(oid,'Buyer contacted shop','{"endplug-plain":2}','test-admin');operation:=(op->>'id')::uuid;
 perform public.prepare_order_refund(oid,5000,5000,0);
 perform public.record_order_refund(refund_id,oid,pi,5000,'thb','pending',now(),operation);
 if (select on_hand from public.inventory where sku='endplug-plain')<>198 then raise exception 'pending refund restocked goods';end if;
 begin
  perform public.admin_mark_shipped(oid,'PICKUP','pickup');raise exception 'cancelled shipment dispatched';
 exception when check_violation then null;end;
 begin
  perform public.admin_set_shipment_hold(oid,false,'Try release','test-admin');raise exception 'cancelled shipment release appeared successful';
 exception when check_violation then null;end;
 perform public.record_order_refund(refund_id,oid,pi,5000,'thb','succeeded',now(),operation);
 perform public.record_order_refund(refund_id,oid,pi,5000,'thb','succeeded',now(),operation);
 if (select on_hand from public.inventory where sku='endplug-plain')<>200 then raise exception 'refund stock not restored exactly once';end if;
 if (select cancellation_status from public.orders where id=oid)<>'cancelled' then raise exception 'refund did not finish cancellation';end if;
 if (select count(*) from public.outbox where dedupe_key like 'refund:'||refund_id||':succeeded:%')<>2 then raise exception 'duplicate refund email jobs';end if;
 perform public.record_order_refund(refund_id,oid,pi,5000,'thb','pending',now(),operation);
 if (select status from public.order_refunds where id=refund_id)<>'succeeded' then raise exception 'late pending event regressed success';end if;

 perform public.record_order_refund(refund_id,oid,pi,5000,'thb','failed',now(),operation);
 if (select status from public.order_refunds where id=refund_id)<>'succeeded' then raise exception 'late failed snapshot regressed successful refund';end if;
 if (select on_hand from public.inventory where sku='endplug-plain')<>200 then raise exception 'terminal status replay changed stock';end if;
 unpaid_id:=pg_temp.refund_paid_order(buyer,2,false);
 begin
  perform public.begin_order_cancellation(unpaid_id,'Unpaid cannot restock','{"endplug-plain":2}','test-admin');raise exception 'unpaid restock accepted';
 exception when invalid_parameter_value then null;end;
 perform public.begin_order_cancellation(unpaid_id,'Unpaid cancellation','{}','test-admin');
 perform public.apply_stripe_event('expire:'||unpaid_id,'checkout.session.expired',unpaid_id,'cs_refund_test_'||replace(unpaid_id::text,'-',''),'thb',5000,'unpaid',null,now());
 perform public.finish_unpaid_cancellation(unpaid_id);
 if (select on_hand from public.inventory where sku='endplug-plain')<>200 or (select reserved from public.inventory where sku='endplug-plain')<>0 then raise exception 'unpaid cancellation did not only release its hold';end if;

 failed_id:=pg_temp.refund_paid_order(buyer);select on_hand into before_stock from public.inventory where sku='endplug-plain';
 op:=public.begin_order_cancellation(failed_id,'Refund might fail','{"endplug-plain":2}','test-admin');operation:=(op->>'id')::uuid;
 perform public.prepare_order_refund(failed_id,5000,5000,0);
 perform public.record_order_refund('re_failed_'||replace(failed_id::text,'-',''),failed_id,'pi_'||replace(failed_id::text,'-',''),5000,'thb','failed',now(),operation);
 if (select on_hand from public.inventory where sku='endplug-plain')<>before_stock then raise exception 'failed refund restocked goods';end if;
 if (select cancellation_status from public.orders where id=failed_id)<>'review' then raise exception 'failed refund not flagged for review';end if;
 perform public.record_order_refund('re_recovered_'||replace(failed_id::text,'-',''),failed_id,'pi_'||replace(failed_id::text,'-',''),5000,'thb','succeeded',now(),null);
 if public.order_record(failed_id)->>'refundStatus'<>'succeeded' then raise exception 'old failed attempt hides completed refund';end if;

 external_id:=pg_temp.refund_paid_order(buyer);select on_hand into before_stock from public.inventory where sku='endplug-plain';
 perform public.record_order_refund('re_external_'||replace(external_id::text,'-',''),external_id,'pi_'||replace(external_id::text,'-',''),5000,'thb','succeeded',now(),null);
 if (select cancellation_status from public.orders where id=external_id)<>'cancelled' then raise exception 'external full refund not recorded';end if;
 if (select on_hand from public.inventory where sku='endplug-plain')<>before_stock then raise exception 'external refund blindly restocked goods';end if;
 if exists(select 1 from public.order_cancellations where order_id=external_id) then raise exception 'external refund invented restock decision';end if;
 if has_function_privilege('authenticated','public.record_order_refund(text,uuid,text,bigint,text,text,timestamptz,uuid)','execute') then raise exception 'customer can mark own refund';end if;
 if has_function_privilege('anon','public.begin_order_cancellation(uuid,text,jsonb,text)','execute') then raise exception 'anonymous cancellation RPC exposed';end if;
 if not has_function_privilege('service_role','public.record_order_refund(text,uuid,text,bigint,text,text,timestamptz,uuid)','execute') then raise exception 'refund worker permission missing';end if;
 raise notice 'PASS: paid cancellation, pending/failed/succeeded refunds, idempotent stock and email, shipment protection, external refund, restricted grants';
end; $$;
rollback;
