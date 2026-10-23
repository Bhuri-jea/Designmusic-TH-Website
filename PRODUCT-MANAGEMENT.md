# Add, view, and edit products

## Setup before using the updated editor

The website must already have migrations through `202610220002_dynamic_catalog.sql`.
Then run these files in Supabase SQL Editor in this order, one at a time:

1. `supabase/migrations/202610230001_catalog_draft_workflow.sql`
2. `supabase/migrations/202610230002_catalog_identifier_integrity.sql`
3. `supabase/migrations/202610230003_catalog_seed_content_parity.sql`

Do not rerun the original catalog migration on an already configured database.
If the original catalog migration failed, use the corrected version first. Its transaction rolls back on failure; do not delete existing inventory.

Deploy the matching website code after all three forward migrations succeed.

## View and edit

1. Sign in with an authorized shop Google account.
2. Open `/admin/products` (English) or `/th/admin/products` (Thai).
3. Search by product name or slug. Select Draft, Published, Archived, or All.
4. Click a product in the list to open its editor.
5. Edit its content, stock, USD/JPY/THB prices, gross weight in kg, images, options, or sales mode.
6. Click **Save complete product** once to save that product's complete record.
7. Wait for **Saved.** before leaving. Reopen the product to verify the persisted values.

Stock means total stock on hand. Reserved quantity is shown separately and cannot be edited. Never reduce stock below reserved quantity. Enter prices in normal currency units: USD 15.00, JPY 2500, THB 200.00. Enter the packaged gross weight in kg, for example 0.150 for 150 g.

## Add a product

1. Click **Create product**. It starts as a private draft.
2. Set a unique slug using lowercase English letters, numbers, and hyphens, for example `reed-case`. It becomes part of the product URL.
3. Leave **Collection slug** blank unless the product belongs to a collection. Use `woodwindaccessories` for the existing Woodwind Accessories collection.
4. Fill in Name, Short description, and Description for English, Thai, Japanese, and Simplified Chinese. Badge is optional. Incomplete translations may be saved in a draft; all four must be complete before publication.
5. Add absolute HTTPS image URLs. Select exactly one primary image. Use the arrows to set gallery order. Existing migrated `/images/...` URLs may be retained; new images must use HTTPS.
6. If the product has variants, add option groups, such as `size`, and values, such as `small` and `large`. Supply labels in all four languages. Value codes must be unique across the product.
7. Click **Add SKU** once for every combination that you actually sell. Give each SKU a unique code and select one value from each option group. For a product without options, create one SKU with no option selections.
8. For **checkout**, enter stock, positive USD/JPY/THB prices, and positive gross weight. For **reservation only**, customers contact the shop directly and cannot add the item to the cart.
9. Click **Save complete product**. Use **Preview** and its language selector to inspect draft text and the main image.
10. Click **Publish**. Current edits are saved first, then publication requirements are checked.
11. Open **Public page** and check all four languages. The product should appear in the product list and navigation without another deployment.

## Hide or discontinue a product

- **Unpublish** changes the product to a draft and hides it from customers. Complete it and publish again when ready.
- Set a SKU to **archived** to discontinue that variant.
- **Archive** hides the entire product and archives its SKUs. Historical order records are retained. To restore, make the intended SKUs active, save, and publish again.
- A slug is locked after first publication. Saved SKU codes cannot be renamed. Add a new SKU and archive the old one instead.

## If something fails

- **Seller tools unavailable:** check the migrations and admin account configuration.
- **Incomplete translations:** complete all four Name, Short description, and Description sections.
- **Invalid images:** check HTTPS URLs and select one primary image.
- **Invalid options/SKUs:** check unique codes, one selection per option group, duplicate combinations, stock, prices, and kg values.
- **Conflict:** another product may already use the slug or SKU, or stock may have become reserved. Reopen the product before retrying stock edits.

The draft preview is a content preview; verify the published page for the final gallery, options, stock, and purchasing experience.
