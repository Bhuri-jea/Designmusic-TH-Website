import { getEnv } from './env.ts';
import { HttpError } from './http.ts';

export class SupabaseRequestError extends HttpError {
  readonly databaseCode?: string;

  constructor(status: number, code?: string) {
    super(status, status === 409 ? 'database_conflict' : 'service_unavailable');
    this.name = 'SupabaseRequestError';
    this.databaseCode = code;
  }
}

function supabaseConfig() {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SECRET_KEY') ?? getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase server configuration is unavailable');
  return { url: url.replace(/\/$/, ''), key };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const { url, key } = supabaseConfig();
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' };
  // Modern API keys are not JWTs. The gateway resolves their role from apikey.
  if (!key.startsWith('sb_secret_')) headers.authorization = `Bearer ${key}`;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  if (!response.ok) {
    let code: string | undefined;
    try {
      const body = await response.clone().json() as { code?: unknown };
      if (typeof body.code === 'string') code = body.code;
    } catch {
      // Provider error bodies are intentionally not surfaced to callers.
    }
    const isConstraintConflict = code?.startsWith('23') === true;
    throw new SupabaseRequestError(response.status === 409 || isConstraintConflict ? 409 : 502, code);
  }
  return response.json() as Promise<T>;
}

export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  return request<T>(`rpc/${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(args) });
}

export async function select<T>(table: string, filters: Record<string, string>): Promise<T[]> {
  const query = new URLSearchParams({ select: '*', ...filters });
  return request<T[]>(`${encodeURIComponent(table)}?${query}`, { method: 'GET' });
}
