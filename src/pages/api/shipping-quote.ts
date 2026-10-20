import type { APIRoute } from 'astro';
import { quoteShipping } from '../../lib/server/shipping.ts';
import { errorResponse, readSameOriginJson } from '../../lib/server/http.ts';
import {requireCustomer} from '../../lib/server/customer.ts';
export const prerender = false;
export const POST: APIRoute = async ({request}) => { try {
 const body=await readSameOriginJson(request);
 const method=body.method==='pickup'?'pickup':body.country==='TH'?'ems_local':'epacket';
 const address=body.country!=='TH'?(await requireCustomer(request)).shippingAddress:undefined;
 return Response.json(await quoteShipping(body.items,body.locale,body.country,method,undefined,address),{headers:{'Cache-Control':'no-store'}});
} catch(error) { return errorResponse(error); } };
