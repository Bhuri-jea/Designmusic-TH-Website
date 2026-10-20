import type {APIRoute} from 'astro';
import {adminShippingQuotes,approveShippingQuote} from '../../../lib/server/shipping-quotes.ts';
import {jsonResponse,errorResponse,readSameOriginJson} from '../../../lib/server/http.ts';
export const prerender=false;
export const GET:APIRoute=async({request})=>{try{return jsonResponse({quotes:await adminShippingQuotes(request)});}catch(error){return errorResponse(error);}};
export const PATCH:APIRoute=async({request})=>{try{return jsonResponse({quote:await approveShippingQuote(request,await readSameOriginJson(request,4096))});}catch(error){return errorResponse(error);}};
