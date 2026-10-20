import type { APIRoute } from 'astro';
import { loadExchangeRates } from '../../lib/server/exchange-rates.ts';
import { errorResponse } from '../../lib/server/http.ts';
export const prerender = false;
export const GET: APIRoute = async () => {
  try { return Response.json(await loadExchangeRates(), { headers: { 'Cache-Control': 'public, max-age=300' } }); }
  catch (error) { return errorResponse(error); }
};
