# Design Music: connect, set up, and access your services

Prepared 14 October 2026 for your existing Astro/Svelte website.

For installation and a real Vercel deployment, follow [the installation manual](deployment-manual.md) first. This guide covers daily access and reporting.

## Where everything lives

| Information | Main system | Where you open it |
|---|---|---|
| Customer names, contact details | Supabase `customers` | Supabase project → Table Editor |
| Email/password registrations | Supabase Authentication | Supabase project → Authentication → Users |
| Appointments and available slots | Supabase `bookings` | Table Editor; customers use the website booking/profile pages |
| Calendar appointment display | Google Calendar | Open your private Design Music calendar |
| Booking report with customer details | Google Sheets | Open your private booking spreadsheet |
| Stock | Supabase `inventory` and `stock_reservations` | Table Editor; available stock is `on_hand - reserved` |
| Sales and purchased items | Supabase `orders` and `order_items` | Table Editor / SQL Editor |
| Payment transactions, fees, refunds, payouts | Stripe | Stripe Dashboard → Payments, Balances and Reports |
| Delivery to Calendar, Sheets and email | Supabase `outbox` | Table Editor; inspect jobs that remain pending, failed or review |

Supabase is the operational database. Calendar and Sheets receive booking copies; changing a Calendar event does **not** change the website's available slots. The current Google script exports bookings, not the full customer list or sales ledger. The seller tools manage stock and paid shipments; automatic accounting-package integration is not implemented.

## 1. Configure your website settings

In `Designmusic-TH-Website`, copy `.env.example` to `.env`. Keep `.env` private. For a hosted website, enter the same settings in your hosting project's environment-variable settings and redeploy when they change.

Start locally with `APP_ORIGIN=http://127.0.0.1:4322` and run `npm run dev -- --host 127.0.0.1 --port 4322`. Use that exact browser address. For production, replace it with your real HTTPS website origin, without a trailing slash. Your public domain is not yet known, so the production URLs below use `YOUR-SITE` as a placeholder.

| Setting | What to enter |
|---|---|
| `AUTH_SECRET` | A strong randomly generated secret for signed website sessions |
| `APP_ORIGIN` | Your local origin or real HTTPS origin |
| `SUPABASE_URL` | Project URL from your Supabase project |
| `SUPABASE_ANON_KEY` | Supabase publishable key, or legacy anon key, for signup/login |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy service-role key for the existing server database integration |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth web application credentials |

The two Supabase keys serve different purposes. Do not substitute the service-role key for the Auth key. The application keeps database access on the server.

## 2. Supabase: customer database and stock

1. Open [Supabase Dashboard](https://supabase.com/dashboard), choose or create the intended project, and record its project URL and keys privately.
2. For a **new empty database**, open SQL Editor and review/apply these files individually, in this order:
   - `supabase/migrations/202610120001_customers.sql`
   - `supabase/migrations/202610120002_orders_inventory_outbox.sql`
   - `supabase/migrations/202610120003_bookings.sql`
   - `supabase/migrations/202610120004_admin.sql`
3. If the database already contains tables or customers, inspect what is applied before running anything. These scripts are not all safe to rerun.
4. This checkout also contains `202610120003_inventory_one_each.sql` and `202610130001_bookings.sql`. **Do not run the entire folder blindly:** the first sets every stock count to one; the second is another booking-table definition. Neither belongs in the selected four-file setup above.
5. Use the authorized `/admin` stock tool for actual counted quantities. Table Editor → `inventory` lets you inspect `on_hand` and `reserved`. Do not change `reserved` manually to make stock appear available. Never set `on_hand` below `reserved`.

Example: `on_hand = 10`, `reserved = 2` means eight units can still be sold. Checkout reserves stock; verified successful Stripe payment commits the deduction. A canceled browser tab alone does not release an uncertain order.

Use the accompanying `Read-only-reporting-queries.sql` for stock and sales views. Those queries read information without changing records.

## 3. Enable email/password signup

1. In Supabase → Authentication, enable the Email provider, allow new signups, and keep **Confirm email** enabled.
2. In Authentication → URL Configuration, set the Site URL to your origin. Add the exact confirmation destinations:
   - `http://127.0.0.1:4322/login`
   - `http://127.0.0.1:4322/th/login`
   - `http://127.0.0.1:4322/ja/login`
   - `http://127.0.0.1:4322/zh-CN/login`
   - The same four paths under your production HTTPS origin when you launch.
3. Configure a verified sending domain and custom SMTP in Supabase for real customer confirmation emails. Its built-in sender is restricted and intended for initial testing; it does not provide general production customer delivery. Follow [Supabase custom SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).
4. Restart the local website after entering the Auth settings. Open `/signup`, enter a name, email and 12–72-character password, confirm the email link, then log in.
5. Look in Authentication → Users for the email registration. Open the website profile page; its protected API creates/loads the operational `customers` record. Google users appear in `customers`, but Google OAuth currently runs through the website's auth system, so they do not automatically appear in Supabase Authentication → Users.

Supabase handles password storage and verification. The previous single `EMAIL_LOGIN_EMAIL` / `EMAIL_LOGIN_PASSWORD` account has been replaced; use a real registered email account now. Website sessions last up to one day. Google and email are separate identities; matching an email address does not automatically merge order histories. Use the same sign-in method each time.

Implementation note for future maintenance: the existing `customers.google_subject` column remains the stable identity key. Google records keep their original subject; email records use `supabase:<Auth user UUID>`. No database migration is required for this addition. Passwords are never written into customer records or Sheets.

See [email/password authentication](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), and [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits). The current website does not include password recovery or automatic linking of Google and email accounts. CAPTCHA would require additional form support before enabling it for this flow.

## 4. Google login

1. Open [Google Cloud Console](https://console.cloud.google.com/). Select your project, configure its OAuth consent screen, and add your own Google account as a test user while the application is in testing.
2. Create an OAuth client of type **Web application**.
3. Add the authorized JavaScript origin `http://127.0.0.1:4322` and authorized redirect URI `http://127.0.0.1:4322/api/auth/callback/google`. Add the equivalent real HTTPS origin/callback before launch.
4. Enter the client ID and client secret in the website settings, then restart.
5. Test both Google buttons. Google sign-up and login use the same OAuth flow; a new operational customer is created when the signed-in profile API is opened.

Keep the existing Google login in the website; enabling Supabase's separate Google provider is unnecessary for this implementation. Google's [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server) explains origins and callback registration.

## 5. Appointment Calendar and booking spreadsheet

1. In Google Calendar, create a private calendar named **Design Music Appointments**. Set its time zone to **Asia/Bangkok**. Open its settings → Integrate calendar and copy the Calendar ID.
2. Create a private Google Sheet named **Design Music Bookings**. Its Spreadsheet ID is the part of its address between `/d/` and `/edit`.
3. From the Sheet, open Extensions → Apps Script. Paste the existing `scripts/google-sheets-booking-webhook.gs` file into the project.
4. In the script editor's Services section, add **Google Calendar API**. If using a standard Cloud project, enable that API there too. See [Advanced Google services](https://developers.google.com/apps-script/guides/services/advanced).
5. In Apps Script Project Settings → Script Properties, add:

| Property | Value |
|---|---|
| `SPREADSHEET_ID` | Your booking spreadsheet ID |
| `CALENDAR_ID` | Your private appointment calendar ID |
| `BOOKING_REPORT_SECRET` | A new random shared secret |
| `SHEET_NAME` | `Repair Bookings` |

6. Deploy → New deployment → Web app. Execute as **Me** (the owner of those destinations). Access must permit the website server to POST without a Google login redirect—normally the **Anyone** option, if your account permits it. The script authenticates each request using the shared secret. Keep the Sheet and Calendar themselves private. If organizational policy prevents this access setting, this transport needs another deployment strategy.
7. Copy the deployed `/exec` URL into `GOOGLE_SHEETS_WEBHOOK_URL`. Enter the identical shared secret as `GOOGLE_SHEETS_WEBHOOK_SECRET`.
8. The script creates the `Repair Bookings` tab and headers on first successful delivery. Open the Sheet to view booking ID, UTC start/end, timezone, name, email, phone, instrument, service and notes. Calendar displays the event in its selected time zone.

The database prevents duplicate bookings. The Calendar copy does not control availability and does not send attendee invitations. The current rules offer one-hour Bangkok slots at 10, 11, 13, 14, 15, 16 and 17, from tomorrow through 14 days ahead, excluding Sundays. Changing business hours later requires updating the website/database rules together.

See [Apps Script web app deployment](https://developers.google.com/apps-script/guides/web). Detailed request and retry behavior remains in the project's `docs/google-sheets-booking-webhook.md`.

## 6. Turn on delivery to Google and email

Bookings are saved first. A protected background task sends the Google report and transaction emails afterward.

1. Set a separate `CRON_SECRET` in the website environment.
2. Configure an HTTP scheduler for **POST** to `https://YOUR-SITE/api/cron/outbox`, approximately every five minutes. Include `Authorization: Bearer <your CRON_SECRET>` as a private request header. A GET-only scheduler cannot call this endpoint correctly.
3. Ensure hosting allows at least 100 seconds for that route. Check the actual account limits; a local build does not establish the hosting allowance.
4. For booking/order notification emails, set `RESEND_API_KEY`, `EMAIL_FROM` using a verified sender, and `SELLER_EMAIL`. These settings are separate from Supabase's confirmation-email SMTP. Follow [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).
5. Place one test booking with your own contact details. After dispatch, check the `bookings` record, the Calendar event, the Sheet row and the `outbox` job statuses. A saved booking does not prove delivery.

If a Google job fails, check its script properties, deployment URL, permissions and shared-secret match. If an uncertain write may already have succeeded, inspect destinations before manual retries.

## 7. Stripe, payments and financial sales

1. Open [Stripe Dashboard](https://dashboard.stripe.com/), use a test environment, and enter its test secret in `STRIPE_SECRET_KEY`. Keep `PAYMENT_LIVE_ENABLED=false`.
2. Register a webhook destination at `https://YOUR-SITE/api/stripe-webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Copy that destination's signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Local webhook testing needs forwarding with the [Stripe CLI](https://docs.stripe.com/stripe-cli). The CLI forwarding secret and a Dashboard endpoint secret are different; use the one for the active test path.
4. Set actual test stock, log in, make one test purchase, and confirm its `orders.status` becomes `paid` through a verified webhook. Refreshing the success page is not payment confirmation. Compare the recorded order/session and amount with Stripe.
5. For operational sales, open Supabase `orders` / `order_items`. For accounting exports, use Stripe's Balance report and payout reports, plus bank and expense records. The database currently records charged currency/amount and payment status; it does not contain a complete ledger of Stripe fees, refunds, bank settlements, expenses or taxes.

Keep USD, JPY and THB totals separate. Database amounts are in Stripe units: USD/THB use hundredths, while JPY is whole yen. Order charge value, processing fees, refunds and bank payouts are different figures. The included SQL report groups paid orders by their **creation month**, not payment date; use Stripe's actual transaction dates for financial reconciliation.

For a monthly working Sheet, use separate tabs: `Sales`, `Stripe Transactions`, `Payouts`, `Expenses`, and `Reconciliation`. Match order/session/payment identifiers where available, and reconcile payout totals to bank deposits. There is no automatic accounting import in the current application. [Stripe Balance reporting](https://docs.stripe.com/reports/balance) explains transaction, fee and balance exports.

## 8. A Google Sheet for your user database

For the current site, start with a private **customer report**, while keeping Supabase as the main database:

1. Run the customer-export query from `Read-only-reporting-queries.sql` in Supabase SQL Editor.
2. Export the result as CSV, then import it into a private Sheet tab named `Customers`. The export protects spreadsheet formula-like contact text; those protective apostrophes are not changes to your database records.
3. Use columns `customer_id`, `name`, `email`, `phone`, `created_at`, `updated_at`. Use `customer_id` to match records rather than a person's name or mutable email address.
4. Restrict access to the owner and staff who need contact data. Keep passwords, provider tokens and API keys out of the Sheet.
5. Refresh the export as needed. Changes made in this Sheet do not update Supabase. A confirmed email signup appears in the operational customer list after its first successful profile API visit; the complete email registration list is in Authentication → Users.

Automatic full-customer synchronization and two-way Sheet editing are not implemented. The booking Sheet already contains contact details for people who book, but that is not a complete user database.

## Suggested setup order

Supabase database → email confirmation/SMTP → Google login → stock counts → private Calendar/Sheet/script → notification sender/scheduler → Stripe test checkout/webhooks → reports.

The website changes can be tested locally now. Actual account ownership, credentials, confirmation email delivery, booking mirrors, payment events and hosting limits must be checked against your accounts before launch.
