import type { APIRoute } from 'astro';
import { createBooking, ownedBookings } from '../../lib/server/bookings.ts';
import { jsonResponse, errorResponse, readSameOriginJson } from '../../lib/server/http.ts';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  try { return jsonResponse({ booking: await createBooking(request, await readSameOriginJson(request, 16384)) }, 201); }
  catch (error) { return errorResponse(error); }
};
export const GET: APIRoute = async ({ request, url }) => {
  try { return jsonResponse({ bookings: await ownedBookings(request, url.searchParams.get('booking_id') ?? undefined) }); }
  catch (error) { return errorResponse(error); }
};
