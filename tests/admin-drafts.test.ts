import test from 'node:test';
import assert from 'node:assert/strict';
import { editableShippingSettings, productValues, reconcileProductDrafts, reconcileShippingDraft } from '../src/lib/admin-drafts.ts';

const row = (sku: string, onHand: number, usdMinor: number, grams: number) => ({
  sku, on_hand: onHand, reserved: 0, price_usd_minor: usdMinor, price_jpy: 2000,
  price_thb_minor: 7000, weight_grams: grams,
});
const settings = (allowed: string[], thbMinor = 5000) => ({
  allowed_countries: allowed,
  shipping_rates: { 'TH:ems_local': [{ maxGrams: 500, thbMinor }] },
  usd_thb: 35, jpy_thb: 0.24, pickup_enabled: true,
});

test('first load initializes product and shipping forms from server values', () => {
  const initialRows = [row('sku-a', 5, 1000, 500)];
  const products = reconcileProductDrafts({}, initialRows, {
    'sku-a': { onHand: undefined as any, usd: undefined as any, jpy: undefined as any, thb: undefined as any, weightKg: undefined as any },
  });
  assert.deepEqual(products.drafts['sku-a'], { onHand: 5, usd: 10, jpy: 2000, thb: 70, weightKg: 0.5 });
  const shipping = reconcileShippingDraft(null, {
    allowed_countries: [], shipping_rates: {}, usd_thb: null, jpy_thb: null, pickup_enabled: true,
  }, settings(['TH', 'JP']));
  assert.deepEqual(shipping.draft.allowed_countries, ['TH', 'JP']);
  assert.equal(shipping.draft.shipping_rates['TH:ems_local'][0].thb, 50);
  assert.equal(shipping.draft.usd_thb, 35);
  assert.equal(shipping.draft.jpy_thb, 0.24);
});

test('product save reconciles its unchanged submitted fields while preserving edits made during the request', () => {
  const initialRows = [row('sku-a', 5, 1000, 500), row('sku-b', 3, 2000, 750)];
  const oldBaseline = Object.fromEntries(initialRows.map(item => [item.sku, productValues(item)]));
  const submitted = { sku: 'sku-a', onHand: 7, usd: 12, jpy: 2100, thb: 71, weightKg: 0.6 };
  const localDrafts = {
    'sku-a': { onHand: 9, usd: 12, jpy: 2100, thb: 71, weightKg: 0.6 },
    'sku-b': { onHand: 3, usd: 25, jpy: 2000, thb: 70, weightKg: 0.9 },
  };
  const refreshedRows = [row('sku-a', 7, 1200, 600), row('sku-b', 3, 2000, 750)];
  const result = reconcileProductDrafts(oldBaseline, refreshedRows, localDrafts, submitted);
  assert.equal(result.drafts['sku-a'].onHand, 9, 'edits made while the save is in flight survive');
  assert.equal(result.drafts['sku-a'].usd, 12, 'submitted, unchanged fields now reflect the saved server value');
  assert.equal(result.drafts['sku-b'].usd, 25, 'another product draft survives');
  assert.equal(result.drafts['sku-b'].weightKg, 0.9);

  const laterRows = [row('sku-a', 7, 1300, 600), row('sku-b', 4, 2000, 750)];
  const reloaded = reconcileProductDrafts(result.baseline, laterRows, result.drafts);
  assert.equal(reloaded.drafts['sku-a'].onHand, 9, 'manual reload keeps the dirty stock draft');
  assert.equal(reloaded.drafts['sku-a'].usd, 13, 'clean fields adopt newer server values');
  assert.equal(reloaded.drafts['sku-b'].onHand, 4, 'clean stock fields refresh independently');
  assert.equal(reloaded.drafts['sku-b'].usd, 25, 'dirty fields remain after reload');
});

test('saving a product leaves dirty shipping settings intact and refreshes clean settings', () => {
  const old = editableShippingSettings(settings(['TH', 'JP']));
  const local = { ...old, allowed_countries: ['TH'], shipping_rates: { ...old.shipping_rates, 'TH:ems_local': [{ maxGrams: 500, thb: 55 }] } };
  const productSaveRefresh = settings(['TH', 'JP'], 5100);
  const merge = reconcileShippingDraft(old, local, productSaveRefresh);
  assert.deepEqual(merge.draft.allowed_countries, ['TH'], 'country draft is retained');
  assert.equal(merge.draft.shipping_rates['TH:ems_local'][0].thb, 55, 'rate draft is retained');
  assert.equal(merge.draft.usd_thb, 35, 'clean exchange rate takes the refreshed value');
  const manualReload = reconcileShippingDraft(merge.baseline, merge.draft, settings(['TH', 'JP'], 5200));
  assert.deepEqual(manualReload.draft.allowed_countries, ['TH']);
  assert.equal(manualReload.draft.shipping_rates['TH:ems_local'][0].thb, 55);
  assert.equal(manualReload.draft.usd_thb, 35);

  const savedSnapshot = { ...local, allowed_countries: ['TH'] };
  const afterInflightEdit = { ...savedSnapshot, pickup_enabled: false };
  const savedRefresh = reconcileShippingDraft(old, afterInflightEdit, settings(['TH'], 5500), savedSnapshot);
  assert.deepEqual(savedRefresh.draft.allowed_countries, ['TH']);
  assert.equal(savedRefresh.draft.shipping_rates['TH:ems_local'][0].thb, 55);
  assert.equal(savedRefresh.draft.pickup_enabled, false, 'an edit made after submit survives the save refresh');
});
