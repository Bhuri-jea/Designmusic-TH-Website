create extension if not exists pgcrypto;

create table public.inventory (
  sku text primary key,
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= on_hand),
  updated_at timestamptz not null default now()
);
insert into public.inventory (sku) values
 ('endplug-plain'), ('endplug-twoColor'), ('endplug-custom'),
 ('shakuhachi-standard-balance'), ('shakuhachi-standard-traditional'), ('shakuhachi-standard-modern'),
 ('shakuhachi-large-balance'), ('shakuhachi-large-traditional'), ('shakuhachi-large-modern')
on conflict do nothing;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  request_key uuid not null,
  fingerprint text not null,
  currency text not null check (currency in ('usd','jpy','thb')),
  locale text not null check (locale in ('en','ja','zh-CN','th')),
  amount_total bigint not null check (amount_total > 0),
  status text not null default 'pending' check (status in ('pending','paid','expired','failed','review')),
  created_at timestamptz not null default now(),
  session_created_at timestamptz,
  expires_at timestamptz not null,
  checkout_session_id text unique,
  checkout_url text,
  checkout_parameters jsonb not null,
  shipping_snapshot jsonb,
  constraint orders_customer_request_key unique (customer_id, request_key)
);
create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  sku text not null,
  product_id text not null,
  variant text not null,
  options jsonb not null default '{}'::jsonb,
  quantity integer not null check (quantity between 1 and 10),
  name text not null,
  unit_amount bigint not null check (unit_amount > 0),
  line_total bigint generated always as (unit_amount * quantity) stored,
  unique (order_id, sku)
);
create table public.stock_reservations (
  order_id uuid not null references public.orders(id),
  sku text not null references public.inventory(sku),
  quantity integer not null check (quantity between 1 and 10),
  status text not null default 'reserved' check (status in ('reserved','committed','released','review')),
  primary key (order_id, sku)
);
create table public.stripe_events (
  event_id text primary key,
  event_type text not null,
  order_id uuid references public.orders(id),
  received_at timestamptz not null default now(),
  event_created timestamptz not null,
  payload jsonb not null default '{}'::jsonb
);
create table public.shipments (
  order_id uuid primary key references public.orders(id),
  recipient jsonb not null,
  address jsonb not null,
  status text not null default 'ready' check (status in ('needs_address','ready','shipped')),
  tracking_number text,
  updated_at timestamptz not null default now()
);
create table public.outbox (
  id bigint generated always as identity primary key,
  topic text not null,
  dedupe_key text not null unique,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','done','failed','review')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  first_attempt_at timestamptz
);

alter table public.inventory enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.stripe_events enable row level security;
alter table public.shipments enable row level security;
alter table public.outbox enable row level security;
revoke all on public.inventory, public.orders, public.order_items, public.stock_reservations, public.stripe_events, public.shipments, public.outbox from public, anon, authenticated;
grant all on public.inventory, public.orders, public.order_items, public.stock_reservations, public.stripe_events, public.shipments, public.outbox to service_role;
revoke all on sequence public.order_items_id_seq, public.outbox_id_seq from public, anon, authenticated;
grant usage, select on sequence public.order_items_id_seq, public.outbox_id_seq to service_role;

create or replace function public.reserve_order(p_customer_id uuid, p_request_key uuid, p_fingerprint text, p_currency text, p_lines jsonb, p_amount_total bigint, p_locale text, p_checkout_parameters jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.orders; new_order public.orders; line jsonb; inv public.inventory; calculated bigint := 0; exp timestamptz;
begin
  if p_currency not in ('usd','jpy','thb') or p_locale not in ('en','ja','zh-CN','th') or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 9 then
    raise exception 'invalid_order' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text || ':' || p_request_key::text, 0));
  select * into existing from public.orders where customer_id=p_customer_id and request_key=p_request_key for update;
  if found then
    if existing.fingerprint <> p_fingerprint then raise exception 'request_key_conflict' using errcode='23505', constraint='orders_customer_request_key'; end if;
    return public.order_record(existing.id);
  end if;
  if p_checkout_parameters->>'expiresAt' is null then raise exception 'checkout_parameters_required' using errcode='22023'; end if;
  exp := to_timestamp((p_checkout_parameters->>'expiresAt')::bigint);
  if exp <= now() or exp > now() + interval '24 hours' then raise exception 'invalid_checkout_expiry' using errcode='22023'; end if;
  for line in select value from jsonb_array_elements(p_lines) order by value->>'sku' loop
    if (line->>'quantity')::integer not between 1 and 10 or (line->>'unitAmount')::bigint <= 0 then raise exception 'invalid_order_line' using errcode='22023'; end if;
    calculated := calculated + (line->>'quantity')::bigint * (line->>'unitAmount')::bigint;
  end loop;
  if calculated <> p_amount_total then raise exception 'amount_mismatch' using errcode='23514', constraint='orders_amount_total_check'; end if;
  for line in select value from jsonb_array_elements(p_lines) order by value->>'sku' loop
    select * into inv from public.inventory where sku=line->>'sku' for update;
    if not found or inv.on_hand - inv.reserved < (line->>'quantity')::integer then raise exception 'stock_unavailable' using errcode='23514', constraint='inventory_stock_available'; end if;
  end loop;
  insert into public.orders(customer_id,request_key,fingerprint,currency,locale,amount_total,expires_at,checkout_parameters)
  values(p_customer_id,p_request_key,p_fingerprint,p_currency,p_locale,p_amount_total,exp,p_checkout_parameters) returning * into new_order;
  for line in select value from jsonb_array_elements(p_lines) order by value->>'sku' loop
    update public.inventory set reserved=reserved+(line->>'quantity')::integer, updated_at=now() where sku=line->>'sku';
    insert into public.stock_reservations(order_id,sku,quantity) values(new_order.id,line->>'sku',(line->>'quantity')::integer);
    insert into public.order_items(order_id,sku,product_id,variant,options,quantity,name,unit_amount)
    values(new_order.id,line->>'sku',line->>'productId',line->>'variant',coalesce(line->'options','{}'::jsonb),(line->>'quantity')::integer,line->>'name',(line->>'unitAmount')::bigint);
  end loop;
  return public.order_record(new_order.id);
end; $$;

create or replace function public.order_record(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',o.id,'customerId',o.customer_id,'requestKey',o.request_key,'fingerprint',o.fingerprint,'currency',o.currency,'locale',o.locale,'amountTotal',o.amount_total,'items',coalesce((select jsonb_agg(jsonb_build_object('sku',i.sku,'productId',i.product_id,'variant',i.variant,'options',i.options,'quantity',i.quantity,'name',i.name,'unitAmount',i.unit_amount) order by i.sku) from public.order_items i where i.order_id=o.id),'[]'::jsonb),'status',o.status,'createdAt',o.created_at,'expiresAt',o.expires_at,'checkoutSessionId',o.checkout_session_id,'checkoutUrl',o.checkout_url,'checkoutParameters',o.checkout_parameters) from public.orders o where o.id=p_id
$$;

create or replace function public.attach_checkout_session(p_order_id uuid,p_session_id text,p_checkout_url text,p_expires_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'order_not_found' using errcode='P0002'; end if;
 if p_session_id is null or btrim(p_session_id)='' or p_checkout_url is null or btrim(p_checkout_url)='' or p_expires_at is null or o.status<>'pending' or extract(epoch from p_expires_at)::bigint<>extract(epoch from o.expires_at)::bigint then raise exception 'checkout_attachment_conflict' using errcode='23514', constraint='orders_session_attachment'; end if;
 if o.checkout_session_id is not null and o.checkout_session_id<>p_session_id then raise exception 'checkout_session_conflict' using errcode='23505', constraint='orders_checkout_session_id_key'; end if;
 update public.orders set checkout_session_id=p_session_id,checkout_url=p_checkout_url,session_created_at=coalesce(session_created_at,now()) where id=p_order_id;
 return public.order_record(p_order_id);
end; $$;

create or replace function public.apply_stripe_event(p_event_id text,p_event_type text,p_order_id uuid,p_session_id text,p_currency text,p_amount_total bigint,p_payment_status text,p_shipping jsonb,p_event_created timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; r public.stock_reservations; inv public.inventory; paid_event boolean; expired_event boolean;
begin
 if p_event_id is null or btrim(p_event_id)='' or p_event_type is null or btrim(p_event_type)='' or p_session_id is null or btrim(p_session_id)='' or p_event_created is null then raise exception 'invalid_payment_event' using errcode='22023'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'order_not_found' using errcode='P0002'; end if;
 if o.checkout_session_id is null then raise exception 'checkout_attachment_pending' using errcode='40001'; end if;
 if o.checkout_session_id is distinct from p_session_id or o.currency is distinct from p_currency or o.amount_total is distinct from p_amount_total then
   raise exception 'payment_metadata_mismatch' using errcode='23514',constraint='orders_payment_metadata';
 end if;
 insert into public.stripe_events(event_id,event_type,order_id,event_created) values(p_event_id,p_event_type,p_order_id,p_event_created) on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true,'order',public.order_record(p_order_id)); end if;
 paid_event := p_event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and p_payment_status='paid';
 expired_event := p_event_type='checkout.session.expired';
 if o.status='paid' then return jsonb_build_object('duplicate',false,'order',public.order_record(o.id)); end if;
 if paid_event then
   if exists(select 1 from public.stock_reservations where order_id=o.id and status='released') then
     update public.stock_reservations set status='review' where order_id=o.id and status='released'; update public.orders set status='review' where id=o.id;
   elsif o.status in ('pending','failed') then
     for r in select * from public.stock_reservations where order_id=o.id and status='reserved' order by sku for update loop
       update public.inventory set on_hand=on_hand-r.quantity,reserved=reserved-r.quantity,updated_at=now() where sku=r.sku;
       update public.stock_reservations set status='committed' where order_id=o.id and sku=r.sku;
     end loop;
     update public.orders set status='paid',shipping_snapshot=p_shipping,checkout_url=null where id=o.id;
     insert into public.shipments(order_id,recipient,address,status) values(o.id,coalesce(p_shipping->'recipient','{}'::jsonb),coalesce(p_shipping->'address','{}'::jsonb),case when
       coalesce(btrim(p_shipping->'recipient'->>'name'),'')<>'' and
       coalesce(btrim(p_shipping->'address'->>'line1'),'')<>'' and
       coalesce(btrim(p_shipping->'address'->>'city'),'')<>'' and
       coalesce(btrim(p_shipping->'address'->>'postal_code'),'')<>'' and
       coalesce(p_shipping->'address'->>'country','') ~ '^[A-Z]{2}$'
       then 'ready' else 'needs_address' end) on conflict(order_id) do nothing;
     insert into public.outbox(topic,dedupe_key,payload)
       select topic,'order:'||o.id||':'||audience,jsonb_build_object('orderId',o.id,'recipient',case when audience='buyer' then o.checkout_parameters->>'customerEmail' else null end,'locale',o.locale,'currency',o.currency,'amountTotal',o.amount_total,'items',public.order_record(o.id)->'items')
       from (values ('order_paid_buyer','buyer'),('order_paid_seller','seller')) as notifications(topic,audience)
       on conflict(dedupe_key) do nothing;
   end if;
 elsif expired_event and o.status in ('pending','failed') then
   for r in select * from public.stock_reservations where order_id=o.id and status='reserved' order by sku for update loop
     update public.inventory set reserved=reserved-r.quantity,updated_at=now() where sku=r.sku;
     update public.stock_reservations set status='released' where order_id=o.id and sku=r.sku;
   end loop;
   update public.orders set status='expired',checkout_url=null where id=o.id;
 elsif p_event_type='checkout.session.async_payment_failed' and o.status='pending' then update public.orders set status='failed',checkout_url=null where id=o.id;
 end if;
 return jsonb_build_object('duplicate',false,'order',public.order_record(o.id));
end; $$;

create or replace function public.claim_outbox(p_limit integer,p_worker_id text) returns setof public.outbox language plpgsql security definer set search_path='' as $$
begin
 if p_worker_id is null or btrim(p_worker_id)='' or length(p_worker_id)>200 then raise exception 'invalid_worker_id' using errcode='22023'; end if;
 -- Exhausted abandoned leases must terminate too, even when no worker calls fail_outbox.
 update public.outbox set status=case when topic in ('order_paid_buyer','order_paid_seller','booking_buyer','booking_seller') then 'review' else 'failed' end,lease_owner=null,lease_until=null,last_error='retry_limit'
 where (status='pending' or (status='processing' and lease_until<now()))
 and (attempts>=5 or (topic in ('order_paid_buyer','order_paid_seller','booking_buyer','booking_seller') and first_attempt_at<=now()-interval '23 hours'));
 return query with picked as (select id from public.outbox where ((status='pending' and available_at<=now()) or (status='processing' and lease_until<now())) and attempts<5 and (topic not in ('order_paid_buyer','order_paid_seller','booking_buyer','booking_seller') or first_attempt_at is null or first_attempt_at>now()-interval '23 hours') order by id for update skip locked limit least(greatest(p_limit,1),100))
 update public.outbox o set status='processing',lease_owner=p_worker_id,lease_until=now()+interval '5 minutes',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()) from picked where o.id=picked.id returning o.*
 ;
end;
$$;
create or replace function public.complete_outbox(p_id bigint,p_worker_id text) returns boolean language plpgsql security definer set search_path='' as $$
begin update public.outbox set status='done',lease_owner=null,lease_until=null where id=p_id and status='processing' and lease_owner=p_worker_id and lease_until>now(); if not found then raise exception 'outbox_lease_owner_mismatch' using errcode='23514',constraint='outbox_lease_owner_check'; end if; return true; end; $$;
create or replace function public.fail_outbox(p_id bigint,p_worker_id text,p_error text) returns boolean language plpgsql security definer set search_path='' as $$
begin update public.outbox set status=case when attempts>=5 or (topic in ('order_paid_buyer','order_paid_seller','booking_buyer','booking_seller') and first_attempt_at<=now()-interval '23 hours') then case when topic in ('order_paid_buyer','order_paid_seller','booking_buyer','booking_seller') then 'review' else 'failed' end else 'pending' end,available_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::integer)),lease_owner=null,lease_until=null,last_error=left(regexp_replace(coalesce(p_error,'unknown'),'[^a-zA-Z0-9_.:-]','','g'),80) where id=p_id and status='processing' and lease_owner=p_worker_id and lease_until>now(); if not found then raise exception 'outbox_lease_owner_mismatch' using errcode='23514',constraint='outbox_lease_owner_check'; end if; return true; end; $$;

revoke all on function public.reserve_order(uuid,uuid,text,text,jsonb,bigint,text,jsonb),
  public.order_record(uuid), public.attach_checkout_session(uuid,text,text,timestamptz),
  public.apply_stripe_event(text,text,uuid,text,text,bigint,text,jsonb,timestamptz),
  public.claim_outbox(integer,text), public.complete_outbox(bigint,text), public.fail_outbox(bigint,text,text)
  from public, anon, authenticated;
grant execute on function public.reserve_order(uuid,uuid,text,text,jsonb,bigint,text,jsonb),
  public.order_record(uuid), public.attach_checkout_session(uuid,text,text,timestamptz),
  public.apply_stripe_event(text,text,uuid,text,text,bigint,text,jsonb,timestamptz),
  public.claim_outbox(integer,text), public.complete_outbox(bigint,text), public.fail_outbox(bigint,text,text)
  to service_role;

