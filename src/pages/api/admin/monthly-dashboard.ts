import type { APIRoute } from 'astro';
import { createMonthlyDashboardHandler } from '../../../lib/server/monthly-dashboard.ts';
export const prerender = false;
const handler = createMonthlyDashboardHandler();
export const GET: APIRoute = ({ request }) => handler(request);
