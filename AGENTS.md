# Design Music Website

## Project Commands

- Requires Node `22.x`; install dependencies with `npm install`.
- Run the site with `npm run dev` and build it with `npm run build`.
- Preview a production build with `npm run preview`.
- Run Astro diagnostics with `npm run astro -- check`.
- No automated test or lint script is currently configured.

## Architecture

- Astro owns routes, server-side data loading, layouts, and page composition.
- Svelte 5 owns hydrated interactive components. Follow the existing `client:load` usage for browser-dependent widgets.
- [Layout.astro](src/layouts/Layout.astro) is the shared shell; [ProductLayout.astro](src/layouts/ProductLayout.astro) is the product detail shell.
- [cart.svelte.ts](src/store/cart.svelte.ts) exports the module-level cart singleton used by interactive purchase UI.
- Tailwind CSS 4 is loaded from [global.css](src/styles/global.css). Reuse existing utility classes such as `btn`, `card`, `badge`, and `alert`.
- Use Lucide Svelte icons from `lucide-svelte` where an icon is needed; follow [Navbar.svelte](src/components/Navbar.svelte) for the local pattern.

## Routing And Localization

- Supported locales are `en`, `ja`, `zh-CN`, and `th`. English is the unprefixed default; other locales use a URL prefix.
- Use [navigation.ts](src/utils/navigation.ts) for locale-aware links and [i18n/utils.ts](src/i18n/utils.ts) for translation lookup and fallback behavior.
- Localized home, about, and product-index routes live under `src/pages/[lang]/`; explicit locale pages also exist under `src/pages/ja/`, `src/pages/th/`, and `src/pages/zh-CN/`.
- Product detail paths are statically enumerated in `src/pages/[lang]/product/[slug].astro`. Update its slug list when adding a product, and check for duplicate explicit locale routes.
- Add UI strings to [ui.ts](src/i18n/ui.ts) for every supported locale when translations are available. English is the fallback for missing keys.

## Products And Content

- [products.ts](src/lib/products.ts) is the product registry for navigation, cards, galleries, metadata, categories, and prices.
- Product Markdown is read directly from `src/content/products/`, not through Astro Content Collections.
- The dynamic product page looks for `<slug>/<lang>/<slug>.md`, then `<slug>/<slug>.<lang>.md`, then the base `<slug>/<slug>.md`.
- Keep product front matter compatible with the simple parser in [slug].astro; do not assume full YAML or Markdown support there.
- Put static assets in `public/images/` and reference them with root-relative paths.

## Checkout And Auth

- Checkout is implemented in [checkout.ts](src/pages/api/checkout.ts) and requires `STRIPE_SECRET_KEY` for real Stripe requests.
- Treat cart-provided names, prices, quantities, options, and image URLs as untrusted input. The current endpoint trusts client prices and hard-codes Stripe currency to THB; preserve or document this limitation rather than treating it as production-safe.
- Auth uses `auth-astro`; server pages read sessions with `getSession(Astro.request)`. Google OAuth requires the credentials described in [auth.config.ts](auth.config.ts).

## Change And Validation Rules

- Keep edits focused and preserve the existing Astro/Svelte boundaries.
- When changing shared routes, translations, product metadata, or checkout, verify both the default English route and at least one prefixed locale.
- Run `npm run astro -- check` for type and Astro diagnostics, then `npm run build` for production-facing changes.
- Do not add secrets to source control; use `.env.example` as the reference for required environment variables.