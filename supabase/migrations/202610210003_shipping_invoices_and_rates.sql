begin;
-- Forward update: preserve order history, prices, stock, rates and reservations.
alter table public.shipping_quotes drop constraint if exists shipping_quotes_weight_grams_check;
alter table public.shipping_quotes add constraint shipping_quotes_weight_grams_check check(weight_grams>0);
alter table public.shipping_quotes add column if not exists reference_thb_rate numeric;
alter table public.shipping_quotes add column if not exists reference_fx_date date;

create or replace function public.admin_set_storefront_config(p_allowed_countries text[],p_shipping_rates jsonb,p_usd_thb numeric,p_jpy_thb numeric,p_pickup_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; band jsonb;
begin
 if p_allowed_countries is null or cardinality(p_allowed_countries) not between 1 and 249
    or exists(select 1 from unnest(p_allowed_countries) c where c !~ '^[A-Z]{2}$')
    or cardinality(p_allowed_countries)<>(select count(distinct c) from unnest(p_allowed_countries)c)
    or p_shipping_rates is null or jsonb_typeof(p_shipping_rates)<>'object' or p_pickup_enabled is null then
  raise exception 'invalid_storefront_config' using errcode='22023';
 end if;
 for r in select key,value from jsonb_each(p_shipping_rates) loop
  if r.key !~ '^(TH:(ems_local|flash)|[A-Z]{2}:(ems_world|epacket))$'
    or r.key in ('TH:ems_world','TH:epacket') or jsonb_typeof(r.value)<>'array'
    or jsonb_array_length(r.value) not between 1 and 60 then
   raise exception 'invalid_shipping_rates' using errcode='22023';
  end if;
  for band in select value from jsonb_array_elements(r.value) loop
   if jsonb_typeof(band)<>'object' or not(band ? 'maxGrams') or not(band ? 'thbMinor')
      or (band->>'maxGrams') !~ '^[1-9][0-9]{0,4}$' or (band->>'maxGrams')::integer>30000
      or (band->'thbMinor'<>'null'::jsonb and ((band->>'thbMinor') !~ '^[1-9][0-9]{0,10}$' or (band->>'thbMinor')::bigint>10000000000)) then
    raise exception 'invalid_shipping_rates' using errcode='22023';
   end if;
  end loop;
  if (select count(*)<>count(distinct value->>'maxGrams') from jsonb_array_elements(r.value)) then
   raise exception 'invalid_shipping_rates' using errcode='22023';
  end if;
 end loop;
 update public.storefront_settings set allowed_countries=p_allowed_countries,shipping_rates=p_shipping_rates,
   pickup_enabled=p_pickup_enabled,updated_at=now() where id='default';
 -- Legacy FX fields are deliberately preserved. Live conversion is server-fetched.
 return public.storefront_config();
end; $$;

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
  'referenceThbRate',q.reference_thb_rate,'referenceFxDate',q.reference_fx_date,
  'shippingService',case when q.country='TH' then 'ems_local' else 'ems_world' end,
  'customerName',q.recipient->>'name','customerEmail',c.email)
 from public.shipping_quotes q join public.customers c on c.id=q.customer_id
 left join public.orders o on o.id=q.order_id where q.id=p_id
$$;

create or replace function public.create_shipping_quote(
 p_customer_id uuid,p_request_key uuid,p_fingerprint text,p_cart_fingerprint text,
 p_currency text,p_locale text,p_items jsonb,p_subtotal bigint,p_weight_grams integer,
 p_country text,p_address jsonb,p_recipient jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.shipping_quotes;
begin
 if p_weight_grams is null or p_weight_grams<=0 or p_country is null
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
end; $$;

create or replace function public.admin_approve_shipping_quote_v2(
 p_id uuid,p_shipping_amount bigint,p_shipping_thb_minor bigint,p_note text,p_actor text,
 p_reference_thb_rate numeric,p_reference_fx_date date
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_reference_thb_rate is null or p_reference_thb_rate<=0 then raise exception 'invalid_fx_rate' using errcode='22023';end if;
 perform public.admin_approve_shipping_quote(p_id,p_shipping_amount,p_shipping_thb_minor,p_note,p_actor);
 update public.shipping_quotes set reference_thb_rate=p_reference_thb_rate,reference_fx_date=p_reference_fx_date where id=p_id;
 return public.shipping_quote_record(p_id);
end; $$;
revoke all on function public.admin_approve_shipping_quote_v2(uuid,bigint,bigint,text,text,numeric,date) from public,anon,authenticated;
grant execute on function public.admin_approve_shipping_quote_v2(uuid,bigint,bigint,text,text,numeric,date) to service_role;

create or replace function public.admin_shipping_record(p_order_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'order_id',o.id,'created_at',o.created_at,'payment_status',o.status,'status',s.status,'currency',o.currency,
  'amount_total',o.amount_total,'subtotal_minor',o.amount_total-o.shipping_minor,'shipping_minor',o.shipping_minor,
  'reference_thb_rate',case when o.currency='thb' then 1 else (o.checkout_parameters->>'referenceThbRate')::numeric end,
  'reference_fx_date',o.checkout_parameters->>'referenceFxDate',
  'manual_shipping_quote',(o.checkout_parameters?'shippingQuoteId'),'fulfillment_method',o.fulfillment_method,
  'shipping_service',coalesce(s.shipping_service,o.fulfillment_method),'tracking_number',s.tracking_number,
  'tracking_url',case coalesce(s.shipping_service,o.fulfillment_method)
    when 'ems_local' then 'https://track.thailandpost.com'
    when 'ems_world' then 'https://track.thailandpost.co.th/?lang=en'
    when 'epacket' then 'https://track.thailandpost.co.th/?lang=en'
    when 'flash' then 'https://www.flashexpress.com/fle/tracking' else null end,
  'recipient',s.recipient,'address',s.address,'hold',s.hold,'hold_reason',s.hold_reason,
  'hold_history',coalesce((select jsonb_agg(jsonb_build_object('hold',e.hold,'reason',e.reason,'actor',e.actor,'created_at',e.created_at) order by e.created_at desc,e.id desc) from public.shipment_hold_events e where e.order_id=o.id),'[]'::jsonb),
  'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.name,'sku',i.sku,'options',i.options,'quantity',i.quantity,'unitAmount',i.unit_amount) order by i.sku) from public.order_items i where i.order_id=o.id),'[]'::jsonb))
 from public.orders o join public.shipments s on s.order_id=o.id where o.id=p_order_id
$$;
commit;
