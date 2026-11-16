-- Run against a disposable database after the ordering migration.
begin;
insert into public.catalog_products(id,slug,lifecycle,created_at,display_order) values
 ('11111111-1111-4111-8111-111111111111','first','published','2026-01-01',0),
 ('22222222-2222-4222-8222-222222222222','second','published','2026-01-02',1),
 ('33333333-3333-4333-8333-333333333333','draft','draft','2026-01-03',2),
 ('44444444-4444-4444-8444-444444444444','archived','archived','2026-01-04',3);
do $$
declare a uuid:='11111111-1111-4111-8111-111111111111'; b uuid:='22222222-2222-4222-8222-222222222222'; c uuid:='33333333-3333-4333-8333-333333333333'; actual uuid[];
begin
 perform public.admin_reorder_catalog_products(array[b,a],array[a,b]);
 select array_agg(id order by display_order,created_at,id) into actual from public.catalog_products where lifecycle='published';
 if actual<>array[b,a] then raise exception 'Order not saved';end if;
 if (select display_order from public.catalog_products where id=c)<>2 then raise exception 'Draft changed';end if;
 if (select slug from public.catalog_products where id=a)<>'first' then raise exception 'Content changed';end if;
 begin perform public.admin_reorder_catalog_products(array[a,b],array[a,b]);raise exception 'Stale save accepted';exception when serialization_failure then null;end;
 begin perform public.admin_reorder_catalog_products(array[a,a],array[b,a]);raise exception 'Duplicate accepted';exception when check_violation then null;end;
 begin perform public.admin_reorder_catalog_products(array[a],array[b,a]);raise exception 'Incomplete list accepted';exception when check_violation then null;end;
 begin perform public.admin_reorder_catalog_products(array[a,c],array[b,a]);raise exception 'Draft accepted';exception when check_violation then null;end;
 begin perform public.admin_reorder_catalog_products(null,array[b,a]);raise exception 'Null accepted';exception when check_violation then null;end;
 select array_agg(id order by display_order,created_at,id) into actual from public.catalog_products where lifecycle='published';
 if actual<>array[b,a] then raise exception 'Failed save changed order';end if;
 insert into public.catalog_products(id,slug,lifecycle,created_at) values('55555555-5555-4555-8555-555555555555','new-product','published','2026-02-01');
 select array_agg(id order by display_order,created_at,id) into actual from public.catalog_products where lifecycle='published';
 if actual[3]<>'55555555-5555-4555-8555-555555555555'::uuid then raise exception 'New product did not append';end if;
 begin perform public.admin_reorder_catalog_products(array[a,b],array[b,a]);raise exception 'New publication lost';exception when check_violation then null;end;
 insert into public.catalog_product_translations(product_id,locale) select p.id,l.locale from public.catalog_products p cross join (values('en'),('th'),('ja'),('zh-CN')) l(locale);
 insert into public.catalog_product_images(product_id,is_primary) select id,true from public.catalog_products;
 insert into public.inventory(product_id,lifecycle,product_lifecycle) select id,'active',lifecycle from public.catalog_products;
 perform public.admin_set_catalog_lifecycle(c,'published');
 select array_agg(id order by display_order,created_at,id) into actual from public.catalog_products where lifecycle='published';
 if actual[4]<>c then raise exception 'Older draft did not append after later products';end if;
 perform public.admin_set_catalog_lifecycle(a,'draft');
 perform public.admin_set_catalog_lifecycle(a,'published');
 select array_agg(id order by display_order,created_at,id) into actual from public.catalog_products where lifecycle='published';
 if actual[4]<>a then raise exception 'Republished product did not append';end if;
 if has_function_privilege('anon','public.admin_reorder_catalog_products(uuid[],uuid[])','execute') or has_function_privilege('authenticated','public.admin_reorder_catalog_products(uuid[],uuid[])','execute') then raise exception 'Public execute granted';end if;
 if not has_function_privilege('service_role','public.admin_reorder_catalog_products(uuid[],uuid[])','execute') then raise exception 'Server cannot save';end if;
end $$;
rollback;
