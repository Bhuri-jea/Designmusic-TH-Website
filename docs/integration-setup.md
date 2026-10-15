# Integration setup and release checks

This is a configuration guide for the implemented local workflows. It does not authorize production changes or assert that the external accounts have been verified.

## Private configuration

Copy .env.example to .env and supply your own server-side values. AUTH_SECRET is a long random secret. APP_ORIGIN must equal the public origin used by customers, with no path or trailing slash. Use one consistent local host/port, for example http://127.0.0.1:4322. OAuth callbacks and same-origin mutations depend on this choice.

Configure Google OAuth's client ID/secret and the callback URL <APP_ORIGIN>/api/auth/callback/google in your own Google project. Use test users while verifying the consent/sign-in flow. Email/password signup and login use Supabase Auth with SUPABASE_ANON_KEY (publishable or legacy anon key). Enable Email, allow signups and keep email confirmation enabled; allow <APP_ORIGIN>/login and the /th/login, /ja/login, /zh-CN/login variants in Auth URL Configuration. Configure custom SMTP before accepting real customer signups. The single EMAIL_LOGIN_EMAIL/PASSWORD credential account is replaced. Google and email identities are separate and are not merged by matching email. Existing customer keys remain in the legacy google_subject column; email keys use supabase:<verified Auth UUID>. Signed website sessions last one day. ADMIN_GOOGLE_SUBJECTS is reserved for the planned seller allowlist; this checkout does not yet contain the completed admin module.

SUPABASE_URL and SUPABASE_SECRET_KEY belong to the intended project and stay server-only; legacy SUPABASE_SERVICE_ROLE_KEY is also supported. For a new empty database, review and apply 202610120001_customers.sql, 202610120002_orders_inventory_outbox.sql, 202610120003_bookings.sql, 202610120004_admin.sql, then 202610140001_account_booking_management.sql in order. Inspect existing schemas and data before changing a deployed database. Do not bulk-run this checkout's migration folder: 202610120003_inventory_one_each.sql sets every SKU to one, and 202610130001_bookings.sql duplicates the booking definition. The primary inventory seed is zero; configure actual stock later. Email authentication needs no additional schema migration.

## Test payments

Set STRIPE_SECRET_KEY to a test secret and STRIPE_WEBHOOK_SECRET to the signing secret for POST /api/stripe-webhook. Keep PAYMENT_LIVE_ENABLED=false. Register checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed and checkout.session.expired for the test endpoint. Signature verification uses the raw request body.

The server derives independent catalog prices, reserves inventory and freezes Checkout parameters. The allowed initial shipping countries are TH,JP through SHIPPING_ALLOWED_COUNTRIES. Extend that explicit list only after checking current carrier availability. No shipping charge is added from the supplied historical rate table.

The account profile stores a customer-owned shipping address in `customers.shipping_address`. The fifth selected migration above adds the saved-address RPC and booking reschedule/cancel RPCs. For an existing database, inspect deployed function signatures, table data and migration history first; apply it only through the database owner's reviewed migration process. Do not bulk-run the migration directory.

Google or verified email/password login is required before reserving an order. Browser price, success query parameter and return-page visits are not payment authority. Webhook updates are idempotent and reconcile only the matching order/customer/session/currency/amount. The return page reads the owned database record. Cancel or elapsed time alone does not release stock; verified provider expiration does. A paid event received after released stock requires review.

Do not rotate the Stripe key/account or change frozen parameters to retry an ambiguous checkout automatically. Existing reservation fingerprints bind the protected key; inspect the original provider account/session before manual reconciliation. Test provider uncertainty, duplicate events and delayed callbacks using dummy customer data before enabling real purchases.

## Bookings and delivery

See [booking mirror and transactional delivery setup](google-sheets-booking-webhook.md) for Apps Script destination properties, Calendar service, Resend sender verification and exact response contracts.

Configure GOOGLE_SHEETS_WEBHOOK_URL/SECRET, RESEND_API_KEY, EMAIL_FROM, SELLER_EMAIL and a separate CRON_SECRET. Bookings are stored before asynchronous reporting/mail. Missing configuration leaves delivery pending or failed/review after bounded attempts; it never proves delivery.

Use an authenticated HTTP scheduler sending POST /api/cron/outbox with Authorization: Bearer <CRON_SECRET>. A GET scheduler does not satisfy this contract. Reconciliation has 25 seconds and outbox has 70 seconds; hosting must permit at least 100 seconds. The planned adapter duration is 120 seconds; verify your hosting account actually supports it. Never put the token in a URL, public bundle or browser request.

Email retries stop after five claims or 23 hours from first attempt; Google jobs stop after five claims. An external write may succeed before its acknowledgment is lost. Inspect provider and job state before manual retries or changing destinations; automatic idempotency does not establish unlimited exactly-once delivery.

## Seller preparation

Use the subject allowlist for actual seller access. Set only real stock counts greater than or equal to held quantities. Prepare shipments from paid orders with complete recorded recipient addresses. Do not mark missing-address orders ready or override financial status. Printable labels are preparation documents, not purchased carrier postage.

The supplied Thailand Post table is effective 15 April 2022, not a current tariff or eligibility list. A 1,300 g assumption may show a historical THB reference for its listed destinations; confirm actual weight, today's rate and service availability before dispatch. Domestic Thailand and unlisted countries have no estimate from that international table.

## Acceptance and rollback

Before launch, run native tests, real disposable SQL checks, Astro diagnostics and a complete production build on the integrated source. Inspect mobile/desktop and every touched language. Separately verify real Google test login, owned profiles/bookings/orders, Stripe test Checkout/webhooks, actual private Sheets/Calendar mirror, dummy-recipient email, authenticated scheduler and seller authorization. Record what passed; local mocks cannot replace these service checks.

Keep a reviewed backup and explicit database migration plan before production work. If a release must be stopped, disable the scheduler and new checkout/booking traffic, preserve existing orders/holds/jobs, inspect outstanding provider state and restore a compatible prior application. Do not drop transaction tables or release ambiguous holds as a generic rollback. Production deployment, migration and live activation require separate owner authorization.

## Node runtime

The project declares Node 24.x in package.json and .nvmrc. Use a current Node 24 LTS patch locally and match Vercel project settings to 24.x. The adapter derives the server function runtime from the project engine declaration. Update the global Windows installer through nodejs.org if desired, reopen the terminal and check node -v/npm -v. Root verifies a portable official runtime without changing system settings.
