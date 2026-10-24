begin;

create table if not exists public.catalog_collections(
 slug text primary key check(slug~'^[a-z0-9]+(-[a-z0-9]+)*$'),
 labels jsonb not null check(jsonb_typeof(labels)='object'),
 created_at timestamptz not null default now()
);
alter table public.catalog_collections enable row level security;
revoke all on public.catalog_collections from public,anon,authenticated;
grant all on public.catalog_collections to service_role;
insert into public.catalog_collections(slug,labels) values('woodwindaccessories',
 '{"en":"Woodwind Accessories","th":"อุปกรณ์เสริมเครื่องเป่า","ja":"木管楽器アクセサリー","zh-CN":"木管乐器配件"}') on conflict do nothing;
insert into public.catalog_collections(slug,labels)
select distinct collection_slug,jsonb_build_object('en',initcap(replace(collection_slug,'-',' ')))
from public.catalog_products where collection_slug is not null on conflict do nothing;

create or replace function public.admin_create_catalog_collection(p_name text,p_locale text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare code text; names jsonb;
begin
 if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_name~'[[:cntrl:]]'
 or p_locale not in('en','th') then raise exception 'invalid_collection_name' using errcode='23514'; end if;
 code:=trim(both '-' from regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','-','g'));
 if length(code)<2 then code:='collection-'||gen_random_uuid()::text; end if;
 names:=jsonb_build_object('en',btrim(p_name),'th',btrim(p_name),'ja',btrim(p_name),'zh-CN',btrim(p_name));
 insert into public.catalog_collections(slug,labels) values(code,names);
 return jsonb_build_object('slug',code,'labels',names);
end;
$$;
revoke all on function public.admin_create_catalog_collection(text,text) from public,anon,authenticated;
grant execute on function public.admin_create_catalog_collection(text,text) to service_role;

-- Supabase Storage is optional in a plain local PostgreSQL test instance.
do $$ begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('product-images','product-images',true,4194304,array['image/jpeg','image/png','image/webp'])
  on conflict(id) do update set public=true,file_size_limit=4194304,allowed_mime_types=excluded.allowed_mime_types;
 end if;
end $$;
-- No public upload policies: only the authenticated seller API uploads using service_role.
commit;
