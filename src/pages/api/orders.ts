import type { APIRoute } from 'astro';
import { ownedOrders } from '../../lib/server/payments.ts';
import { jsonResponse, errorResponse } from '../../lib/server/http.ts';
export const prerender = false;
export const GET: APIRoute = async ({ request, url }) => {
    try {
        return jsonResponse({
            orders: await ownedOrders(request, url.searchParams.get('order_id') ?? undefined)
        });
    }
    catch (error) {
        return errorResponse(error);
    }
};
