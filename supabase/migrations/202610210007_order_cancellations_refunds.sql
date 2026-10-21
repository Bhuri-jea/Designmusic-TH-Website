begin;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists paid_at_estimated boolean not null default false;
alter table public.orders add column if not exists payment_intent_id text;
alter table public.orders add column if not exists cancellation_status text not null default 'none'
 check(cancellation_status in ('none','requested','cancelled','review'));
alter table public.orders add column if not exists cancellation_reason text;
create unique index if not exists orders_payment_intent_unique on public.orders(payment_intent_id) where payment_intent_id is not null;

create table public.order_cancellations(
 order_id uuid primary key references public.orders(id),id uuid not null unique default gen_random_uuid(),
 actor text not null,reason text not null,restock jsonb not null default '{}',restock_applied boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 refund_id text,refund_amount bigint,merchandise_minor bigint,shipping_minor bigint,
 last_error text
);
create table public.order_refunds(
 id text primary key,order_id uuid not null references public.orders(id),payment_intent_id text not null,
 amount bigint not null check(amount>0),currency text not null check(currency in ('usd','jpy','thb')),
 status text not null check(status in ('pending','requires_action','succeeded','failed','canceled')),
 created_at timestamptz not null,updated_at timestamptz not null default now(),
 merchandise_minor bigint,shipping_minor bigint,reason text,
 check((merchandise_minor is null and shipping_minor is null) or
  (merchandise_minor>=0 and shipping_minor>=0 and merchandise_minor+shipping_minor=amount))
);
alter table public.order_cancellations enable row level security;
alter table public.order_refunds enable row level security;
revoke all on public.order_cancellations,public.order_refunds from public,anon,authenticated;
grant all on public.order_cancellations,public.order_refunds to service_role;
create index order_refunds_order on public.order_refunds(order_id);
create index order_refunds_reporting on public.order_refunds(created_at) where status='succeeded';
create index orders_paid_reporting on public.orders(paid_at) where status='paid';

update public.orders o set paid_at=coalesce((select min(event_created) from public.stripe_events e
 where e.order_id=o.id and e.event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded')),o.created_at),
 paid_at_estimated=not exists(select 1 from public.stripe_events e where e.order_id=o.id and e.event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded'))
 where status='paid' and paid_at is null;

-- Preserve established payment validation and fulfillment; only extend projections and timestamps.
alter function public.order_record(uuid) rename to order_record_before_refunds;
create function public.order_record(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select public.order_record_before_refunds(p_id)||jsonb_build_object('paidAt',o.paid_at,'paidAtEstimated',o.paid_at_estimated,
 'paymentIntentId',o.payment_intent_id,'cancellationStatus',o.cancellation_status,'cancellationReason',o.cancellation_reason,
 'refundedAmount',coalesce((select sum(amount) from public.order_refunds where order_id=o.id and status='succeeded'),0),
 'refundStatus',case when coalesce((select sum(amount) from public.order_refunds where order_id=o.id and status='succeeded'),0)=o.amount_total then 'succeeded'
  when exists(select 1 from public.order_refunds where order_id=o.id and status in ('pending','requires_action')) then 'pending'
  when exists(select 1 from public.order_refunds where order_id=o.id and status='failed') then 'failed'
  when exists(select 1 from public.order_refunds where order_id=o.id and status='succeeded') then 'succeeded' else null end)
 from public.orders o where o.id=p_id
$$;
alter function public.admin_shipping_record(uuid) rename to admin_shipping_record_before_refunds;
create function public.admin_shipping_record(p_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select public.admin_shipping_record_before_refunds(p_order_id)||jsonb_build_object(
 'cancellation_status',o.cancellation_status,'cancellation_reason',o.cancellation_reason,
 'refunded_amount',public.order_record(o.id)->'refundedAmount','refund_status',public.order_record(o.id)->'refundStatus')
 from public.orders o where o.id=p_order_id
$$;
alter function public.apply_stripe_event(text,text,uuid,text,text,bigint,text,jsonb,timestamptz) rename to apply_stripe_event_before_refunds;
create function public.apply_stripe_event(p_event_id text,p_event_type text,p_order_id uuid,p_session_id text,p_currency text,p_amount_total bigint,p_payment_status text,p_shipping jsonb,p_event_created timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.apply_stripe_event_before_refunds(p_event_id,p_event_type,p_order_id,p_session_id,p_currency,p_amount_total,p_payment_status,p_shipping,p_event_created);
 update public.orders set paid_at=p_event_created,paid_at_estimated=p_event_id like 'reconcile:%'
 where id=p_order_id and status='paid' and (paid_at is null or paid_at_estimated and p_event_id not like 'reconcile:%');
 return public.order_record(p_order_id);
end; $$;

create function public.protect_cancelled_shipment() returns trigger language plpgsql security definer set search_path='' as $$
declare state text;
begin
 select cancellation_status into state from public.orders where id=new.order_id for update;
 if state<>'none' then
  if tg_op='UPDATE' and old.hold and not new.hold then raise exception 'order_cancellation_on_hold' using errcode='23514';end if;
  if new.status='shipped' and (tg_op='INSERT' or old.status is distinct from 'shipped') then raise exception 'order_cancelled' using errcode='23514';end if;
  new.hold:=true;
  new.hold_reason:=coalesce(new.hold_reason,'Cancellation or refund in progress');
 end if;
 return new;
end; $$;
create trigger protect_cancelled_shipment before insert or update on public.shipments for each row execute function public.protect_cancelled_shipment();

create function public.begin_order_cancellation(p_order_id uuid,p_reason text,p_restock jsonb,p_actor text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders;s public.shipments;c public.order_cancellations;r record;qty integer;
begin
 if coalesce(btrim(p_reason),'')='' or length(p_reason)>1000 or coalesce(btrim(p_actor),'')='' or jsonb_typeof(p_restock)<>'object' or p_restock is null then raise exception 'invalid_cancellation' using errcode='22023';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'order_not_found' using errcode='P0002';end if;
 select * into c from public.order_cancellations where order_id=p_order_id;
 if found then
  if c.reason<>btrim(p_reason) or c.restock<>p_restock then raise exception 'cancellation_changed' using errcode='23514';end if;
  return to_jsonb(c)||jsonb_build_object('order',public.order_record(p_order_id));
 end if;
 select * into s from public.shipments where order_id=p_order_id for update;
 if s.status='shipped' or o.status not in ('paid','pending','failed') or o.cancellation_status<>'none' then raise exception 'order_not_cancellable' using errcode='23514';end if;
 for r in select key,value from jsonb_each(p_restock) loop
  if r.value::text !~ '^[0-9]+$' then raise exception 'invalid_restock' using errcode='22023';end if;
  select quantity into qty from public.order_items where order_id=p_order_id and sku=r.key;
  if qty is null or (r.value::text)::integer>qty then raise exception 'invalid_restock' using errcode='22023';end if;
  if o.status<>'paid' and (r.value::text)::integer>0 then raise exception 'invalid_restock' using errcode='22023';end if;
 end loop;
 insert into public.order_cancellations(order_id,reason,restock,actor) values(p_order_id,btrim(p_reason),p_restock,p_actor) returning * into c;
 update public.orders set cancellation_status='requested',cancellation_reason=btrim(p_reason) where id=p_order_id;
 update public.shipments set hold=true,hold_reason=btrim(p_reason) where order_id=p_order_id;
 return to_jsonb(c)||jsonb_build_object('order',public.order_record(p_order_id));
end; $$;

create function public.link_order_payment(p_order_id uuid,p_payment_intent text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_payment_intent !~ '^pi_[A-Za-z0-9_]+$' then raise exception 'invalid_payment' using errcode='22023';end if;
 update public.orders set payment_intent_id=p_payment_intent where id=p_order_id and (payment_intent_id is null or payment_intent_id=p_payment_intent);
 if not found then raise exception 'payment_mismatch' using errcode='23514';end if;return true;
end; $$;

create function public.prepare_order_refund(p_order_id uuid,p_amount bigint,p_merchandise bigint,p_shipping bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.order_cancellations;
begin
 perform 1 from public.orders where id=p_order_id for update;
 select * into c from public.order_cancellations where order_id=p_order_id for update;
 if not found then raise exception 'cancellation_required' using errcode='23514';end if;
 if c.refund_amount is null then
  if p_amount<=0 or p_amount is null or p_amount>(select amount_total from public.orders where id=p_order_id) then raise exception 'invalid_refund' using errcode='22023';end if;
  if (p_merchandise is null)<>(p_shipping is null) or p_merchandise<0 or p_shipping<0 or p_merchandise+p_shipping<>p_amount then raise exception 'invalid_refund_allocation' using errcode='22023';end if;
  update public.order_cancellations set refund_amount=p_amount,merchandise_minor=p_merchandise,shipping_minor=p_shipping where order_id=p_order_id returning * into c;
 end if;
 return to_jsonb(c);
end; $$;

create function public.record_order_refund(p_id text,p_order_id uuid,p_payment_intent text,p_amount bigint,p_currency text,p_status text,p_created_at timestamptz,p_operation uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;c public.order_cancellations;existing public.order_refunds;total bigint;r record;
begin
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.payment_intent_id is distinct from p_payment_intent or o.currency<>p_currency or p_amount<=0 or p_amount>o.amount_total
 or p_id !~ '^re_[A-Za-z0-9_]+$' or p_status not in ('pending','requires_action','succeeded','failed','canceled') then raise exception 'refund_mismatch' using errcode='23514';end if;
 select * into c from public.order_cancellations where order_id=p_order_id;
 if p_operation is not null and (c.id is distinct from p_operation or c.refund_amount<>p_amount or c.refund_id is not null and c.refund_id<>p_id) then raise exception 'refund_mismatch' using errcode='23514';end if;
 select * into existing from public.order_refunds where id=p_id;
 if found and (existing.order_id<>p_order_id or existing.amount<>p_amount or existing.currency<>p_currency) then raise exception 'refund_mismatch' using errcode='23514';end if;
 -- Terminal provider states cannot be undone by a late pending event.
 if existing.status in ('succeeded','failed','canceled') and existing.status<>p_status then return public.order_record(p_order_id);end if;
 insert into public.order_refunds(id,order_id,payment_intent_id,amount,currency,status,created_at,merchandise_minor,shipping_minor)
 values(p_id,p_order_id,p_payment_intent,p_amount,p_currency,p_status,p_created_at,
  case when p_operation is not null then c.merchandise_minor when p_amount=o.amount_total then o.amount_total-o.shipping_minor else null end,
  case when p_operation is not null then c.shipping_minor when p_amount=o.amount_total then o.shipping_minor else null end)
 on conflict(id) do update set status=excluded.status,updated_at=now();
 if p_operation is not null then update public.order_cancellations set refund_id=p_id,last_error=case when p_status in ('failed','canceled') then 'refund_'||p_status else null end,updated_at=now() where order_id=p_order_id;end if;
 select coalesce(sum(amount),0) into total from public.order_refunds where order_id=p_order_id and status='succeeded';
 if total>o.amount_total then raise exception 'refund_exceeds_payment' using errcode='23514';end if;
 update public.orders set cancellation_status=case when total=o.amount_total then 'cancelled' when p_status in ('failed','canceled') then 'review' else case when cancellation_status='none' then 'requested' else cancellation_status end end where id=p_order_id;
 update public.shipments set hold=true,hold_reason=coalesce(o.cancellation_reason,'Refund received from Stripe') where order_id=p_order_id;
 if total=o.amount_total and c.id is not null and not c.restock_applied then
  for r in select key,value from jsonb_each(c.restock) order by key loop
   update public.inventory set on_hand=on_hand+(r.value::text)::integer,updated_at=now() where sku=r.key;
  end loop;
  update public.order_cancellations set restock_applied=true,updated_at=now() where order_id=p_order_id;
 end if;
 if existing.id is null or existing.status is distinct from p_status then
  insert into public.outbox(topic,dedupe_key,payload)
  select audience,'refund:'||p_id||':'||p_status||':'||audience,jsonb_build_object('orderId',o.id,'refundId',p_id,'recipient',cu.email,'currency',o.currency,'amount',p_amount,'refundStatus',p_status,'locale',o.locale,'reason',o.cancellation_reason)
  from public.customers cu cross join unnest(array['order_refund_buyer','order_refund_seller']) audience where cu.id=o.customer_id on conflict(dedupe_key) do nothing;
 end if;
 return public.order_record(p_order_id);
end; $$;

create function public.finish_unpaid_cancellation(p_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_order_id for update;
 if o.status<>'expired' or not exists(select 1 from public.order_cancellations where order_id=p_order_id) then raise exception 'unverified_cancellation' using errcode='23514';end if;
 update public.orders set cancellation_status='cancelled' where id=p_order_id;
 insert into public.outbox(topic,dedupe_key,payload)
 select audience,'cancel:'||o.id||':'||audience,jsonb_build_object('orderId',o.id,'recipient',c.email,'currency',o.currency,'amount',0,'refundStatus','cancelled','locale',o.locale,'reason',o.cancellation_reason)
 from public.customers c cross join unnest(array['order_refund_buyer','order_refund_seller']) audience where c.id=o.customer_id on conflict(dedupe_key) do nothing;
 return public.order_record(p_order_id);
end; $$;
create function public.review_order_cancellation(p_order_id uuid,p_error text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.orders set cancellation_status='review' where id=p_order_id and cancellation_status<>'cancelled';
 update public.order_cancellations set last_error=left(p_error,100),updated_at=now() where order_id=p_order_id;
 return true;
end; $$;

create function public.admin_cancellation_queue() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.order_record(o.id)||jsonb_build_object('cancellation',to_jsonb(c)) order by o.created_at desc),'[]'::jsonb)
 from public.orders o left join public.order_cancellations c on c.order_id=o.id
 where c.order_id is not null or o.cancellation_status<>'none' or (o.status in ('pending','failed','review') and o.expires_at>now()-interval '30 days')
$$;
create function public.recoverable_order_cancellations() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(candidate)),'[]'::jsonb) from (
  select c.order_id,c.reason,c.restock,c.actor from public.order_cancellations c join public.orders o on o.id=c.order_id
  where c.refund_id is null and o.cancellation_status in ('requested','review') and o.checkout_session_id is not null
   and c.created_at>now()-interval '23 hours' order by c.updated_at,c.order_id limit 2
 ) candidate
$$;
do $$ declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (
 'order_record','admin_shipping_record','apply_stripe_event','begin_order_cancellation','link_order_payment','prepare_order_refund','record_order_refund','finish_unpaid_cancellation','review_order_cancellation','admin_cancellation_queue','recoverable_order_cancellations') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
