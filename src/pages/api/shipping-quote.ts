import type { APIRoute } from 'astro';
import { quoteShipping } from '../../lib/server/shipping.ts';
import { errorResponse, readSameOriginJson } from '../../lib/server/http.ts';
export const prerender = false;
export const POST: APIRoute = async ({request}) => { try { const body=await readSameOriginJson(request);return Response.json(await quoteShipping(body.items,body.locale,body.country,body.method),{headers:{'Cache-Control':'no-store'}}); } catch(error) { return errorResponse(error); } };
