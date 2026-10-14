# Design Music website

Astro server routes with Svelte 5 interactions and Tailwind CSS 4. English, Japanese, Thai and Simplified Chinese use the existing system fonts and design.

## Local preview

Use Node 24.x. From this project directory:

```powershell
npm ci --legacy-peer-deps
Copy-Item .env.example .env
npm run dev -- --host 127.0.0.1 --port 4322
```

Set a long random AUTH_SECRET in the private .env file, then open http://127.0.0.1:4322/. Match APP_ORIGIN to the exact browser origin. Public pages can be previewed without connecting external providers; missing configuration must not be mistaken for a completed sign-in, booking or payment. Never commit .env or paste service secrets into chat.

## Verification

```powershell
npm test
npm run astro -- check
npm run build
```

Tests run native Node validators and orchestration with controlled external transports. SQL acceptance/concurrency scripts under supabase/tests require a disposable PostgreSQL database with the expected Supabase roles; never run fixture scripts against production. Build uses the Vercel server adapter; the Astro preview command alone is not evidence of a deployed server.

## Service setup

Start with the [installation and Vercel deployment manual](docs/deployment-manual.md). See [integration setup](docs/integration-setup.md), [booking mirror and mail setup](docs/google-sheets-booking-webhook.md), and the complete server-only variable reference in [.env.example](.env.example).

Google subject resolves a stable customer UUID. Supabase stores customer profiles, bookings, orders, inventory and delivery jobs. Canonical server prices are independent USD/JPY/THB values: en/zh-CN charge USD, ja JPY, th THB. Stripe Checkout is one-time card payment, with verified webhook updates. Returning from Stripe does not prove payment.

Bookings commit before asynchronous Sheets, Calendar and transactional email delivery. An authenticated POST scheduler handles reporting, email and payment reconciliation. Initial stock is zero until actual counts are entered. The preserved one-each sample in docs/examples is excluded from migrations.

Thailand Post's supplied 2022 table is a historical parcel-preparation reference only. It adds no Checkout shipping charge and does not define current worldwide eligibility.

## Work status

The four requested workflows and acceptance checks are tracked in [website-agent-plan.md](docs/website-agent-plan.md). The detailed implementation ledger is [the integration progress file](docs/superpowers/progress/2026-10-12-website-integration.md). Local code/tests and real external-service verification are recorded separately. No automatic deployment, production migration, live payment or real customer message is part of local setup.
