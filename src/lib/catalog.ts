export type Currency = 'usd' | 'jpy' | 'thb';
export type Locale = 'en' | 'ja' | 'zh-CN' | 'th';
export type CartInput = { productId: string; variant?: string; options?: Record<string, string>; quantity: number };
export type CatalogLine = { sku: string; productId: string; variant: string; options: Record<string, string>; quantity: number; name: string; unitAmount: number };
export type CartQuote = { currency: Currency; lines: CatalogLine[]; totalAmount: number; fingerprint: string };
export type CatalogPrices = Record<string, Partial<Record<Currency, number>>>;

const currencyByLocale: Record<Locale, Currency> = { en: 'usd', 'zh-CN': 'usd', ja: 'jpy', th: 'thb' };
const plugs = {
  plain: { usd: 1500, jpy: 2500, thb: 20000 },
  twoColor: { usd: 1800, jpy: 2800, thb: 25000 },
  custom: { usd: 2200, jpy: 3200, thb: 35000 },
} satisfies Record<string, Record<Currency, number>>;
const shakuhachiPrice = { usd: 23000, jpy: 35000, thb: 690000 } satisfies Record<Currency, number>;
const encoder = new TextEncoder();

function isObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function quoteCartDetails({ items, locale, prices }: { items: unknown; locale: unknown; prices?: CatalogPrices }): Omit<CartQuote, 'fingerprint'> {
  if (typeof locale !== 'string' || !Object.hasOwn(currencyByLocale, locale)) throw new Error('Unsupported locale');
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) throw new Error('Cart must contain 1 to 20 rows');
  const currency = currencyByLocale[locale as Locale];
  const combined = new Map<string, CatalogLine>();
  for (const item of items) {
    if (!isObject(item) || Object.keys(item).some(k => !['productId', 'variant', 'options', 'quantity'].includes(k))) throw new Error('Invalid cart item');
    const { productId, variant, options, quantity } = item;
    if (typeof productId !== 'string' || !Number.isSafeInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 10) throw new Error('Invalid product or quantity');
    let sku: string, name: string, unitAmount: number, normalizedOptions: Record<string, string> = {}, normalizedVariant: string;
    if (productId === 'saxophone-end-plug') {
      if (typeof variant !== 'string' || !Object.hasOwn(plugs, variant) || options !== undefined && (!isObject(options) || Object.keys(options).length !== 0)) throw new Error('Invalid end plug selection');
      normalizedVariant = variant; sku = `endplug-${variant}`; name = `Saxophone End Plug (${variant})`; unitAmount = prices?.[sku]?.[currency] ?? plugs[variant as keyof typeof plugs][currency];
    } else if (productId === 'shakuhachi') {
      if (variant !== undefined && variant !== 'standard') throw new Error('Invalid shakuhachi variant');
      if (!isObject(options) || Object.keys(options).sort().join(',') !== 'mouthpiece,toneHoles') throw new Error('Invalid shakuhachi options');
      const { toneHoles, mouthpiece } = options;
      if (typeof toneHoles !== 'string' || typeof mouthpiece !== 'string' || !['standard', 'large'].includes(toneHoles) || !['balance', 'traditional', 'modern'].includes(mouthpiece)) throw new Error('Invalid shakuhachi options');
      normalizedVariant = 'standard'; normalizedOptions = { toneHoles, mouthpiece };
      sku = `shakuhachi-${normalizedOptions.toneHoles}-${normalizedOptions.mouthpiece}`; name = `Shakuhachi S-1/D (${normalizedOptions.toneHoles}, ${normalizedOptions.mouthpiece})`; unitAmount = prices?.[sku]?.[currency] ?? shakuhachiPrice[currency];
    } else throw new Error('Product is not saleable');
    const prev = combined.get(sku);
    const aggregate = (prev?.quantity ?? 0) + (quantity as number);
    if (aggregate > 10) throw new Error('Aggregate quantity exceeds 10');
    combined.set(sku, { sku, productId, variant: normalizedVariant, options: normalizedOptions, quantity: aggregate, name, unitAmount });
  }
  const lines = [...combined.values()].sort((a, b) => a.sku.localeCompare(b.sku));
  const totalAmount = lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0);
  if (!Number.isSafeInteger(totalAmount)) throw new Error('Cart total exceeds safe integer range');
  return { currency, lines, totalAmount };
}

export async function quoteCart(input: {items:unknown;locale:unknown;prices?:CatalogPrices}):Promise<CartQuote> {
  const {currency,lines,totalAmount}=quoteCartDetails(input);
  const canonical = stable({ currency, lines });
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(canonical));
  const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return { currency, lines, totalAmount, fingerprint };
}

export function priceFor(productId: string, variant: string | undefined, locale: Locale, prices?: CatalogPrices, options?: Record<string, string>): number | undefined {
  if (!Object.hasOwn(currencyByLocale, locale)) return undefined;
  if (productId === 'saxophone-end-plug' && variant && Object.hasOwn(plugs, variant)) return prices?.[`endplug-${variant}`]?.[currencyByLocale[locale]] ?? plugs[variant as keyof typeof plugs][currencyByLocale[locale]];
  if (productId === 'shakuhachi') {
    const sku = options?.toneHoles && options?.mouthpiece ? `shakuhachi-${options.toneHoles}-${options.mouthpiece}` : undefined;
    return (sku ? prices?.[sku]?.[currencyByLocale[locale]] : undefined) ?? shakuhachiPrice[currencyByLocale[locale]];
  }
  return undefined;
}

export function formatPrice(amount: number, locale: Locale): string {
  const currency = currencyByLocale[locale];
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: currency === 'jpy' ? 0 : 2 }).format(amount / (currency === 'jpy' ? 1 : 100));
}
