import type {APIRoute} from 'astro';
import {createCatalogOrderHandlers} from '../../../../lib/server/catalog-order';
export const prerender=false;
const handlers=createCatalogOrderHandlers();
export const GET:APIRoute=({request})=>handlers.get(request);
export const PUT:APIRoute=({request})=>handlers.put(request);
