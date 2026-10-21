import type {APIRoute} from 'astro';
import {requireAdmin} from '../../../lib/server/admin';
import {cancelOrder} from '../../../lib/server/refunds';
import {rpc} from '../../../lib/server/supabase';
import {readSameOriginJson,jsonResponse,errorResponse} from '../../../lib/server/http';
export const prerender=false;
export const GET:APIRoute=async({request})=>{try{await requireAdmin(request);return jsonResponse({orders:await rpc('admin_cancellation_queue',{})});}catch(error){return errorResponse(error);}};
export const POST:APIRoute=async({request})=>{try{return jsonResponse(await cancelOrder(request,await readSameOriginJson(request,8192)));}catch(error){return errorResponse(error);}};
