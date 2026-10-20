import type { APIRoute } from 'astro';
import { select } from '../../lib/server/supabase.ts';
export const prerender = false;
export const GET: APIRoute = async () => {
  try {
    const rows = await select<any>('inventory', { select: 'sku,price_usd_minor,price_jpy,price_thb_minor' });
    const prices = Object.fromEntries(rows.map(row => [row.sku, { usd: row.price_usd_minor, jpy: row.price_jpy, thb: row.price_thb_minor }]));
    return Response.json({ prices }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
  } catch {
    return Response.json({ prices: {} }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  }
};
