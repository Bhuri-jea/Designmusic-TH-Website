import type {APIRoute} from 'astro';
import {checkoutShippingQuote} from '../../../lib/server/shipping-quotes.ts';
import {jsonResponse,errorResponse,readSameOriginJson} from '../../../lib/server/http.ts';
export const prerender=false;
export const POST:APIRoute=async({request})=>{try{return jsonResponse(await checkoutShippingQuote(request,await readSameOriginJson(request)));}catch(error){return errorResponse(error);}};
