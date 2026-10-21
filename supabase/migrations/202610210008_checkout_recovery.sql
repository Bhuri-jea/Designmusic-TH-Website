begin;
-- An uncertain Stripe create retains the reservation until an operator verifies it.
create or replace function public.flag_checkout_review(p_order_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status not in ('pending','failed') or o.checkout_session_id is not null or o.expires_at>now() then return false;end if;
 insert into public.outbox(topic,dedupe_key,status,payload,last_error)
 values('checkout_review','checkout:'||o.id||':uncertain','review',jsonb_build_object('orderId',o.id,'reason','Checkout creation is uncertain. Check Stripe before releasing stock or starting another payment.'),'checkout_session_unconfirmed')
 on conflict(dedupe_key) do nothing;
 return true;
end; $$;
create or replace function public.record_order_payment_time(p_order_id uuid,p_paid_at timestamptz,p_estimated boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_paid_at is null or p_estimated is null or p_paid_at>now()+interval '5 minutes' then raise exception 'invalid_payment_time' using errcode='22023';end if;
 update public.orders set paid_at=p_paid_at,paid_at_estimated=p_estimated
 where id=p_order_id and status='paid' and (paid_at is null or paid_at_estimated or not p_estimated);
 return found;
end; $$;
create or replace function public.customer_orders_page(p_customer_id uuid,p_page integer default 1,p_page_size integer default 5) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if p_page is null or p_page_size is null or p_page<1 or p_page>1000000 or p_page_size not in (5,50) then raise exception 'invalid_order_page' using errcode='22023';end if;
 return jsonb_build_object('orders',coalesce((select jsonb_agg(public.order_record(o.id) order by o.created_at desc,o.id desc) from
 (select id,created_at from public.orders where customer_id=p_customer_id order by created_at desc,id desc limit p_page_size offset (p_page-1)*p_page_size)o),'[]'::jsonb),
 'total',(select count(*) from public.orders where customer_id=p_customer_id));
end; $$;
revoke all on function public.flag_checkout_review(uuid),public.record_order_payment_time(uuid,timestamptz,boolean),public.customer_orders_page(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.flag_checkout_review(uuid),public.record_order_payment_time(uuid,timestamptz,boolean),public.customer_orders_page(uuid,integer,integer) to service_role;
commit;
