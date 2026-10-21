import test from 'node:test';
import assert from 'node:assert/strict';
import { bangkokMonth, createMonthlyDashboardHandler } from '../src/lib/server/monthly-dashboard.ts';
import { HttpError } from '../src/lib/server/http.ts';

test('monthly report defaults to Thailand month across UTC month boundary', async () => {
  const instant = new Date('2026-10-31T17:00:00Z');
  assert.equal(bangkokMonth(instant), '2026-11');
  const months: string[] = [];
  const handler = createMonthlyDashboardHandler({ authorize: async () => {}, now: () => instant, summary: async month => { months.push(month); return []; } });
  const response = await handler(new Request('https://shop.test/api/admin/monthly-dashboard'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { month: '2026-11', timeZone: 'Asia/Bangkok', summary: [] });
  assert.deepEqual(months, ['2026-11']);
});

test('monthly report enforces admin before aggregating and rejects malformed months', async () => {
  let calls = 0;
  const summary = async () => { calls++; return []; };
  const forbidden = createMonthlyDashboardHandler({ authorize: async () => { throw new HttpError(403, 'forbidden'); }, now: () => new Date(), summary });
  assert.equal((await forbidden(new Request('https://shop.test/api/admin/monthly-dashboard?month=2026-10'))).status,403);
  const handler = createMonthlyDashboardHandler({ authorize: async () => {}, now: () => new Date(), summary });
  for (const month of ['2026-13','2026-00','2026-1','2026-10-01','2026-10%27','']) {
    assert.equal((await handler(new Request('https://shop.test/api/admin/monthly-dashboard?month='+month))).status,400);
  }
  assert.equal(calls,0);
  const success = await handler(new Request('https://shop.test/api/admin/monthly-dashboard?month=2026-09'));
  assert.equal(success.status,200);
  assert.equal(calls,1);
  assert.equal(success.headers.get('cache-control'),'private, no-store');
});
