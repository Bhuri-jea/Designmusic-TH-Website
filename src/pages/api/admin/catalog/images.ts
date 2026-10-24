import type {APIRoute} from 'astro';
import {createImageUploadHandler} from '../../../../lib/server/catalog-images';
export const prerender=false;
const handler=createImageUploadHandler();
export const POST:APIRoute=({request})=>handler(request);
