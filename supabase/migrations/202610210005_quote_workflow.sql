begin;
-- Preserve requests, snapshots and paid orders.
create or replace function public.create_shipping_quote(
 p_customer_id uuid,p_request_key uuid,p_fingerprint text,p_cart_fingerprint text,
 p_currency text,p_locale text,p_items jsonb,p_subtotal bigint,p_weight_grams integer,
 p_country text,p_address jsonb,p_recipient jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.shipping_quotes; line jsonb; inv public.inventory;
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
 -- Quotes do not reserve inventory, but unavailable products cannot be requested.
 for line in select value from jsonb_array_elements(p_items) order by value->>'sku' loop
  select * into inv from public.inventory where sku=line->>'sku' for share;
  if not found or inv.on_hand-inv.reserved<(line->>'quantity')::integer then
   raise exception 'stock_unavailable' using errcode='23514',constraint='inventory_stock_available';
  end if;
 end loop;
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


create or replace function public.admin_shipping_quotes() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.shipping_quote_record(id) order by created_at desc),'[]'::jsonb)
 from public.shipping_quotes
$$;

create or replace function public.admin_decline_shipping_quote(p_id uuid,p_reason text,p_actor text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.shipping_quotes;
begin
 if coalesce(btrim(p_reason),'')='' or length(p_reason)>1000 or coalesce(btrim(p_actor),'')='' then
  raise exception 'invalid_shipping_quote' using errcode='22023';
 end if;
 select * into q from public.shipping_quotes where id=p_id for update;
 if not found then raise exception 'shipping_quote_not_found' using errcode='P0002';end if;
 if q.order_id is not null or q.status='cancelled' or q.expires_at<=now() then
  raise exception 'shipping_quote_not_editable' using errcode='23514';
 end if;
 update public.shipping_quotes set status='cancelled',seller_note=btrim(p_reason),approved_by=p_actor,version=version+1 where id=p_id;
 return public.shipping_quote_record(p_id);
end; $$;
revoke all on function public.admin_decline_shipping_quote(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_decline_shipping_quote(uuid,text,text) to service_role;
commit;
