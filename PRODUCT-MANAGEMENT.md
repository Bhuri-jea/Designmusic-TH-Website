# Add, view, and edit products

## Install the updated editor

Existing installations must already have catalog migrations through `202610230003_catalog_seed_content_parity.sql`. Do not rerun the original catalog migration or delete inventory.

In Supabase SQL Editor, run these new files one at a time, then deploy the matching application:

1. `supabase/migrations/202610240001_product_presentation.sql`
2. `supabase/migrations/202610240002_catalog_media_collections.sql`

The first adds atomic product presentation settings. The second adds named categories and a public `product-images` Storage bucket. Existing prices, stock, reservations and orders are retained. No new environment variables are required: the server uses the existing Supabase URL and secret key. Do not expose the secret key in browser settings.

For an installation without the catalog yet, first apply `202610220002_dynamic_catalog.sql`, followed by the three `202610230001`, `202610230002`, and `202610230003` catalog migrations in order.

## Open and edit a product

1. Sign in with an authorized seller Google account.
2. Open `/admin/products` or `/th/admin/products`.
3. Search by product name or page address. Filter by Draft, Published, Archived, or All.
4. Select a product. Existing End Plug, Shakuhachi and Silicone Pads should already be listed after catalog setup.
5. Edit the product. The live preview updates beside the editor on desktop. On smaller screens, press **Preview**; close it with × or Escape.
6. Press **Save complete product** once to save all content, layout, options, reviews, stock, prices and weight together.
7. Wait for **Saved.** before leaving. Failed saves retain your edits. Reopen the product to check its saved values when necessary.

The preview uses the same product renderer as the public page, including the four languages and option display styles. Purchasing is disabled in preview; it does not add items to the real cart or reserve stock.

## Create a product

1. Click **Create product**. It starts as a private draft.
2. Set a unique page address using lowercase English letters, numbers and hyphens, for example `reed-case`. It is locked after first publication.
3. Select a friendly **Category**, or choose **No category**. To add one, enter its readable name, such as “Instrument parts,” then press **New category**. Its URL identifier is generated behind the scenes. Save the product to assign the category.
4. Fill in Name, Short description and Description in English, Thai, Japanese and Simplified Chinese. A badge is optional. Incomplete text can be saved in a draft, but all four language sections must be complete before publication.
5. Add images from your computer or paste absolute HTTPS image URLs. Select one primary image. Use the arrows to order the gallery and edit alternative text to describe each image.
6. Add option groups and values when required. Supply labels and one-line explanations in all four languages. Codes identify the combinations internally and must be unique.
7. Select **Option display** for each group: **Buttons**, **Dropdown**, or **Radio list**. Dropdowns show the selected value's explanation below the field; the other styles show explanations with the choices.
8. Add one SKU for each combination actually sold. Choose exactly one value from every group. A product without options needs one SKU without selections.
9. For **checkout**, enter stock, positive USD/JPY/THB prices and packaged gross weight in kg. For **reservation only**, the page shows shop contact choices and customers cannot add that variant to the cart.
10. Save the complete product, inspect the live preview, then **Publish**.
11. Open **Public page** and check the languages. Products and categories update without another deployment.

## Stock, prices and weight

Stock is total quantity on hand. Reserved quantity is shown separately and cannot be edited; do not reduce stock below reservations.

Enter normal currency units: USD 15.00, JPY 2500, THB 200.00. Enter packaged gross weight in kg, such as 0.150 for 150 g. Price fields have no spinner arrows; mouse-wheel and arrow keys do not change their values. Type the desired amount, then Save.

Customers choose quantity after availability by default. The cap is 10 units per SKU or available stock, whichever is lower, including quantities already in their cart. **Add to cart** checks current stock again. A failed or insufficient-stock check does not add anything. Stock is reserved only during checkout, which independently validates prices and availability.

## Arrange each product page

**Page layout** applies only to the selected product. Use the up/down controls to arrange badge, name, description, options, price, availability, quantity, purchase/contact action and reviews.

**Combine with previous** puts two sections in a row. **Split row** separates them. Combined sections stack when the containing page area is narrow, including the live preview. All sections remain present in the layout; empty badges/reviews and irrelevant checkout controls are automatically omitted.

**Standard** resets the usual reading order. **Compact** combines availability and quantity. Neither preset changes the product content, stock or price.

## Customer reviews

In **Customer reviews**, enter a customer's name, a whole-star rating from 1 to 5, and their impression. Publish only genuine feedback you have permission to share.

You can move reviews up/down or remove them. The limit is 50 reviews, 120 characters per name and 2000 characters per impression. Original wording is displayed across languages and labelled as feedback added by the shop. The website does not claim these are verified purchases. Reviews save with the complete product.

## Images and cloud storage

Computer uploads accept JPG, PNG and WebP up to 4 MB per file. The authenticated seller endpoint checks the actual file signature, type and size, then stores the file in Supabase Storage. The bucket is public because these are product photographs; do not upload private customer material.

Upload finishes before the product can be saved. Successfully uploaded images remain in the editor if a later file fails. Press Save to associate the images with the product. Pasted HTTPS URLs remain supported, and existing migrated `/images/...` paths may be kept.

Removing an image from the product does not delete its cloud object. Uploaded files abandoned before saving may remain in Storage; review and remove unused objects manually only when you are sure they are no longer referenced.

## Publish, unpublish and archive

- **Draft:** Save, Publish, or Archive. Publish is disabled until at least one SKU is Active. Other publishing requirements are still validated by the server.
- **Published:** Save, Unpublish, or Archive. Unpublish hides the product while preserving its content and SKUs for editing.
- **Archived:** Save or Restore as draft. Redundant Archive and direct Publish actions are omitted. Archiving hides the product and archives its SKUs while retaining historical orders.
- **Restore as draft:** Restores the editable product but does not reactivate discontinued SKUs. Set the intended SKUs to Active, save, then publish when ready.
- To discontinue only one variant, set that SKU to Archived. Saved SKU codes cannot be renamed; add a new SKU and archive the old one instead.

## Public category filtering

The product listing offers **All products** or a friendly category name. Select a category and press **Show products**. Only published products are listed; draft or archived products remain hidden.

## If something fails

- **Seller tools unavailable:** confirm both new SQL migrations, existing catalog setup and seller-account access.
- **Incomplete translations:** complete all four Name, Short description and Description sections.
- **Invalid images:** check file type/size or HTTPS URL and exactly one primary image. For uploads, confirm the Storage bucket exists.
- **Invalid options/SKUs:** check unique codes, one value per group, duplicate combinations, stock, prices and gross weight.
- **Invalid presentation:** check option styles, complete reviews and the page section list.
- **Conflict:** another product may use the page address/SKU, a category name may already exist, or stock may have become reserved. Preserve your edits and review the conflict before retrying.
