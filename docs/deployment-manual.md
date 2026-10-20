# DesignMusic installation and deployment manual

Prepared 14 October 2026. Follow these steps in order. Account configuration and deployment are performed by you; this document does not mean the live services have been tested.

For the current code-versus-production status and release gates, see [launch readiness](launch-readiness-status.md). As checked on 15 October, the Vercel project has `designmusic-th.com` and `designmusic-th-website-*.vercel.app` aliases; `designmusic-th.vercel.app` is **not** listed. Choose the final origin before copying any callback, webhook or scheduler URL below.

## 1. Prepare your website and accounts

You need GitHub, Vercel, Supabase, a Google account that owns the Calendar/Sheet, Stripe and a verified email sender. Start with a separate test database and Stripe test credentials.

Your website folder is D:/MyDocument/Design_music/Website/Designmusic-TH-Website. Open a terminal there:

```powershell
node -v
npm ci --legacy-peer-deps
npm test
npm run astro -- check
npm run build
```

Use Node 24.x. Keep package-lock.json; do not upgrade dependencies during installation. The existing Astro server output and Vercel adapter are configured already. Do not use an old static Astro deployment example or replace the adapter.

Copy .env.example to .env for local use; keep .env private. Generate different long random secrets for AUTH_SECRET, CRON_SECRET and GOOGLE_SHEETS_WEBHOOK_SECRET. For example, run this separately for each and save its output privately:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Local origin: http://127.0.0.1:4322. Production origin: your final HTTPS domain, without a path or trailing slash. Use the same origin consistently in website settings, Google callbacks, Supabase redirects and scheduler URLs.

## 2. Create the Supabase database

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and create the intended project. Save its database password privately.
2. In project settings/connect/API keys, find the project URL, publishable key and secret key.
3. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY. The server sends modern keys in the apikey header, without treating them as JWTs. Legacy SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY remain supported as fallbacks. None of these settings need a PUBLIC_ prefix. SUPABASE_JWKS_URL is not used by this app, which verifies email credentials through Supabase Auth and signs its own website session. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
4. In SQL Editor, for a NEW EMPTY database, apply the selected files individually:

| Order | File | Purpose |
|---|---|---|
| 1 | supabase/migrations/202610120001_customers.sql | Customer identity/profile |
| 2 | supabase/migrations/202610120002_orders_inventory_outbox.sql | Orders, inventory, event processing and delivery jobs |
| 3 | supabase/migrations/202610120003_bookings.sql | Booking slots, atomic reservation and reporting jobs |
| 4 | supabase/migrations/202610120004_admin.sql | Seller stock and shipment tools; apply only after this file is present and reviewed |
| 5 | supabase/migrations/202610140001_account_booking_management.sql | Saved shipping addresses and customer reschedule/cancel controls |
| 6 | supabase/migrations/202610190001_shipment_holds.sql | Shipment dispatch holds |
| 7 | supabase/migrations/202610200001_catalog_shipping_settings.sql | Editable prices, parcel weight, shipping rates and destination settings |
| 8 | supabase/migrations/202610200002_shipment_hold_history.sql | Shipment hold audit history |
| 9 | supabase/migrations/202610200003_weighted_shipping_checkout.sql | Weight-based shipping totals at Checkout |
| 10 | supabase/migrations/202610200004_weekly_booking_hours.sql | Editable weekly repair hours and overlap-safe half-hour booking starts |
| 11 | supabase/migrations/202610200005_shipping_tracking_links.sql | Shipping service constraints and carrier/tracking details on customer orders |
| 12 | supabase/migrations/202610200006_shop_postage_rates.sql | Supplied postage presets and dispatch notice |
| 13 | supabase/migrations/202610200007_shipping_quotes.sql | Submitted shipping invoices and buyer approval/payment flow |
| 14 | supabase/migrations/202610200008_daily_booking_calendar.sql | Date-specific repair schedules |
| 15 | supabase/migrations/202610200009_atomic_product_save.sql | One atomic Save for stock, three prices and weight |
| 16 | supabase/migrations/202610210001_booking_calendar_window.sql | Rolling Bangkok two-calendar-month window, including reservation validation |
| 17 | supabase/migrations/202610210002_booking_history_archive.sql | Owner-only cancelled-booking removal from customer history |
| 18 | supabase/migrations/202610210003_shipping_invoices_and_rates.sql | Blank unsupported rate bands, invoices at any weight, frozen reference FX |

Do not run the whole migrations folder automatically. This checkout has also contained 202610120003_inventory_one_each.sql, a sample that assigns one item to every SKU, and 202610130001_bookings.sql, an alternate booking definition. Neither is part of the setup above. A .sql.clean draft is not a migration. Preserve these originals; do not apply them to manufacture stock or recreate tables.

If your project already has tables/data, first inspect its applied schema and migration history and take a backup. Do not rerun these creation scripts or delete tables to force installation; an existing alternate schema needs a forward migration reviewed for that schema.

After installation, inspect customers, inventory, orders, order_items, bookings and outbox in Table Editor. RLS and service-role-only RPC grants must remain intact. Count your real stock before editing on_hand; unknown stock stays zero. Never manually reduce reserved or set on_hand below reserved. Use the authorized seller stock tool when available.

## 3. Configure login and signup

### Email/password

In Supabase Authentication:

1. Enable Email signup and Confirm email.
2. Set Site URL to your origin. Allow these exact redirect paths under it: /login, /ja/login, /th/login, /zh-CN/login. Add local URLs only to your test project; production URLs to production.
3. Configure custom SMTP using a verified sender/domain. The default Supabase sender is restricted and is not a production customer-mail setup. See [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
4. Register a test email, follow its confirmation message, then log in. Registration/confirmation alone does not create a signed website session.

### Google

1. In Google Cloud create/select a project, configure the Google Auth Platform consent screen and add your test users while it is in testing mode.
2. Create an OAuth client of type Web application.
3. Add the exact authorized redirect URI for your chosen public origin, for example `https://designmusic-th.com/api/auth/callback/google` if that domain is your final site. For local testing use `http://127.0.0.1:4322/api/auth/callback/google`. These must match the browser origin exactly.
4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server, along with AUTH_SECRET.
5. Before public launch, complete Google's applicable publishing/verification requirements and test with an account outside your development login.

The app uses Google OAuth directly through auth-astro; enabling Google only in Supabase does not configure this path. Email and Google accounts are separate identities even when their email addresses match. [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

For seller access, sign in through Google and inspect your own signed /api/auth/session response locally. Put the googleSubject value in server-only ADMIN_GOOGLE_SUBJECTS; multiple values are comma-separated. Use the subject, not your email, Supabase user ID or a browser role. Restart/redeploy after changing it. Email login alone must not grant seller access.

## 4. Repair reservation slots

Repair hours are configured for individual dates in `/admin`. The window starts today in Asia/Bangkok and extends through the same date two calendar months ahead (month-end dates clamp to the last valid day). It advances automatically; 20 October 2026 is not a permanent boundary. The default is Monday–Friday 08:00–18:00. Each appointment lasts one hour with starts every 30 minutes; a following open half-hour is required. Choose Available, Contact directly or Closed for each date. Website bookings and Google Calendar busy events block starts. The admin calendar refreshes every minute and on focus while preserving unsaved date edits. Public booking fails closed when Google cannot be checked; admin schedule editing remains accessible with a sync warning. These website overrides do not edit arbitrary Google Calendar events.

For a database already installed, apply each unapplied forward migration once, in order. Migration `202610200004_weekly_booking_hours.sql` adds booking-hour settings and overlap protection; `202610200005_shipping_tracking_links.sql` stores the selected carrier and derives the external tracking website. Do not edit or rerun old SQL files. Before applying migration 004, check for existing overlapping confirmed bookings; it adds a database constraint to prevent overlapping one-hour appointments:

```sql
select a.id as booking_a, b.id as booking_b, a.start_at, a.end_at, b.start_at, b.end_at
from public.bookings a
join public.bookings b on a.id < b.id
where a.status = 'confirmed' and b.status = 'confirmed'
  and tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)');
```

If this returns rows, stop and resolve those records carefully before applying the migration. After installation, sign in as admin and edit the dates you need. Google Calendar busy events still block configured available slots, including all-day events. Cancel or reschedule website bookings from `/profile/bookings`; deleting a Calendar copy does not change the database booking. Customers can remove only cancelled entries from their displayed history; the source records remain available for reconciliation.

## 5. Connect Google Sheets and Calendar

### Create private destinations

1. Open Google Calendar in a desktop browser. Next to Other calendars choose + > Create new calendar. Name it DesignMusic Repairs; choose Bangkok time for display. Keep it private.
2. Open its Settings > Integrate calendar and copy Calendar ID. It may look like an email address; use the ID, not a public calendar URL. [Create a calendar](https://support.google.com/calendar/answer/37095).
3. Create a private Google Sheet named DesignMusic Repair Bookings. Copy the spreadsheet ID between /d/ and /edit in its URL. Give the execution owner edit access to both destinations; share only with necessary staff.

### Install the script

1. In the Sheet choose Extensions > Apps Script. Replace the starter code with scripts/google-sheets-booking-webhook.gs from this repository.
2. In Apps Script Services > + enable Google Calendar API with identifier Calendar. Enable the corresponding Cloud API if your associated project requires it. [Advanced Calendar service](https://developers.google.com/apps-script/advanced/calendar).
3. In Project Settings > Script Properties enter:

| Property | Value |
|---|---|
| SPREADSHEET_ID | Your spreadsheet ID |
| CALENDAR_ID | Your private calendar ID |
| SHEET_NAME | Repair Bookings, or your preferred tab name |
| BOOKING_REPORT_SECRET | A private random shared secret |

4. Deploy > New deployment > Web app. Execute as Me (the owner). Access must allow the website server's unauthenticated HTTP POST, generally Anyone; the script authenticates its body with the shared secret. This does not make the Sheet or Calendar public. If organizational policy prevents this access mode, the current transport needs another integration; a Google-sign-in-only endpoint will not work.
5. Authorize the script as the owner. Copy the deployment URL ending /exec, not /dev.
6. Set website GOOGLE_SHEETS_WEBHOOK_URL to that exact HTTPS script.google.com/macros/s/.../exec URL and GOOGLE_SHEETS_WEBHOOK_SECRET to the same BOOKING_REPORT_SECRET.
7. When script code changes, publish a new deployment version through Manage deployments; saving the editor alone does not update the deployed version. [Apps Script web apps](https://developers.google.com/apps-script/guides/web).

Bookings are saved first in Supabase. The outbox worker later writes a row and a private Calendar event. A booking ID prevents duplicate rows/events on retries. Events do not invite customers. A Sheet outage must not lose the original reservation.

## 6. Enable notifications and scheduled delivery

Set RESEND_API_KEY, EMAIL_FROM (verified sender/domain) and SELLER_EMAIL. Supabase signup SMTP and these application notification settings are separate configurations.

Set CRON_SECRET and configure an HTTP scheduler with:

| Setting | Value |
|---|---|
| Method | POST |
| URL | `YOUR_APP_ORIGIN/api/cron/outbox`, for example `https://designmusic-th.com/api/cron/outbox` |
| Header | Authorization: Bearer YOUR_CRON_SECRET |
| Interval | Every five minutes to start |
| Timeout | At least 120 seconds |

Keep this secret in the scheduler's protected settings. Do not put it in the URL. The current route rejects GET; [Vercel native cron sends GET](https://vercel.com/docs/cron-jobs), so do not simply add this endpoint to a Vercel cron configuration. An external scheduler with POST and private headers is the straightforward setup.

The worker may use about 95 seconds plus overhead. The deployment must permit at least 120 seconds and its function configuration should declare maxDuration:120. Confirm your Vercel compute/settings support this. Inspect failed/review outbox jobs and provider logs rather than repeatedly forcing retries. [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration).

Test with your own dummy booking: confirm a database booking, one Sheet row, one Calendar event and buyer/seller notifications. Repeated worker runs must not duplicate them. Keep the scheduler disabled until destinations and sender are ready.

## 7. Deploy to Vercel

1. Review the final local changes and commit/push them to your GitHub repository yourself. Vercel deploys the remote Git revision, not uncommitted local files.
2. In Vercel choose Add New > Project and import that repository.
3. Select Astro. Root Directory is the folder containing package.json: repository root if the repository itself is Designmusic-TH-Website; otherwise select Designmusic-TH-Website. Do not select src or public.
4. Set Node.js Version to 24.x. Install Command: npm ci --legacy-peer-deps. Build Command: npm run build. Keep Astro's output settings rather than overriding the app as a static site. [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Astro deployment](https://vercel.com/docs/frameworks/frontend/astro).
5. In Settings > Environment Variables enter the settings in the table below. Use Production for the real account settings. Preview should use separate test resources, test Stripe keys and its own stable APP_ORIGIN. Avoid random preview URLs for OAuth unless you register the exact callbacks.
6. Deploy initially with test payments and the scheduler disabled. After you know the permanent Vercel/domain address, update APP_ORIGIN and provider callbacks, then redeploy. Environment changes apply to new deployments, not an already-built deployment. [Vercel environment variables](https://vercel.com/docs/environment-variables).
7. If using a custom domain, add it in Settings > Domains and follow the displayed DNS records. Wait for HTTPS, then use that final origin everywhere.

| Group | Environment variables |
|---|---|
| Session/origin | AUTH_SECRET, APP_ORIGIN |
| Database/email login | SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY |
| Google login | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET |
| Payment | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PAYMENT_LIVE_ENABLED=false |
| Destinations | SHIPPING_ALLOWED_COUNTRIES=TH,JP initially |
| Booking mirrors | GOOGLE_SHEETS_WEBHOOK_URL, GOOGLE_SHEETS_WEBHOOK_SECRET |
| Notifications | RESEND_API_KEY, EMAIL_FROM, SELLER_EMAIL |
| Worker/seller | CRON_SECRET, ADMIN_GOOGLE_SUBJECTS |

Never commit real .env values or paste them into chat. Edit stock, independent USD/JPY/THB product prices and gross product weight in `/admin/products`; one Save updates the product atomically. Edit destinations and two postage tables in `/admin/shipping`. For 0.15 kg select the smallest covering maximum, such as 0.2 kg. A blank price explicitly makes that weight band unavailable for the selected service; it is not free shipping. Existing 20 g EMS bands are preserved. Customers default to EMS locally and ePacket internationally and may select another configured service. International automatically calculated postage is at least THB 500. Free pickup remains Thailand-only.

Latest daily exchange rates come from Frankfurter on the server and are cached for one hour per running server instance. The source date is displayed; invalid, mismatched or more-than-ten-day-old observations are rejected. Only postage converted from THB to USD/JPY receives the existing 5% buffer; product prices remain the independently configured amounts. Checkout freezes the charged amount and reference rate. Original-currency amounts and THB reference equivalents are shown in fulfillment; the reference equivalent is not Stripe's actual settlement or net bank payout. Old orders without a frozen rate use a clearly labelled current reference estimate when available; an FX outage leaves those estimates unavailable without hiding fulfillment. No API key is needed for Frankfurter. See [Frankfurter API](https://frankfurter.dev/).

If no rate covers the selected service/weight, or gross weight exceeds 2 kg, the buyer submits a shipping invoice request with a complete saved address. It does not reserve stock. In `/admin`, approve the THB fee (international minimum THB 500); the normal outbox scheduler automatically emails the buyer. The buyer opens `/profile/orders`, finds Shipping quotes at the bottom, and pays through Checkout or cancels before starting payment. Approved prices and addresses are frozen; the quote expires after seven days. Checkout then reserves stock using the existing payment protections. Contact-directly email/Facebook/Instagram links remain visible.

Customer policies are consolidated at `/policies`, with privacy, terms and shipping/returns anchors. Seller: Norraphat Thanavisuth (Design Music), 98 Thanon Akarn Songkhro, Soi Narathiwas 15 Yak 4-2, Thung Maha Mek Subdistrict, Sathorn District, Bangkok, Thailand, 10120; telephone 0850915959. Customers must contact the shop directly about manufacturing-defect returns within 7 days; the product must otherwise be in good condition. Silicone pads, shakuhachi and end plugs have a 6-month manufacturing-defect replacement warranty; careless handling/misuse is excluded, and repair services are not covered by this product warranty. The periods count from receipt. The buyer pays postage to return the product; the seller pays approved replacement postage. Statutory rights are preserved.

The combined policy is intentionally Thai-only. `/privacy`, `/terms` and `/shipping-returns` redirect permanently to their matching sections in `/policies`. Switching site language keeps the combined policy and anchor.

### Stripe before selling

Use Stripe test keys first. Create a webhook endpoint at `YOUR_APP_ORIGIN/api/stripe-webhook` (for example `https://designmusic-th.com/api/stripe-webhook`) for checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed and checkout.session.expired. Set the signing secret from that exact endpoint/mode as STRIPE_WEBHOOK_SECRET, then redeploy. Verify test payment, duplicate event handling, order ownership and stock behavior before changing to live keys and explicitly setting PAYMENT_LIVE_ENABLED=true.

Charges use independently set USD/JPY/THB prices. THB settlement, fees and conversion are managed by the Thai Stripe account; do not assume a catalog amount equals a bank deposit. Use Stripe financial reports for fees/refunds/payouts. [Stripe webhooks](https://docs.stripe.com/webhooks), [Balance reports](https://docs.stripe.com/reports/balance).

## 8. Prelaunch checklist and daily access

- [ ] Final tests, Astro diagnostics and build pass; generated function runtime is Node24 and worker duration is sufficient.
- [ ] All migrations match the actual database; sample stock and duplicate booking definitions are excluded.
- [ ] Email confirmation/login and Google login work with your configured accounts; profile persists actual fields.
- [ ] Another customer cannot read the first customer's profile, bookings or orders; email login cannot become seller.
- [ ] Booking uses Bangkok slots and rejects a double booking; worker produces exactly one matching Sheet row/Calendar event.
- [ ] Counted stock is configured; seller stock edits cannot undercut reservations.
- [ ] Stripe test checkout handles successful, pending, failed and cancelled states honestly; cart preserves later additions.
- [ ] Verify EN/JA/TH/zh-CN prices and routes, mobile layout, all three posters and keyboard controls.
- [ ] Check production logs, provider delivery, webhook endpoint and protected scheduler; then deliberately enable live sales.

Open /booking for reservations, /profile for your signed customer records and /admin for authorized seller tools once integrated. Supabase Table Editor is the operational database; Google Calendar/Sheet are private booking views. Use Stripe Dashboard for payments and accounting exports. Existing docs/owner-setup-guide.md and docs/examples/read-only-reporting-queries.sql explain customer/sales reports; automatic full customer Sheet sync and a complete accounting ledger are not implemented.

If deployment fails, keep the previous working Vercel deployment available and inspect build/runtime logs. Redeploy the previous code if needed; reverting code does not undo database migrations. Disable the scheduler while investigating ambiguous external deliveries. Do not delete live data to repair setup.

