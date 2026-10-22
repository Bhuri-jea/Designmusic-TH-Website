import type {APIRoute} from 'astro';import {createCatalogDraft,listCatalog} from '../../../../lib/server/catalog-admin';import {errorResponse,jsonResponse,readSameOriginJson} from '../../../../lib/server/http';
export const prerender=false;
export const GET:APIRoute=async({request,url})=>{try{return jsonResponse({products:await listCatalog(request,url.searchParams.get('q')??'',url.searchParams.get('lifecycle')??'')});}catch(error){return errorResponse(error);}};
export const POST:APIRoute=async({request})=>{try{const body=await readSameOriginJson(request,64);if(Object.keys(body).length)throw Error('invalid');return jsonResponse(await createCatalogDraft(request),201);}catch(error){return errorResponse(error);}};
