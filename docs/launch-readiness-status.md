# DesignMusic launch readiness

## Current checkpoint — 17 October 2026 (Asia/Tokyo)

This checkpoint supersedes the historical 15 October audit below. Stripe work is paused at the owner's request while waiting for the account owner; do not activate live payments.

### Verified with the owner

- Supabase selected migrations were applied; Google sign-in/profile access works.
- Resend booking delivery works after replacing the API key.
- Calendar cancellation was repaired by using Apps Script `Calendar.Events.remove`; the formerly failing cancellation job completed.
- The previous 28 outbox jobs are all `done`.
- A five-minute Apps Script trigger ran automatically. A new owner test booking produced its email, Google Sheet row and Calendar event without a manual worker call.
- The remaining payment reconciliation warning is separate from booking delivery. Stripe credentials, webhook and payment acceptance are not verified.

### Remaining before full shop launch

#### Local work update — 17 October, account/booking follow-up

- Implemented safe existing return-path handling for both login methods; short-lived tab-local booking draft recovery (30 minutes), consumed on restoration, with fresh availability checks.
- Added shared dark input/textarea styles, date/new-time labels in all four locales, guarded reschedule selection and distinct non-modifiable/conflict recovery.
- Profile fields are disabled while saving; profile/orders/booking summary have independent retries. Booking summaries now identify upcoming, past and cancelled appointments. Address requirements are explicit.
- Removed the unused `getStaticPaths` from the server-rendered localized product list; existing locale validation remains.
- Owner selected two Google admin accounts. Awaiting `ADMIN_GOOGLE_SUBJECTS` setup and access verification; identities are not hardcoded in source. Stock/prices are ready for the owner to supply but have not been received or changed.
- Verification: 110 native tests passed. Final Astro check reported 0 errors/0 warnings (6 existing hints); `git diff --check` passed. Client/server production compilation passed, but Vercel packaging still failed with `The URL must be of scheme file` in the external C: dependency junction. The ignored static-path declaration was removed after that build; Vercel CI must verify final packaging.
- Local browser: English service selection advanced to the availability error/retry state; Japanese booking rendered at narrow width. Local backend configuration did not provide slots, so live slot selection, authenticated profile, native select popup and full sign-in recovery remain unverified. No live bookings or stock were changed.
- Pending: owner inputs/policy approval, authenticated/live checks, full browser matrix and GitHub release. Stripe remains paused. Profile session-expiry recovery beyond a retry and the full accessibility matrix remain open.

The numbered list below is the original launch checklist; the implementation items above supersede its older source observations.

1. Configure and verify seller access to `/admin`, stock editing and operational views. Real stock quantities remain owner-supplied; do not invent them. Paid shipments/tracking need the later Stripe test sale.
2. Confirm independent USD/JPY/THB prices, actual inventory, supported shipping countries and customer-facing postage terms. The historical ThaiPost table remains preparation-only and adds no checkout fee.
3. Finish the UX findings in `ux-review-2026-10-16.md`: login return path/draft recovery, profile save behavior, appointment status/history, field labels/styles and recoverable error states. Recheck current code before each fix. Login still targets profile; footer privacy/terms links still point to `#` in the current source.
4. Publish owner-approved privacy, terms, shipping/returns and repair cancellation information. No dedicated privacy/terms routes were found in the current source.
5. Verify remaining live flows: email/password signup and confirmation delivery, saved address persistence, rescheduling and Calendar busy-time blocking, mobile/desktop in four locales, owner/customer access boundaries. The confirmed new-booking test does not certify every failure/concurrency case.
6. Preserve the deployed Apps Script cancellation fix and scheduler in GitHub: local script/test changes remain uncommitted. Review dependency alerts and complete release checks. The most recent scheduler test suite passed 106 tests; this checkpoint did not rerun tests or certify a new build.
7. Resume Stripe only when the owner is ready: test-mode credentials/webhook, successful and failed/expired payment, order/stock/fulfillment checks, then a separately approved live activation.

Suggested next task while Stripe is paused: seller `/admin` access and actual stock configuration, followed by the outstanding account/booking UX work.

### Later enhancements, not part of the verified booking flow

- Full customer database sync to Google Sheets (the current Sheet mirrors bookings).
- Complete accounting and an owner order list spanning all payment states.
- An owner UI for weekly opening hours/holidays; current slot rules are fixed in code/SQL, with Calendar busy-time filtering.
- Additional payment methods.

## Historical audit — 15 October 2026

Checked 15 October 2026 against the local source and the connected Vercel project. **A READY deployment is present, but the site is not yet verified for taking real orders or reservations.** Vercel reports a production build of Git commit `31dc372`; the local checkout also has uncommitted changes. Secret values, database schema, provider accounts and real transactions were not inspected.

## What the current code provides

| Need | Current implementation | Remaining acceptance check |
| --- | --- | --- |
| Customer accounts | Google and email login, profile and saved shipping address | Configure and test both providers, confirmation email, and account ownership |
| Buy by card | Server-priced USD/JPY/THB cart, Stripe card Checkout, signed webhook, order and stock reservation, customer order status | Configure Stripe test mode and webhook; complete a test purchase through fulfillment before enabling live mode |
| Repair reservations | Bangkok-time availability, atomic Supabase booking, customer cancel/reschedule page, private Google Calendar busy-time filtering and queued Calendar/Sheet copies | Apply database schema; connect the private bridge and scheduler; test booking, busy event, reschedule, cancellation and duplicate-slot prevention |
| Owner stock and orders | `/admin` edits on-hand stock and shows paid shipments, preparation documents, tracking entry and failed delivery jobs | Add the owner Google subject, count real stock, and verify a paid test order appears. The page does **not** show every unpaid/failed order or provide full financial accounting. Use Supabase and Stripe dashboards for those records. |
| Customer database | Supabase customers, profile, orders and bookings; read-only reporting SQL | Apply migrations and verify actual records and staff access. The Google Sheet mirrors bookings only; full customer Sheet sync is not implemented. |
| Calendar editing | Owner can edit the private Google Calendar; busy events block overlapping offered slots | Current opening days/hours are fixed in code and SQL. There is no owner screen for changing weekly hours, holidays or slot rules. |
| Payment settlement | Website charges the locale's catalog currency; Stripe handles payment and payout reporting | Verify the Thai Stripe account's currencies, fees, THB payout and bank details. Additional payment methods can follow launch. |

## Release gates, in order

1. **Choose the final public origin.** Vercel currently lists `designmusic-th.com` and several `designmusic-th-website-*.vercel.app` aliases, but **not** `designmusic-th.vercel.app`, which appears in the older setup instructions. Set `APP_ORIGIN`, Google OAuth redirect, Supabase redirects, Stripe webhook and scheduler URL to the same chosen origin. Confirm HTTPS and public access. Do not use the old callback URL unless that domain is actually attached.
2. **Deploy the intended revision.** Review the local changes, reconcile the checkout with `origin/main`, run tests/check/build in a working Node 24 environment, then commit and deploy. A Vercel `READY` build alone does not prove the customer flows work. Recheck production after every environment-variable change.
3. **Install and verify Supabase.** The owner last described the project as empty; this has not been reconfirmed from the database. If still empty, apply the five selected migrations in [the installation manual](deployment-manual.md) in order. Do not apply sample one-each stock or alternate booking SQL. Verify tables, grants, ownership, and booking/stock transactions. Keep unknown stock at zero until counted and entered through `/admin`.
4. **Finish production configuration.** Vercel currently lists `APP_ORIGIN`, Google credentials, three Supabase variables and `AUTH_SECRET`. Their values are hidden and unverified. It does **not** list `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENT_LIVE_ENABLED`, `SHIPPING_ALLOWED_COUNTRIES`, `ADMIN_GOOGLE_SUBJECTS`, `GOOGLE_SHEETS_WEBHOOK_URL`, `GOOGLE_SHEETS_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `SELLER_EMAIL` or `CRON_SECRET`. Add those as the matching services are tested; never paste secrets into chat.
5. **Connect operations.** Configure Supabase email confirmation/SMTP, the Google OAuth callback, seller Google subject, private Calendar/Sheet Apps Script, notification sender and authenticated POST scheduler. Test an edited busy event, a booking and its later change/cancellation, the resulting database record, one Calendar event, one Sheet row and delivery-job status. Google Calendar is a scheduling view; Supabase remains the booking authority.
6. **Prove a test sale.** Set actual product stock and supported destinations, verify each currency's prices and shipping terms, then run a Stripe **test-mode** card payment. Check signed webhook, exactly one paid order, stock reduction, customer status, seller shipment, tracking and notifications. Check failed/expired payment recovery too. The historical Thailand Post table is for parcel preparation; checkout currently adds **no shipping fee**. Decide and publish how postage will be charged or handled before live sales.
7. **Publish customer terms and test the public site.** The footer's Privacy Policy and Terms of Service links currently point to `#`; there are no corresponding pages. Publish the business's actual privacy, returns/cancellation, shipping and contact terms before taking personal data and live payments. Then test English, Japanese, Thai and Chinese on mobile and desktop, including sign-in, booking, card checkout, and owner tools. These are owner-approved business terms, not text the code can infer.

## After first launch

An owner order dashboard covering **all** order states, a screen for changing booking opening hours/holidays, automatic full-customer Sheet sync, automated accounting imports and additional payment methods are separate enhancements. Supabase Table Editor, Google Calendar, Stripe Dashboard and the existing `/admin` page cover the stated day-one operations once the release gates above pass.

Use [the installation manual](deployment-manual.md) for exact setup steps and [the owner guide](owner-setup-guide.md) for daily database, calendar, stock and finance access.
