# SDD ledger — plan: docs/superpowers/plans/2026-10-12-website-integration.md

Baseline commit: `cfc3f83b30d56ee4fa78133c62ec03fe4b7fa519`. Checkout: `D:/MyDocument/Design_music/Website/Designmusic-TH-Website`, branch `main`. User documents were untracked at start; preserve them. Pete read-only architecture review and Mai source/rendered baseline review complete.

## Decisions

- Owner authorizes generating Markdown and beginning local implementation; do not repeat prior approval questions. Production migration/deployment/live transactions remain outside scope.
- Owner explicitly requests separate USD/JPY/THB prices and THB settlement. Retain actual catalog values; locale mapping en/zh-CN USD, ja JPY, th THB. If a different mapping is later requested, repricing/UI need adjustment.
- Implement in the requested checkout and leave changes uncommitted for review; no temporary source copy is the implementation target. The old preview serves a temporary copy and must be refreshed.
- Source contradicts supplied docs: most integrations, daisyUI and age gate are absent. Build missing systems and correct source inventory. No arbitrary age restriction or new styling framework.
- Actual stock, shipping countries, production service settings and business legal policies are not known. Stock seeds zero; external operations require configured owner settings.

### Owner steering after Copilot changes

- Preserve Copilot's revised styling, system fonts, inline SVG, imagery and login layout. Complete the four functional tasks in website-agent-plan.md before decorative polish. Self-host font packages were staged but will not replace the owner's new system-font choice.
- Stock quantities are unknown: keep all nine SKU seeds at zero. Shipping intent is TH, JP and Thailand Post international ePacket destinations. TH/JP are the explicitly named initial configuration; the complete current provider destination/suspension list remains unverified. Do not describe the implementation as full worldwide availability until configured and checked.
- Wal/Luna hit a usage limit during Task 2. Pete explicitly assigned a fresh GPT-6.1 Sol implementer at medium effort, retaining Wal's bounded role; root verifies and Pete reviews. Do not retry the exhausted runtime or revert Copilot work.
- The static Credentials provider does not resolve a Google customer. Preserve its layout but disable unsupported credentials sign-in for this delivery; Google subject remains the customer authority.
- Order email topics are order_paid_buyer/order_paid_seller; booking email topics are booking_buyer/booking_seller. Report topic will be booking_google. Email first_attempt_at starts the 23-hour retry window; review status and five claims bound both explicit failure and lease reclaim.
- Existing immutable OrderRecord.locale supplies the fixed Stripe locale mapping. Do not derive retry locale from new browser input; CheckoutParameters retains its established fields without a redundant locale field.

Current-checkout evidence after Copilot: Node22 native 16 tests passed; Astro diagnostics passed with zero errors, zero warnings and five hints. Same-drive dependencies installed and production build running. Partial Task2 has not been accepted; source review found webhook race, failed-hold recovery, address validation and lease/retry blockers, now being repaired.

## Preflight interface review

| Tasks | Producer / consumer | Result |
| --- | --- | --- |
| 1 | Subject callbacks, owned profile RPCs, SSR guards vs identity tests | Consistent; client updates cannot select identity. |
| 2 | Quote/catalog + transaction RPCs vs amount/idempotency/stock tests | Consistent; use three currencies after owner clarification. |
| 3 | Checkout/webhook vs provider uncertainty/mode/ownership tests | Consistent; no release on uncertain create or cancel. |
| 4 | Booking/report/email vs calendar and retry tests | Consistent; Google acknowledgment requires both destinations. |
| 5 | UI/admin vs owned server state and snapshot tests | Consistent; no client authority or mixed-currency cart. |
| 6 | Diagnostics/docs/preview vs actual local and external evidence | Consistent; unavailable SQL/services must remain disclosed. |
| 1→2/3/4/5 | requireCustomer, rpc/select, errors | Shared interfaces defined in Task1. |
| 2→3/4/5 | reservations, events, outbox, catalog | Task2 defines names/values; later tasks consume them. |
| 3→4/5 | reconciliation, owned order snapshots | Used by scheduler and success/profile. |
| 4→5 | server availability/bookings | Form uses returned UTC slots and Bangkok label. |
| 1–5→6 | touched source, test evidence, setup contracts | Final verification covers integrated source. |

## Tasks

- [x] Task 1: OAuth/customer foundation.
- [x] Task 2: Catalog/orders/inventory/outbox.
- [x] Task 3: Checkout/webhook/order status.
- [x] Task 4: Bookings/Google/transactional notifications.
- [ ] Task 5: Customer UI/locales/cart/admin.
- [ ] Task 6: Diagnostics, preview and release documentation.

## Evidence and limitations

Initial runtime was Node24; Node22/dependency baseline will be established. Previous temporary preview returned `Home | Design Music` after using a temporary auth secret. Mai reproduced booking `ReferenceError: t is not defined`, localized account 404, and false anonymous payment success on that preview. OAuth credentials, database, test Stripe account, email sender and Google destinations have not been connected or tested.

### Task 1 acceptance — 12 October

Pete scoped review passed six wiring/mapping repairs and the project-local auth endpoint. Root ran Node 22.23.3 native tests: 10 passed, zero failed. Customer migration applied to disposable PostgreSQL 17.11 on localhost; actual SQL checked stable UUID across email refresh, preservation of edited name/phone, RLS and denied browser grants. Anonymous workspace HTTP checks: /, /ja/, /th/, /zh-CN/ returned 200; /xx/ 404; /api/profile 401 with no-store; /api/auth/session 200.

Astro diagnostics now execute: 52 baseline errors, mainly Astro usage of old Lucide Svelte types, existing product price typing, AOS missing declaration and signIn option. These are assigned to Tasks 2/5/6. Build compiles server/client then fails Vercel packaging with cross-drive dependency file URL. Root is installing dependencies on D: to verify this environment issue. No external OAuth or Supabase was exercised.

Ruling: proceed after foundation route/SQL/native evidence and source review; repair existing UI diagnostics in their planned tasks instead of mixing unrelated UI changes into Task 1. Build packaging verification remains required in Task 6.
### Task 3 provider compatibility ruling

Pete verified installed Stripe22.0.2 API version 2026-03-25.dahlia and current primary docs. Use typed hosted_page, zh for zh-CN, collected_information.shipping_details, and adaptive_pricing.enabled=false. Freeze one-hour expiry; do not attempt uncertain unattached creation if less than 30 minutes plus transport margin remains. Existing CheckoutParameters property names remain expiresAt (Unix seconds), locale comes from immutable OrderRecord; brief examples' expiresAtEpoch/stripeLocale do not override this contract. Full provider brief is in scratch and implementation will capture relevant setup facts in retained docs.

Pete additionally approved a versioned server reservation fingerprint binding canonical quote fingerprint plus SHA-256 of the protected Stripe key. Key/account/mode changes must conflict before provider calls, preserve uncertain holds and require manual reconciliation; even same-account key rotation conservatively refuses automatic retries. Existing unbound records fail closed. Neither fingerprint appears in customer responses. CheckoutParameters remains five fields; provider idempotency remains checkout:{order.id}. Future Connect/account routing would need to join this identity binding.

### Task 2 acceptance — 12 October

Pete final scoped review passed after correcting paid-after-release review preservation. Root independently ran the full native suite: 20 passed, zero failed. Entire customer and order/inventory/outbox migrations applied to a fresh disposable PostgreSQL database; SQL acceptance passed. The final targeted RPC fix was reloaded and acceptance rerun successfully.

Two actual simultaneous PostgreSQL sessions were observed waiting on locks: competing request keys with one available unit yielded one order and one stock_unavailable rejection; identical concurrent request keys returned one immutable order and reserved once. Fixtures were removed and inventory returned to zero. Evidence retained locally in .runtime/task-2-fresh-sql.log, task-2-final-sql.log, task-2-final-native.log and task-2-concurrency.log. This is local PostgreSQL evidence, not a claim that external Supabase has been configured.

Current verification limits: Astro diagnostics previously passed with zero errors/warnings; production compilation succeeds but Vercel packaging fails on Windows directory symlink permissions. Root is preparing a flat dependency installation to resolve packaging without changing the production adapter or operating-system privileges. Real OAuth, Supabase, Stripe, Google and email services remain unconnected.

### Task 3 acceptance — 13 October

Pete full review and targeted reconciliation re-review passed. Root independently ran the complete native suite: 40 passed, zero failed. Signed SDK webhook fixtures, ownership, canonical/frozen parameters, account-key binding and bounded reconciliation are covered. No actual Stripe transport or external OAuth/Supabase was exercised. Full Astro diagnostics are still running; their result and production packaging remain required Task6 checks and are not claimed as passed.

Reconciliation defaults/caps are five orders, 25 seconds total and five seconds per Stripe lookup with no automatic network retry; monotonic elapsed time is independent of provider-event business time. Timeout before issuing an expiration update preserves holds. An already-issued, authorized/idempotent verified-expiration RPC may finish after the caller times out; this is ambiguous completion, not unconditional hold preservation. Outbox work must have its own bounded scheduler budget.

After owner restart/copy, file-content reads stalled temporarily and then recovered. The local Git config contained 510 zero bytes; backed it up to .runtime/git-config-corrupt-20261013.bin and restored minimal core/origin settings using the HTTPS remote verified in FETCH_HEAD. Existing HEAD remains cfc3f83b30d56ee4fa78133c62ec03fe4b7fa519; source, index and history were not reset.

Owner supplied Thailandpost-destination.pdf and thailand_post_epacket_destinations_and_rates.md, effective2022 with47 destinations. Owner explicitly selected the 1300g table for parcel preparation only. Do not add its fees to checkout or claim these historical rates/destinations are the complete current service list. Preserve supplied files; admin may show a dated THB preparation estimate.

Task4 interface ruling: add optional validated booking locale (default en) and ninth SQL p_locale text default en so immutable notification snapshots can use the booking language without altering customer identity/profile schema. Existing eight-argument SQL callers remain valid through the default. Update producer/consumer briefs together before implementation.

### Parcel preparation and temporary validation — 13 October

Owner explicitly confirmed the supplied Thailand Post 2022 table is for parcel preparation only; no shipping charge will be added to Checkout. Root visually verified the 1,300 g reference row against PDF page 3. The historical table does not establish current worldwide eligibility.

Intermittent D shell stalls returned. A complete current-source snapshot (168 initial files) and flat locked dependencies were staged in the authorized C workspace; Node22.23.3 and disposable PostgreSQL17.11 on localhost55433 are available there. Implementers may stage/test current changes there, and root will synchronize exact scoped changes back to the authoritative D checkout before final acceptance. This is an execution workaround, not a replacement source repository. Earlier disposable D PostgreSQL server stopped cleanly.

Fresh migrations001/002 applied successfully on C. The current SQL acceptance assertion expecting one-unit stock failed; an existing one-each stock sample also collided with planned migration003. Pete ruled to preserve the sample verbatim outside migrations, restore zero-seed acceptance and keep003 bookings/004 admin. No actual inventory data is reset and no stock is inferred from the sample.

### Task 4 acceptance — 13 October

Pete full review and flush repair re-review passed. Root independently ran all 59 native tests after preserving the newer typed payment fixture. Fresh real PostgreSQL migration and booking concurrency evidence is recorded in the Task4 report. The reviewed 22 scoped files were synchronized and byte-verified on D. Six newer alternative D modules were preserved under .runtime/source-preservation-20261013; Pete compared them and found regressions rather than required behavior. The original one-each sample was byte-verified and preserved outside migrations; seeds remain zero. Apps Script flush now commits Sheet changes under the lock before Calendar and success acknowledgment. External providers remain unconfigured. Customer UI/admin and final diagnostics/build/rendered verification remain pending.

### Owner checkout update observed

Current D HEAD is e29d507a3144e1b53548c5d4f8f6a26ccf490783 (13 October 04:25 JST), following b04f89f. These pre-existing owner commits were discovered during synchronization and remain untouched. Baseline cfc3f83 remains the start-of-work reference only. Current secret-ignore rules are preserved. Package manifests add the missing @emnapi/runtime 1.10.0 diagnostic peer without changing locked Astro6.1.7/Stripe22.0.2 versions. Baseline backend production build now completes in the flat C dependency installation; integrated UI build remains required after Task5.

Pete approved byte-preserving archival of the duplicate 202610130001 booking migration and obsolete002.sql.clean draft under docs/examples. Only verified original executable/draft paths were removed; no database migration or data change occurred. Any external database that applied the alternate schema requires separate inspection/forward reconciliation.
