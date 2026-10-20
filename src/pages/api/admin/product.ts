import type { APIRoute } from 'astro';
import { createAdminProductHandlers } from '../../../lib/server/admin-product.ts';

export const prerender = false;
const handlers = createAdminProductHandlers();
export const PATCH: APIRoute = ({ request }) => handlers.patch(request);
