-- Run only against an isolated database after migrations 007, 009 and 010.
-- Every fixture is rolled back.
begin;
do $$
declare customer uuid; a uuid; b uuid; c uuid; d uuid; unknown_date uuid; summary jsonb; thb jsonb; usd jsonb; jpy jsonb;
begin
 insert into public.customers(google_subject,email,name) values('monthly-dashboard-fixture','dashboard@example.invalid','Fixture') returning id into customer;
 insert into public.orders(customer_id,request_key,fingerprint,currency,locale,amount_total,shipping_minor,status,fulfillment_method,expires_at,checkout_parameters,paid_at,paid_at_estimated)
 values(customer,gen_random_uuid(),'monthly-a','thb','th',1000,100,'paid','ems_local',now()+interval '1 day','{}','2030-04-30 17:00:00+00',true) returning id into a;
 insert into public.orders(customer_id,request_key,fingerprint,currency,locale,amount_total,shipping_minor,status,fulfillment_method,expires_at,checkout_parameters,paid_at)
 values(customer,gen_random_uuid(),'monthly-b','usd','en',10000,1000,'paid','ems_local',now()+interval '1 day','{"referenceThbRate":35}','2030-05-15 00:00:00+00') returning id into b;
 insert into public.orders(customer_id,request_key,fingerprint,currency,locale,amount_total,shipping_minor,status,fulfillment_method,expires_at,checkout_parameters,paid_at)
 values(customer,gen_random_uuid(),'monthly-c','jpy','ja',1000,0,'paid','ems_local',now()+interval '1 day','{"referenceThbRate":0.25}','2030-04-30 16:59:59+00') returning id into c;
 insert into public.orders(customer_id,request_key,fingerprint,currency,locale,amount_total,shipping_minor,status,fulfillment_method,expires_at,checkout_parameters,paid_at)
 values(customer,gen_random_uuid(),'monthly-d','usd','en',3000,0,'paid','ems_local',now()+interval '1 day','{}','2030-05-20 00:00:00+00') returning id into d;
 insert into public.orders(customer_id,request_key,fingerprint,currency,locale,amount_total,shipping_minor,status,fulfillment_method,expires_at,checkout_parameters)
 values(customer,gen_random_uuid(),'monthly-missing','usd','en',3000,0,'paid','ems_local',now()+interval '1 day','{}') returning id into unknown_date;
 insert into public.order_refunds(id,order_id,payment_intent_id,amount,currency,status,created_at,merchandise_minor,shipping_minor) values
 ('re_monthly_a',a,'pi_monthly_a',200,'thb','succeeded','2030-05-10 00:00:00+00',200,0),
 ('re_monthly_b',b,'pi_monthly_b',1000,'usd','succeeded','2030-05-20 00:00:00+00',900,100),
 ('re_monthly_b_pending',b,'pi_monthly_b',400,'usd','pending','2030-05-20 00:00:00+00',400,0),
 ('re_monthly_b_unallocated',b,'pi_monthly_b',500,'usd','succeeded','2030-05-20 00:00:00+00',null,null),
 ('re_monthly_c_full',c,'pi_monthly_c',1000,'jpy','succeeded','2030-05-01 00:00:00+00',1000,0);
 summary:=public.admin_monthly_dashboard('2030-05-01');
 select value into thb from jsonb_array_elements(summary) where value->>'currency'='thb';
 select value into usd from jsonb_array_elements(summary) where value->>'currency'='usd';
 select value into jpy from jsonb_array_elements(summary) where value->>'currency'='jpy';
 if (thb->>'paidOrders')::integer<>1 or (thb->>'estimatedPaidDates')::integer<>1 or (thb->>'merchandiseNetMinor')::integer<>700 or (thb->>'shippingCollectedMinor')::integer<>100 then raise exception 'TH boundary / shipping / net failed: %',thb;end if;
 if (usd->>'paidOrders')::integer<>2 or (usd->>'merchandiseNetMinor')::integer<>11100 or (usd->>'refundMinor')::integer<>1500 or (usd->>'refundedOrders')::integer<>1 or (usd->>'unallocatedRefunds')::integer<>1 then raise exception 'USD partial / pending / distinct refund order failed: %',usd;end if;
 if (usd->>'unknownPaidDates')::integer<>1 or (usd->>'missingReferenceRates')::integer<>1 or usd->'merchandiseNetReferenceTHB'<>'null'::jsonb then raise exception 'unknown date / missing frozen FX failed: %',usd;end if;
 if (jpy->>'paidOrders')::integer<>0 or (jpy->>'merchandiseNetMinor')::integer<>-1000 or (jpy->>'refundMinor')::integer<>1000 or (jpy->>'merchandiseNetReferenceTHB')::numeric<>-250 then raise exception 'full refund in later month failed: %',jpy;end if;
 if has_function_privilege('anon','public.admin_monthly_dashboard(date)','execute') or has_function_privilege('authenticated','public.admin_monthly_dashboard(date)','execute') then raise exception 'summary leaked to browser roles';end if;
 perform public.admin_allocate_refund('re_monthly_b_unallocated',400,100,'fixture-admin');
 perform public.admin_allocate_refund('re_monthly_b_unallocated',400,100,'retry-admin');
 if not exists(select 1 from public.order_refunds where id='re_monthly_b_unallocated' and allocated_by='fixture-admin' and allocated_at is not null) then raise exception 'allocation audit overwritten';end if;
 begin
  perform public.admin_allocate_refund('re_monthly_b_unallocated',500,0,'changed-admin');
  raise exception 'changed allocation accepted';
 exception when check_violation then null;end;
 begin
  perform public.admin_allocate_refund('re_monthly_b_pending',400,0,'fixture-admin');
  raise exception 'pending refund allocation accepted';
 exception when check_violation then null;end;
 select value into usd from jsonb_array_elements(public.admin_monthly_dashboard('2030-05-01')) where value->>'currency'='usd';
 if (usd->>'unallocatedRefunds')::integer<>0 or (usd->>'merchandiseNetMinor')::integer<>10700 or (usd->>'shippingRefundedMinor')::integer<>200 then raise exception 'classified refund did not update net correctly: %',usd;end if;
 if has_function_privilege('anon','public.admin_allocate_refund(text,bigint,bigint,text)','execute') then raise exception 'allocation leaked to browser role';end if;
 raise notice 'Monthly dashboard acceptance passed';
end $$;
rollback;
