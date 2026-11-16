begin;
-- Serialize publication with ordering and append products when they become public.
create or replace function public.admin_set_catalog_lifecycle(p_product_id uuid,p_lifecycle text)
returns void language plpgsql security definer set search_path='' as $$
declare previous_lifecycle text; trailing_position integer;
begin
 lock table public.catalog_products in share row exclusive mode;
 if p_lifecycle not in('draft','published','archived') then raise exception 'invalid_lifecycle' using errcode='22023'; end if;
 select lifecycle into previous_lifecycle from public.catalog_products where id=p_product_id;
 if not found then raise exception 'catalog_product_not_found' using errcode='P0002';end if;
 if p_lifecycle='published' and ((select count(*) from public.catalog_product_translations where product_id=p_product_id)<>4 or not exists(select 1 from public.catalog_product_images where product_id=p_product_id and is_primary) or not exists(select 1 from public.inventory where product_id=p_product_id and lifecycle='active')) then raise exception 'catalog_incomplete' using errcode='23514'; end if;
 if p_lifecycle='published' and previous_lifecycle<>'published' then
  -- Normalize only positions, retaining the current relative order and leaving room to append.
  with ordered as (select id,(row_number() over(order by display_order,created_at,id)-1)::integer as position from public.catalog_products where lifecycle='published')
  update public.catalog_products p set display_order=o.position from ordered o where p.id=o.id;
  select count(*)::integer into trailing_position from public.catalog_products where lifecycle='published';
  update public.catalog_products set display_order=trailing_position where id=p_product_id;
 end if;
 update public.catalog_products set lifecycle=p_lifecycle,published_at=case when p_lifecycle='published' then coalesce(published_at,now()) else published_at end,updated_at=now() where id=p_product_id;
 if p_lifecycle='archived' then update public.inventory set lifecycle='archived' where product_id=p_product_id;end if;
 update public.inventory set product_lifecycle=p_lifecycle where product_id=p_product_id;
end;
$$;
revoke all on function public.admin_set_catalog_lifecycle(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_set_catalog_lifecycle(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
