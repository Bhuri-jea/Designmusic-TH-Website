import { getEnv } from './env.ts';

type Environment = (name: string) => string | undefined;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type OutboxJob = {
  id: number;
  topic: string;
  dedupe_key: string;
  payload: Record<string, unknown>;
  attempts: number;
};

export type OutboxDependencies = {
  env: Environment;
  elapsedNow: () => number;
  fetch: Fetcher;
  rpc: <T>(name: string, args: Record<string, unknown>) => Promise<T>;
};

export const outboxDependencies: OutboxDependencies = {
  env: getEnv,
  elapsedNow: () => performance.now(),
  fetch: (input, init) => fetch(input, init),
  rpc: async <T>(name: string, args: Record<string, unknown>) => {
    const { rpc } = await import('./supabase.ts');
    return rpc<T>(name, args);
  },
};

function requireEnv(env: Environment, name: string): string {
  const value = env(name);
  if (!value) throw new Error('transport_configuration_unavailable');
  return value;
}

function validAcknowledgment(value: unknown, bookingId: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ack = value as Record<string, unknown>;
  return Object.keys(ack).length === 2 && ack.ok === true && ack.bookingId === bookingId;
}

async function responseJson(response: Response, maxBytes: number): Promise<unknown> {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('transport_failed');
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new Error('transport_failed');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('transport_failed');
  }
}

function validGoogleEndpoint(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('transport_configuration_unavailable');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || url.port ||
      url.username || url.password || url.search || url.hash ||
      !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) {
    throw new Error('transport_configuration_unavailable');
  }
  return url;
}

function validRedirect(value: string | null): URL {
  if (!value) throw new Error('transport_failed');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('transport_failed');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'script.googleusercontent.com' ||
      url.port || url.username || url.password || url.hash) {
    throw new Error('transport_failed');
  }
  return url;
}

export async function sendGoogleReport(
  payload: Record<string, unknown>,
  env: Environment = getEnv,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const endpoint = validGoogleEndpoint(requireEnv(env, 'GOOGLE_SHEETS_WEBHOOK_URL'));
  const secret = requireEnv(env, 'GOOGLE_SHEETS_WEBHOOK_SECRET');
  const bookingId = payload.bookingId;
  if (typeof bookingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
    throw new Error('transport_failed');
  }
  const requestBody = {
    bookingId,
    startAt: payload.startAt,
    endAt: payload.endAt,
    timeZone: payload.timeZone,
    customer: payload.customer,
    instrument: payload.instrument,
    service: payload.service,
    notes: payload.notes,
    reportSecret: secret,
  };
  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
      redirect: 'manual',
    });
    if (response.status === 302 || response.status === 303) {
      const redirectUrl = validRedirect(response.headers.get('location'));
      response = await fetcher(redirectUrl, { method: 'GET', redirect: 'manual' });
      if (response.status === 302 || response.status === 303) throw new Error('transport_failed');
    }
    if (!response.ok) throw new Error('transport_failed');
    const acknowledgment = await responseJson(response, 4096);
    if (!validAcknowledgment(acknowledgment, bookingId)) throw new Error('transport_failed');
  } catch (error) {
    if (error instanceof Error && error.message === 'transport_configuration_unavailable') throw error;
    throw new Error('transport_failed');
  }
}

function bounded(value: number | undefined, fallback: number, maximum: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(maximum, Math.floor(value!))) : fallback;
}

function workerId(): string {
  return globalThis.crypto.randomUUID();
}

async function deliver(job: OutboxJob, deps: OutboxDependencies): Promise<void> {
  if (job.topic === 'booking_google') {
    await sendGoogleReport(job.payload, deps.env, deps.fetch);
    return;
  }
  if (!['booking_buyer', 'booking_seller', 'order_paid_buyer', 'order_paid_seller'].includes(job.topic)) {
    throw new Error('transport_failed');
  }
  const { notification } = await import('./notifications.ts');
  const message = notification(job.topic, job.payload, deps.env);
  const apiKey = requireEnv(deps.env, 'RESEND_API_KEY');
  let response: Response;
  try {
    response = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': job.dedupe_key,
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      }),
    });
    if (!response.ok) throw new Error('transport_failed');
    const result = await responseJson(response, 4096) as { id?: unknown };
    if (!result || typeof result.id !== 'string' || !result.id) throw new Error('transport_failed');
  } catch {
    throw new Error('transport_failed');
  }
}

export async function dispatchOutbox(
  deps: OutboxDependencies = outboxDependencies,
  options: { maxBatch?: number; budgetMs?: number } = {},
): Promise<{ sent: number; failed: number; deferred: number }> {
  const maxBatch = bounded(options.maxBatch, 5, 5);
  const budgetMs = bounded(options.budgetMs, 25000, 25000);
  const deadline = deps.elapsedNow() + budgetMs;
  const worker = workerId();
  const jobs = await deps.rpc<OutboxJob[]>('claim_outbox', {
    p_limit: maxBatch,
    p_worker_id: worker,
  });
  const result = { sent: 0, failed: 0, deferred: 0 };
  for (let index = 0; index < jobs.length; index++) {
    if (deps.elapsedNow() >= deadline) {
      result.deferred += jobs.length - index;
      break;
    }
    const job = jobs[index];
    try {
      await deliver(job, deps);
    } catch (error) {
      const safeCode = error instanceof Error && error.message === 'transport_configuration_unavailable'
        ? 'transport_configuration_unavailable'
        : 'transport_failed';
      await deps.rpc('fail_outbox', { p_id: job.id, p_worker_id: worker, p_error: safeCode });
      result.failed++;
      continue;
    }
    await deps.rpc('complete_outbox', { p_id: job.id, p_worker_id: worker });
    result.sent++;
  }
  return result;
}

export async function runScheduler(
  request: Request,
  deps: OutboxDependencies = outboxDependencies,
  reconcile: () => Promise<unknown> = async () => null,
): Promise<Response> {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' };
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });
  const secret = deps.env('CRON_SECRET');
  if (!secret) return new Response(JSON.stringify({ error: 'scheduler_configuration_unavailable' }), { status: 503, headers });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
  }
  const reconciliation = await reconcile();
  const outbox = await dispatchOutbox(deps);
  return new Response(JSON.stringify({ reconciliation, outbox }), { status: 200, headers });
}
