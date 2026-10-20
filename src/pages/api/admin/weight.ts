import type { APIRoute } from 'astro';
import { createAdminHandlers } from '../../../lib/server/admin.ts';
export const prerender = false;
export const PATCH: APIRoute = ({ request }) => createAdminHandlers().weightPatch(request);
