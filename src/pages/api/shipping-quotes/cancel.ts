import type {APIRoute} from 'astro';
import {cancelShippingQuote} from '../../../lib/server/shipping-quotes.ts';
import {jsonResponse,errorResponse,readSameOriginJson} from '../../../lib/server/http.ts';
export const prerender=false;
export const POST:APIRoute=async({request})=>{try{return jsonResponse({quote:await cancelShippingQuote(request,await readSameOriginJson(request))});}catch(error){return errorResponse(error);}};
