begin;
do $$
declare category jsonb;
begin
 if has_table_privilege('anon','public.catalog_collections','insert')
 or has_function_privilege('authenticated','public.admin_create_catalog_collection(text,text)','execute') then raise exception 'public users can modify categories'; end if;
 category:=public.admin_create_catalog_collection('Test instrument parts','en');
 if category->'labels'->>'en'<>'Test instrument parts' or category->>'slug'<>'test-instrument-parts' then raise exception 'friendly category name missing'; end if;
 begin
  perform public.admin_create_catalog_collection('Test instrument parts','en');
  raise exception 'duplicate category accepted';
 exception when unique_violation then null;
 end;
 category:=public.admin_create_catalog_collection('อะไหล่ทดสอบ','th');
 if category->'labels'->>'th'<>'อะไหล่ทดสอบ' then raise exception 'Thai category label lost'; end if;
end $$;
rollback;
