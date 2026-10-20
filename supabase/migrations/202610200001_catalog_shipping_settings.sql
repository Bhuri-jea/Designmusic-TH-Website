begin;

alter table public.inventory
  add column if not exists price_usd_minor bigint,
  add column if not exists price_jpy bigint,
  add column if not exists price_thb_minor bigint,
  add column if not exists weight_grams integer not null default 0;

update public.inventory set
  price_usd_minor = case sku
    when 'endplug-plain' then 1500
    when 'endplug-twoColor' then 1800
    when 'endplug-custom' then 2200
    else 23000 end,
  price_jpy = case sku
    when 'endplug-plain' then 2500
    when 'endplug-twoColor' then 2800
    when 'endplug-custom' then 3200
    else 35000 end,
  price_thb_minor = case sku
    when 'endplug-plain' then 20000
    when 'endplug-twoColor' then 25000
    when 'endplug-custom' then 35000
    else 690000 end
where price_usd_minor is null or price_jpy is null or price_thb_minor is null;

alter table public.inventory
  alter column price_usd_minor set not null,
  alter column price_jpy set not null,
  alter column price_thb_minor set not null,
  add constraint inventory_prices_positive check (
    price_usd_minor between 1 and 1000000000 and
    price_jpy between 1 and 1000000000 and
    price_thb_minor between 1 and 1000000000
  );

create table if not exists public.storefront_settings (
  id text primary key check (id = 'default'),
  allowed_countries text[],
  shipping_rates jsonb not null default '{}'::jsonb,
  usd_thb numeric(12,6),
  jpy_thb numeric(12,8),
  pickup_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  check (allowed_countries is null or cardinality(allowed_countries) between 1 and 249),
  check (jsonb_typeof(shipping_rates) = 'object'),
  check (usd_thb is null or usd_thb > 0),
  check (jpy_thb is null or jpy_thb > 0)
);
insert into public.storefront_settings(id) values ('default') on conflict (id) do nothing;
alter table public.storefront_settings enable row level security;
revoke all on public.storefront_settings from public, anon, authenticated;
grant all on public.storefront_settings to service_role;

create or replace function public.admin_set_prices(p_sku text, p_usd_minor bigint, p_jpy bigint, p_thb_minor bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_sku is null or p_usd_minor is null or p_jpy is null or p_thb_minor is null
     or p_usd_minor not between 1 and 1000000000
     or p_jpy not between 1 and 1000000000 or p_thb_minor not between 1 and 1000000000 then
    raise exception 'invalid_product_prices' using errcode='22023';
  end if;
  update public.inventory set price_usd_minor=p_usd_minor, price_jpy=p_jpy,
    price_thb_minor=p_thb_minor, updated_at=now() where sku=p_sku;
  if not found then raise exception 'sku_not_found' using errcode='P0002'; end if;
  return jsonb_build_object('sku',p_sku,'price_usd_minor',p_usd_minor,
    'price_jpy',p_jpy,'price_thb_minor',p_thb_minor);
end; $$;

create or replace function public.admin_set_weight(p_sku text,p_weight_grams integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_weight_grams is null or p_weight_grams not between 0 and 30000 then
    raise exception 'invalid_product_weight' using errcode='22023';
  end if;
  update public.inventory set weight_grams=p_weight_grams,updated_at=now() where sku=p_sku;
  if not found then raise exception 'sku_not_found' using errcode='P0002'; end if;
  return jsonb_build_object('sku',p_sku,'weight_grams',p_weight_grams);
end; $$;

create or replace function public.storefront_config()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('allowed_countries',allowed_countries,
    'shipping_rates',shipping_rates,'usd_thb',usd_thb,'jpy_thb',jpy_thb,
    'pickup_enabled',pickup_enabled,'updated_at',updated_at)
  from public.storefront_settings where id='default'
$$;

create or replace function public.admin_set_storefront_config(p_allowed_countries text[],p_shipping_rates jsonb,p_usd_thb numeric,p_jpy_thb numeric,p_pickup_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_allowed_countries is not null and (
       cardinality(p_allowed_countries) not between 1 and 249
       or exists(select 1 from unnest(p_allowed_countries) c where c !~ '^[A-Z]{2}$')
       or cardinality(p_allowed_countries) <> (select count(distinct c) from unnest(p_allowed_countries) c)
     ) then
    raise exception 'invalid_storefront_config' using errcode='22023';
  end if;
  if p_shipping_rates is null or jsonb_typeof(p_shipping_rates) is distinct from 'object'
     or p_usd_thb is not null and p_usd_thb <= 0
     or p_jpy_thb is not null and p_jpy_thb <= 0
     or p_pickup_enabled is null then
    raise exception 'invalid_storefront_config' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_each(p_shipping_rates) r
     where r.key !~ '^[A-Z]{2}:(ems_local|ems_world|flash)$' or jsonb_typeof(r.value) <> 'array'
        or jsonb_array_length(r.value)=0 or jsonb_array_length(r.value)>60) then
    raise exception 'invalid_storefront_config' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_each(p_shipping_rates) r, jsonb_array_elements(r.value) band
     where jsonb_typeof(band) <> 'object'
       or (band->>'maxGrams') !~ '^[1-9][0-9]{0,4}$'
       or (band->>'thbMinor') !~ '^[0-9]{1,10}$'
       or (band->>'maxGrams')::integer > 30000
       or (band->>'thbMinor')::bigint > 10000000000) then
    raise exception 'invalid_storefront_config' using errcode='22023';
  end if;
  update public.storefront_settings set allowed_countries=p_allowed_countries,
    shipping_rates=p_shipping_rates,usd_thb=p_usd_thb,jpy_thb=p_jpy_thb,
    pickup_enabled=p_pickup_enabled,updated_at=now() where id='default';
  return public.storefront_config();
end; $$;

revoke all on function public.admin_set_prices(text,bigint,bigint,bigint),
  public.admin_set_weight(text,integer),public.storefront_config(),
  public.admin_set_storefront_config(text[],jsonb,numeric,numeric,boolean)
  from public, anon, authenticated;
grant execute on function public.admin_set_prices(text,bigint,bigint,bigint),
  public.admin_set_weight(text,integer),public.storefront_config(),
  public.admin_set_storefront_config(text[],jsonb,numeric,numeric,boolean)
  to service_role;

commit;
