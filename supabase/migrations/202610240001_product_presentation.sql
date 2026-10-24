begin;

alter table public.catalog_products
 add column if not exists presentation jsonb not null default '{"optionStyles":{},"reviews":[]}'::jsonb
 check (jsonb_typeof(presentation)='object');

-- Both saves run in the same transaction; a failure leaves the complete product unchanged.
create or replace function public.admin_save_catalog_product_with_presentation(p_payload jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare product uuid; settings jsonb;
begin
 settings:=p_payload->'presentation';
 if settings is not null and (
  jsonb_typeof(settings) is distinct from 'object'
  or jsonb_typeof(settings->'optionStyles') is distinct from 'object'
  or jsonb_typeof(settings->'reviews') is distinct from 'array'
 ) then raise exception 'invalid_catalog_presentation' using errcode='23514'; end if;
 product:=public.admin_save_catalog_product(p_payload);
 if settings is not null then
  update public.catalog_products set presentation=settings where id=product;
 end if;
 return product;
end;
$$;
revoke all on function public.admin_save_catalog_product_with_presentation(jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_catalog_product_with_presentation(jsonb) to service_role;

commit;
