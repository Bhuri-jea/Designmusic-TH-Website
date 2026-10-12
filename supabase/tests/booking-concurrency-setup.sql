-- Disposable local database only. Run before two independent clients.
insert into public.customers(id,google_subject,email,name)
values('88888888-8888-4888-8888-888888888888','booking-concurrency-fixture','concurrency@example.test','Concurrent');
