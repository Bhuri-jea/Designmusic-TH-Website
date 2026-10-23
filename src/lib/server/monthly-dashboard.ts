import { requireAdmin } from './admin.ts';
import { rpc } from './supabase.ts';
import { HttpError, errorResponse, jsonResponse } from './http.ts';
import { loadExchangeRates, type ExchangeRates } from './exchange-rates.ts';
import type { MonthlySummary, BahtSummary, BahtTotals } from '../monthly-report.ts';

type Dependencies = {
  authorize: (request: Request) => Promise<unknown>;
  summary: (month: string) => Promise<unknown>;
  now: () => Date;
  exchangeRates?: () => Promise<ExchangeRates>;
};

const amountFields = {
  merchandiseGrossMinor: 'merchandiseGrossTHB', merchandiseNetMinor: 'merchandiseNetTHB',
  shippingCollectedMinor: 'shippingCollectedTHB', shippingRefundedMinor: 'shippingRefundedTHB', refundMinor: 'refundTHB',
} as const;

async function bahtSummary(value: unknown, now: Date, load: () => Promise<ExchangeRates>): Promise<BahtSummary> {
  if (!Array.isArray(value) || value.some(row => !row || !['usd','jpy','thb'].includes(row.currency)
    || Object.keys(amountFields).some(field => !Number.isSafeInteger(row[field])))) throw new HttpError(503, 'invalid_monthly_summary');
  const rows = value as MonthlySummary[];
  // Zero-valued foreign rows need no rate; baht remains an identity conversion during an FX outage.
  const needsRates = rows.some(row => row.currency !== 'thb' && Object.keys(amountFields).some(field => row[field as keyof typeof amountFields] !== 0));
  let rates: ExchangeRates | null = null;
  if (needsRates) {
    try {
      rates = await load();
      const at = Date.parse(rates.date + 'T00:00:00Z');
      if (![rates.usdThb, rates.jpyThb].every(rate => Number.isFinite(rate) && rate > 0)
        || !/^\d{4}-\d{2}-\d{2}$/.test(rates.date) || !Number.isFinite(at)
        || rates.date > new Date(now.getTime()+7*3600000).toISOString().slice(0,10)) throw Error();
      // Weekend/holiday observations are dated explicitly; older observations cannot be called current.
      if (now.getTime() - at > 4 * 86400000) return { status: 'stale', rates, totals: null };
    } catch { return { status: 'unavailable', rates: null, totals: null }; }
  }
  const totals: BahtTotals = { merchandiseGrossTHB: 0, merchandiseNetTHB: 0, shippingCollectedTHB: 0, shippingRefundedTHB: 0, refundTHB: 0 };
  for (const row of rows) {
    const factor = row.currency === 'thb' ? 1 / 100 : row.currency === 'jpy' ? (rates?.jpyThb ?? 0) : (rates?.usdThb ?? 0) / 100;
    for (const [minor, baht] of Object.entries(amountFields)) totals[baht] += row[minor as keyof typeof amountFields] * factor;
  }
  // Round once after aggregation. Never use the buffered shipping-price conversion for reports.
  for (const field of Object.values(amountFields)) {
    if (!Number.isSafeInteger(Math.round(totals[field] * 100))) throw new HttpError(503, 'invalid_monthly_summary');
    totals[field] = Math.round(totals[field] * 100) / 100;
  }
  return { status: 'available', rates, totals };
}
export function bangkokMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
}
const defaults: Dependencies = {
  authorize: requireAdmin,
  summary: month => rpc('admin_monthly_dashboard', { p_month: `${month}-01` }),
  now: () => new Date(),
};
export function createMonthlyDashboardHandler(deps: Dependencies = defaults) {
  return async (request: Request): Promise<Response> => {
    try {
      await deps.authorize(request);
      const month = new URL(request.url).searchParams.get('month') ?? bangkokMonth(deps.now());
      if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, 'invalid_month');
      const summary = await deps.summary(month);
      return jsonResponse({ month, timeZone: 'Asia/Bangkok', summary, bahtSummary: await bahtSummary(summary, deps.now(), deps.exchangeRates ?? loadExchangeRates) });
    } catch (error) { return errorResponse(error); }
  };
}
