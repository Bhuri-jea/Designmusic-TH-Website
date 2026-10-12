create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  google_subject text not null unique,
  email text not null default '',
  name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;
revoke all on table public.customers from anon, authenticated;
grant all on table public.customers to service_role;

create or replace function public.resolve_customer(p_google_subject text, p_email text, p_name text)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_row public.customers;
begin
  if nullif(btrim(p_google_subject), '') is null then
    raise exception 'google_subject_required' using errcode = '22023';
  end if;
  insert into public.customers (google_subject, email, name)
  values (p_google_subject, coalesce(p_email, ''), coalesce(p_name, ''))
  on conflict (google_subject) do update
    set email = excluded.email, updated_at = now()
  returning * into customer_row;
  return customer_row;
end;
$$;

create or replace function public.update_customer_profile(p_customer_id uuid, p_name text, p_phone text)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_row public.customers;
begin
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) > 120 or length(coalesce(p_phone, '')) > 40 then
    raise exception 'invalid_profile' using errcode = '22023';
  end if;
  update public.customers
     set name = btrim(p_name), phone = nullif(btrim(p_phone), ''), updated_at = now()
   where id = p_customer_id
  returning * into customer_row;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
  return customer_row;
end;
$$;

revoke all on function public.resolve_customer(text, text, text) from public, anon, authenticated;
revoke all on function public.update_customer_profile(uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_customer(text, text, text) to service_role;
grant execute on function public.update_customer_profile(uuid, text, text) to service_role;
