export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}
export const MAX_JSON_BYTES = 2048;

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return jsonResponse({ error: error.code }, error.status);
  return jsonResponse({ error: 'service_unavailable' }, 503);
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  let matches = false;
  try { matches = Boolean(origin && new URL(origin).origin === new URL(request.url).origin); }
  catch { matches = false; }
  if (!matches) throw new HttpError(403, 'origin_not_allowed');
}

export async function readSameOriginJson(request: Request, maxBytes = MAX_JSON_BYTES): Promise<Record<string, unknown>> {
  assertSameOrigin(request);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'json_required');
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) throw new HttpError(413, 'body_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'invalid_json');
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, 'body_too_large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const text = new TextDecoder().decode(bytes);
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new HttpError(400, 'invalid_json'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'invalid_profile');
  return body as Record<string, unknown>;
}


