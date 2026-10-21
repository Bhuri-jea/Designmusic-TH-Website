begin;
do $$
declare week_start date := date_trunc('week',now() at time zone 'Asia/Bangkok')::date+7;
        exception_hours jsonb := '{"12:00":"contact_directly","12:30":"available"}';
        weekly jsonb;
begin
 select public.booking_weekly_hours() into weekly;
 if weekly->'1'->>'08:00'<>'available' or weekly->'1'->>'17:30'<>'available'
    or weekly->'1' ? '18:00' or weekly->'0'<>'{}'::jsonb then
  raise exception 'default must be Monday-Friday 08:00-18:00';
 end if;
 delete from public.booking_day_overrides where booking_date between week_start and week_start+6;
 perform public.admin_set_booking_date(week_start,exception_hours);
 perform public.admin_apply_booking_week(week_start);
 if (select hours from public.booking_day_overrides where booking_date=week_start)<>exception_hours then
  raise exception 'applying default overwrote an existing date exception';
 end if;
 if (select hours from public.booking_day_overrides where booking_date=week_start+1)<>weekly->'2' then
  raise exception 'unmodified Tuesday must receive the weekly default';
 end if;
 if (select count(*) from public.booking_day_overrides where booking_date between week_start and week_start+6)<>7 then
  raise exception 'week application must include seven days';
 end if;
 perform public.admin_apply_booking_week(week_start);
 if (select hours from public.booking_day_overrides where booking_date=week_start)<>exception_hours then
  raise exception 'reapplying must preserve date exceptions';
 end if;
end;
$$;
rollback;
