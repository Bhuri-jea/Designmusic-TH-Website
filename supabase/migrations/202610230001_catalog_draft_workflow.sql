begin;

-- Drafts may be saved before their four translations are publication-ready.
alter table public.catalog_product_translations
  drop constraint if exists catalog_product_translations_name_check;
alter table public.catalog_product_translations
  add constraint catalog_product_translations_name_check
  check (length(btrim(name)) <= 160);

insert into public.catalog_product_translations(
  product_id, locale, name, badge, short_description, description
)
select product.id, locale.code, '', '', '', ''
from public.catalog_products product
cross join (values ('en'), ('th'), ('ja'), ('zh-CN')) locale(code)
where product.lifecycle = 'draft'
on conflict (product_id, locale) do nothing;

create or replace function public.admin_create_catalog_product()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result uuid;
begin
  insert into public.catalog_products(slug)
  values ('draft-' || replace(gen_random_uuid()::text, '-', ''))
  returning id into result;

  insert into public.catalog_product_translations(
    product_id, locale, name, badge, short_description, description
  )
  select result, locale, '', '', '', ''
  from unnest(array['en', 'th', 'ja', 'zh-CN']) locale;

  return result;
end;
$$;

revoke all on function public.admin_create_catalog_product() from public, anon, authenticated;
grant execute on function public.admin_create_catalog_product() to service_role;

commit;
