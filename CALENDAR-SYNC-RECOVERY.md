# Calendar synchronization recovery

## What Job 76 means

The appointment remains saved in Supabase. Job 76 is a separate background delivery of the affected booking to Google Sheet and Calendar. Failed / attempts 5 means automatic retries stopped after five attempts. It does not mean the appointment or payment failed.

The website now sends contactName, contactInformation and accountEmail in its immutable customer snapshot. The old Google script required exactly name/email/phone and rejected the new format. That rejection returns {ok:false}, displayed by the website as Transport acknowledgment. This mismatch is reproduced and covered by tests; the actual production job payload has not been inspected.

## Fix the deployed Google script

1. Open the existing booking Apps Script project (the one that has CALENDAR_ID and SPREADSHEET_ID configured).
2. Replace ONLY the booking webhook file with the complete contents of scripts/google-sheets-booking-webhook.gs from this repair branch. Keep WebsiteScheduler and all Script Properties.
3. Save. Select Deploy > Manage deployments > Edit (pencil) on the existing web app.
4. Select New version and Deploy. Keep the same deployment URL, execution owner and access settings. Saving editor code alone does not update the deployed webhook.
5. Confirm Advanced Google Calendar service identifier Calendar is enabled. Keep calendar and spreadsheet private.

The updated script accepts legacy and current snapshots. It appends Contact information as column M without shifting existing columns, escapes spreadsheet formulas and puts preferred contact in the private Calendar description. Replays use the same row/event identifiers.

## Inspect before retrying

Run this read-only query in Supabase SQL Editor. It returns field names rather than customer contact values:

```sql
select id, topic, status, attempts, last_error,
       payload->>'bookingId' as booking_id,
       payload->>'status' as booking_status,
       payload->>'version' as booking_version,
       (select string_agg(k, ', ' order by k)
        from jsonb_object_keys(payload->'customer') as k) as customer_fields
from public.outbox
where id = 76;
```

## Retry only the affected Google delivery

After deploying the updated script, this guarded query requeues only that failed Google job. It does not resend buyer/seller emails, recreate the booking or clear orders/stock. It preserves the original payload and deduplication key. If it returns no rows, stop: the job has already changed or no longer matches this incident.

```sql
update public.outbox
set status = 'pending', attempts = 0, last_error = null,
    lease_owner = null, lease_until = null
where id = 76
  and topic = 'booking_google'
  and status = 'failed'
  and last_error = 'transport_acknowledgment'
returning id, topic, status, attempts;
```

Run processWebsiteJobs once in the existing Apps Script scheduler, or wait for its five-minute trigger. Re-run the read-only query: status should become done. Confirm Sheet/Calendar match the latest booking state; a cancelled booking should not have an active event. Do not create another appointment just to retry delivery.

If it fails again, keep the exact new last_error and inspect the Apps Script execution. Do not reset unrelated delivery jobs or disable acknowledgment validation. Destination access and the deployed version must be checked separately; local tests cannot verify them.

## Website text selection

Static HTML previews intentionally disable backend actions. Previously they disabled the whole form, which also blocked selecting/copying text. The preview exporter now installs a submit blocker before allowing text editing and native copy/paste. Existing generated snapshots require the new preview interaction script. Real authenticated forms must be used for saving data.

## Database reset

All test data was declared disposable, but this repair does not need a reset. No production database changes were made by the implementation. The guarded retry above is the only database action required for this particular failed delivery after updating the script.
