import type { CatalogPrices, Locale } from '../lib/catalog.ts';
import { priceFor } from '../lib/catalog.ts';

export const catalogPricing = $state<{ prices: CatalogPrices }>({ prices: {} });
let loading: Promise<void> | undefined;

export function loadCatalogPricing() {
  if (loading) return loading;
  loading = fetch('/api/catalog', { cache: 'no-store' })
    .then(async response => response.ok ? response.json() : null)
    .then(data => { if (data?.prices && typeof data.prices === 'object') catalogPricing.prices = data.prices; })
    .catch(() => {})
    .finally(() => { loading = undefined; });
  return loading;
}

export function displayPriceFor(productId: string, variant: string | undefined, locale: Locale, options?: Record<string, string>) {
  return priceFor(productId, variant, locale, catalogPricing.prices, options);
}
