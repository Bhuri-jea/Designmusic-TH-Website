# Design Music website — agent and architecture plan

**Status (13 October 2026):** Local implementation authorized and in progress. Backend foundations for the four workflows are accepted; customer/admin integration and final rendered/build verification remain. External accounts are not yet connected. See the detailed integration progress ledger.

## Intended result

Build on the existing Astro + Svelte 5 + Tailwind CSS 4 site. Customers sign in with Google OAuth; Supabase is the primary source for customer profiles, repair bookings, orders and payment state. Google Sheets receives repair-booking times and internal reports. Stripe-hosted Checkout takes eligible payments. Catalog prices are independent values in USD, JPY and THB; a Thai Stripe account settles funds in THB. Customer information and server-verified status may be displayed in the DOM, but the DOM is never a source of authority for identity or payment.

## 5 main tasks
|1. Sign in system with Google OAuth.|
|2. Database system with supabase (email, order and stock management, notification email system to buyer and seller). Generate or modify necessary table in Supabase to test run this project (if not possible, make detail step-by-step manual).|
|3. Design login (profile) page for user. User can add information such as address and phone number here. User can comfirm booked appointment (for repair services) and can manage (cancel or modify) the booking.
|4. Google Sheets (link with google drive) receives repair-booking customer informatim and time slot then connect with google calendar to update the schedule (I will adjust the available slot later). Generate manual to connet google sheet and calendar for this.|
|5. Stripe-hosted Checkout for credit cards payments. Link the payment detail with Database -> check and comfirm the available stock -> clear checkout and prepare for shipping label -> and deduct the stock|

## What is already in the folder

| Concern | Current location and observation |
| --- | --- |
| Framework | `astro.config.mjs` configures Astro, Svelte and a Vercel adapter; `src/layouts/` and `src/pages/` compose routes. |
| Styles | `src/styles/global.css` imports Tailwind 4 and defines the existing component classes; daisyUI is not installed. |
| Languages | `src/i18n/`, `src/utils/navigation.ts` and localized routes support `en`, `ja`, `zh-CN`, `th`; English has no prefix. |
| Product/cart | `src/lib/products.ts` holds canonical product data and independent USD/JPY/THB prices; `src/store/cart.svelte.ts` is browser cart state. |
| Login/customer | `auth.config.ts` uses Google through `auth-astro`; `src/lib/server/customer.ts` maps the Google subject to a Supabase customer UUID. |
| Supabase | `src/lib/server/supabase.ts`, `src/pages/api/profile.ts`, booking and order APIs, and `supabase/migrations/` manage customer data. |
| Payment | `src/pages/api/checkout.ts` currently checks product/variant/options/quantity against server data and creates a hosted card Checkout Session in USD, JPY or THB according to locale. `src/pages/api/stripe-webhook.ts` verifies signatures and updates an order through a database RPC. `src/pages/success.astro` displays customer-owned order status. |
| Booking/Sheets | Booking APIs, availability module, report outbox, POST report cron, Apps Script and `docs/google-sheets-booking-webhook.md` are already present. |
| Design | `.agent.md` contains an existing Jay design brief. `src/layouts/Layout.astro` uses existing system-font stacks. |

This worktree has many uncommitted changes and dependency/cache directories. Preserve them. `AGENTS.md` and `.agent.md` now describe canonical server pricing. The older `docs/superpowers/plans/2026-10-09-website-integration.md` assumes card-only scope. Historical plans are not acceptance evidence; use the current approved plan and progress ledger.

## Team and model workflow

| Working Philosophy|
| "Do a clean code". Don't write unneccessary code. |
| Stage | Owner | Output |
| --- | --- | --- |
| Large architecture and final technical review | [Pete](agents/Pete.md), GPT-6 Astra / high | System boundaries, risks, decisions, acceptance criteria |
| Detailed work-package planning | GPT-6.1 Sol | Specific files, invariants, dependencies and checks for each approved slice |
| Design, language and legal-risk review | [Mai](agents/Mai.md), model selected at launch | Rendered-page findings and scoped fixes for Wal |
| Implementation, preview and deployment preparation | [Wal](agents/Wal.md), GPT-6 Luna / medium | Focused changes, diagnostics, build, preview and release notes |

The three agent Markdown files are role briefs. They do **not** register agents or apply model settings automatically. After owner approval, launch each with the named model/effort and its brief; do not treat this plan as permission to create a production project or run a live transaction.

## System boundaries

1. **Astro and Svelte:** Astro owns routes, session checks, server data and page composition. Svelte owns browser interactions such as cart and booking controls. Tailwind and existing custom component classes remain the styling base. Avoid framework replacement.
2. **Google OAuth and Supabase:** The server verifies OAuth login and resolves the Google provider subject to a stable customer UUID. Every profile, booking and order read/write uses the signed session and server-side ownership checks. Supabase service-role credentials remain server-only; review RLS, grants and migrations before deployment.
3. **Bookings and Sheets:** Persist and deconflict booking slots in Supabase. Atomically queue a reporting job. Send only required booking fields to Sheets from the server with retries and idempotency. Sheets is a report/internal operations destination, not the customer or order database.
4. **Products and Checkout:** Browser requests contain identifiers, options, bounded quantities, locale and request key. The Astro API derives actual prices from the server catalog and creates a pending Supabase order and Stripe-hosted Checkout Session. Browser code may follow the Checkout URL; it must not call secret Stripe APIs, calculate an authoritative amount, or mark an order paid.
5. **Payment confirmation:** Verify Stripe's webhook signature and order/session/currency/amount match; apply each event idempotently. The return page displays server-verified order status. Fulfillment must not depend on the customer reaching the return page. See [Stripe's fulfillment guidance](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted).
6. **Privacy:** Keep API keys, OAuth secrets, database service keys, card data and financial authorization state out of HTML, JavaScript bundles, DOM attributes and logs. Render only the customer fields needed for the signed-in user's view.

## Payment feasibility for a Thai Stripe account

| Method | Planning result |
| --- | --- |
| Visa/Mastercard | Supported by [Stripe Thailand's method list](https://support.stripe.com/questions/supported-payment-methods-currencies-and-businesses-for-stripe-accounts-in-thailand?locale=th-TH). Current checkout is card-only. |
| PayPay | Stripe lists a Japanese merchant account and JPY presentment; a Thai Stripe account cannot simply enable it. [PayPay documentation](https://docs.stripe.com/payments/paypay). |
| PayPal | Standard Stripe-processed PayPal lists supported European merchant countries, not Thailand. A [custom PayPal method](https://docs.stripe.com/payments/payment-methods/custom-payment-methods/paypal) uses the merchant's own PayPal account and adapter and requires access/commercial review. [Standard method documentation](https://docs.stripe.com/payments/paypal). |
| Alipay | [Stripe Thailand's method list](https://support.stripe.com/questions/supported-payment-methods-currencies-and-businesses-for-stripe-accounts-in-thailand?locale=th-TH) lists it as unsupported. Do not promise it in the Thai-account checkout. |

Stripe Thailand says it can accept card charges in many currencies but pays out only in THB. Keep **catalog price**, **customer charge** and **THB settlement** as separate concepts. USD uses cents and JPY uses whole yen in Stripe amounts. Record the actual settlement/FX data provided by Stripe; do not invent a live exchange rate or promise a fixed THB bank amount from browser calculations. Confirm the actual account configuration, fees and payout behavior before live activation. A different merchant/provider strategy for PayPay, PayPal or Alipay needs separate owner review.

## Work packages after owner approval

1. **Baseline and request-time behavior — Pete plans, Wal verifies.** Confirm Node 22 and dependencies; inspect current uncommitted changes; run `npm run astro -- check` then `npm run build`. Verify that auth, profile, bookings, checkout, webhook, success and the session-aware layout execute at request time under the chosen Astro/Vercel settings. A source file alone does not prove deployment behavior.
2. **Auth and data — Pete designs, Wal implements.** Review Google subject binding, Supabase ownership checks, service-role use, RLS/RPC grants, migration compatibility and legacy rows. Inspect the deployed schema before any migration. Keep customer identity independent of mutable email.
3. **Payments — Pete designs, Wal implements.** Confirm whether customers are charged in USD/JPY or THB, whether currency is selected or inferred from locale, and which eligible methods appear. Check tampered cart input, repeated checkout requests, session expiry, duplicate/out-of-order webhook events, failed/delayed payments and customer-owned status reads. Use Stripe test mode only for verification.
4. **Bookings and reports — Pete sets data contract, Wal implements.** Check Bangkok-time slot rules, competing requests, queue retries, report acknowledgments and scheduler authentication. The current report cron accepts POST; choose a scheduler that matches that contract. Decide whether booking photo previews need a private upload feature before treating them as stored records.
5. **Visual and language pass — Mai reviews, Wal implements approved fixes.** Inspect real rendered English and prefixed routes on mobile and desktop. Review imagery, color, typography, button placement, product discovery, checkout and booking paths, keyboard access, reduced motion, error copy and equivalent locale navigation. Preserve the current custom styles and system fonts.
6. **Legal-risk inventory — Mai reports, Pete reviews, Wal implements approved applicable fixes.** Evaluate age handling before OAuth, local font hosting, replay/consent and masking, marketing email footer/unsubscribe, subscription renewal disclosures, and whether a US DMCA designated agent applies. The current source uses system fonts and contains no age gate, initialized replay, marketing-email or subscription implementation; jurisdiction and business practice still require confirmation. Use [FTC COPPA](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), [FTC CAN-SPAM](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) and the [US Copyright Office](https://copyright.gov/dmca-directory/) as primary US references, with local legal advice for applicable jurisdictions.
7. **Release preparation — Wal demonstrates, Pete and Mai accept.** Show a production preview; check English and at least one prefixed locale, plus every touched language. Report diagnostics/build results, sandbox integration results, environment settings, migration order, webhook/scheduler setup and rollback steps. Production deployment and live method activation remain owner decisions.

## Acceptance checks

- Authenticated users can view only their own profile, bookings and orders; the Google identity remains stable when contact details change.
- A booking cannot double-occupy a slot, and a Sheets outage leaves a retryable report without losing the Supabase booking.
- The server sets the checkout amount from canonical product data; repeated requests and webhooks do not double-charge or double-fulfill.
- Paid status follows a verified provider event; a URL, return page or DOM value cannot grant paid status.
- No sensitive keys or payment authority appear in browser output. UI shows only methods supported by the configured merchant account and currency.
- Touched routes work in English and applicable prefixed locales; `npm run astro -- check` and `npm run build` pass before release review.

## Recorded owner decisions and remaining configuration

- Local implementation is approved. Complete the four functional workflows before decorative polish; preserve Copilot's styling and system fonts.
- Independently priced USD/JPY/THB products: en/zh-CN charge USD, ja JPY, th THB; intended Thai bank settlement is THB. Card-only Checkout is the approved scope.
- Actual stock is unknown; initial stock remains zero. The one-each sample is preserved under docs/examples, outside migrations.
- Shipping intent includes TH, JP and international ThaiPost ePacket. Initial explicit configuration is TH,JP; today's complete destinations must be checked before extending it.
- The supplied 2022 Thailand Post table is for parcel preparation only. It adds no Checkout fee and does not establish current worldwide eligibility.
- Owner must configure private service credentials, actual stock, seller Google subjects, verified mail sender, private Sheets/Calendar destinations and authenticated scheduler. These are external verification prerequisites, not reasons to stop authorized local work.

Implementation slices in the detailed plan are not a count of completed owner workflows. Backend code, integrated UI, final local verification and actual external-service acceptance are tracked separately.
