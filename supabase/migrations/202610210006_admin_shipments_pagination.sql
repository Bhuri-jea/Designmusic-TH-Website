begin;
create or replace function public.admin_shipments_page(p_page integer default 1,p_page_size integer default 5)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_page is null or p_page<1 or p_page>1000000 or p_page_size is null or p_page_size not in (5,50) then
  raise exception 'invalid_pagination' using errcode='22023';
 end if;
 select jsonb_build_object('total',(select count(*) from public.orders o join public.shipments s on s.order_id=o.id where o.status='paid'),
  'shipments',coalesce((select jsonb_agg(public.admin_shipping_record(p.id) order by p.created_at desc,p.id desc)
   from (select o.id,o.created_at from public.orders o join public.shipments s on s.order_id=o.id
    where o.status='paid' order by o.created_at desc,o.id desc
    limit p_page_size offset (p_page-1)*p_page_size) p),'[]'::jsonb)) into result;
 return result;
end; $$;
revoke all on function public.admin_shipments_page(integer,integer) from public,anon,authenticated;
grant execute on function public.admin_shipments_page(integer,integer) to service_role;
commit;
