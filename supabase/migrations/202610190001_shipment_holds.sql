-- Case-by-case customer-service dispatch holds. Existing shipment state is preserved.
begin;

alter table public.shipments
  add column if not exists hold boolean not null default false,
  add column if not exists hold_reason text;

create table if not exists public.shipment_hold_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  hold boolean not null,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  actor text not null check (length(btrim(actor)) between 1 and 255),
  created_at timestamptz not null default now()
);
alter table public.shipment_hold_events enable row level security;
revoke all on public.shipment_hold_events from public,anon,authenticated;
grant all on public.shipment_hold_events to service_role;
grant usage,select on sequence public.shipment_hold_events_id_seq to service_role;

create or replace function public.admin_shipping_record(p_order_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('order_id',o.id,'payment_status',o.status,'status',s.status,
  'recipient',s.recipient,'address',s.address,'tracking_number',s.tracking_number,
  'hold',s.hold,'hold_reason',s.hold_reason,
  'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.name,'sku',i.sku,'options',i.options,'quantity',i.quantity) order by i.sku) from public.order_items i where i.order_id=o.id),'[]'::jsonb))
 from public.orders o join public.shipments s on s.order_id=o.id where o.id=p_order_id
$$;

create or replace function public.admin_shipments() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.admin_shipping_record(id) order by created_at desc),'[]'::jsonb)
 from (select o.id,o.created_at from public.orders o join public.shipments s on s.order_id=o.id where o.status='paid' order by o.created_at desc limit 100) paid
$$;

-- Both hold changes and dispatch lock orders first, then shipments. This serializes a
-- concurrent hold against dispatch and makes the winning operation authoritative.
create or replace function public.admin_set_shipment_hold(p_order_id uuid,p_hold boolean,p_reason text,p_actor text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;s public.shipments;
begin
 if p_hold is null or p_reason is null or length(btrim(p_reason)) not between 1 and 500
   or p_actor is null or length(btrim(p_actor)) not between 1 and 255 then
   raise exception 'invalid_shipment_hold' using errcode='22023';
 end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status<>'paid' then raise exception 'shipment_not_holdable' using errcode='23514';end if;
 select * into s from public.shipments where order_id=p_order_id for update;
 if not found or s.status='shipped' then raise exception 'shipment_not_holdable' using errcode='23514';end if;
 if s.hold=p_hold then raise exception 'shipment_hold_unchanged' using errcode='23514';end if;
 update public.shipments set hold=p_hold,hold_reason=case when p_hold then btrim(p_reason) else null end,updated_at=now() where order_id=p_order_id;
 insert into public.shipment_hold_events(order_id,hold,reason,actor) values(p_order_id,p_hold,btrim(p_reason),btrim(p_actor));
 return public.admin_shipping_record(p_order_id);
end;$$;

create or replace function public.admin_mark_shipped(p_order_id uuid,p_tracking text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;s public.shipments;
begin
 if p_tracking is null or p_tracking !~ '^[A-Za-z0-9][A-Za-z0-9 -]{2,119}$' then raise exception 'invalid_tracking' using errcode='22023';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status<>'paid' then raise exception 'unpaid_order' using errcode='23514';end if;
 select * into s from public.shipments where order_id=p_order_id for update;
 if not found or s.status='needs_address' or coalesce(btrim(s.recipient->>'name'),'')='' or coalesce(btrim(s.address->>'line1'),'')='' or coalesce(btrim(s.address->>'city'),'')='' or coalesce(btrim(s.address->>'postal_code'),'')='' or coalesce(s.address->>'country','') !~ '^[A-Z]{2}$' then raise exception 'shipment_not_ready' using errcode='23514';end if;
 if s.hold then raise exception 'shipment_on_hold' using errcode='23514';end if;
 if s.status='shipped' then if s.tracking_number=btrim(p_tracking) then return public.admin_shipping_record(p_order_id);end if;raise exception 'already_shipped' using errcode='23514';end if;
 update public.shipments set status='shipped',tracking_number=btrim(p_tracking),updated_at=now() where order_id=p_order_id;
 return public.admin_shipping_record(p_order_id);
end;$$;

revoke all on function public.admin_shipping_record(uuid),public.admin_shipments(),public.admin_set_shipment_hold(uuid,boolean,text,text),public.admin_mark_shipped(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_shipping_record(uuid),public.admin_shipments(),public.admin_set_shipment_hold(uuid,boolean,text,text),public.admin_mark_shipped(uuid,text) to service_role;

commit;
