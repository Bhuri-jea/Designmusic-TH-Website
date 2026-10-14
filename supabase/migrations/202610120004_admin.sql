-- Seller-only application routes enforce the Google-subject allowlist before these service-role RPCs.
-- No payment state override, inventory initialization, carrier purchase or notification retry.
create or replace function public.admin_set_stock(p_sku text,p_on_hand integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare inv public.inventory;
begin
 if p_on_hand is null or p_on_hand<0 or p_on_hand>100000 then raise exception 'invalid_stock' using errcode='22023';end if;
 select * into inv from public.inventory where sku=p_sku for update;
 if not found then raise exception 'sku_not_found' using errcode='P0002';end if;
 if p_on_hand<inv.reserved then raise exception 'stock_below_reserved' using errcode='23514';end if;
 update public.inventory set on_hand=p_on_hand,updated_at=now() where sku=p_sku;
 return jsonb_build_object('sku',p_sku,'onHand',p_on_hand,'reserved',inv.reserved);
end;$$;
create or replace function public.admin_shipping_record(p_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('order_id',o.id,'payment_status',o.status,'status',s.status,'recipient',s.recipient,'address',s.address,'tracking_number',s.tracking_number,'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.name,'sku',i.sku,'options',i.options,'quantity',i.quantity) order by i.sku) from public.order_items i where i.order_id=o.id),'[]'::jsonb)) from public.orders o join public.shipments s on s.order_id=o.id where o.id=p_order_id
$$;
create or replace function public.admin_shipments() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.admin_shipping_record(id) order by created_at desc),'[]'::jsonb) from (select o.id,o.created_at from public.orders o join public.shipments s on s.order_id=o.id where o.status='paid' order by o.created_at desc limit 100) paid
$$;
create or replace function public.admin_mark_shipped(p_order_id uuid,p_tracking text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;s public.shipments;
begin
 if p_tracking is null or p_tracking !~ '^[A-Za-z0-9][A-Za-z0-9 -]{2,119}$' then raise exception 'invalid_tracking' using errcode='22023';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status<>'paid' then raise exception 'unpaid_order' using errcode='23514';end if;
 select * into s from public.shipments where order_id=p_order_id for update;
 if not found or s.status='needs_address' or coalesce(btrim(s.recipient->>'name'),'')='' or coalesce(btrim(s.address->>'line1'),'')='' or coalesce(btrim(s.address->>'city'),'')='' or coalesce(btrim(s.address->>'postal_code'),'')='' or coalesce(s.address->>'country','') !~ '^[A-Z]{2}$' then raise exception 'shipment_not_ready' using errcode='23514';end if;
 if s.status='shipped' then if s.tracking_number=btrim(p_tracking) then return public.admin_shipping_record(p_order_id);end if;raise exception 'already_shipped' using errcode='23514';end if;
 update public.shipments set status='shipped',tracking_number=btrim(p_tracking),updated_at=now() where order_id=p_order_id;
 return public.admin_shipping_record(p_order_id);
end;$$;
revoke all on function public.admin_set_stock(text,integer),public.admin_shipping_record(uuid),public.admin_shipments(),public.admin_mark_shipped(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_set_stock(text,integer),public.admin_shipping_record(uuid),public.admin_shipments(),public.admin_mark_shipped(uuid,text) to service_role;
