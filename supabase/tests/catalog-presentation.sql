-- Acceptance checks for a disposable local/test database with all migrations applied.
begin;
do $$
declare product uuid; payload jsonb; saved jsonb;
begin
 if has_function_privilege('anon','public.admin_save_catalog_product_with_presentation(jsonb)','execute')
 or has_function_privilege('authenticated','public.admin_save_catalog_product_with_presentation(jsonb)','execute')
 or not has_function_privilege('service_role','public.admin_save_catalog_product_with_presentation(jsonb)','execute') then
  raise exception 'presentation save grants are incorrect';
 end if;
 product:=public.admin_create_catalog_product();
 payload:=jsonb_build_object('id',product,'slug','presentation-test-'||product::text,'collectionSlug',null,
 'translations','[]'::jsonb,'images','[]'::jsonb,'optionGroups','[]'::jsonb,'skus','[]'::jsonb,
 'presentation','{"optionStyles":{},"reviews":[{"name":"Customer","rating":5,"impression":"Good"}]}'::jsonb);
 perform public.admin_save_catalog_product_with_presentation(payload);
 select presentation into saved from public.catalog_products where id=product;
 if saved<>payload->'presentation' then raise exception 'presentation was not saved'; end if;
 begin
  perform public.admin_save_catalog_product_with_presentation(payload||'{"slug":"must-not-save","presentation":{"optionStyles":[],"reviews":[]}}'::jsonb);
  raise exception 'invalid presentation was accepted';
 exception when check_violation then null;
 end;
 if (select slug from public.catalog_products where id=product)<>payload->>'slug' then raise exception 'failed save changed the product'; end if;
 begin
  perform public.admin_save_catalog_product_with_presentation(payload||'{"slug":"must-not-save","presentation":{"optionStyles":{},"reviews":[]},"skus":[{"sku":"invalid-test-stock","onHand":-1,"optionValueCodes":[],"salesMode":"checkout","lifecycle":"active"}]}'::jsonb);
  raise exception 'invalid stock was accepted';
 exception when check_violation then null;
 end;
 if (select presentation from public.catalog_products where id=product)<>saved
 or (select slug from public.catalog_products where id=product)<>payload->>'slug' then raise exception 'failed SKU save partially saved presentation'; end if;
 payload:=payload||jsonb_build_object('skus',jsonb_build_array(jsonb_build_object('sku','presentation-stock-'||product::text,'optionValueCodes','[]'::jsonb,'onHand',1,'usd',1,'jpy',100,'thb',30,'weightKg',0.1,'salesMode','checkout','lifecycle','active')));
 perform public.admin_save_catalog_product_with_presentation(payload);
 perform public.admin_set_catalog_lifecycle(product,'archived');
 if exists(select 1 from public.inventory where product_id=product and lifecycle<>'archived') then raise exception 'archive left a sellable SKU'; end if;
 perform public.admin_set_catalog_lifecycle(product,'draft');
 if exists(select 1 from public.inventory where product_id=product and lifecycle<>'archived') then raise exception 'restore reactivated discontinued stock'; end if;
end;
$$;
rollback;
