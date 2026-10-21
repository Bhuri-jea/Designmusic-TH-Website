import type {APIRoute} from 'astro';
import {createRefundAllocationHandlers} from '../../../lib/server/refund-allocation';
export const prerender=false;
const handlers=createRefundAllocationHandlers();
export const GET:APIRoute=({request})=>handlers.get(request);
export const POST:APIRoute=({request})=>handlers.post(request);
