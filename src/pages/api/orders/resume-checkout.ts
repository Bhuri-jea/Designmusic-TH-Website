import type { APIRoute } from 'astro';
import { resumeCheckout } from '../../../lib/server/payments.ts';
import { readSameOriginJson, jsonResponse, errorResponse } from '../../../lib/server/http.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    return jsonResponse(await resumeCheckout(request, await readSameOriginJson(request)));
  } catch (error) {
    return errorResponse(error);
  }
};
