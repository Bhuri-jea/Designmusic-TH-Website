import { HttpError } from './http.ts';

export type ExchangeRates = { usdThb: number; jpyThb: number; date: string; source: 'Frankfurter' };
type Dependencies = { fetch: typeof fetch; now: () => number };
const MAX_RATE_AGE = 10 * 86400000;

// A single request supplies both pairs; cross-conversion uses the same observation.
export function createExchangeRateLoader(deps: Dependencies = { fetch: globalThis.fetch, now: Date.now }) {
  let cached: ExchangeRates | null = null, expiresAt = 0;
  let pending: Promise<ExchangeRates> | null = null;
  return async function load(): Promise<ExchangeRates> {
    if (cached && deps.now() < expiresAt) return { ...cached };
    if (pending) return { ...await pending };
    pending = (async () => {
      try {
        const response = await deps.fetch('https://api.frankfurter.app/latest?from=USD&to=THB,JPY', { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!data || typeof data !== 'object' || !data.rates || typeof data.rates !== 'object') throw Error();
        const thbRate = data.rates.THB, jpyRate = data.rates.JPY, rateDate = data.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rateDate)
          || !Number.isFinite(thbRate) || thbRate <= 0 || !Number.isFinite(jpyRate) || jpyRate <= 0) throw Error();
        const dateTime = Date.parse(rateDate + 'T00:00:00Z');
        if (!Number.isFinite(dateTime) || dateTime > deps.now() + 86400000 || deps.now() - dateTime > MAX_RATE_AGE) throw Error();
        cached = { usdThb: thbRate, jpyThb: thbRate / jpyRate, date: rateDate, source: 'Frankfurter' };
        expiresAt = deps.now() + 3600000;
        return cached;
      } catch { throw new HttpError(503, 'shipping_fx_unavailable'); }
    })();
    try { return { ...await pending }; } finally { pending = null; }
  };
}
export const loadExchangeRates = createExchangeRateLoader();

export async function shipmentReferenceRates(rows:any[],load=loadExchangeRates){
  if(!rows.some(row=>row.currency!=='thb'&&!(Number(row.reference_thb_rate)>0)))return rows;
  let fx:ExchangeRates;try{fx=await load();}catch{return rows;}
  return rows.map(row=>row.currency!=='thb'&&!(Number(row.reference_thb_rate)>0)?{...row,
    reference_thb_rate:row.currency==='usd'?fx.usdThb:row.currency==='jpy'?fx.jpyThb:null,
    reference_fx_date:fx.date,reference_fx_current:true}:row);
}

export function convertPostage(thbMinor: number, currency: string, rates?: ExchangeRates) {
  if (!Number.isSafeInteger(thbMinor) || thbMinor < 0) throw new HttpError(400, 'invalid_shipping_amount');
  if (currency === 'thb') return thbMinor;
  if (!rates) throw new HttpError(503, 'shipping_fx_unavailable');
  const perUnit = currency === 'usd' ? rates.usdThb : currency === 'jpy' ? rates.jpyThb : 0;
  if (!Number.isFinite(perUnit) || perUnit <= 0) throw new HttpError(503, 'shipping_fx_unavailable');
  return Math.ceil(thbMinor / (currency === 'jpy' ? 100 : 1) * 1.05 / perUnit);
}
