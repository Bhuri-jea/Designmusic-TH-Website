begin;

alter table public.catalog_products add column if not exists display_order integer not null default 2147483647 check(display_order>=0);
-- Preserve the existing catalog order; repeated application keeps later manual ordering.
with initial as (
 select id,(row_number() over(order by created_at,id)-1)::integer as position
 from public.catalog_products
)
update public.catalog_products p set display_order=i.position from initial i
where p.id=i.id and p.display_order=2147483647;
create index if not exists catalog_products_display_order on public.catalog_products(display_order,created_at,id);

create or replace function public.admin_reorder_catalog_products(p_product_ids uuid[],p_expected_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_ids uuid[];
begin
 -- Short catalog-only lock prevents concurrent publication or reorder from losing entries.
 lock table public.catalog_products in share row exclusive mode;
 select coalesce(array_agg(id order by display_order,created_at,id),'{}'::uuid[])
 into current_ids from public.catalog_products where lifecycle='published';
 if p_product_ids is null or p_expected_ids is null or cardinality(p_product_ids)>500
 or array_position(p_product_ids,null) is not null
 or cardinality(p_product_ids)<>cardinality(current_ids)
 or (select count(distinct id) from unnest(p_product_ids) id)<>cardinality(current_ids)
 or exists(select unnest(p_product_ids) except select unnest(current_ids)) then
  raise exception 'invalid_catalog_order' using errcode='23514';
 end if;
 if p_expected_ids is distinct from current_ids then
  raise exception 'catalog_order_changed' using errcode='40001';
 end if;
 update public.catalog_products p set display_order=(o.position-1)::integer
 from unnest(p_product_ids) with ordinality o(id,position) where p.id=o.id;
 return jsonb_build_object('ids',p_product_ids);
end;
$$;
revoke all on function public.admin_reorder_catalog_products(uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.admin_reorder_catalog_products(uuid[],uuid[]) to service_role;
notify pgrst,'reload schema';
commit;
