import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminProductHandlers } from '../src/lib/server/admin-product.ts';
import { SupabaseRequestError } from '../src/lib/server/supabase.ts';
import { HttpError } from '../src/lib/server/http.ts';

const valid = { sku: 'endplug-plain', onHand: 8, usd: 19.99, jpy: 2200, thb: 730.25, weightKg: 0.125 };
const request = (body: unknown, origin = 'https://shop.test') => new Request('https://shop.test/api/admin/product', {
  method: 'PATCH', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('product save sends every field in one atomic persistence call and accepts decimal prices', async () => {
  const saves: unknown[] = [];
  const handler = createAdminProductHandlers({ authorize: async () => {}, save: async product => { saves.push(product); } });
  const response = await handler.patch(request(valid));
  assert.equal(response.status, 200);
  assert.deepEqual(saves, [{ sku: 'endplug-plain', onHand: 8, usd: 19.99, jpy: 2200, thb: 730.25, weightKg: 0.125 }]);
});

test('invalid price, stock, weight, or SKU is rejected without persisting anything', async () => {
  let saves = 0;
  const handler = createAdminProductHandlers({ authorize: async () => {}, save: async () => { saves++; } });
  for (const body of [
    { ...valid, usd: 0 }, { ...valid, usd: 1.001 }, { ...valid, jpy: 2.5 },
    { ...valid, thb: 1.001 }, { ...valid, weightKg: 30.001 }, { ...valid, weightKg: 0.0001 },
    { ...valid, sku: 'unsupported' }, { ...valid, onHand: 100001 }, { ...valid, extra: true },
  ]) assert.equal((await handler.patch(request(body))).status, 400);
  assert.equal(saves, 0);
});

test('admin and same-origin checks run before persistence', async () => {
  let saves = 0;
  const handler = createAdminProductHandlers({
    authorize: async () => { throw new HttpError(403, 'forbidden'); },
    save: async () => { saves++; },
  });
  assert.equal((await handler.patch(request(valid))).status, 403);
  const authorized = createAdminProductHandlers({ authorize: async () => {}, save: async () => { saves++; } });
  assert.equal((await authorized.patch(request(valid, 'https://evil.test'))).status, 403);
  assert.equal(saves, 0);
});

test('reserved-stock race maps database constraint failure to conflict with no second write', async () => {
  let saves = 0;
  const handler = createAdminProductHandlers({ authorize: async () => {}, save: async () => { saves++; throw new SupabaseRequestError(409, '23514'); } });
  const response = await handler.patch(request({ ...valid, onHand: 1 }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'stock_below_reserved' });
  assert.equal(saves, 1);
});
