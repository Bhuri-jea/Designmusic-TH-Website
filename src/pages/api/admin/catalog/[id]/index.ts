import type {APIRoute} from 'astro';import {getCatalogProduct,saveCatalogProduct} from '../../../../../lib/server/catalog-admin';import {errorResponse,jsonResponse,readSameOriginJson} from '../../../../../lib/server/http';
export const prerender=false;
export const GET:APIRoute=async({request,params})=>{try{return jsonResponse({product:await getCatalogProduct(request,params.id??'')});}catch(error){return errorResponse(error);}};
export const PUT:APIRoute=async({request,params})=>{try{return jsonResponse(await saveCatalogProduct(request,params.id??'',await readSameOriginJson(request,262144)));}catch(error){return errorResponse(error);}};
