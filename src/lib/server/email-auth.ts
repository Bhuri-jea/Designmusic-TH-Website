import { getEnv } from './env.ts';
import { HttpError } from './http.ts';

type AuthConfig = { url: string; key: string; origin: string };
type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function configuration(): AuthConfig {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_PUBLISHABLE_KEY') ?? getEnv('SUPABASE_ANON_KEY');
  const origin = getEnv('APP_ORIGIN');
  if (!url || !key || !origin) throw new HttpError(503, 'service_unavailable');
  return { url: url.replace(/\/$/, ''), key, origin };
}

function credentials(body: Record<string, unknown>, signup: boolean) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < (signup ? 12 : 1) || password.length > 72) throw new HttpError(400, 'invalid_credentials');
  return { email, password };
}

async function authRequest(path: string, body: unknown, config: AuthConfig, send: AuthFetch) {
  return send(`${config.url}/auth/v1/${path}`, {
    method: 'POST', headers: { apikey: config.key, 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000), redirect: 'error',
  });
}

export async function authenticateEmail(body: Record<string, unknown>, config?: AuthConfig, send: AuthFetch = fetch) {
  try {
    const input = credentials(body, false);
    const response = await authRequest('token?grant_type=password', input, config ?? configuration(), send);
    if (!response.ok) return null;
    const payload = await response.json();
    const user = payload?.user;
    if (!user || typeof user.id !== 'string' || !uuid.test(user.id) || typeof user.email !== 'string' || !user.email_confirmed_at || user.email.toLowerCase() !== input.email) return null;
    return { id: user.id, email: user.email, name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.slice(0, 120) : user.email, image: null };
  } catch { return null; }
}

export async function registerEmail(body: Record<string, unknown>, locale = 'en', config?: AuthConfig, send: AuthFetch = fetch) {
  const input = credentials(body, true);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) throw new HttpError(400, 'invalid_profile');
  const settings = config ?? configuration();
  const prefix = ['ja', 'th', 'zh-CN'].includes(locale) ? `/${locale}` : '';
  const redirect = `${settings.origin}${prefix}/login`;
  const response = await authRequest(`signup?redirect_to=${encodeURIComponent(redirect)}`, { ...input, data: { name } }, settings, send);
  if (response.ok) return;
  if (response.status === 429) throw new HttpError(429, 'auth_rate_limited');
  const result = await response.json().catch(() => ({}));
  // Preserve the same public response for existing and new accounts.
  if (result.code === 'user_already_exists' || result.error_code === 'user_already_exists') return;
  if (result.code === 'weak_password' || result.error_code === 'weak_password') throw new HttpError(400, 'weak_password');
  throw new HttpError(503, 'service_unavailable');
}
