import type { APIRoute } from 'astro';
import { adminCancelBooking } from '../../../../../lib/server/bookings.ts';
import { errorResponse, jsonResponse, readSameOriginJson } from '../../../../../lib/server/http.ts';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const body = await readSameOriginJson(request, 2048);
    return jsonResponse({ booking: await adminCancelBooking(request, params.id ?? '', body) });
  } catch (error) { return errorResponse(error); }
};
