begin;

-- Rotate through provider reads durably, including open sessions and errors.
alter table public.orders add column reconciliation_checked_at timestamptz;
create index orders_reconciliation_rotation on public.orders(reconciliation_checked_at nulls first,expires_at,id)
 where status in ('pending','failed') and checkout_session_id is not null;
create function public.mark_order_reconciliation_attempt(p_order_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.orders set reconciliation_checked_at=clock_timestamp() where id=p_order_id;
 return found;
end $$;

-- Preserve the complete effective constructor and its privileges. Abort rather
-- than silently editing an unexpected deployed definition.
do $$
declare definition text;needle text:='jsonb_array_length(p_lines) not between 1 and 9';
begin
 definition:=pg_get_functiondef('public.reserve_order_with_hold(uuid,uuid,text,text,jsonb,bigint,text,jsonb)'::regprocedure);
 if position(needle in definition)=0 or position(needle in substring(definition from position(needle in definition)+length(needle)))>0 then
  raise exception 'unexpected_reserve_order_constructor';
 end if;
 execute replace(definition,needle,'jsonb_array_length(p_lines) not between 1 and 20');
end $$;
alter table public.shipping_quotes drop constraint shipping_quotes_items_check;
alter table public.shipping_quotes add constraint shipping_quotes_items_check
 check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 20);

-- A pending cancellation has no allocated stock yet. If payment wins the race,
-- a seller must review its restock choice before the refund can be prepared.
alter table public.order_cancellations add column restock_review_required boolean not null default false;
update public.order_cancellations c set restock_review_required=true
 where c.refund_amount is null and c.refund_id is null and not c.restock_applied
 and exists(select 1 from public.orders o where o.id=c.order_id and o.status in ('pending','failed'));

drop function public.begin_order_cancellation(uuid,text,jsonb,text);
create function public.begin_order_cancellation(
 p_order_id uuid,p_reason text,p_restock jsonb,p_actor text,p_expected_status text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;s public.shipments;c public.order_cancellations;r record;qty integer;amendable boolean;
begin
 if coalesce(btrim(p_reason),'')='' or length(p_reason)>1000 or coalesce(btrim(p_actor),'')=''
  or jsonb_typeof(p_restock)<>'object' or p_restock is null then raise exception 'invalid_cancellation' using errcode='22023';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'order_not_found' using errcode='P0002';end if;
 if p_expected_status in ('pending','failed') and o.status in ('paid','review') then
  return jsonb_build_object('restockReviewRequired',true,'order',public.order_record(p_order_id));
 end if;
 select * into c from public.order_cancellations where order_id=p_order_id for update;
 select * into s from public.shipments where order_id=p_order_id for update;
 if c.id is not null then
  amendable:=c.restock_review_required and o.status='paid' and s.status is distinct from 'shipped'
   and o.cancellation_status in ('requested','review') and c.refund_amount is null and c.refund_id is null and not c.restock_applied;
  if c.reason<>btrim(p_reason) or c.restock<>p_restock and not amendable then
   raise exception 'cancellation_changed' using errcode='23514';end if;
  if not amendable then return to_jsonb(c)||jsonb_build_object('order',public.order_record(p_order_id));end if;
 else
  if s.status='shipped' or not (
   o.status in ('paid','pending','failed') and o.cancellation_status='none'
   or o.status='paid' and o.cancellation_status in ('requested','review')
     and exists(select 1 from public.order_refunds where order_id=p_order_id)
   or o.status='review' and o.paid_at is not null and o.cancellation_status='review'
  ) then raise exception 'order_not_cancellable' using errcode='23514';end if;
 end if;
 for r in select key,value from jsonb_each(p_restock) loop
  if r.value::text !~ '^[0-9]+$' then raise exception 'invalid_restock' using errcode='22023';end if;
  select quantity into qty from public.order_items where order_id=p_order_id and sku=r.key;
  if qty is null or (r.value::text)::integer>qty or o.status<>'paid' and (r.value::text)::integer>0 then
   raise exception 'invalid_restock' using errcode='22023';end if;
 end loop;
 if c.id is not null then
  update public.order_cancellations set restock=p_restock,restock_review_required=false,actor=p_actor,updated_at=now()
   where order_id=p_order_id returning * into c;
 else
  insert into public.order_cancellations(order_id,reason,restock,actor,restock_review_required)
   values(p_order_id,btrim(p_reason),p_restock,p_actor,o.status in ('pending','failed')) returning * into c;
 end if;
 update public.orders set cancellation_status='requested',cancellation_reason=btrim(p_reason) where id=p_order_id;
 update public.shipments set hold=true,hold_reason=btrim(p_reason) where order_id=p_order_id;
 return to_jsonb(c)||jsonb_build_object('order',public.order_record(p_order_id));
end $$;

alter function public.prepare_order_refund(uuid,bigint,bigint,bigint) rename to prepare_order_refund_before_recovery;
create function public.prepare_order_refund(p_order_id uuid,p_amount bigint,p_merchandise bigint,p_shipping bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.orders where id=p_order_id for update;
 if exists(select 1 from public.order_cancellations c join public.orders o on o.id=c.order_id
  where c.order_id=p_order_id and c.restock_review_required and o.status='paid') then
  raise exception 'cancellation_restock_review_required' using errcode='23514';
 end if;
 return public.prepare_order_refund_before_recovery(p_order_id,p_amount,p_merchandise,p_shipping);
end $$;

create or replace function public.recoverable_order_cancellations() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(candidate)),'[]'::jsonb) from (
  select c.order_id,c.reason,c.restock,c.actor from public.order_cancellations c join public.orders o on o.id=c.order_id
  where c.refund_id is null and o.cancellation_status in ('requested','review') and o.checkout_session_id is not null
   and not (c.restock_review_required and o.status='paid')
   and c.created_at>now()-interval '23 hours' order by c.updated_at,c.order_id limit 2
 ) candidate
$$;

revoke all on function public.prepare_order_refund_before_recovery(uuid,bigint,bigint,bigint) from public,anon,authenticated,service_role;
revoke all on function public.mark_order_reconciliation_attempt(uuid),public.prepare_order_refund(uuid,bigint,bigint,bigint),public.begin_order_cancellation(uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.mark_order_reconciliation_attempt(uuid),public.prepare_order_refund(uuid,bigint,bigint,bigint),public.begin_order_cancellation(uuid,text,jsonb,text,text) to service_role;
commit;
