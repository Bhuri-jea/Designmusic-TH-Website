-- Read-only reports for the current Design Music schema. Run separately in Supabase SQL Editor.
-- Stock: on_hand already reflects committed sales; reserved represents current holds.
select sku, on_hand, reserved, on_hand - reserved as available, updated_at
from public.inventory order by sku;

-- Paid order totals by ORDER CREATION month, not payment or payout date.
-- Do not mix currencies. JPY uses whole yen; USD/THB use hundredths.
select date_trunc('month', created_at at time zone 'Asia/Bangkok') as order_creation_month,
       upper(currency) as currency, count(*) as paid_order_count,
       sum(amount_total) / case when currency = 'jpy' then 1.0 else 100.0 end as gross_paid_order_value
from public.orders where status = 'paid'
group by 1, currency order by 1 desc, currency;

-- Private customer CSV for Google Sheets. Prefix formula-like text for safe spreadsheet import.
select id as customer_id,
       case when name ~ '^[[:space:]]*[=+@-]' then chr(39) || name else name end as name,
       case when email ~ '^[[:space:]]*[=+@-]' then chr(39) || email else email end as email,
       case when phone ~ '^[[:space:]]*[=+@-]' then chr(39) || phone else phone end as phone,
       created_at, updated_at
from public.customers order by created_at desc;

-- Diagnose reporting/email jobs; do not export payloads containing private customer data.
select id, topic, status, attempts, available_at, last_error
from public.outbox where status in ('pending', 'failed', 'review')
order by id desc limit 100;
