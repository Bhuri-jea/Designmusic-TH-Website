import { HttpError, errorResponse, jsonResponse, readSameOriginJson } from './http.ts';
import { requireAdmin } from './admin.ts';
import { rpc, SupabaseRequestError } from './supabase.ts';

const supportedSku = /^(endplug-(plain|twoColor|custom)|shakuhachi-(standard|large)-(balance|traditional|modern))$/;
type Product = { sku: string; onHand: number; usd: number; jpy: number; thb: number; weightKg: number };
type Dependencies = {
  authorize: (request: Request) => Promise<void>;
  save: (product: Product) => Promise<unknown>;
};

const defaults: Dependencies = {
  authorize: async request => {
    await requireAdmin(request);
  },
  save: product => rpc('admin_set_product', {
    p_sku: product.sku,
    p_on_hand: product.onHand,
    p_usd_minor: Math.round(product.usd * 100),
    p_jpy: product.jpy,
    p_thb_minor: Math.round(product.thb * 100),
    p_weight_grams: Math.round(product.weightKg * 1000),
  }),
};

function scaledInteger(value: unknown, scale: number, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const scaled = value * scale;
  const rounded = Math.round(scaled);
  // JSON decimals such as 19.99 are not represented exactly as binary floats.
  if (Math.abs(scaled - rounded) > 1e-8 || rounded < min || rounded > max) return null;
  return rounded;
}

export function createAdminProductHandlers(deps: Dependencies = defaults) {
  return {
    patch: async (request: Request): Promise<Response> => {
      try {
        await deps.authorize(request);
        const body = await readSameOriginJson(request);
        if (Object.keys(body).sort().join(',') !== 'jpy,onHand,sku,thb,usd,weightKg' ||
            typeof body.sku !== 'string' || !supportedSku.test(body.sku) ||
            !Number.isInteger(body.onHand) || (body.onHand as number) < 0 || (body.onHand as number) > 100000) {
          throw new HttpError(400, 'invalid_product');
        }
        const usdMinor = scaledInteger(body.usd, 100, 1, 1_000_000_000);
        const jpy = scaledInteger(body.jpy, 1, 1, 1_000_000_000);
        const thbMinor = scaledInteger(body.thb, 100, 1, 1_000_000_000);
        const grams = scaledInteger(body.weightKg, 1000, 0, 30000);
        if (usdMinor === null || jpy === null || thbMinor === null || grams === null) throw new HttpError(400, 'invalid_product');
        await deps.save({ sku: body.sku, onHand: body.onHand as number, usd: usdMinor / 100, jpy, thb: thbMinor / 100, weightKg: grams / 1000 });
        return jsonResponse({ ok: true });
      } catch (error) {
        if (error instanceof SupabaseRequestError && error.databaseCode === '23514') return jsonResponse({ error: 'stock_below_reserved' }, 409);
        return errorResponse(error);
      }
    },
  };
}
