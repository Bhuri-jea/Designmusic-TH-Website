# Booking contact and seller-managed catalog design

**Date:** 22 October 2026  
**Status:** Approved design; implementation pending

## Purpose

Add an explicit customer contact channel to repair appointments, expose private appointment details only to authorized sellers, simplify the public repair-availability panel, and replace the hard-coded product registry with a seller-managed catalog. Sellers can create complete product pages and explicit SKU combinations without editing source code or redeploying.

Supabase remains authoritative for bookings, products, prices, stock and orders. Historical order and booking snapshots remain immutable.

## Booking contact and calendar behavior

The booking Details step requires:

- Customer name.
- Contact information: one free-text preferred-contact field, with localized examples such as Facebook, LINE or phone.
- Optional repair notes.

The authenticated account email remains internal for identity and confirmation-email delivery. It is not presented as the customer's preferred contact method. The submitted name and contact information are validated on the server, included in the booking fingerprint, and frozen into `customer_snapshot`. Profile changes do not rewrite existing appointments. Rescheduling retains the original snapshot.

The public availability response continues to expose only dates, times and status. It never contains customer details. In the authorized admin calendar, a booked slot initially shows customer name, contact information and instrument. An expandable **View details** section reveals the selected repair plan, notes, full appointment time and booking status. Legacy appointments without the new field show **Contact information not provided** and do not substitute the old account email.

The repair-services availability calendar is read-only. Customers may browse **Available**, **Booked**, **Contact directly** and **Unavailable** states but cannot select a slot. One centered, localized **Book appointment** link opens the localized booking page. Slot selection and submission occur only there.

Booking notifications and the Google delivery snapshot include the preferred contact information. Buyer confirmation mail still goes to the authenticated account email.

## Seller-managed product catalog

Use one database-backed catalog and one standardized editorial product template. Migrate the current Saxophone End Plug, Shakuhachi S-1/D and Silicone Pads into it. Keep Woodwind Accessories as a collection that can contain current and future products.

### Product records

Each product has:

- Stable identifier, slug and optional collection.
- `draft`, `published` or `archived` lifecycle status.
- Ordered image URLs with one primary image.
- English, Thai, Japanese and Simplified Chinese translations.
- Translated name, short description, full description, badge, image descriptions, SEO title and description.
- Ordered option groups and option values.
- Created, updated and published timestamps.

A draft can be saved incomplete. Publishing requires all four complete translations, at least one valid primary image and at least one active SKU. Published slugs are immutable. Archiving hides the product from public lists, navigation and direct public lookup while retaining administrative and historical references.

New image entries must be absolute HTTPS URLs with bounded lengths and counts. Migrated records may retain existing local `/images/...` paths. The server does not download, proxy or inspect remote image bodies.

### SKU records

Each SKU belongs to one product and contains:

- An immutable SKU code.
- One explicit option-value combination; combinations are never generated automatically.
- On-hand and reserved quantities.
- Independent USD, JPY and THB prices.
- Packaged weight.
- `checkout` or `reservation_only` sales mode.
- `active` or `archived` lifecycle state.

Checkout SKUs require valid positive prices and packaged weight before publication. Reservation-only SKUs may omit checkout prices and stock and show Facebook, Instagram, email and phone contact actions. They never enter the repair-booking workflow. Archived SKUs cannot be added to a new cart but remain valid in historical orders and existing payment/reservation records.

Published SKU codes cannot be renamed. The seller archives an incorrect SKU and creates its replacement. The system rejects duplicate option combinations within a product.

## Storage and interfaces

Add normalized catalog tables for products, translations, images, option groups and option values. Extend inventory with the catalog product reference, explicit option selection, sales mode and lifecycle state. Retain `inventory.sku` as the stable stock key used by orders and reservations.

Add an additive booking migration that updates the final booking RPC contract to accept `contactName` and `contactInformation`. Existing rows need no destructive conversion. Add an admin-only booking-calendar projection containing private booking detail; keep the public projection unchanged.

Provide authenticated seller catalog endpoints for listing, creating, loading, saving and changing lifecycle state. A full product save accepts the product, all four translations, ordered images, option model and complete SKU list. A single database transaction validates all fields and either commits all changes or none. The browser never supplies authoritative reserved quantities or historical order values.

The public catalog endpoints and Astro product route return only published products and active SKUs. Checkout canonicalization reads prices, weight, lifecycle and sales mode from Supabase. Draft, archived, reservation-only and unknown SKUs fail closed.

## Admin experience

The product administration area provides:

- Search and lifecycle filters.
- Create-product and edit-product screens.
- Four clearly separated translation editors with completeness indicators.
- Image URL ordering and primary-image selection.
- Option-group and option-value editing.
- Explicit SKU combination creation.
- Stock, prices, weight, sales mode and lifecycle controls.
- Preview, Save, Publish, Unpublish and Archive actions.

Save is transactional for one entire product and all its SKUs. Failed validation preserves the current draft and identifies the affected field or SKU. Destructive-looking actions use archive semantics. Reserved quantities remain read-only.

The standardized public template contains the gallery, translated editorial copy, option selectors, currency price, stock or reservation state and the appropriate checkout or direct-contact action. It remains responsive and keyboard accessible in every supported language.

## Security and privacy invariants

- Only the existing approved Google admin identities can mutate catalog or view private booking details.
- Customer identity and account email are never accepted from browser claims.
- Public availability never contains contact snapshots, notes or customer identifiers.
- Prices, stock, reserved quantity, weight, product lifecycle and SKU sales mode are read from trusted server data at checkout.
- Existing orders retain their frozen product name, SKU, options and charged amount after catalog edits or archival.
- Existing booking and outbox idempotency is preserved; the new contact fields join the immutable fingerprint and snapshots.
- New request bodies, text and URLs use explicit schemas, bounds and control-character rejection.

## Migration and compatibility

Use forward-only migrations after the current `202610210012` release. Seed the three existing products idempotently and associate every current inventory SKU without changing any stock, reservation, price or weight value. Do not apply the sample one-each inventory seed.

During rollout, existing static pages remain available until the seeded catalog passes parity checks. Switch navigation, listing and product detail reads together so there is no mixed catalog authority. Rollback may restore the previous application deployment; additive tables and columns remain dormant and must not be deleted.

## Acceptance criteria

- Booking rejects missing or malformed name/contact information and accepts localized valid examples.
- Identical booking retries preserve one snapshot and one booking; changed contact data with the same request key conflicts.
- Public availability contains no customer data. Authorized admin can expand a booked slot; unauthorized and customer accounts cannot.
- Repair-services has no slot-selection action and contains one localized **Book appointment** link.
- A seller can draft a product, add translations/images/options/SKUs, preview it and publish only when complete.
- The three migrated products preserve current content, images, SKUs, prices, stock and sales behavior.
- Reservation-only SKUs show direct contact choices and never enter cart or repair booking.
- Catalog save is atomic. Duplicate slugs, SKU codes or option combinations do not partially write.
- Archived products/SKUs disappear from public discovery and new carts while old orders remain readable.
- Checkout refuses stale, archived, reservation-only or unknown SKU input and continues to enforce server prices and stock.
- All four customer locales and English/Thai admin pass keyboard, focus, mobile, tablet and desktop review.
- Native tests, SQL acceptance, Astro diagnostics and production build pass before deployment.

