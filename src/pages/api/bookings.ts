import type { APIRoute } from 'astro';
import { createBooking, ownedBookings, availableBookings } from '../../lib/server/bookings.ts';
import { errorResponse, jsonResponse, readSameOriginJson } from '../../lib/server/http.ts';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  try {
    if (url.searchParams.get('slots') === 'true') return jsonResponse(availableBookings());
    return jsonResponse({
      bookings: await ownedBookings(request, url.searchParams.get('booking_id') ?? undefined),
    });
  } catch (error) {
    return errorResponse(error);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const booking = await createBooking(request, await readSameOriginJson(request));
    return jsonResponse({ booking }, 201);
  } catch (error) {
    return errorResponse(error);
  }
};