\set ON_ERROR_STOP on
begin;
do $$
declare buyer uuid; other_buyer uuid; q jsonb; saved jsonb; ord jsonb; lines jsonb;
 booking_id uuid; active_id uuid; slot timestamptz;
begin
 insert into public.customers(google_subject,email,name) values('ops-test-buyer','buyer@example.test','Buyer') returning id into buyer;
 insert into public.customers(google_subject,email,name) values('ops-test-other','other@example.test','Other') returning id into other_buyer;
 perform public.admin_set_storefront_config(array['TH','JP'],'{"TH:ems_local":[{"maxGrams":100,"thbMinor":3500},{"maxGrams":200,"thbMinor":null},{"maxGrams":300,"thbMinor":7000}]}',null,null,true);
 if public.storefront_config()->'shipping_rates'->'TH:ems_local'->1->'thbMinor'<>'null'::jsonb then raise exception 'blank rate lost';end if;
 update public.inventory set on_hand=10,reserved=0,price_usd_minor=1500,price_jpy=2500,price_thb_minor=20000,weight_grams=150 where sku='endplug-plain';
 lines:='[{"sku":"endplug-plain","productId":"saxophone-end-plug","variant":"plain","options":{},"quantity":1,"name":"End plug","unitAmount":1500}]';
 q:=public.create_shipping_quote(buyer,gen_random_uuid(),repeat('a',64),repeat('b',64),'usd','en',lines,1500,150,'TH','{"line1":"1 Road","city":"Bangkok","postal_code":"10120","country":"TH"}','{"name":"Buyer"}');
 if q->>'status'<>'requested' then raise exception 'missing request';end if;
 if (select reserved from public.inventory where sku='endplug-plain')<>0 then raise exception 'quote reserved stock';end if;
 saved:=public.admin_approve_shipping_quote_v2((q->>'id')::uuid,300,10000,'Fee agreed','test-seller',35,current_date);
 if saved->>'status'<>'quoted' or (saved->>'referenceThbRate')::numeric<>35 then raise exception 'approval snapshot missing';end if;
 if (select count(*) from public.outbox where topic='shipping_quote_buyer' and payload->>'quoteId'=q->>'id')<>1 then raise exception 'approval email missing';end if;
 ord:=public.reserve_order(buyer,(q->>'id')::uuid,repeat('c',64),'usd',lines,1800,'en',jsonb_build_object(
  'expiresAt',extract(epoch from now()+interval '1 hour')::bigint,'shippingCountry','TH','fulfillmentMethod','ems_local','shippingAmount',300,'estimatedWeightGrams',150,
  'shippingQuoteId',q->>'id','shippingQuoteVersion',(saved->>'version')::integer,'shippingQuoteAddress',saved->'address','shippingQuoteRecipient',saved->'recipient','referenceThbRate',35));
 if (select reserved from public.inventory where sku='endplug-plain')<>1 then raise exception 'checkout did not reserve';end if;
 begin perform public.cancel_shipping_quote((q->>'id')::uuid,buyer);raise exception 'cancel accepted after checkout';exception when check_violation then null;end;
 begin perform public.admin_set_product('endplug-plain',0,9999,9999,9999,999);raise exception 'stock below reserved accepted';exception when check_violation then null;end;
 if (select price_usd_minor from public.inventory where sku='endplug-plain')<>1500 then raise exception 'partial price save';end if;

 slot:=(((now() at time zone 'Asia/Bangkok')::date+20)::text||' 10:30')::timestamp at time zone 'Asia/Bangkok';
 perform public.admin_set_booking_date((slot at time zone 'Asia/Bangkok')::date,'{"10:30":"available","11:00":"available"}');
 if not public.booking_slot_allowed(slot,slot+interval '1 hour') then raise exception 'new booking window failed';end if;
 saved:=public.create_booking(buyer,gen_random_uuid(),repeat('d',64),slot,slot+interval '1 hour','alto','standard','','en');
 active_id:=(saved->>'id')::uuid;
 begin perform public.archive_cancelled_booking(buyer,active_id);raise exception 'active archive accepted';exception when invalid_parameter_value then null;end;
 update public.bookings set status='cancelled' where id=active_id;
 begin perform public.archive_cancelled_booking(other_buyer,active_id);raise exception 'foreign archive accepted';exception when no_data_found then null;end;
 saved:=public.archive_cancelled_booking(buyer,active_id);
 if not exists(select 1 from public.bookings where id=active_id and archived_at is not null and status='cancelled') then raise exception 'archive destroyed history';end if;
 if has_function_privilege('anon','public.archive_cancelled_booking(uuid,uuid)','execute') then raise exception 'archive RPC public';end if;
 if has_function_privilege('authenticated','public.admin_approve_shipping_quote_v2(uuid,bigint,bigint,text,text,numeric,date)','execute') then raise exception 'approval RPC public';end if;
end; $$;
rollback;
