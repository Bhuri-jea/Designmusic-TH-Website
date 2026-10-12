begin;
do $$
declare c uuid; other_customer uuid; booking jsonb; retry jsonb; booking_id uuid; request_key uuid:=gen_random_uuid(); d date; start_time timestamptz; caught boolean; row_snapshot jsonb;
begin
 select min(date_value::date) into d from generate_series((now() at time zone 'Asia/Bangkok')::date+1,(now() at time zone 'Asia/Bangkok')::date+14,interval '1 day') date_value where extract(dow from date_value)<>0;
 start_time := (d+time '10:00') at time zone 'Asia/Bangkok';
 insert into public.customers(google_subject,email,name,phone) values('booking-sql-'||gen_random_uuid(),'first@example.test','First','123') returning id into c;
 insert into public.customers(google_subject,email,name) values('booking-other-'||gen_random_uuid(),'other@example.test','Other') returning id into other_customer;
 booking := public.create_booking(c,request_key,repeat('a',64),start_time,start_time+interval '1 hour','alto','basic','notes','ja');
 booking_id := (booking->>'id')::uuid;
 if booking->>'customerId'<>c::text or booking->>'locale'<>'ja' or booking->>'status'<>'confirmed' then raise exception 'booking record contract'; end if;
 if (select count(*) from public.outbox where payload->>'bookingId'=booking_id::text)<>3 then raise exception 'booking not atomic with three jobs'; end if;
 if exists(select 1 from public.outbox where payload->>'bookingId'=booking_id::text and (payload->>'locale'<>'ja' or payload->'customer'->>'email'<>'first@example.test' or payload->'customer'->>'name'<>'First' or payload->>'startAt' is null)) then raise exception 'immutable booking payload'; end if;
 update public.customers set email='changed@example.test',name='Changed',phone='456' where id=c;
 retry := public.create_booking(c,request_key,repeat('a',64),start_time,start_time+interval '1 hour','alto','basic','notes','ja');
 if retry<>booking or (select count(*) from public.outbox where payload->>'bookingId'=booking_id::text)<>3 then raise exception 'booking replay duplicates'; end if;
 if (select customer_snapshot->>'email' from public.bookings where id=booking_id)<>'first@example.test' then raise exception 'contact mutated'; end if;
 caught := false;
 begin perform public.create_booking(c,request_key,repeat('b',64),start_time,start_time+interval '1 hour','alto','basic','changed','ja'); exception when unique_violation then caught:=true; end;
 if not caught then raise exception 'changed fingerprint accepted'; end if;
 caught := false;
 begin perform public.create_booking(c,request_key,repeat('a',64),start_time,start_time+interval '1 hour','alto','basic','notes','th'); exception when unique_violation then caught:=true; end;
 if not caught then raise exception 'changed locale accepted'; end if;
 caught := false;
 begin perform public.create_booking(other_customer,gen_random_uuid(),repeat('c',64),start_time,start_time+interval '1 hour','tenor','assessment',''); exception when unique_violation then caught:=true; end;
 if not caught then raise exception 'occupied slot accepted'; end if;
 if (select count(*) from public.outbox where payload->'customer'->>'email'='other@example.test')<>0 then raise exception 'collision leaked jobs'; end if;
 -- New requests independently reject all rule violations, including NULLs.
 for start_time in select unnest(array[
 (d+time '12:00') at time zone 'Asia/Bangkok',
 (d+time '10:00:01') at time zone 'Asia/Bangkok',
 ((now() at time zone 'Asia/Bangkok')::date+time '10:00') at time zone 'Asia/Bangkok',
 ((now() at time zone 'Asia/Bangkok')::date+15+time '10:00') at time zone 'Asia/Bangkok',
 ((select min(date_value::date) from generate_series((now() at time zone 'Asia/Bangkok')::date+1,(now() at time zone 'Asia/Bangkok')::date+14,interval '1 day') date_value where extract(dow from date_value)=0)+time '10:00') at time zone 'Asia/Bangkok'
 ]) loop
  caught:=false;
  begin perform public.create_booking(c,gen_random_uuid(),repeat('d',64),start_time,start_time+interval '1 hour','alto','basic',''); exception when invalid_parameter_value then caught:=true; end;
  if not caught then raise exception 'invalid time accepted %',start_time; end if;
 end loop;
 start_time := (d+time '11:00') at time zone 'Asia/Bangkok';
 caught:=false;
 begin perform public.create_booking(c,gen_random_uuid(),repeat('d',64),start_time,start_time+interval '1 hour','bassoon','basic',''); exception when invalid_parameter_value then caught:=true; end;
 if not caught then raise exception 'bassoon basic accepted'; end if;
 caught:=false;
 begin perform public.create_booking(c,gen_random_uuid(),repeat('d',64),start_time,start_time+interval '2 hours','alto','basic',''); exception when invalid_parameter_value then caught:=true; end;
 if not caught then raise exception 'two hour slot accepted'; end if;
 caught:=false;
 begin perform public.create_booking(c,gen_random_uuid(),repeat('d',64),start_time,start_time+interval '1 hour','alto','basic',repeat('x',2001)); exception when invalid_parameter_value then caught:=true; end;
 if not caught then raise exception 'oversized notes accepted'; end if;
 caught:=false;
 begin perform public.create_booking(c,gen_random_uuid(),repeat('d',64),start_time,start_time+interval '1 hour',null,'basic',''); exception when invalid_parameter_value then caught:=true; end;
 if not caught then raise exception 'null instrument accepted'; end if;
 -- Eight-argument compatibility: default locale is English.
 retry:=public.create_booking(c,gen_random_uuid(),repeat('e',64),start_time,start_time+interval '1 hour','alto','assessment','');
 if retry->>'locale'<>'en' then raise exception 'default locale lost'; end if;
 -- A persisted old booking is still replayable after the current window.
 request_key:=gen_random_uuid();
 start_time:=((now() at time zone 'Asia/Bangkok')::date-1+time '10:00') at time zone 'Asia/Bangkok';
 insert into public.bookings(customer_id,request_key,fingerprint,start_at,end_at,instrument,service,notes,locale,customer_snapshot) values(c,request_key,repeat('f',64),start_time,start_time+interval '1 hour','alto','assessment','','en','{}') returning id into booking_id;
 retry:=public.create_booking(c,request_key,repeat('f',64),start_time,start_time+interval '1 hour','alto','assessment','');
 if retry->>'id'<>booking_id::text then raise exception 'old replay changed booking'; end if;
 if has_table_privilege('anon','public.bookings','select') or has_table_privilege('authenticated','public.bookings','insert') or not (select relrowsecurity from pg_class where oid='public.bookings'::regclass) then raise exception 'booking browser table access'; end if;
 if has_function_privilege('anon','public.create_booking(uuid,uuid,text,timestamptz,timestamptz,text,text,text,text)','execute') or has_function_privilege('authenticated','public.booking_record(uuid)','execute') then raise exception 'booking browser RPC access'; end if;
end $$;
rollback;
