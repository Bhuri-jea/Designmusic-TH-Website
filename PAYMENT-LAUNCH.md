# Payment recovery changes — 18 November 2026

This branch fixes checkout attempt identity (shipping and international recipient/address), restart after provider-confirmed expiry, frozen approved catalog quote prices/names, quote lifetime validation before order linking, automatic shipping request size, twenty-line order/quote persistence, cancellation/restock recovery, external partial-refund adoption, and fair payment reconciliation.

The existing pay-to-secure policy is preserved: competing successful payments can put the unallocated order into seller review/refund. This change does not promise stock before payment or enable additional Stripe payment methods.

## Rollout

1. Back up the database and apply `supabase/migrations/202611180001_payment_launch_recovery.sql` before deploying this branch. The code depends on its reconciliation column/RPC and cancellation guards. The migration deliberately aborts if the preserved order constructor differs from the expected source; investigate drift rather than bypassing the guard.
2. Deploy the matching application revision. Check English and Thai checkout, shipping changes, corrected international addresses, expired sessions, manual quotes, cancellation and partial-refund recovery.
3. Confirm the deployment uses the intended live restricted key and matching webhook signing secret. Stripe Account status and live webhook destination were inspected as Active; that does not establish the deployed key/secret pair matches.
4. Complete a controlled end-to-end payment with the owner's explicit payment action, then verify its signed event, paid order, stock allocation, shipment address and notification. Check refund/stock recovery using disposable test-mode orders first.

No production migration, live charge, refund, or settings change was performed as part of this code change. Previously linked quotes without known sessions require seller investigation; do not clear uncertain payment links automatically.

## Verification

Use Node 24, `npm ci --legacy-peer-deps`, `npm test`, `npm run astro -- check`, and `npm run build`.

The new transactional SQL acceptance fixture is `supabase/tests/payment-launch-recovery.sql`. It covers external partial-refund adoption, exactly-once stock restoration, delayed payment/restock review, refund preparation guards, scheduler recovery guards, twenty-line persistence and RPC privileges. Run against a disposable database with the committed migrations applied.

Local SQL verification used PGlite/PostgreSQL with pgcrypto and dummy roles, not a production Supabase database or independent concurrent connections. Replay excludes the obsolete duplicate `202610120003_bookings.sql` and sample-stock `202610120003_inventory_one_each.sql`. Historical stock/refund fixtures assume earlier catalog lifecycle state and need fixture maintenance before they can serve as full-current-schema acceptance tests.

The existing pickup-location test had an obsolete map URL and was aligned with the current configured workshop URL.

The dependency update removes the previously flagged `proxy-addr` and `shell-quote` critical findings. The npm lockfile is the source for installs. The override keeps `@vercel/routing-utils` on patched `path-to-regexp` 6.3.0 until its upstream dependency pin is updated. Both the full npm audit and the production-only audit reported zero known vulnerabilities on 19 November 2026. The live payment test remains a separate rollout step.
