import type { APIRoute } from 'astro';
import { runScheduler } from '../../../lib/server/outbox.ts';
import { reconcilePayments } from '../../../lib/server/reconciliation.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) =>
  runScheduler(request, undefined, () => reconcilePayments());
