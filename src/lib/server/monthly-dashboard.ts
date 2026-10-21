import { requireAdmin } from './admin.ts';
import { rpc } from './supabase.ts';
import { HttpError, errorResponse, jsonResponse } from './http.ts';

type Dependencies = {
  authorize: (request: Request) => Promise<unknown>;
  summary: (month: string) => Promise<unknown>;
  now: () => Date;
};
export function bangkokMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
}
const defaults: Dependencies = {
  authorize: requireAdmin,
  summary: month => rpc('admin_monthly_dashboard', { p_month: `${month}-01` }),
  now: () => new Date(),
};
export function createMonthlyDashboardHandler(deps: Dependencies = defaults) {
  return async (request: Request): Promise<Response> => {
    try {
      await deps.authorize(request);
      const month = new URL(request.url).searchParams.get('month') ?? bangkokMonth(deps.now());
      if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, 'invalid_month');
      return jsonResponse({ month, timeZone: 'Asia/Bangkok', summary: await deps.summary(month) });
    } catch (error) { return errorResponse(error); }
  };
}
