\set ON_ERROR_STOP on
begin;
do $$
declare customer_id uuid;v_order_id uuid:='66666666-6666-4666-8666-666666666666';value jsonb;
begin
 if has_function_privilege('anon','public.admin_set_stock(text,integer)','execute') or has_function_privilege('authenticated','public.admin_mark_shipped(uuid,text)','execute') then raise exception 'browser admin RPC grant';end if;
 if not has_function_privilege('service_role','public.admin_set_stock(text,integer)','execute') then raise exception 'missing service role grant';end if;
 update public.inventory set on_hand=3,reserved=2 where sku='endplug-plain';
 begin perform public.admin_set_stock('endplug-plain',1);raise exception 'accepted below-reserved stock';exception when check_violation then null;end;
 perform public.admin_set_stock('endplug-plain',2);
 if not exists(select 1 from public.inventory where sku='endplug-plain' and on_hand=2 and reserved=2) then raise exception 'stock update changed hold';end if;
 insert into public.customers(google_subject,email,name) values('task5-admin-test','admin-fixture@example.test','Fixture') returning id into customer_id;
 insert into public.orders(id,customer_id,request_key,fingerprint,currency,locale,amount_total,status,expires_at,checkout_parameters) values(v_order_id,customer_id,gen_random_uuid(),'fixture','usd','en',1500,'pending',now()+interval '1 hour','{}');
 insert into public.order_items(order_id,sku,product_id,variant,quantity,name,unit_amount) values(v_order_id,'endplug-plain','saxophone-end-plug','plain',1,'Fixture',1500);
 insert into public.shipments(order_id,recipient,address,status) values(v_order_id,'{"name":"Actual recipient"}','{"line1":"Actual street","city":"Bangkok","postal_code":"10110","country":"TH"}','ready');
 begin perform public.admin_mark_shipped(v_order_id,'TEST123');raise exception 'unpaid shipment accepted';exception when check_violation then null;end;
 update public.orders set status='paid' where id=v_order_id;
 update public.shipments set status='needs_address' where shipments.order_id=v_order_id;
 begin perform public.admin_mark_shipped(v_order_id,'TEST123');raise exception 'missing address shipment accepted';exception when check_violation then null;end;
 update public.shipments set status='ready' where shipments.order_id=v_order_id;
 begin perform public.admin_mark_shipped(v_order_id,'<script>');raise exception 'invalid tracking accepted';exception when invalid_parameter_value then null;end;
 value:=public.admin_mark_shipped(v_order_id,'TEST123');
 if value->>'status'<>'shipped' or value->>'payment_status'<>'paid' or value->>'tracking_number'<>'TEST123' then raise exception 'shipment state mismatch';end if;
 perform public.admin_mark_shipped(v_order_id,'TEST123');
 begin perform public.admin_mark_shipped(v_order_id,'CHANGED123');raise exception 'changed shipped tracking accepted';exception when check_violation then null;end;
 if (select status from public.orders where id=v_order_id)<>'paid' then raise exception 'admin changed payment state';end if;
end;$$;
rollback;
