begin;

create table if not exists public.catalog_products(
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug~'^[a-z0-9]+(-[a-z0-9]+)*$'),
 collection_slug text, lifecycle text not null default 'draft' check(lifecycle in('draft','published','archived')),
 published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.catalog_product_translations(
 product_id uuid not null references public.catalog_products(id) on delete cascade, locale text not null check(locale in('en','th','ja','zh-CN')),
 name text not null check(length(btrim(name))<=160), badge text not null default '', short_description text not null, description text not null,
 primary key(product_id,locale)
);
create table if not exists public.catalog_product_images(
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.catalog_products(id) on delete cascade,
 url text not null, alt text not null default '', position integer not null check(position>=0), is_primary boolean not null default false,
 unique(product_id,position)
);
create unique index if not exists catalog_one_primary_image on public.catalog_product_images(product_id) where is_primary;
create table if not exists public.catalog_option_groups(
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.catalog_products(id) on delete cascade,
 code text not null check(code~'^[A-Za-z0-9_-]+$'), position integer not null check(position>=0), labels jsonb not null, unique(product_id,code),unique(product_id,position)
);
create table if not exists public.catalog_option_values(
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.catalog_option_groups(id) on delete cascade,
 code text not null check(code~'^[A-Za-z0-9_-]+$'), position integer not null check(position>=0), labels jsonb not null, unique(group_id,code),unique(group_id,position),unique(id,group_id)
);
alter table public.inventory add column if not exists product_id uuid references public.catalog_products(id);
alter table public.inventory add column if not exists product_slug text;
alter table public.inventory add column if not exists product_lifecycle text not null default 'archived' check(product_lifecycle in('draft','published','archived'));
alter table public.inventory add column if not exists option_value_ids uuid[] not null default '{}';
alter table public.inventory add column if not exists option_codes text[] not null default '{}';
alter table public.inventory add column if not exists sales_mode text not null default 'checkout' check(sales_mode in('checkout','reservation_only'));
alter table public.inventory add column if not exists lifecycle text not null default 'active' check(lifecycle in('active','archived'));
alter table public.inventory drop constraint if exists inventory_prices_positive;
alter table public.inventory alter column price_usd_minor drop not null,alter column price_jpy drop not null,alter column price_thb_minor drop not null,alter column weight_grams drop not null;
alter table public.inventory add constraint inventory_catalog_values check(product_lifecycle<>'published' or sales_mode='reservation_only' or (price_usd_minor between 1 and 1000000000 and price_jpy between 1 and 1000000000 and price_thb_minor between 1 and 1000000000 and weight_grams between 1 and 30000));

alter table public.catalog_products enable row level security; alter table public.catalog_product_translations enable row level security;
alter table public.catalog_product_images enable row level security; alter table public.catalog_option_groups enable row level security; alter table public.catalog_option_values enable row level security;
revoke all on public.catalog_products,public.catalog_product_translations,public.catalog_product_images,public.catalog_option_groups,public.catalog_option_values from public,anon,authenticated;
grant all on public.catalog_products,public.catalog_product_translations,public.catalog_product_images,public.catalog_option_groups,public.catalog_option_values to service_role;

-- Seed product identities without changing inventory quantities, prices, reservations or weights.
insert into public.catalog_products(slug,collection_slug,lifecycle,published_at) values
 ('saxophone-end-plug',null,'draft',null),('shakuhachi',null,'draft',null),('siliconepads','woodwindaccessories','published',now()) on conflict(slug) do nothing;
insert into public.catalog_product_translations(product_id,locale,name,badge,short_description,description)
select p.id,l.locale,
 case p.slug when 'saxophone-end-plug' then case l.locale when 'th' then 'จุกอุดแซกโซโฟน' when 'ja' then 'サクソフォン エンドプラグ' when 'zh-CN' then '萨克斯管端塞' else 'Saxophone End Plug' end when 'shakuhachi' then 'Shakuhachi S-1/D' else case l.locale when 'th' then 'แผ่นซิลิโคน' when 'ja' then 'シリコンパッド' when 'zh-CN' then '硅胶垫' else 'Silicone Pads' end end,
 '',case when l.locale='th' then 'ผลิตภัณฑ์จาก Design Music' else 'A Design Music product.' end,
 case when l.locale='th' then 'รายละเอียดผลิตภัณฑ์ฉบับเดิมได้รับการย้ายเข้าสู่แค็ตตาล็อกที่ผู้ขายจัดการได้' else 'The existing product content is preserved in the seller-managed catalog.' end
from public.catalog_products p cross join (values('en'),('th'),('ja'),('zh-CN')) l(locale)
where p.slug in('saxophone-end-plug','shakuhachi','siliconepads') on conflict(product_id,locale) do nothing;
insert into public.catalog_product_images(product_id,url,alt,position,is_primary)
select id,case slug when 'saxophone-end-plug' then '/images/endplug2.jpg' when 'shakuhachi' then '/images/ShakuhachiPoster1.jpg' else '/images/SiliconePad1.jpg' end,'',0,true
from public.catalog_products where slug in('saxophone-end-plug','shakuhachi','siliconepads') on conflict(product_id,position) do nothing;
insert into public.catalog_option_groups(product_id,code,position,labels)
select p.id,x.code,x.position,jsonb_build_object('en',x.label,'th',x.label,'ja',x.label,'zh-CN',x.label) from public.catalog_products p join (values
 ('saxophone-end-plug','style',0,'Style'),('shakuhachi','toneHoles',0,'Tone holes'),('shakuhachi','mouthpiece',1,'Mouthpiece')) x(slug,code,position,label) on x.slug=p.slug on conflict(product_id,code) do nothing;
insert into public.catalog_option_values(group_id,code,position,labels)
select g.id,x.code,x.position,jsonb_build_object('en',x.label,'th',x.label,'ja',x.label,'zh-CN',x.label) from public.catalog_option_groups g join public.catalog_products p on p.id=g.product_id join (values
 ('saxophone-end-plug','style','plain',0,'Plain'),('saxophone-end-plug','style','twoColor',1,'Two color'),('saxophone-end-plug','style','custom',2,'Custom'),
 ('shakuhachi','toneHoles','standard',0,'Standard'),('shakuhachi','toneHoles','large',1,'Large'),
 ('shakuhachi','mouthpiece','balance',0,'Balance'),('shakuhachi','mouthpiece','traditional',1,'Traditional'),('shakuhachi','mouthpiece','modern',2,'Modern')) x(slug,group_code,code,position,label) on x.slug=p.slug and x.group_code=g.code on conflict(group_id,code) do nothing;
update public.inventory set product_id=(select id from public.catalog_products where slug='saxophone-end-plug') where sku like 'endplug-%' and product_id is null;
update public.inventory set product_id=(select id from public.catalog_products where slug='shakuhachi') where sku like 'shakuhachi-%' and product_id is null;
update public.inventory set product_slug='saxophone-end-plug',option_codes=array[substring(sku from 9)] where sku like 'endplug-%';
update public.inventory set product_slug='shakuhachi',option_codes=string_to_array(substring(sku from 12),'-') where sku like 'shakuhachi-%';
update public.inventory i set option_value_ids=(select array_agg(v.id order by g.position) from public.catalog_option_values v join public.catalog_option_groups g on g.id=v.group_id where g.product_id=i.product_id and v.code=any(i.option_codes)) where i.product_id is not null;
create unique index if not exists inventory_product_options_unique on public.inventory(product_id,option_value_ids) where product_id is not null;
insert into public.inventory(sku,on_hand,reserved,price_usd_minor,price_jpy,price_thb_minor,weight_grams,product_id,product_slug,product_lifecycle,option_codes,sales_mode,lifecycle)
select 'siliconepads-reservation',0,0,null,null,null,null,id,slug,'published','{}','reservation_only','active' from public.catalog_products where slug='siliconepads' on conflict(sku) do nothing;
update public.catalog_products product set lifecycle='published',published_at=coalesce(published_at,now())
where product.slug in('saxophone-end-plug','shakuhachi')
  and not exists(select 1 from public.inventory item where item.product_id=product.id and item.sales_mode='checkout' and (item.price_usd_minor<=0 or item.price_jpy<=0 or item.price_thb_minor<=0 or item.weight_grams<=0));
update public.inventory item set product_lifecycle=product.lifecycle
from public.catalog_products product where product.id=item.product_id;

create or replace function public.admin_create_catalog_product() returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 insert into public.catalog_products(slug) values('draft-'||replace(gen_random_uuid()::text,'-','')) returning id into result;
 insert into public.catalog_product_translations(product_id,locale,name,badge,short_description,description)
 select result,locale,'','','','' from unnest(array['en','th','ja','zh-CN']) locale;
 return result;
end $$;

-- Complete saves are one transaction. Reserved stock is always retained from the database.
create or replace function public.admin_save_catalog_product(p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare product uuid; current_lifecycle text; row jsonb; group_row jsonb; group_id uuid; value_row jsonb; value_ids uuid[]; sku_row public.inventory;
begin
 product:=nullif(p_payload->>'id','')::uuid;
 select lifecycle into current_lifecycle from public.catalog_products where id=product for update;
 if not found then raise exception 'catalog_product_not_found' using errcode='P0002'; end if;
 if current_lifecycle='published' and (select slug from public.catalog_products where id=product)<>p_payload->>'slug' then raise exception 'published_slug_immutable' using errcode='23514'; end if;
 update public.catalog_products set slug=p_payload->>'slug',collection_slug=nullif(p_payload->>'collectionSlug',''),updated_at=now() where id=product;
 delete from public.catalog_product_translations where product_id=product;
 for row in select * from jsonb_array_elements(p_payload->'translations') loop
  insert into public.catalog_product_translations values(product,row->>'locale',row->>'name',coalesce(row->>'badge',''),row->>'shortDescription',row->>'description');
 end loop;
 delete from public.catalog_product_images where product_id=product;
 for row in select * from jsonb_array_elements(p_payload->'images') loop
  insert into public.catalog_product_images(product_id,url,alt,position,is_primary) values(product,row->>'url',coalesce(row->>'alt',''),(row->>'position')::int,(row->>'primary')::boolean);
 end loop;
 delete from public.catalog_option_groups where product_id=product;
 for group_row in select * from jsonb_array_elements(p_payload->'optionGroups') loop
  insert into public.catalog_option_groups(product_id,code,position,labels) values(product,group_row->>'code',(group_row->>'position')::int,group_row->'labels') returning id into group_id;
  for value_row in select * from jsonb_array_elements(group_row->'values') loop
   insert into public.catalog_option_values(group_id,code,position,labels) values(group_id,value_row->>'code',(value_row->>'position')::int,value_row->'labels');
  end loop;
 end loop;
 for row in select * from jsonb_array_elements(p_payload->'skus') loop
  select * into sku_row from public.inventory where sku=row->>'sku' for update;
  if found and sku_row.product_id is distinct from product then raise exception 'sku_immutable' using errcode='23505'; end if;
  if not found and current_lifecycle='published' then raise exception 'published_sku_immutable' using errcode='23514'; end if;
  select coalesce(array_agg(v.id order by v.id),'{}') into value_ids from public.catalog_option_values v join public.catalog_option_groups g on g.id=v.group_id where g.product_id=product and v.code in(select jsonb_array_elements_text(row->'optionValueCodes'));
  insert into public.inventory(sku,on_hand,reserved,price_usd_minor,price_jpy,price_thb_minor,weight_grams,product_id,product_slug,product_lifecycle,option_value_ids,option_codes,sales_mode,lifecycle)
  values(row->>'sku',(row->>'onHand')::int,0,case when row->>'usd' is null then null else round((row->>'usd')::numeric*100)::int end,(row->>'jpy')::int,case when row->>'thb' is null then null else round((row->>'thb')::numeric*100)::int end,case when row->>'weightKg' is null then null else round((row->>'weightKg')::numeric*1000)::int end,product,p_payload->>'slug',current_lifecycle,value_ids,array(select jsonb_array_elements_text(row->'optionValueCodes')),row->>'salesMode',row->>'lifecycle')
  on conflict(sku) do update set on_hand=excluded.on_hand,price_usd_minor=excluded.price_usd_minor,price_jpy=excluded.price_jpy,price_thb_minor=excluded.price_thb_minor,weight_grams=excluded.weight_grams,option_value_ids=excluded.option_value_ids,option_codes=excluded.option_codes,product_slug=excluded.product_slug,product_lifecycle=excluded.product_lifecycle,sales_mode=excluded.sales_mode,lifecycle=excluded.lifecycle;
 end loop;
 update public.inventory set lifecycle='archived' where product_id=product and sku not in(select value->>'sku' from jsonb_array_elements(p_payload->'skus') value);
 return product;
end $$;

create or replace function public.admin_set_catalog_lifecycle(p_product_id uuid,p_lifecycle text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_lifecycle not in('draft','published','archived') then raise exception 'invalid_lifecycle' using errcode='22023'; end if;
 if p_lifecycle='published' and ((select count(*) from public.catalog_product_translations where product_id=p_product_id)<>4 or not exists(select 1 from public.catalog_product_images where product_id=p_product_id and is_primary) or not exists(select 1 from public.inventory where product_id=p_product_id and lifecycle='active')) then raise exception 'catalog_incomplete' using errcode='23514'; end if;
 update public.catalog_products set lifecycle=p_lifecycle,published_at=case when p_lifecycle='published' then coalesce(published_at,now()) else published_at end,updated_at=now() where id=p_product_id;
 if not found then raise exception 'catalog_product_not_found' using errcode='P0002'; end if;
 if p_lifecycle='archived' then update public.inventory set lifecycle='archived' where product_id=p_product_id; end if;
 update public.inventory set product_lifecycle=p_lifecycle where product_id=p_product_id;
end $$;
revoke all on function public.admin_create_catalog_product(),public.admin_save_catalog_product(jsonb),public.admin_set_catalog_lifecycle(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_create_catalog_product(),public.admin_save_catalog_product(jsonb),public.admin_set_catalog_lifecycle(uuid,text) to service_role;

commit;
