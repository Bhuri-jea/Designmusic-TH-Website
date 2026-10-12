-- psql -v request_key=<UUID> -v delay=2 (first client) / -v delay=0 (second).
-- Same key must return one booking; different keys competing for this slot must yield one unique violation.
begin;
with slot as (
 select ((min(d::date)+time '17:00') at time zone 'Asia/Bangkok') as start_at
 from generate_series((now() at time zone 'Asia/Bangkok')::date+1,(now() at time zone 'Asia/Bangkok')::date+14,interval '1 day') d where extract(dow from d)<>0
)
select public.create_booking('88888888-8888-4888-8888-888888888888', :'request_key'::uuid,repeat('a',64),start_at,start_at+interval '1 hour','alto','assessment','concurrent') from slot;
select pg_sleep(:delay);
commit;
