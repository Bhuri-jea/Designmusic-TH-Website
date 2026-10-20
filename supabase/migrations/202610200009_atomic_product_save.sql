create or replace function public.admin_set_product(
  p_sku text,
  p_on_hand integer,
  p_usd_minor bigint,
  p_jpy bigint,
  p_thb_minor bigint,
  p_weight_grams integer
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare inv public.inventory;
begin
  if p_sku is null or p_sku !~ '^(endplug-(plain|twoColor|custom)|shakuhachi-(standard|large)-(balance|traditional|modern))$' then
    raise exception 'sku_not_found' using errcode='P0002';
  end if;
  if p_on_hand is null or p_on_hand not between 0 and 100000 then raise exception 'invalid_stock' using errcode='22023'; end if;
  if p_usd_minor is null or p_usd_minor not between 1 and 1000000000 or
     p_jpy is null or p_jpy not between 1 and 1000000000 or
     p_thb_minor is null or p_thb_minor not between 1 and 1000000000 then
    raise exception 'invalid_price' using errcode='22023';
  end if;
  if p_weight_grams is null or p_weight_grams not between 0 and 30000 then raise exception 'invalid_weight' using errcode='22023'; end if;

  select * into inv from public.inventory where sku=p_sku for update;
  if not found then raise exception 'sku_not_found' using errcode='P0002'; end if;
  if p_on_hand < inv.reserved then raise exception 'stock_below_reserved' using errcode='23514'; end if;

  update public.inventory set
    on_hand=p_on_hand,
    price_usd_minor=p_usd_minor,
    price_jpy=p_jpy,
    price_thb_minor=p_thb_minor,
    weight_grams=p_weight_grams,
    updated_at=now()
  where sku=p_sku;

  return jsonb_build_object('sku',p_sku,'onHand',p_on_hand,'reserved',inv.reserved,
    'priceUsdMinor',p_usd_minor,'priceJpy',p_jpy,'priceThbMinor',p_thb_minor,'weightGrams',p_weight_grams);
end;
$$;

revoke all on function public.admin_set_product(text,integer,bigint,bigint,bigint,integer) from public,anon,authenticated;
grant execute on function public.admin_set_product(text,integer,bigint,bigint,bigint,integer) to service_role;
