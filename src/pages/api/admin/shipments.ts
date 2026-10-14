import type {APIRoute} from 'astro';import {createAdminHandlers} from '../../../lib/server/admin.ts';
export const prerender=false;const handlers=createAdminHandlers();
export const GET:APIRoute=({request})=>handlers.shipmentsGet(request);
export const POST:APIRoute=({request})=>handlers.ship(request);
