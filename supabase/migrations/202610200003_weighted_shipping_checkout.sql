begin;

alter table public.orders
  add column if not exists shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  add column if not exists fulfillment_method text not null default 'ems' check (fulfillment_method in ('ems','pickup'));

create or replace function public.reserve_order(p_customer_id uuid,p_request_key uuid,p_fingerprint text,p_currency text,p_lines jsonb,p_amount_total bigint,p_locale text,p_checkout_parameters jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.orders; new_order public.orders; line jsonb; inv public.inventory; calculated bigint:=0; exp timestamptz; shipping bigint; method text; destination text;
begin
 if p_currency not in ('usd','jpy','thb') or p_locale not in ('en','ja','zh-CN','th') or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 9 then raise exception 'invalid_order' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text||':'||p_request_key::text,0));
 select * into existing from public.orders where customer_id=p_customer_id and request_key=p_request_key for update;
 if found then if existing.fingerprint<>p_fingerprint then raise exception 'request_key_conflict' using errcode='23505',constraint='orders_customer_request_key';end if;return public.order_record(existing.id);end if;
 if p_checkout_parameters->>'expiresAt' is null then raise exception 'checkout_parameters_required' using errcode='22023';end if;
 exp:=to_timestamp((p_checkout_parameters->>'expiresAt')::bigint);
 if exp<=now() or exp>now()+interval '24 hours' then raise exception 'invalid_checkout_expiry' using errcode='22023';end if;
 method:=p_checkout_parameters->>'fulfillmentMethod';destination:=p_checkout_parameters->>'shippingCountry';shipping:=(p_checkout_parameters->>'shippingAmount')::bigint;
 if method not in ('ems','pickup') or destination !~ '^[A-Z]{2}$' or shipping is null or shipping<0 or (method='pickup' and (destination<>'TH' or shipping<>0)) or (method='ems' and shipping<=0) then raise exception 'invalid_shipping_selection' using errcode='22023';end if;
 for line in select value from jsonb_array_elements(p_lines) order by value->>'sku' loop
  if (line->>'quantity')::integer not between 1 and 10 or (line->>'unitAmount')::bigint<=0 then raise exception 'invalid_order_line' using errcode='22023';end if;
  calculated:=calculated+(line->>'quantity')::bigint*(line->>'unitAmount')::bigint;
 end loop;
 if calculated+shipping<>p_amount_total then raise exception 'amount_mismatch' using errcode='23514',constraint='orders_amount_total_check';end if;
 for line in select value from jsonb_array_elements(p_lines) order by value->>'sku' loop
  select * into inv from public.inventory where sku=line->>'sku' for update;
  if not found or inv.on_hand-inv.reserved<(line->>'quantity')::integer then raise exception 'stock_unavailable' using errcode='23514',constraint='inventory_stock_available';end if;
 end loop;
 insert into public.orders(customer_id,request_key,fingerprint,currency,locale,amount_total,shipping_minor,fulfillment_method,expires_at,checkout_parameters)
 values(p_customer_id,p_request_key,p_fingerprint,p_currency,p_locale,p_amount_total,shipping,method,exp,p_checkout_parameters) returning * into new_order;
 for line in select value from jsonb_array_elements(p_lines) order by value->>'sku' loop
  update public.inventory set reserved=reserved+(line->>'quantity')::integer,updated_at=now() where sku=line->>'sku';
  insert into public.stock_reservations(order_id,sku,quantity) values(new_order.id,line->>'sku',(line->>'quantity')::integer);
  insert into public.order_items(order_id,sku,product_id,variant,options,quantity,name,unit_amount)
  values(new_order.id,line->>'sku',line->>'productId',line->>'variant',coalesce(line->'options','{}'::jsonb),(line->>'quantity')::integer,line->>'name',(line->>'unitAmount')::bigint);
 end loop;
 return public.order_record(new_order.id);
end;$$;

create or replace function public.order_record(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',o.id,'customerId',o.customer_id,'requestKey',o.request_key,'fingerprint',o.fingerprint,'currency',o.currency,'locale',o.locale,'amountTotal',o.amount_total,'shippingAmount',o.shipping_minor,'fulfillmentMethod',o.fulfillment_method,'items',coalesce((select jsonb_agg(jsonb_build_object('sku',i.sku,'productId',i.product_id,'variant',i.variant,'options',i.options,'quantity',i.quantity,'name',i.name,'unitAmount',i.unit_amount) order by i.sku) from public.order_items i where i.order_id=o.id),'[]'::jsonb),'status',o.status,'createdAt',o.created_at,'expiresAt',o.expires_at,'checkoutSessionId',o.checkout_session_id,'checkoutUrl',o.checkout_url,'checkoutParameters',o.checkout_parameters) from public.orders o where o.id=p_id
$$;

create or replace function public.admin_shipping_record(p_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('order_id',o.id,'payment_status',o.status,'status',s.status,'currency',o.currency,'amount_total',o.amount_total,'shipping_minor',o.shipping_minor,'fulfillment_method',o.fulfillment_method,'recipient',s.recipient,'address',s.address,'tracking_number',s.tracking_number,'hold',s.hold,'hold_reason',s.hold_reason,'hold_history',coalesce((select jsonb_agg(jsonb_build_object('hold',e.hold,'reason',e.reason,'actor',e.actor,'created_at',e.created_at) order by e.created_at desc,e.id desc) from public.shipment_hold_events e where e.order_id=o.id),'[]'::jsonb),'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.name,'sku',i.sku,'options',i.options,'quantity',i.quantity) order by i.sku) from public.order_items i where i.order_id=o.id),'[]'::jsonb))
 from public.orders o join public.shipments s on s.order_id=o.id where o.id=p_order_id
$$;
revoke all on function public.admin_shipping_record(uuid) from public,anon,authenticated;
grant execute on function public.admin_shipping_record(uuid) to service_role;

revoke all on function public.reserve_order(uuid,uuid,text,text,jsonb,bigint,text,jsonb),public.order_record(uuid) from public,anon,authenticated;
grant execute on function public.reserve_order(uuid,uuid,text,text,jsonb,bigint,text,jsonb),public.order_record(uuid) to service_role;
commit;
