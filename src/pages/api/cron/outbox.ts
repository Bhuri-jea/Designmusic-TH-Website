import type { APIRoute } from 'astro';
import { runScheduler } from '../../../lib/server/outbox.ts';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => runScheduler(request);
