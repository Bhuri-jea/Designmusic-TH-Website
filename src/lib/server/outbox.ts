import { getEnv } from './env.ts';
import { rpc } from './supabase.ts';
import { HttpError, jsonResponse, errorResponse } from './http.ts';
import { notification } from './notifications.ts';
import { reconcilePayments } from './reconciliation.ts';
type Env = (name: string) => string | undefined;
type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type OutboxDependencies = { env: Env; fetch: Fetch; rpc: <T>(name: string, args: Record<string, unknown>) => Promise<T>; elapsedNow: () => number };
export const outboxDependencies: OutboxDependencies = { env: getEnv, fetch: (input, init) => fetch(input, init), rpc, elapsedNow: () => performance.now() };
type Job = { id: number; topic: string; dedupe_key: string; payload: Record<string, unknown>; attempts: number };
export type OutboxOptions = { maxBatch?: number; budgetMs?: number };
const clamp = (value: number | undefined, max: number) => Number.isFinite(value) ? Math.max(1, Math.min(max, Math.floor(value!))) : max;
async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
 if (timeoutMs <= 0) throw Error('transport_timeout');
 const controller = new AbortController();
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), new Promise<never>((_, reject) => {
   timer = setTimeout(() => { controller.abort(); reject(Error('transport_timeout')); }, timeoutMs);
  })]);
 } finally { clearTimeout(timer); }
}
async function boundedJson(response: Response, maxBytes = 4096): Promise<unknown> {
 if (response.status !== 200 || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) throw Error('transport_response');
 if (Number(response.headers.get('content-length') ?? 0) > maxBytes) { await response.body?.cancel(); throw Error('transport_response'); }
 if (!response.body) throw Error('transport_response');
 const reader = response.body.getReader();
 const chunks: Uint8Array[] = []; let length = 0;
 try {
  while (true) {
   const part = await reader.read(); if (part.done) break;
   length += part.value.byteLength;
   if (length > maxBytes) { await reader.cancel(); throw Error('transport_response'); }
   chunks.push(part.value);
  }
 } finally { reader.releaseLock(); }
 const data = new Uint8Array(length); let offset = 0;
 for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
 return JSON.parse(new TextDecoder().decode(data));
}
async function sendGoogleRequest(body: Record<string, unknown>, env: Env, transport: Fetch, timeoutMs: number, maxResponseBytes: number): Promise<unknown> {
 const endpoint = googleEndpoint(env('GOOGLE_SHEETS_WEBHOOK_URL'));
 const secret = env('GOOGLE_SHEETS_WEBHOOK_SECRET');
 if (!secret) throw new HttpError(503, 'transport_configuration_unavailable');
 return bounded(async signal => {
  let response = await transport(endpoint, {
   method: 'POST', headers: { 'content-type': 'application/json' },
   body: JSON.stringify({ reportSecret: secret, ...body }),
   redirect: 'manual', credentials: 'omit', signal,
  });
  if (response.status === 302 || response.status === 303) {
   const location = response.headers.get('location');
   let target: URL;
   try { target = new URL(location!); } catch { throw Error('transport_redirect'); }
   if (!location || target.protocol !== 'https:' || target.hostname !== 'script.googleusercontent.com' || target.port || target.username || target.password || target.hash) throw Error('transport_redirect');
   await response.body?.cancel();
   response = await transport(target, { method: 'GET', redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer', signal });
  }
  return boundedJson(response, maxResponseBytes);
 }, Math.min(timeoutMs, 12000));
}
function googleEndpoint(value: string | undefined) {
 let url: URL;
 try { url = new URL(value!); } catch { throw new HttpError(503, 'transport_configuration_unavailable'); }
 if (!value || url.protocol !== 'https:' || url.hostname !== 'script.google.com' || url.port || url.username || url.password || url.search || url.hash || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) throw new HttpError(503, 'transport_configuration_unavailable');
 return url;
}
export async function sendGoogleReport(payload: Record<string, unknown>, env: Env = getEnv, transport: Fetch = fetch, timeoutMs = 12000) {
 const ack = await sendGoogleRequest({
  bookingId: payload.bookingId, startAt: payload.startAt, endAt: payload.endAt,
  timeZone: 'Asia/Bangkok', customer: payload.customer, instrument: payload.instrument,
  service: payload.service, notes: payload.notes, status: payload.status ?? 'confirmed',
  version: payload.version ?? 1,
 }, env, transport, timeoutMs, 4096);
 if (!ack || typeof ack !== 'object' || Array.isArray(ack) || Object.keys(ack).sort().join(',') !== 'bookingId,ok' || (ack as { ok?: unknown }).ok !== true || (ack as { bookingId?: unknown }).bookingId !== payload.bookingId) throw Error('transport_acknowledgment');
}

export type CalendarSlot = { startAt: string; endAt: string };
export async function filterGoogleCalendarAvailability(slots: CalendarSlot[], env: Env = getEnv, transport: Fetch = fetch): Promise<CalendarSlot[] | null> {
 const url = env('GOOGLE_SHEETS_WEBHOOK_URL');
 const secret = env('GOOGLE_SHEETS_WEBHOOK_SECRET');
 if (!url && !secret) return null;
 if (!url || !secret) throw new HttpError(503, 'transport_configuration_unavailable');
 const ack = await sendGoogleRequest({ action: 'availability', slots }, env, transport, 12000, 16384);
 if (!ack || typeof ack !== 'object' || Array.isArray(ack) ||
  Object.keys(ack).sort().join(',') !== 'availableStartAt,ok' ||
  (ack as { ok?: unknown }).ok !== true || !Array.isArray((ack as { availableStartAt?: unknown }).availableStartAt)) {
  throw Error('transport_acknowledgment');
 }
 const requested = new Set(slots.map(slot => slot.startAt));
 const available = new Set<string>();
 for (const value of (ack as { availableStartAt: unknown[] }).availableStartAt) {
  if (typeof value !== 'string' || !requested.has(value) || available.has(value)) throw Error('transport_acknowledgment');
  available.add(value);
 }
 return slots.filter(slot => available.has(slot.startAt));
}
async function sendEmail(job: Job, deps: OutboxDependencies, timeoutMs: number) {
 const key = deps.env('RESEND_API_KEY');
 if (!key) throw new HttpError(503, 'transport_configuration_unavailable');
 const message = notification(job.topic, job.payload, deps.env);
 await bounded(async signal => {
  const response = await deps.fetch('https://api.resend.com/emails', {
   method: 'POST', redirect: 'manual', credentials: 'omit', signal,
   headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json', 'Idempotency-Key': job.dedupe_key },
   body: JSON.stringify(message),
  });
  const ack = await boundedJson(response);
  if (!ack || typeof ack !== 'object' || typeof (ack as { id?: unknown }).id !== 'string' || !(ack as { id: string }).id) throw Error('transport_acknowledgment');
 }, Math.min(10000, timeoutMs));
}
export async function dispatchOutbox(deps = outboxDependencies, options: OutboxOptions = {}) {
 const deadline = deps.elapsedNow() + clamp(options.budgetMs, 70000);
 const remaining = () => Math.max(0, Math.floor(deadline - deps.elapsedNow()));
 const worker = crypto.randomUUID();
 const result = { claimed: 0, sent: 0, errors: 0, deferred: 0 };
 let jobs: Job[];
 try { jobs = await bounded(() => deps.rpc<Job[]>('claim_outbox', { p_limit: clamp(options.maxBatch, 5), p_worker_id: worker }), remaining()); }
 catch { result.errors++; return result; }
 const batch = jobs.slice(0, clamp(options.maxBatch, 5));
 result.claimed = batch.length;
 for (let index = 0; index < batch.length; index++) {
  if (!remaining()) { result.deferred += batch.length - index; break; }
  const job = batch[index];
  try {
   if (job.topic === 'booking_google') await sendGoogleReport(job.payload, deps.env, deps.fetch, Math.min(12000, remaining()));
   else await sendEmail(job, deps, Math.min(10000, remaining()));
   await bounded(() => deps.rpc('complete_outbox', { p_id: job.id, p_worker_id: worker }), remaining());
   result.sent++;
  } catch (error) {
   result.errors++;
   const code = error instanceof HttpError && error.code === 'transport_configuration_unavailable' ? error.code : 'transport_failed';
   if (remaining()) {
    try { await bounded(() => deps.rpc('fail_outbox', { p_id: job.id, p_worker_id: worker, p_error: code }), remaining()); }
    catch { /* An expired/stale lease cannot mutate another worker's claim. Reclamation repairs uncertainty. */ }
   }
  }
 }
 return result;
}
export async function runScheduler(request: Request, deps = outboxDependencies, reconcile: () => Promise<unknown> = () => reconcilePayments()) {
 try {
  if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
  const secret = deps.env('CRON_SECRET');
  if (!secret) throw new HttpError(503, 'scheduler_configuration_unavailable');
  if (request.headers.get('authorization') !== 'Bearer ' + secret) throw new HttpError(401, 'unauthorized');
  let payments: unknown;
  try { payments = await bounded(() => reconcile(), 25000); } catch { payments = { errors: 1 }; }
  const outbox = await dispatchOutbox(deps, { budgetMs: 70000, maxBatch: 5 });
  return jsonResponse({ payments, outbox });
 } catch (error) { return errorResponse(error); }
}
