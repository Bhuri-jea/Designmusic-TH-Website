import type { APIRoute } from 'astro';
import { registerEmail } from '../../lib/server/email-auth.ts';
import { errorResponse, jsonResponse, readSameOriginJson } from '../../lib/server/http.ts';

export const prerender = false;
export function createSignupHandler(register = registerEmail) {
  return async (request: Request): Promise<Response> => {
    try {
      const body = await readSameOriginJson(request);
      await register(body, typeof body.locale === 'string' ? body.locale : 'en');
      return jsonResponse({ ok: true });
    } catch (error) { return errorResponse(error); }
  };
}
const signup = createSignupHandler();
export const POST: APIRoute = ({ request }) => signup(request);
