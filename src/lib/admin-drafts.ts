export type ProductDraft = { onHand: number; usd: number; jpy: number; thb: number; weightKg: number };
export type ProductBaseline = ProductDraft;
export type ProductSnapshot = { sku: string } & ProductDraft;

export function productValues(row: any): ProductBaseline {
  return {
    onHand: row.on_hand,
    usd: (row.price_usd_minor ?? 0) / 100,
    jpy: row.price_jpy ?? 0,
    thb: (row.price_thb_minor ?? 0) / 100,
    weightKg: (row.weight_grams ?? 0) / 1000,
  };
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left && right && typeof left === 'object' && typeof right === 'object') return JSON.stringify(left) === JSON.stringify(right);
  return false;
}

export function reconcileProductDrafts(
  oldBaseline: Record<string, ProductBaseline>,
  newRows: any[],
  drafts: Record<string, ProductDraft>,
  submitted?: ProductSnapshot | ProductSnapshot[],
) {
  const baseline: Record<string, ProductBaseline> = {};
  const nextDrafts: Record<string, ProductDraft> = {};
  for (const row of newRows) {
    const server = productValues(row);
    const old = oldBaseline[row.sku];
    const local = drafts[row.sku] ?? server;
    const values = {} as ProductDraft;
    for (const field of ['onHand', 'usd', 'jpy', 'thb', 'weightKg'] as const) {
      const unchangedSinceLoad = !old || local[field] === undefined || equal(local[field], old[field]);
      const snapshot = Array.isArray(submitted) ? submitted.find(item => item.sku === row.sku) : submitted;
      const unchangedSinceSubmit = snapshot !== undefined && snapshot.sku === row.sku && equal(local[field], snapshot[field]);
      values[field] = unchangedSinceLoad || unchangedSinceSubmit ? server[field] : local[field];
    }
    baseline[row.sku] = server;
    nextDrafts[row.sku] = values;
  }
  return { baseline, drafts: nextDrafts };
}

export type ShippingDraft = {
  allowed_countries: string[];
  shipping_rates: Record<string, { maxGrams: number; thb: number|null }[]>;
  usd_thb: number | null;
  jpy_thb: number | null;
  pickup_enabled: boolean;
};

export function editableShippingSettings(value: any): ShippingDraft {
  return {
    allowed_countries: [...(value.allowed_countries ?? [])],
    shipping_rates: Object.fromEntries(Object.entries(value.shipping_rates ?? {}).map(([key, bands]: any) =>
      [key, bands.map((band: any) => ({ maxGrams: band.maxGrams, thb: band.thbMinor === null ? null : band.thbMinor === undefined ? band.thb : band.thbMinor / 100 }))])),
    usd_thb: value.usd_thb ?? null,
    jpy_thb: value.jpy_thb ?? null,
    pickup_enabled: value.pickup_enabled ?? true,
  };
}

export function reconcileShippingDraft(
  oldBaseline: ShippingDraft | null,
  local: ShippingDraft,
  serverValue: any,
  submitted?: ShippingDraft,
) {
  const server = editableShippingSettings(serverValue);
  const next = {} as ShippingDraft;
  function mergeField<K extends keyof ShippingDraft>(field:K) {
    const unchangedSinceLoad = oldBaseline === null || equal(local[field], oldBaseline[field]);
    const unchangedSinceSubmit = submitted !== undefined && equal(local[field], submitted[field]);
    next[field] = unchangedSinceLoad || unchangedSinceSubmit ? server[field] : local[field];
  }
  for (const field of ['allowed_countries', 'shipping_rates', 'usd_thb', 'jpy_thb', 'pickup_enabled'] as const) mergeField(field);
  return { baseline: server, draft: next };
}

export type ShippingRateRowDraft = { key: string; maxGrams: number; thb: string };

export function reconcileShippingRateDrafts(
  oldBaseline: Record<string, ShippingRateRowDraft[]> | null,
  serverRows: Record<string, ShippingRateRowDraft[]>,
  localDrafts: Record<string, ShippingRateRowDraft[]>,
  submitted?: Record<string, ShippingRateRowDraft[]>,
) {
  const baseline = Object.fromEntries(Object.entries(serverRows).map(([key, rows]) => [key, rows.map(row => ({ ...row }))]));
  const drafts: Record<string, ShippingRateRowDraft[]> = {};
  const keys = new Set([...Object.keys(oldBaseline ?? {}), ...Object.keys(serverRows), ...Object.keys(localDrafts)]);
  for (const key of keys) {
    const hasLocal = Object.hasOwn(localDrafts, key);
    const local = localDrafts[key] ?? [];
    const previous = oldBaseline?.[key] ?? [];
    const wasUnchanged = oldBaseline === null || !hasLocal || equal(local, previous);
    const matchesSubmitted = submitted !== undefined && equal(local, submitted[key] ?? []);
    const server = serverRows[key] ?? [];
    drafts[key] = (wasUnchanged || matchesSubmitted ? server : local).map(row => ({ ...row }));
  }
  return { baseline, drafts };
}

export function hasValidShippingPricePrecision(amount: number): boolean {
  const scaled = amount * 100;
  return Number.isFinite(amount) && Math.abs(scaled - Math.round(scaled)) <= 0.000001;
}
