do $$ begin
 if (select count(*) from public.bookings where customer_id='88888888-8888-4888-8888-888888888888')<>1 then raise exception 'concurrency should persist exactly one booking'; end if;
 if (select count(*) from public.outbox where payload->'customer'->>'email'='concurrency@example.test')<>3 then raise exception 'concurrency should queue exactly three jobs'; end if;
end $$;
delete from public.outbox where payload->'customer'->>'email'='concurrency@example.test';
delete from public.bookings where customer_id='88888888-8888-4888-8888-888888888888';
delete from public.customers where id='88888888-8888-4888-8888-888888888888';
