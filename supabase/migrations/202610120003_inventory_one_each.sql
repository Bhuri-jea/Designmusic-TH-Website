do $$
begin
  if exists (select 1 from public.inventory where reserved > 1) then
    raise exception 'inventory_initialization_requires_reservation_review';
  end if;

  update public.inventory
     set on_hand = 1,
         updated_at = now();
end;
$$;