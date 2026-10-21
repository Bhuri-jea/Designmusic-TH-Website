begin;

-- Restore the requested baseline, keeping all date exceptions and bookings.
update public.booking_settings set weekly_hours = (
 select jsonb_object_agg(day_no::text, case when day_no between 1 and 5 then (
  select jsonb_object_agg(to_char(make_time(hour_no,minute_no,0),'HH24:MI'),'"available"'::jsonb)
  from generate_series(8,17) as hours(hour_no) cross join (values(0),(30)) as minutes(minute_no)
 ) else '{}'::jsonb end)
 from generate_series(0,6) as days(day_no)
), updated_at=now() where singleton=true;

create or replace function public.admin_apply_booking_week(p_week_start date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date := (now() at time zone 'Asia/Bangkok')::date; weekly jsonb;
begin
 if p_week_start is null or extract(isodow from p_week_start)<>1
    or p_week_start> (today+interval '2 months')::date or p_week_start+6<today then
  raise exception 'invalid_booking_date' using errcode='22023';
 end if;
 select weekly_hours into weekly from public.booking_settings where singleton=true for share;
 insert into public.booking_day_overrides(booking_date,hours)
 select p_week_start+offset_no, coalesce(weekly->extract(dow from p_week_start+offset_no)::integer::text,'{}'::jsonb)
 from generate_series(0,6) as offsets(offset_no)
 where p_week_start+offset_no between today and (today+interval '2 months')::date
 on conflict(booking_date) do nothing;
 return public.booking_date_hours();
end;
$$;
revoke all on function public.admin_apply_booking_week(date) from public,anon,authenticated;
grant execute on function public.admin_apply_booking_week(date) to service_role;
commit;
