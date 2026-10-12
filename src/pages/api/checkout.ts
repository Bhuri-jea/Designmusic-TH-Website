import type { APIRoute } from 'astro';
import { checkout } from '../../lib/server/payments.ts';
import { readSameOriginJson, jsonResponse, errorResponse } from '../../lib/server/http.ts';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
    try {
        return jsonResponse(await checkout(request, await readSameOriginJson(request, 16384)));
    }
    catch (error) {
        return errorResponse(error);
    }
};
