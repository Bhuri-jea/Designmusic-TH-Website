import type { CatalogPrices, Locale,TrustedCatalogSku } from '../lib/catalog.ts';
import { priceFor } from '../lib/catalog.ts';

export const catalogPricing = $state<{ prices: CatalogPrices;skus:TrustedCatalogSku[] }>({ prices: {},skus:[] });
let loading: Promise<void> | undefined;

export function loadCatalogPricing(locale:Locale='en') {
  if (loading) return loading;
  loading = fetch(`/api/catalog?locale=${encodeURIComponent(locale)}`, { cache: 'no-store' })
    .then(async response => response.ok ? response.json() : null)
    .then(data => { if (data?.prices && typeof data.prices === 'object') catalogPricing.prices = data.prices;if(Array.isArray(data?.products))catalogPricing.skus=data.products.flatMap((product:any)=>product.skus.map((sku:any)=>({sku:sku.sku,productSlug:product.slug,optionCodes:sku.optionCodes??[],name:product.name,salesMode:sku.salesMode,productLifecycle:'published',skuLifecycle:'active',prices:sku.prices}))); })
    .catch(() => {})
    .finally(() => { loading = undefined; });
  return loading;
}

export function displayPriceFor(productId: string, variant: string | undefined, locale: Locale, options?: Record<string, string>) {
  const row=catalogPricing.skus.find(sku=>sku.productSlug===productId&&(sku.sku===variant||options&&sku.optionCodes.every(code=>Object.values(options).includes(code))));if(row){const currency=locale==='ja'?'jpy':locale==='th'?'thb':'usd';return row.prices[currency];}
  return priceFor(productId, variant, locale, catalogPricing.prices, options);
}
export function displayNameFor(productId:string,variant?:string){return catalogPricing.skus.find(sku=>sku.productSlug===productId&&(!variant||sku.sku===variant))?.name;}
