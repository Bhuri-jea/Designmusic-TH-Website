begin;
create table public.shipping_quotes (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customers(id),
 request_key uuid not null,
 fingerprint text not null check (length(fingerprint)=64),
 cart_fingerprint text not null check (length(cart_fingerprint)=64),
 currency text not null check (currency in ('usd','jpy','thb')),
 locale text not null check (locale in ('en','ja','zh-CN','th')),
 items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 9),
 subtotal bigint not null check (subtotal>0),
 weight_grams integer not null check (weight_grams>2000),
 country text not null check (country ~ '^[A-Z]{2}$'),
 address jsonb not null,
 recipient jsonb not null,
 status text not null default 'requested' check (status in ('requested','quoted','cancelled')),
 shipping_amount bigint check (shipping_amount>0),
 shipping_thb_minor bigint check (shipping_thb_minor>0),
 seller_note text check (length(seller_note)<=1000),
 approved_by text,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 order_id uuid unique references public.orders(id),
 unique(customer_id,request_key)
);
create index shipping_quotes_customer_created on public.shipping_quotes(customer_id,created_at desc);
alter table public.shipping_quotes enable row level security;
revoke all on public.shipping_quotes from public,anon,authenticated;
grant all on public.shipping_quotes to service_role;

create or replace function public.shipping_quote_record(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',q.id,'customerId',q.customer_id,'requestKey',q.request_key,'cartFingerprint',q.cart_fingerprint,
  'status',q.status,'currency',q.currency,'locale',q.locale,'items',q.items,
  'amountSubtotal',q.subtotal,'shippingAmount',q.shipping_amount,
  'amountTotal',case when q.shipping_amount is null then null else q.subtotal+q.shipping_amount end,
  'weightGrams',q.weight_grams,'country',q.country,'address',q.address,'recipient',q.recipient,
  'createdAt',q.created_at,'expiresAt',q.expires_at,'orderId',q.order_id,'orderStatus',o.status,
  'sellerNote',q.seller_note,'version',q.version,
  'shippingService',case when q.country='TH' then 'ems_local' else 'ems_world' end,
  'customerName',q.recipient->>'name','customerEmail',c.email)
 from public.shipping_quotes q join public.customers c on c.id=q.customer_id
 left join public.orders o on o.id=q.order_id where q.id=p_id
$$;
create or replace function public.customer_shipping_quotes(p_customer_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.shipping_quote_record(id) order by created_at desc),'[]'::jsonb)
 from (select id,created_at from public.shipping_quotes where customer_id=p_customer_id order by created_at desc limit 50) q
$$;
create or replace function public.admin_shipping_quotes() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.shipping_quote_record(id) order by created_at desc),'[]'::jsonb)
 from (select id,created_at from public.shipping_quotes order by created_at desc limit 100) q
$$;
create or replace function public.create_shipping_quote(
 p_customer_id uuid,p_request_key uuid,p_fingerprint text,p_cart_fingerprint text,
 p_currency text,p_locale text,p_items jsonb,p_subtotal bigint,p_weight_grams integer,
 p_country text,p_address jsonb,p_recipient jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.shipping_quotes;
begin
 if p_weight_grams is null or p_weight_grams<=2000 or p_country is null
    or coalesce(p_address->>'country','')<>p_country
    or coalesce(btrim(p_address->>'line1'),'')='' or coalesce(btrim(p_address->>'city'),'')=''
    or coalesce(btrim(p_address->>'postal_code'),'')='' or coalesce(btrim(p_recipient->>'name'),'')='' then
   raise exception 'invalid_shipping_quote' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text||':'||p_request_key::text,0));
 select * into q from public.shipping_quotes where customer_id=p_customer_id and request_key=p_request_key for update;
 if found then
  if q.fingerprint<>p_fingerprint then raise exception 'shipping_quote_conflict' using errcode='23505';end if;
  return public.shipping_quote_record(q.id);
 end if;
 insert into public.shipping_quotes(customer_id,request_key,fingerprint,cart_fingerprint,currency,locale,items,subtotal,weight_grams,country,address,recipient)
 values(p_customer_id,p_request_key,p_fingerprint,p_cart_fingerprint,p_currency,p_locale,p_items,p_subtotal,p_weight_grams,p_country,p_address,p_recipient)
 returning * into q;
 insert into public.outbox(topic,dedupe_key,payload)
 select 'shipping_quote_request_seller','shipping-quote:'||q.id||':requested',
 jsonb_build_object('quoteId',q.id,'locale',q.locale,'country',q.country,'weightGrams',q.weight_grams,
 'customer',jsonb_build_object('name',q.recipient->>'name','email',c.email))
 from public.customers c where c.id=q.customer_id;
 return public.shipping_quote_record(q.id);
end;
$$;
create or replace function public.admin_approve_shipping_quote(
 p_id uuid,p_shipping_amount bigint,p_shipping_thb_minor bigint,p_note text,p_actor text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.shipping_quotes;
begin
 if p_shipping_amount is null or p_shipping_amount<=0 or p_shipping_thb_minor is null or p_shipping_thb_minor<=0
    or p_shipping_thb_minor>100000000 or p_note is null or length(p_note)>1000 or coalesce(btrim(p_actor),'')='' then
  raise exception 'invalid_shipping_quote' using errcode='22023';
 end if;
 select * into q from public.shipping_quotes where id=p_id for update;
 if not found or q.order_id is not null or q.status='cancelled' or q.expires_at<=now() then
  raise exception 'shipping_quote_not_editable' using errcode='23514';
 end if;
 update public.shipping_quotes set status='quoted',shipping_amount=p_shipping_amount,shipping_thb_minor=p_shipping_thb_minor,
 seller_note=btrim(p_note),approved_by=p_actor,version=version+1,expires_at=now()+interval '7 days' where id=p_id returning * into q;
 insert into public.outbox(topic,dedupe_key,payload)
 select 'shipping_quote_buyer','shipping-quote:'||q.id||':approved:'||q.version,
 jsonb_build_object('quoteId',q.id,'version',q.version,'recipient',c.email,'customer',jsonb_build_object('name',q.recipient->>'name','email',c.email),
 'locale',q.locale,'currency',q.currency,'amountTotal',q.subtotal+q.shipping_amount,'shippingAmount',q.shipping_amount,'expiresAt',q.expires_at)
 from public.customers c where c.id=q.customer_id;
 return public.shipping_quote_record(p_id);
end;
$$;
revoke all on function public.shipping_quote_record(uuid),public.customer_shipping_quotes(uuid),
 public.admin_shipping_quotes(),public.create_shipping_quote(uuid,uuid,text,text,text,text,jsonb,bigint,integer,text,jsonb,jsonb),
 public.admin_approve_shipping_quote(uuid,bigint,bigint,text,text) from public,anon,authenticated;
grant execute on function public.shipping_quote_record(uuid),public.customer_shipping_quotes(uuid),
 public.admin_shipping_quotes(),public.create_shipping_quote(uuid,uuid,text,text,text,text,jsonb,bigint,integer,text,jsonb,jsonb),
 public.admin_approve_shipping_quote(uuid,bigint,bigint,text,text) to service_role;

create or replace function public.reserve_order(
  p_customer_id uuid, p_request_key uuid, p_fingerprint text, p_currency text,
  p_lines jsonb, p_amount_total bigint, p_locale text, p_checkout_parameters jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare approval public.shipping_quotes; existing public.orders; new_order public.orders; line jsonb; inv public.inventory;
  calculated bigint := 0; exp timestamptz; shipping bigint; method text; destination text;
begin
  if p_currency not in ('usd','jpy','thb') or p_locale not in ('en','ja','zh-CN','th')
     or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 9 then
    raise exception 'invalid_order' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text || ':' || p_request_key::text, 0));
  select * into existing from public.orders
    where customer_id = p_customer_id and request_key = p_request_key for update;
  if found then
    if existing.fingerprint <> p_fingerprint then raise exception 'request_key_conflict' using errcode = '23505', constraint = 'orders_customer_request_key'; end if;
    return public.order_record(existing.id);
  end if;
  if p_checkout_parameters->>'expiresAt' is null then raise exception 'checkout_parameters_required' using errcode = '22023'; end if;
  exp := to_timestamp((p_checkout_parameters->>'expiresAt')::bigint);
  if exp <= now() or exp > now() + interval '24 hours' then raise exception 'invalid_checkout_expiry' using errcode = '22023'; end if;
  method := p_checkout_parameters->>'fulfillmentMethod';
  destination := p_checkout_parameters->>'shippingCountry';
  shipping := (p_checkout_parameters->>'shippingAmount')::bigint;
  if method is null or destination is null
     or method not in ('ems_local','ems_world','epacket','flash','pickup') or destination !~ '^[A-Z]{2}$'
     or shipping is null or shipping < 0
     or (method = 'pickup' and (destination <> 'TH' or shipping <> 0))
     or (method in ('ems_local','flash') and (destination <> 'TH' or shipping <= 0))
     or (method in ('ems_world','epacket') and (destination = 'TH' or shipping <= 0)) then
    raise exception 'invalid_shipping_selection' using errcode = '22023';
  end if;
  if p_checkout_parameters ? 'shippingQuoteId' then
    select * into approval from public.shipping_quotes where id=(p_checkout_parameters->>'shippingQuoteId')::uuid for update;
    if not found or approval.customer_id<>p_customer_id or approval.status<>'quoted'
       or approval.expires_at<=now() or approval.order_id is not null
       or p_request_key<>approval.id or approval.currency<>p_currency or approval.locale<>p_locale
       or approval.shipping_amount<>shipping or approval.subtotal+shipping<>p_amount_total
       or approval.items<>p_lines or approval.country<>destination
       or approval.version is distinct from (p_checkout_parameters->>'shippingQuoteVersion')::integer
       or approval.address is distinct from p_checkout_parameters->'shippingQuoteAddress'
       or approval.recipient is distinct from p_checkout_parameters->'shippingQuoteRecipient'
       or (case when approval.country='TH' then 'ems_local' else 'ems_world' end)<>method then
      raise exception 'shipping_quote_not_ready' using errcode='23514';
    end if;
  elsif coalesce((p_checkout_parameters->>'estimatedWeightGrams')::integer,0)>2000 then
    raise exception 'shipping_contact_required' using errcode='23514';
  end if;
  for line in select value from jsonb_array_elements(p_lines) order by value->>'sku' loop
    if (line->>'quantity')::integer not between 1 and 10 or (line->>'unitAmount')::bigint <= 0 then raise exception 'invalid_order_line' using errcode = '22023'; end if;
    calculated := calculated + (line->>'quantity')::bigint * (line->>'unitAmount')::bigint;
  end loop;
  if calculated + shipping <> p_amount_total then raise exception 'amount_mismatch' using errcode = '23514', constraint = 'orders_amount_total_check'; end if;
  for line in select value from jsonb_array_elements(p_lines) order by value->>'sku' loop
    select * into inv from public.inventory where sku = line->>'sku' for update;
    if not found or inv.on_hand - inv.reserved < (line->>'quantity')::integer then raise exception 'stock_unavailable' using errcode = '23514', constraint = 'inventory_stock_available'; end if;
  end loop;
  insert into public.orders(customer_id,request_key,fingerprint,currency,locale,amount_total,shipping_minor,fulfillment_method,expires_at,checkout_parameters)
  values(p_customer_id,p_request_key,p_fingerprint,p_currency,p_locale,p_amount_total,shipping,method,exp,p_checkout_parameters)
  returning * into new_order;
  if approval.id is not null then update public.shipping_quotes set order_id=new_order.id where id=approval.id;end if;
  for line in select value from jsonb_array_elements(p_lines) order by value->>'sku' loop
    update public.inventory set reserved = reserved + (line->>'quantity')::integer, updated_at = now() where sku = line->>'sku';
    insert into public.stock_reservations(order_id,sku,quantity) values(new_order.id,line->>'sku',(line->>'quantity')::integer);
    insert into public.order_items(order_id,sku,product_id,variant,options,quantity,name,unit_amount)
    values(new_order.id,line->>'sku',line->>'productId',line->>'variant',coalesce(line->'options','{}'::jsonb),(line->>'quantity')::integer,line->>'name',(line->>'unitAmount')::bigint);
  end loop;
  return public.order_record(new_order.id);
end;
$$;


create or replace function public.admin_shipping_record(p_order_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_id',o.id,'payment_status',o.status,'status',s.status,'currency',o.currency,
    'amount_total',o.amount_total,'shipping_minor',o.shipping_minor,
    'manual_shipping_quote',(o.checkout_parameters ? 'shippingQuoteId'),'fulfillment_method',o.fulfillment_method,'shipping_service',coalesce(s.shipping_service,o.fulfillment_method),
    'tracking_number',s.tracking_number,
    'tracking_url',case coalesce(s.shipping_service,o.fulfillment_method)
      when 'ems_local' then 'https://track.thailandpost.com'
      when 'ems_world' then 'https://track.thailandpost.co.th/?lang=en'
        when 'epacket' then 'https://track.thailandpost.co.th/?lang=en'
      when 'flash' then 'https://www.flashexpress.com/fle/tracking'
      else null end,
    'recipient',s.recipient,'address',s.address,'hold',s.hold,'hold_reason',s.hold_reason,
    'hold_history',coalesce((select jsonb_agg(jsonb_build_object('hold',e.hold,'reason',e.reason,'actor',e.actor,'created_at',e.created_at) order by e.created_at desc,e.id desc)
      from public.shipment_hold_events e where e.order_id=o.id),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.name,'sku',i.sku,'options',i.options,'quantity',i.quantity) order by i.sku)
      from public.order_items i where i.order_id=o.id),'[]'::jsonb))
  from public.orders o join public.shipments s on s.order_id=o.id where o.id=p_order_id
$$;


create or replace function public.cancel_shipping_quote(p_id uuid,p_customer_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.shipping_quotes;
begin
 select * into q from public.shipping_quotes where id=p_id and customer_id=p_customer_id for update;
 if not found then raise exception 'shipping_quote_not_found' using errcode='P0002';end if;
 if q.order_id is not null then raise exception 'shipping_quote_payment_started' using errcode='23514';end if;
 update public.shipping_quotes set status='cancelled',version=version+1 where id=p_id;
 return public.shipping_quote_record(p_id);
end; $;
revoke all on function public.cancel_shipping_quote(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancel_shipping_quote(uuid,uuid) to service_role;
commit;
