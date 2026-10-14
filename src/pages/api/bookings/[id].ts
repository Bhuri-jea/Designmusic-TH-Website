import type { APIRoute } from 'astro';
import { cancelBooking, rescheduleBooking } from '../../../lib/server/bookings.ts';
import { assertSameOrigin, errorResponse, jsonResponse, readSameOriginJson } from '../../../lib/server/http.ts';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    return jsonResponse({ booking: await rescheduleBooking(request, params.id ?? '', await readSameOriginJson(request)) });
  } catch (error) { return errorResponse(error); }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    assertSameOrigin(request);
    return jsonResponse({ booking: await cancelBooking(request, params.id ?? '') });
  }
  catch (error) { return errorResponse(error); }
};
