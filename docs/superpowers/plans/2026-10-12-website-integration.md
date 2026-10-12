# Website Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Google-authenticated customer accounts, stock-backed Stripe Checkout, repair bookings mirrored to Google, and transactional notifications.

**Architecture:** Astro request-time routes own identity, canonical amounts and Supabase REST/RPC access. Transactional PostgreSQL functions own reservations, event transitions, booking collisions and an outbox; Svelte displays server state. Hosted Stripe and server-only adapters integrate external systems.

**Tech Stack:** Node 22, Astro 6, Svelte 5, Tailwind 4, auth-astro, Stripe SDK, Supabase REST/PostgreSQL, Apps Script, Resend REST, native Node tests.

**Spec:** `docs/superpowers/specs/2026-10-12-website-integration-design.md`

## Global Constraints

- Preserve Astro/Svelte boundaries, existing Tailwind component classes, user documents and current design.
- Locales are `en`, `ja`, `zh-CN`, `th`; English is unprefixed.
- Currency is `usd` for `en`/`zh-CN`, `jpy` for `ja`, `thb` for `th`; prices come from the spec table, without FX conversion.
- Stable Google subject determines customer ownership; browser IDs/emails/amounts/paid states confer no authority.
- Supabase service-role credentials and Stripe/OAuth/transport secrets remain server-only; owned responses are private/no-store.
- RLS enabled and browser grants revoked on new database objects only; every RPC restricts execution to service_role.
- Seed nine inventory SKUs at zero. Holds are released only by verified provider expiration, never by elapsed time or browser cancellation.
- Use Stripe test mode unless `PAYMENT_LIVE_ENABLED=true`; no external/live transactions or production deployment/migrations.
- Native Node tests exercise real validators/orchestrators; mock only external transports. Never present mocked locking as a database concurrency check.
- Work in the requested checkout, no automatic commits/push; keep task reports and progress reviewable.

## Review Focus

- OAuth email changes and client JWT/session updates must preserve the stable Google subject.
- Duplicate cart rows, mismatched key reuse and competing orders must not bypass quantity/stock limits.
- Checkout-create/attach uncertainty, webhook races and late expiry must not free paid or uncertain stock.
- Bangkok midnight/Sunday boundaries and competing booking submissions must use server rules.
- Provider timeouts, reclaimed leases and partial Sheets/Calendar writes must retain jobs without duplicate confirmed fulfillment.

---

### Task 1: Request-time OAuth and customer foundation

**Files:** Modify `astro.config.mjs`, `auth.config.ts`, `src/layouts/Layout.astro`, dynamic routes under `src/pages/[lang]/`. Create `src/env.d.ts`, `src/lib/server/env.ts`, `http.ts`, `supabase.ts`, `customer.ts`, `identity.ts`, `src/pages/api/profile.ts`, `supabase/migrations/202610120001_customers.sql`, `tests/identity.test.ts`, `tests/profile.test.ts`. Add `test` script and `@astrojs/check` dev dependency as needed.

**Interfaces:** `Customer={id,googleSubject,email,name,phone}`. `requireCustomer(request):Promise<Customer>`. `rpc<T>(name,args):Promise<T>`, `select<T>(table,filters):Promise<T[]>`. `HttpError(status,code)`, bounded/same-origin JSON helpers and no-store JSON response. Env lookup supports Astro runtime and test process values. JWT helpers capture Google subject only from Google account on sign-in and ignore browser update data. SQL `resolve_customer(p_google_subject,p_email,p_name)` and `update_customer_profile(p_customer_id,p_name,p_phone)` preserve edited profile fields.

- [ ] Write failing tests: Google subject `google-123` persists when email changes; non-Google provider and client update cannot set/replace it; absent subject is 401; PATCH cannot select another customer; malformed/oversized profile and foreign Origin fail; external/config errors expose no secrets.
- [ ] Run `npm test` and record the expected missing-behavior failures.
- [ ] Implement helpers, customer migration and profile GET/PATCH. Set `output:'server'`; validate locale/slugs before filesystem interpolation. Pass only display user fields to Navbar. Public pages remain viewable without external credentials.
- [ ] Run tests, Astro diagnostics and an English/prefixed anonymous homepage check; report pre-existing diagnostics separately.
- [ ] Record files and evidence in the task report; request Pete's task review and resolve important findings.

### Task 2: Canonical catalog, orders, inventory and outbox transactions

**Files:** Create `src/lib/catalog.ts`, `src/lib/server/order-state.ts`, `supabase/migrations/202610120002_orders_inventory_outbox.sql`, `supabase/tests/integration.sql`, `tests/catalog.test.ts`, `tests/order-state.test.ts`. Modify the invalid prices typing in `src/lib/products.ts` without changing navigation content.

**Interfaces:** `Currency='usd'|'jpy'|'thb'`, `Locale`, `CartInput={productId,variant?,options?,quantity}`; `CatalogLine={sku,productId,variant,options,quantity,name,unitAmount}`; asynchronous Web Crypto `quoteCart({items:unknown,locale:unknown})` returns `{currency,lines,totalAmount,fingerprint}`. Export shared display pricing/formatting. SQL creates inventory, orders, order_items, stock_reservations, stripe_events, shipments and outbox. RPCs: `reserve_order(p_customer_id,p_request_key,p_fingerprint,p_currency,p_lines,p_amount_total,p_locale,p_checkout_parameters)`, `attach_checkout_session(p_order_id,p_session_id,p_checkout_url,p_expires_at)`, `apply_stripe_event(p_event_id,p_event_type,p_order_id,p_session_id,p_currency,p_amount_total,p_payment_status,p_shipping,p_event_created)`, `claim_outbox(p_limit,p_worker_id)`, `complete_outbox(p_id,p_worker_id)`, `fail_outbox(p_id,p_worker_id,p_error)`. Use the spec's camel-case OrderRecord and CheckoutParameters JSON contracts. Store immutable session creation time/expiry, email, locale, allowed countries and return URLs, line/shipping snapshots and notification dedupe keys.

- [ ] Write failing quote tests with literal expected amounts: plain USD1500/JPY2500/THB20000, Shakuhachi USD23000/JPY35000/THB690000; reject tampered price, invalid keys/options, unpriced product, quantity fractions/zero/negative/>10, 21 rows and duplicate aggregate>10. Canonical order/options produce equal fingerprints.
- [ ] Write payment-transition tests: only paid matching session/currency/amount commits; duplicate event/paid-then-expired changes nothing; released-then-paid requires review. SQL acceptance exercises actual reservation shortage, duplicate request mismatch, stock decrement/release once and restricted grants.
- [ ] Implement canonical catalog and additive transaction migration with sorted row locks, request uniqueness, event dedupe, outbox leases and owner checks. Use explicit SQLSTATE/constraint failures that API maps to 409.
- [ ] Run full tests and SQL acceptance when PostgreSQL exists; otherwise record SQL verification unavailable and provide the exact command. Review with Pete before payment orchestration consumes these RPCs.

### Task 3: Hosted Checkout and verified order status

**Files:** Create `src/lib/server/payments.ts`, `src/pages/api/stripe-webhook.ts`, `src/pages/api/orders.ts`, `src/lib/server/reconciliation.ts`, `tests/payments.test.ts`. Replace `src/pages/api/checkout.ts`.

**Interfaces:** Checkout accepts `{requestKey,locale,items}` and returns `{orderId,url}`. Server payment orchestration consumes Task 1 identity and Task 2 catalog/RPCs; adapters can inject external Stripe/DB transports for tests. Order reads filter by server customer UUID. Raw webhook event is verified with Stripe SDK before invoking RPC. Reconciliation retrieves attached pending sessions and applies only provider-confirmed expiration; paid recovery requires signed webhook redelivery, never releasing unattached uncertain holds.

- [ ] Write failing tests for unauthenticated/config failures before reservation, canonical provider amounts/card-only/session metadata, identical create retry parameters/idempotency key after profile/config changes, refusing recreation outside the saved safe retry window, create timeout preserving holds, attach race, forged/raw-body signature, live/test mismatch, amount/session mismatch and customer-owned order reads.
- [ ] Implement request handlers and orchestration using server `APP_ORIGIN`, required shipping-country allowlist, stable stored expiry, secret-gated live mode and generic responses. Return retryable webhook failure until session attachment succeeds.
- [ ] Run `npm test`; locally exercise API validation/configuration failures without sending a real Stripe request. Pete reviews spec compliance and correctness.

### Task 4: Booking transactions, Google mirror and notifications

**Files:** Create `src/lib/booking.ts`, `src/lib/server/bookings.ts`, `src/lib/server/outbox.ts`, `src/lib/server/notifications.ts`, `src/pages/api/bookings.ts`, `src/pages/api/booking-availability.ts`, `src/pages/api/cron/outbox.ts`, `supabase/migrations/202610120003_bookings.sql`, `scripts/google-sheets-booking-webhook.gs`, `tests/bookings.test.ts`, `tests/outbox.test.ts`. Extend SQL acceptance tests. Update `docs/google-sheets-booking-webhook.md`.

**Interfaces:** Booking body `{requestKey,slot,instrument,service,notes}`; availability returns `{timeZone:'Asia/Bangkok',slots:[{startAt,endAt}]}`. SQL `create_booking(p_customer_id,p_request_key,p_fingerprint,p_start_at,p_end_at,p_instrument,p_service,p_notes)` persists booking plus jobs atomically. Dispatcher consumes Task 2 lease RPCs. Google body/ack shape is fixed in spec; notifications use `RESEND_API_KEY`, `EMAIL_FROM`, `SELLER_EMAIL` and stable provider idempotency keys. Protected scheduler also runs Task 3 reconciliation.

- [ ] Write failing tests for Bangkok date rollover, Sunday/past/out-of-window slots, stable IDs/notes bounds, booking idempotency/collision and owner reads; include executable SQL collision tests.
- [ ] Write outbox transport tests for malformed/redirect/wrong-ID acknowledgments, partial report retry, missing config retaining jobs, lease completion ownership and bounded ambiguous email retries. Test Apps Script against controlled Sheet/Calendar service doubles to prove dedupe and repair.
- [ ] Implement booking rules/API/migration; mirror private Calendar event by deterministic UUID ID and upsert Sheet row under lock, escaping formula-like text; acknowledge only complete success. Add bounded leased dispatcher and transactional buyer/seller email delivery.
- [ ] Run full tests and update setup docs for Advanced Calendar service, script properties, restricted destinations and authenticated POST scheduler. Pete reviews.

### Task 5: Customer UI, locale routes, cart persistence and admin preparation

**Files:** Modify `src/store/cart.svelte.ts`, `src/components/Navbar.svelte`, product purchase components, `src/components/ui/BookingForm.svelte`, `src/i18n/ui.ts`, `src/utils/navigation.ts`, login/profile/success/cancel pages and locale wrappers, `src/pages/zh-CN/booking.astro`, `src/pages/ja/booking.astro`. Create shared account page components where they prevent duplication, `src/lib/cart-storage.ts`, `src/lib/server/admin.ts`, `/api/admin/inventory` and `/api/admin/shipping-label` endpoints, `src/pages/admin.astro`, `tests/cart.test.ts`, `tests/admin.test.ts`; add narrowly scoped SQL admin-stock/fulfillment RPCs in `supabase/migrations/202610120004_admin.sql`.

**Interfaces:** Cart persists canonical IDs/options/currency and quantities with bounded storage validation; checkout stores the submitted snapshot/request key and preserves later additions. Paid return page supplies only an owned verified order snapshot to cart reconciliation. Profile saves through Task 1 and lists owned Task 3/4 records. Admin requires `ADMIN_GOOGLE_SUBJECTS` and may set stock >=reserved or prepare paid shipments/mark shipped, never payment state.

- [ ] Write failing cart tests for malformed storage, no mixed currencies, navigation persistence and clearing only a paid matching snapshot while preserving later additions. Admin tests reject non-admin subjects, cross-account access, stock below reservations and shipping preparation for unpaid orders; printable content must escape HTML.
- [ ] Integrate UI with APIs and all four locale strings/routes. Use stable machine options and the same catalog prices; show confirmed booking/payment only from server responses. Preserve failed/cancelled cart and request key for retries; actionable inline status and no false photo claims/static appointment.
- [ ] Repair accessible icon names, dialog focus/Escape behavior, selection semantics and locale switching; remove stray Chinese `npm` and correct Japanese booking text. Show useful missing-configuration states.
- [ ] Review rendered English plus ja/th/zh-CN booking/account/product/cart/success flows at desktop/mobile with Mai, record actual findings and fix material regressions. Pete reviews the admin/data boundary.

### Task 6: Final diagnostics, source truth and release preparation

**Files:** Update `AGENTS.md`, `.agent.md`, `.env.example`, `README.md`, `docs/website-agent-plan.md`, `docs/legal-risk-review.md`. Create `docs/integration-setup.md`, `docs/verification-report.md`; narrowly fix diagnostic/build issues in touched files. If self-hosting current font families, create licensed assets under `public/fonts/` and update `src/layouts/Layout.astro`/`src/styles/global.css` without changing typography direction.

- [ ] Run full `npm test`, `npm run astro -- check`, `npm run build` with Node22. Fix relevant baseline typing/Svelte failures with regression tests where behavior changes; report checks exactly.
- [ ] Self-host the current fonts with licenses if complete assets can be obtained, verify four-language fallback; otherwise document the remaining remote-font issue accurately.
- [ ] Refresh the preview from current workspace source and check default/prefixed routes, auth redirect, API failure states, booking selection (previous `t` crash), cart persistence and unverified-success behavior. Never claim external integrations or SQL locking were tested without the actual services.
- [ ] Prepare environment, migration order, stock setup, OAuth callbacks, Stripe test webhook, verified mail sender, Sheets/Calendar/scheduler setup, shipping-country policy and rollback/reconciliation notes. Correct stale supplied documents without overwriting owner intent.
- [ ] Pete performs a whole-change review; Wal fixes important findings and a scoped review verifies fixes. Update progress and verification report with completed work, exact checks and external prerequisites. Leave source changes reviewable; no deployment, live payment or automatic Git publication.
