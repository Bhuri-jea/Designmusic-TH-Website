import type {APIRoute} from 'astro';
import {requireAdmin} from '../../../../lib/server/admin';
import {select,rpc} from '../../../../lib/server/supabase';
import {HttpError,errorResponse,jsonResponse,readSameOriginJson} from '../../../../lib/server/http';
export const prerender=false;
export const GET:APIRoute=async({request})=>{try{await requireAdmin(request);return jsonResponse({collections:await select('catalog_collections',{order:'created_at'})});}catch(error){return errorResponse(error);}};
export const POST:APIRoute=async({request})=>{try{const body=await readSameOriginJson(request);await requireAdmin(request);if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>100||/[\u0000-\u001f\u007f]/.test(body.name)||!['en','th'].includes(String(body.locale)))throw new HttpError(400,'invalid_collection_name');return jsonResponse({collection:await rpc('admin_create_catalog_collection',{p_name:body.name.trim(),p_locale:body.locale})},201);}catch(error){return errorResponse(error);}};
