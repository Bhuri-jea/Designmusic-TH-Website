import type { APIRoute } from 'astro';
import { ownedOrders, ownedOrdersPage } from '../../lib/server/payments.ts';
import { jsonResponse, errorResponse } from '../../lib/server/http.ts';
export const prerender = false;
export const GET: APIRoute = async ({ request, url }) => {
    try {
        const id=url.searchParams.get('order_id');
        if(id)return jsonResponse({orders:await ownedOrders(request,id)});
        return jsonResponse(await ownedOrdersPage(request,Number(url.searchParams.get('page')??1),Number(url.searchParams.get('page_size')??5)));
    }
    catch (error) {
        return errorResponse(error);
    }
};
