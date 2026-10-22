import type {APIRoute} from 'astro';import {setCatalogLifecycle} from '../../../../../lib/server/catalog-admin';import {errorResponse,jsonResponse,readSameOriginJson} from '../../../../../lib/server/http';
export const prerender=false;
export const POST:APIRoute=async({request,params})=>{try{const body=await readSameOriginJson(request,256);return jsonResponse(await setCatalogLifecycle(request,params.id??'',body.lifecycle));}catch(error){return errorResponse(error);}};
