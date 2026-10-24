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
  const data = await response.json();
  assert.equal(data.month, '2026-11'); assert.equal(data.timeZone, 'Asia/Bangkok'); assert.deepEqual(data.summary, []);
  assert.deepEqual(months, ['2026-11']);
});

const reportRow = (currency: string, net: number, shipping = 0, refund = 0, shippingRefund = 0) => ({ currency, paidOrders: 1, refundedOrders: refund ? 1 : 0, merchandiseGrossMinor: net + refund - shippingRefund, merchandiseNetMinor: net, shippingCollectedMinor: shipping, shippingRefundedMinor: shippingRefund, refundMinor: refund, estimatedPaidDates: 0, unknownPaidDates: 0, unallocatedRefunds: 0 });
const reportNow = new Date('2026-10-21T09:00:00Z');
const rates = { usdThb: 35, jpyThb: .25, date: '2026-10-20', source: 'Frankfurter' as const };
test('rate date for today in Thailand is accepted before UTC midnight but tomorrow is rejected',async()=>{
 const instant=new Date('2026-10-23T18:30:00Z');
 for(const [date,expected] of [['2026-10-24','available'],['2026-10-25','unavailable']]){
  const handler=createMonthlyDashboardHandler({authorize:async()=>{},now:()=>instant,summary:async()=>[reportRow('usd',1000)],exchangeRates:async()=>({...rates,date})});
  const data=await (await handler(new Request('https://shop.test/api/admin/monthly-dashboard'))).json();
  assert.equal(data.bahtSummary.status,expected);if(expected==='available')assert.equal(data.bahtSummary.totals.merchandiseNetTHB,350);
 }
});
async function convertedReport(rows: ReturnType<typeof reportRow>[], exchangeRates: () => Promise<typeof rates>) {
 const response = await createMonthlyDashboardHandler({ authorize: async () => {}, now: () => reportNow, summary: async () => rows, exchangeRates })(new Request('https://shop.test/api/admin/monthly-dashboard'));
 assert.equal(response.status, 200);
 return response.json();
}
test('current baht report combines cents and whole yen without shipping markup or changing paid totals', async () => {
 const rows = [reportRow('usd', 1000, 200, 300, 100), reportRow('jpy', 1000, 100, 200, 50), reportRow('thb', 10000, 1000, 500, 100)];
 const data = await convertedReport(rows, async () => rates);
 assert.deepEqual(data.summary, rows);
 assert.equal(data.bahtSummary.status, 'available');
 assert.deepEqual(data.bahtSummary.totals, { merchandiseGrossTHB: 811.5, merchandiseNetTHB: 700, shippingCollectedTHB: 105, shippingRefundedTHB: 48.5, refundTHB: 160 });
 assert.equal(data.bahtSummary.rates.date, '2026-10-20');
});
test('refund-only months retain negative merchandise net and allocation warnings', async () => {
 const rows = [{ ...reportRow('usd', -1000, 0, 1200, 200), paidOrders: 0, unallocatedRefunds: 1 }];
 const data = await convertedReport(rows, async () => rates);
 assert.equal(data.bahtSummary.totals.merchandiseNetTHB, -350);
 assert.equal(data.summary[0].unallocatedRefunds, 1);
});
test('unavailable or stale rates leave original totals and never fabricate combined zero amounts', async () => {
 const rows = [reportRow('usd', 1000)];
 const unavailable = await convertedReport(rows, async () => { throw Error('offline'); });
 assert.equal(unavailable.bahtSummary.status, 'unavailable'); assert.equal(unavailable.bahtSummary.totals, null); assert.deepEqual(unavailable.summary, rows);
 const stale = await convertedReport(rows, async () => ({ ...rates, date: '2026-10-15' }));
 assert.equal(stale.bahtSummary.status, 'stale'); assert.equal(stale.bahtSummary.totals, null);
 for (const invalid of [{ ...rates, usdThb: NaN }, { ...rates, date: '2026-10-25' }]) {
  assert.equal((await convertedReport(rows, async () => invalid)).bahtSummary.status, 'unavailable');
 }
});
test('baht-only totals use identity conversion even when the rate service is offline', async () => {
 const data = await convertedReport([reportRow('thb', 12345)], async () => { throw Error('offline'); });
 assert.equal(data.bahtSummary.status, 'available'); assert.equal(data.bahtSummary.totals.merchandiseNetTHB, 123.45); assert.equal(data.bahtSummary.rates, null);
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
