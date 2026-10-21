begin;
alter table public.order_refunds add column if not exists allocated_by text;
alter table public.order_refunds add column if not exists allocated_at timestamptz;
create or replace function public.admin_allocate_refund(p_id text,p_merchandise bigint,p_shipping bigint,p_actor text)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.order_refunds;o public.orders;allocated_merchandise bigint;allocated_shipping bigint;
begin
 if p_merchandise is null or p_shipping is null or p_merchandise<0 or p_shipping<0 or coalesce(btrim(p_actor),'')='' then raise exception 'invalid_refund_allocation' using errcode='22023';end if;
 select * into r from public.order_refunds where id=p_id;
 if not found then raise exception 'refund_not_found' using errcode='P0002';end if;
 -- Use the same order-before-refund lock order as provider reconciliation.
 select * into o from public.orders where id=r.order_id for update;
 select * into r from public.order_refunds where id=p_id for update;
 if r.status<>'succeeded' or p_merchandise>r.amount or p_shipping>r.amount or p_merchandise<>r.amount-p_shipping then raise exception 'refund_allocation_changed' using errcode='23514';end if;
 if r.merchandise_minor is not null or r.shipping_minor is not null then
  if r.merchandise_minor=p_merchandise and r.shipping_minor=p_shipping then return true;end if;
  raise exception 'refund_allocation_changed' using errcode='23514';
 end if;
 select coalesce(sum(merchandise_minor),0),coalesce(sum(shipping_minor),0) into allocated_merchandise,allocated_shipping
 from public.order_refunds where order_id=r.order_id and status='succeeded' and id<>p_id;
 if allocated_merchandise+p_merchandise>o.amount_total-o.shipping_minor or allocated_shipping+p_shipping>o.shipping_minor then
  raise exception 'refund_allocation_exceeds_order' using errcode='23514';
 end if;
 update public.order_refunds set merchandise_minor=p_merchandise,shipping_minor=p_shipping,allocated_by=btrim(p_actor),allocated_at=now(),updated_at=now() where id=p_id;
 return true;
end;$$;
revoke all on function public.admin_allocate_refund(text,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.admin_allocate_refund(text,bigint,bigint,text) to service_role;
commit;
