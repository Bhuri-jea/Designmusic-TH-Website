import type { APIRoute } from 'astro';
import { archiveCancelledBooking } from '../../../../lib/server/booking-history.ts';
import { assertSameOrigin, errorResponse, jsonResponse } from '../../../../lib/server/http.ts';

export const prerender = false;
export const POST: APIRoute = async ({ params, request }) => {
  try {
    assertSameOrigin(request);
    return jsonResponse({ archived: await archiveCancelledBooking(request, params.id ?? '') });
  } catch (error) { return errorResponse(error); }
};
