import type {APIRoute} from 'astro';
import {customerShippingQuotes,requestShippingQuote} from '../../../lib/server/shipping-quotes.ts';
import {jsonResponse,errorResponse,readSameOriginJson} from '../../../lib/server/http.ts';
export const prerender=false;
export const GET:APIRoute=async({request})=>{try{return jsonResponse({quotes:await customerShippingQuotes(request)});}catch(error){return errorResponse(error);}};
export const POST:APIRoute=async({request})=>{try{return jsonResponse({quote:await requestShippingQuote(request,await readSameOriginJson(request,16384))});}catch(error){return errorResponse(error);}};
