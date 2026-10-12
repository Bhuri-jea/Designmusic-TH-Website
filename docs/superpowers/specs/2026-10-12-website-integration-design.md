# Design Music integration design

## Purpose and authorization

Implement the four tasks in `docs/website-agent-plan.md`: Google sign-in, Supabase customer/order/stock data and transactional notifications, repair bookings mirrored to Sheets and Calendar, and Stripe-hosted card Checkout. The owner's 12 October 2026 instruction authorizes generating these documents and starting local implementation using Pete, Mai and Wal. Production migrations, deployment and live financial operations are separate owner decisions.

The source is authoritative for the baseline. Supabase helpers, migrations, payment webhooks, booking APIs, reports and an age gate described in the supplied documents are absent. The current checkout trusts browser prices; the profile and booking confirmations are placeholders. daisyUI is absent; retain the existing Tailwind component classes without adding a second styling system.

## Team and execution

Pete (GPT-6 Astra/high) defines contracts and reviews financial/data changes. The controller writes detailed work packages. Wal (GPT-6 Luna/medium) implements bounded tasks, writes behavioral tests and records checks. Mai reviews rendered customer flows and localization. Preserve the user's untracked documents and existing source. Work in the requested checkout; leave changes reviewable without automatic commits or publication. Maintain `docs/superpowers/progress/2026-10-12-website-integration.md` through execution.

## Runtime, identity and privacy

Astro owns request-time routes, verified sessions, API endpoints and database access. Svelte 5 owns browser interactions. Set `output: 'server'` and validate dynamic locale/product parameters before reading files. Support `en`, `ja`, `zh-CN`, `th`; English remains unprefixed. Use localized account/payment routes consistently.

Google JWT identity is `account.providerAccountId` captured only for provider `google` and retained in subsequent signed JWTs. Never derive identity from email or accept a subject/customer ID from a browser update. Resolve a stable customer UUID through a unique Google subject. A user's editable name/phone survive future sign-ins; the verified email may change without changing ownership.

Use Supabase REST/RPC with server-only service-role credentials. Every customer query filters by the resolved UUID. Enable RLS and revoke anon/authenticated table and function access; grant only the necessary service-role access. Functions use fixed search paths and transactions. Private responses use `Cache-Control: private, no-store`. Browser writes require same-origin requests and bounded JSON bodies. Configuration failures return actionable generic errors, not secrets/provider bodies. Public pages render without configured external services; sign-in and transactional APIs disclose unavailable configuration honestly.

## Catalog, currency and stock

The owner explicitly chose independently configured USD, JPY and THB product prices with THB settlement. Map English and Chinese to USD, Japanese to JPY, Thai to THB. No client or live FX conversion. USD/THB Stripe amounts use hundredths; JPY uses whole yen. THB settlement is an account/provider outcome, not a browser-calculated promise.

| Product | Variant/options | USD | JPY | THB |
| --- | --- | ---: | ---: | ---: |
| saxophone-end-plug | plain | 15 | 2500 | 200 |
| saxophone-end-plug | twoColor | 18 | 2800 | 250 |
| saxophone-end-plug | custom | 22 | 3200 | 350 |
| shakuhachi | standard; toneHoles=standard/large, mouthpiece=balance/traditional/modern | 230 | 35000 | 6900 |

Saleable SKUs: three `endplug-{variant}` and six `shakuhachi-{toneHoles}-{mouthpiece}` combinations. Category `woodwindaccessories` and unpriced `siliconepads` cannot be purchased. Seed stock at zero; an owner must load actual quantities. Browser requests contain product IDs, variant, machine options, quantities, locale and UUID request key. Prices, names, shipping information, identity and paid state are never authoritative browser inputs.

`quoteCart({items,locale})` is asynchronous and returns sorted canonical lines, currency, safe integer total and SHA-256 fingerprint using Web Crypto. The shared browser catalog must not import Node-only modules. Accept 1–20 input rows, quantities 1–10, aggregate duplicate SKUs and reject aggregate quantities above 10. Reject invalid locale, extra machine options, fractional/negative quantities and unpriced products. Derive display prices from this same catalog.

Order reservation locks stock rows in sorted order and atomically increments reserved quantities only if sufficient stock exists. Unique owner/request key makes identical retries return one order; a different fingerprint conflicts. Paid confirmation decrements on-hand and reserved quantities exactly once. Verified expiration releases reserved quantities exactly once. Never release a hold on browser cancellation, elapsed time alone or uncertain Stripe/database errors. Paid-after-release is an explicit review exception. Refunds do not implicitly restock.

## Checkout, webhook and fulfillment

POST `/api/checkout` resolves the customer, validates `{requestKey,locale,items}`, reserves an immutable order and creates hosted card Checkout with canonical amounts, order/customer metadata, shipping-address collection and `checkout:{orderId}` idempotency. `APP_ORIGIN` and `SHIPPING_ALLOWED_COUNTRIES` are required server configuration. Persist session creation/expiry parameters so retries send the same values, then attach the Stripe session before returning its URL. Validate configuration before taking a stock hold. Test-mode is the default; reject live keys unless `PAYMENT_LIVE_ENABLED=true`.

Use the installed Stripe SDK's default API version and current hosted-page types; map application Chinese locale to Stripe `zh`. Explicitly disable Adaptive Pricing to preserve the selected catalog currency. Freeze a one-hour expiration and refuse an uncertain unattached creation attempt when less than thirty minutes plus transport margin remains. Current signed session shipping data comes from `collected_information.shipping_details`; billing address is not a shipping substitute. See [Stripe session creation](https://docs.stripe.com/api/checkout/sessions/create) and [session object](https://docs.stripe.com/api/checkout/sessions/object).

POST `/api/stripe-webhook` verifies the raw body signature, mode, session ID, order metadata, currency and exact total. Completed/async-success events require provider `payment_status=paid`. An atomic database RPC deduplicates event IDs, advances order state, commits/releases stock, prepares shipping details and queues buyer/seller notifications. Late failure/expiry cannot regress paid status. Attachment races return retryable failures. Fulfillment never depends on a customer visiting the return page.

Customer-owned order APIs and return pages show database paid/pending/expired/failed/review states. A URL cannot confer payment. Persist a bounded cart across navigation and preserve its currency; locale changes require repricing or an explicit clear choice. Clear only the submitted cart snapshot after ownership and paid status are verified, preserving later additions. Cancellation retains the cart.

The immutable order contract is `OrderRecord={id,customerId,requestKey,fingerprint,currency,locale,amountTotal,items,status,createdAt,expiresAt,checkoutSessionId,checkoutUrl,checkoutParameters}`. `CheckoutParameters={customerEmail,successUrl,cancelUrl,allowedCountries,expiresAt}` uses a Unix-second expiry; the order exposes ISO timestamp strings. `reserve_order` additionally consumes `p_locale` and `p_checkout_parameters`; identical request-key retries return the original snapshot even after profile/configuration changes. Refuse recreation of uncertain unattached sessions outside the saved safe retry window and require manual review. Paid/expired/failed orders never return an active Checkout URL. Item totals exclude automatic tax, discounts and shipping charges; such features require a revised exact-total contract.

Shipping preparation uses only verified Stripe recipient/address details and immutable order items. A paid order with incomplete details is `needs_address`; complete details are printable by an administrator. This prepares a shipping label; it does not buy a carrier label. Admin access uses a server allowlist of stable Google subjects, never a browser role or mutable email. Admins may adjust stock subject to reserved quantities and mark shipping status, but cannot mark an order paid.

## Booking, reporting and notifications

Use stable instrument IDs `soprano`, `alto`, `tenor`, `baritone`, `bassoon`, `other` and service IDs `basic`, `standard`, `overhaul`, `assessment`. Editable server rules define Asia/Bangkok time, tomorrow through fourteen calendar days, excluding Sundays, with the existing one-hour slots starting 10, 11, 13, 14, 15, 16, 17. Server availability and submission independently enforce these rules. Unique active slots prevent competing requests; owner/request key plus fingerprint ensures retry consistency. Persist bookings and outbox jobs in the same transaction.

The UI confirms only a persisted booking and explains Bangkok time. Return inline configuration/validation/slot-conflict feedback. Remove unsupported photo-upload claims and the mailto submission. Profile lists actual owned bookings and orders, with honest empty states.

Outbox jobs hold only needed payloads; atomically claim bounded batches using `SKIP LOCKED`, worker leases and lease-owner completion checks. Use backoff, sanitized error codes and stable idempotency keys. POST `/api/cron/outbox` is protected by a separate bearer secret. Reconcile attached Stripe sessions only for provider-confirmed expiration. Retrieved paid sessions await signed webhook redelivery; reconciliation never marks paid. Unattached uncertain orders require explicit review, never time-only stock release. Review jobs/order exceptions are visible to administrators.

Transactional buyer/seller notifications use configured Resend REST delivery (`RESEND_API_KEY`, `EMAIL_FROM`, `SELLER_EMAIL`). No marketing or subscriptions are introduced. Resend retries use a stable idempotency key within its retention window; bound automatic ambiguous email retries to five attempts and less than 24 hours, then expose manual-review status. Do not claim globally exactly-once email. Missing transport configuration must not lose a booking or paid order.

The Apps Script receives a secret plus booking ID, UTC start/end, Bangkok timezone, customer name/email/phone and bounded instrument/service/notes. Script properties hold spreadsheet/calendar IDs and secret. With a script lock, upsert a booking-ID sheet row and insert/get the same private Calendar event using the UUID without hyphens as its deterministic ID. Replay repairs partial failures. Escape formula-like spreadsheet text. Do not invite attendees or send Google invitation mail. Acknowledge exactly `{ok:true,bookingId}` only after both destinations succeed. Calendar is a mirror; manual edits do not change database availability. Document the required POST scheduler and destination access.

## UX and evidence-backed legal scope

Preserve the existing visual direction. Localize touched flows in all four languages, repair account route navigation and the booking crash, remove Chinese stray `npm`, and provide keyboard-operable named controls, focus/status feedback and cart dialog handling. Self-host the currently used fonts with their licenses when feasible; report glyph coverage honestly. Correct supplied documents that claim unimplemented features exist. Do not invent an age policy, legal compliance claim, postal address, subscription terms or DMCA registration.

## Verification and delivery boundary

Write meaningful native Node behavioral tests for identity, ownership, canonical quoting, tampered input, stock/payment transitions, raw signed webhook handling, Bangkok time boundaries, report acknowledgment and retry behavior. Supply executable SQL acceptance tests for the actual migration invariants; mocks cannot establish Postgres concurrency/RLS. Run Node 22, `npm test`, `npm run astro -- check`, `npm run build`, and rendered default/prefixed flows. Report external OAuth, Supabase, Stripe, email, Sheets/Calendar and scheduler verification separately when credentials/services are unavailable.

Deliver migrations, environment examples, setup and rollback instructions. No production migration, external project creation, real customer email, live payment, carrier purchase or deployment is part of this execution.
