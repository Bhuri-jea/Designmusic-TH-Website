# Copilot instructions for Design Music Website

## Project overview

This repository is an Astro 6 storefront for Design Music, with interactive UI in Svelte 5 and Tailwind CSS 4. The app is mostly route-driven: Astro handles page composition and server-side concerns, while Svelte components are used for browser-only UI. Most product and localization logic is centralized instead of being spread across one-off files.

Key repo conventions:
- `src/pages/` contains route files and locale-aware product pages.
- `src/layouts/Layout.astro` and `src/layouts/ProductLayout.astro` are the main shared layout shells.
- `src/lib/products.ts` is the product registry; add or change products here when updating nav, cards, metadata, prices, or category pages.
- `src/i18n/ui.ts` and `src/utils/navigation.ts` are the main localization entry points; English is the default route and non-English locales are prefixed in the URL.
- `src/styles/global.css` contains the shared Tailwind utility patterns used across the site (`btn`, `card`, `badge`, `alert`).
- Checkout and auth live in `src/pages/api/checkout.ts` and `auth.config.ts`; secrets must stay in local environment config, not in source control.

## Build, test, and validation commands

Use Node 22.x for this project.

- Install dependencies: `npm install`
- Start the dev server: `npm run dev`
- Build for production: `npm run build`
- Preview a production build: `npm run preview`
- Run Astro diagnostics: `npm run astro -- check`
- Run the project test entrypoint: `npm test`
- Run a single test file: `node --experimental-strip-types --experimental-test-isolation=none --test tests/<file>.test.ts`

There is no dedicated lint script in `package.json` right now. For validation, prefer `npm run astro -- check` and the project test command, and only add linting if the repo explicitly introduces it.

## High-level architecture

- Astro owns the app shell, routes, and server-side data loading. Use Astro pages and layouts for route composition and SEO-facing content.
- Svelte 5 owns interactive components that need browser runtime behavior. Follow the repo's existing pattern of using `client:load` for client-side widgets and stateful UI.
- Product content is not modeled through Astro Content Collections. Instead, the site reads product markdown from `src/content/products/` and uses a lightweight custom parser for product detail pages.
- Static product metadata and commerce details are kept in `src/lib/products.ts`; this file feeds the product index, category cards, navbar, and page metadata.
- Localized routes are intentionally split between the default English routes and locale-specific folders (`/ja`, `/th`, `/zh-CN`). When adding new product routes or localized variants, keep both the English and prefixed localized behavior consistent.
- The cart is a module-level singleton at `src/store/cart.svelte.ts` and is reused by purchase flows and checkout UI.
- Auth uses `auth-astro` with Google OAuth, and checkout relies on Stripe. Treat all cart and checkout input as untrusted and preserve existing validation assumptions rather than reworking the integration with a new trust model.

## Conventions and repo-specific patterns

- Keep Astro and Svelte boundaries clear. Do not move browser-only logic into Astro pages when a component already exists for that behavior.
- When adding or changing a product, update the product entry in `src/lib/products.ts`, the corresponding slug/path, and any relevant localized strings in `src/i18n/ui.ts`.
- Product detail routes are statically enumerated for the dynamic product page; if a product slug is added, ensure the slug list and duplicate locale route checks are kept in sync.
- Use the locale-aware links helpers in `src/utils/navigation.ts` instead of hard-coded `/ja/...` or `/th/...` path construction.
- Add UI strings in `src/i18n/ui.ts` for every supported locale when translations are available. English remains the fallback for missing keys.
- Keep static assets in `public/images/` and reference them with root-relative paths.
- Preserve the existing default-language behavior: English is the unprefixed default route; other locales add a prefix.
- Do not commit secrets or credentials. Use `.env.example` as the reference for required environment variables and keep local env values out of the repo.
- For checkout or auth changes, validate the default English route and at least one localized route, since the site uses locale-aware paths and product metadata across multiple pages.

## Working style for this repo

- Prefer focused edits that preserve the current Astro/Svelte structure.
- When making shared route, translation, product, or checkout changes, validate both the default English route and a prefixed locale route.
- Do not add broad refactors or unrelated cleanup while fixing a feature or bug in this codebase.
- Follow the established patterns in the repo rather than introducing a new app structure, because this is a small, opinionated storefront with deliberate conventions around localization and product data.
