import type { APIRoute } from 'astro';
import { bookingAvailability } from '../../lib/server/bookings.ts';
import { jsonResponse, errorResponse } from '../../lib/server/http.ts';
export const prerender = false;
export const GET: APIRoute = async () => {
  try { return jsonResponse(await bookingAvailability()); }
  catch (error) { return errorResponse(error); }
};
