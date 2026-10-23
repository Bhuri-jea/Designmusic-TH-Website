begin;

-- A permanent identity lets sellers add variants while preventing an existing
-- SKU code from being renamed after orders may reference it.
alter table public.inventory add column if not exists catalog_sku_id uuid;
update public.inventory set catalog_sku_id=gen_random_uuid() where catalog_sku_id is null;
alter table public.inventory alter column catalog_sku_id set default gen_random_uuid();
alter table public.inventory alter column catalog_sku_id set not null;
create unique index if not exists inventory_catalog_sku_id_unique on public.inventory(catalog_sku_id);

create or replace function public.admin_save_catalog_product(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
 product uuid;
 previous_slug text;
 was_published boolean;
 row jsonb;
 group_row jsonb;
 group_id uuid;
 value_row jsonb;
 value_ids uuid[];
 sku_identity uuid;
 existing_sku public.inventory;
 touched_ids uuid[] := '{}';
 expected_groups integer;
begin
 product:=nullif(p_payload->>'id','')::uuid;
 select slug,published_at is not null into previous_slug,was_published
 from public.catalog_products where id=product for update;
 if not found then raise exception 'catalog_product_not_found' using errcode='P0002'; end if;
 if was_published and previous_slug<>p_payload->>'slug' then
  raise exception 'published_slug_immutable' using errcode='23514';
 end if;

 update public.catalog_products
 set slug=p_payload->>'slug',collection_slug=nullif(p_payload->>'collectionSlug',''),updated_at=now()
 where id=product;

 delete from public.catalog_product_translations where product_id=product;
 for row in select * from jsonb_array_elements(p_payload->'translations') loop
  insert into public.catalog_product_translations
  values(product,row->>'locale',row->>'name',coalesce(row->>'badge',''),row->>'shortDescription',row->>'description');
 end loop;

 delete from public.catalog_product_images where product_id=product;
 for row in select * from jsonb_array_elements(p_payload->'images') loop
  insert into public.catalog_product_images(product_id,url,alt,position,is_primary)
  values(product,row->>'url',coalesce(row->>'alt',''),(row->>'position')::int,(row->>'primary')::boolean);
 end loop;

 delete from public.catalog_option_groups where product_id=product;
 for group_row in select * from jsonb_array_elements(p_payload->'optionGroups') loop
  insert into public.catalog_option_groups(product_id,code,position,labels)
  values(product,group_row->>'code',(group_row->>'position')::int,group_row->'labels')
  returning id into group_id;
  for value_row in select * from jsonb_array_elements(group_row->'values') loop
   insert into public.catalog_option_values(group_id,code,position,labels)
   values(group_id,value_row->>'code',(value_row->>'position')::int,value_row->'labels');
  end loop;
 end loop;
 select count(*) into expected_groups from public.catalog_option_groups where product_id=product;

 for row in select * from jsonb_array_elements(p_payload->'skus') loop
  sku_identity:=nullif(row->>'id','')::uuid;
  existing_sku:=null;
  if sku_identity is not null then
   select * into existing_sku from public.inventory
   where catalog_sku_id=sku_identity and product_id=product for update;
   if not found then raise exception 'catalog_sku_not_found' using errcode='P0002'; end if;
   if existing_sku.sku<>row->>'sku' then raise exception 'published_sku_immutable' using errcode='23514'; end if;
  elsif exists(select 1 from public.inventory where sku=row->>'sku') then
   raise exception 'sku_already_exists' using errcode='23505';
  end if;

  select coalesce(array_agg(v.id order by g.position),'{}') into value_ids
  from public.catalog_option_values v
  join public.catalog_option_groups g on g.id=v.group_id
  where g.product_id=product and v.code in(select jsonb_array_elements_text(row->'optionValueCodes'));
  if cardinality(value_ids)<>expected_groups
     or cardinality(value_ids)<>jsonb_array_length(row->'optionValueCodes') then
   raise exception 'invalid_catalog_sku_options' using errcode='23514';
  end if;

  if sku_identity is null then
   insert into public.inventory(
    sku,on_hand,reserved,price_usd_minor,price_jpy,price_thb_minor,weight_grams,
    product_id,product_slug,product_lifecycle,option_value_ids,option_codes,sales_mode,lifecycle
   ) values(
    row->>'sku',(row->>'onHand')::int,0,
    case when row->>'usd' is null then null else round((row->>'usd')::numeric*100)::int end,
    case when row->>'jpy' is null then null else (row->>'jpy')::int end,
    case when row->>'thb' is null then null else round((row->>'thb')::numeric*100)::int end,
    case when row->>'weightKg' is null then null else round((row->>'weightKg')::numeric*1000)::int end,
    product,p_payload->>'slug',(select lifecycle from public.catalog_products where id=product),
    value_ids,array(select jsonb_array_elements_text(row->'optionValueCodes')),row->>'salesMode',row->>'lifecycle'
   ) returning catalog_sku_id into sku_identity;
  else
   update public.inventory set
    on_hand=(row->>'onHand')::int,
    price_usd_minor=case when row->>'usd' is null then null else round((row->>'usd')::numeric*100)::int end,
    price_jpy=case when row->>'jpy' is null then null else (row->>'jpy')::int end,
    price_thb_minor=case when row->>'thb' is null then null else round((row->>'thb')::numeric*100)::int end,
    weight_grams=case when row->>'weightKg' is null then null else round((row->>'weightKg')::numeric*1000)::int end,
    option_value_ids=value_ids,
    option_codes=array(select jsonb_array_elements_text(row->'optionValueCodes')),
    product_slug=p_payload->>'slug',
    product_lifecycle=(select lifecycle from public.catalog_products where id=product),
    sales_mode=row->>'salesMode',lifecycle=row->>'lifecycle'
   where catalog_sku_id=sku_identity and product_id=product;
  end if;
  touched_ids:=array_append(touched_ids,sku_identity);
 end loop;

 update public.inventory set lifecycle='archived'
 where product_id=product and not(catalog_sku_id=any(touched_ids));
 return product;
end;
$$;

revoke all on function public.admin_save_catalog_product(jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_catalog_product(jsonb) to service_role;

commit;
