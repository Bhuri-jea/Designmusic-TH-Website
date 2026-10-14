import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateEmail, registerEmail } from '../src/lib/server/email-auth.ts';
import { createSignupHandler } from '../src/pages/api/signup.ts';

const config = { url: 'https://project.supabase.co', key: 'anon-test-key', origin: 'https://site.test' };
const id = '12345678-1234-4234-8234-123456789abc';
const user = { id, email: 'person@example.test', email_confirmed_at: '2026-10-14T00:00:00Z', user_metadata: { name: 'Person' } };

test('password login returns only a verified stable identity and never provider tokens', async () => {
  const result = await authenticateEmail({ email: ' Person@Example.test ', password: 'example-password' }, config, async (url, init) => {
    assert.equal(String(url), 'https://project.supabase.co/auth/v1/token?grant_type=password');
    assert.deepEqual(JSON.parse(String(init?.body)), { email: 'person@example.test', password: 'example-password' });
    return Response.json({ access_token: 'private-token', refresh_token: 'private-refresh', user });
  });
  assert.deepEqual(result, { id, email: 'person@example.test', name: 'Person', image: null });
});

test('unconfirmed, malformed and incorrect credentials never yield an authenticated identity', async () => {
  for (const response of [Response.json({ user: { ...user, email_confirmed_at: null } }), Response.json({ user: { ...user, id: 'fake' } }), Response.json({ error: 'bad password' }, { status: 400 })]) {
    assert.equal(await authenticateEmail({ email: 'person@example.test', password: 'example-password' }, config, async () => response), null);
  }
});

test('signup uses the configured confirmation destination and excludes browser identity/role claims', async () => {
  await registerEmail({ email: ' Person@Example.test ', password: 'example-password', name: ' Person ', googleSubject: 'attacker', role: 'admin', redirect: 'https://evil.test' }, 'th', config, async (url, init) => {
    assert.equal(String(url), 'https://project.supabase.co/auth/v1/signup?redirect_to=https%3A%2F%2Fsite.test%2Fth%2Flogin');
    assert.deepEqual(JSON.parse(String(init?.body)), { email: 'person@example.test', password: 'example-password', data: { name: 'Person' } });
    assert.equal((init?.headers as Record<string,string>).apikey, 'anon-test-key');
    return Response.json({ ...user, email_confirmed_at: null });
  });
});

test('invalid signup is rejected before contacting the provider', async () => {
  let called = false;
  for (const body of [{ email: 'bad', password: 'example-password', name: 'Person' }, { email: 'person@example.test', password: 'short', name: 'Person' }, { email: 'person@example.test', password: 'example-password', name: '' }]) {
    await assert.rejects(() => registerEmail(body, 'en', config, async () => { called = true; return Response.json({}); }));
  }
  assert.equal(called, false);
});

test('signup enforces origin, returns no identity/token and sanitizes provider errors', async () => {
  let called = false;
  const handler = createSignupHandler(async () => { called = true; });
  const request = (origin: string) => new Request('https://site.test/api/signup', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'person@example.test', password: 'example-password', name: 'Person' }) });
  assert.equal((await handler(request('https://evil.test'))).status, 403);
  assert.equal(called, false);
  const success = await handler(request('https://site.test'));
  assert.deepEqual(await success.json(), { ok: true });
  assert.match(success.headers.get('cache-control') ?? '', /no-store/);
  const failed = await createSignupHandler(async () => { throw new Error('secret-key customer-password'); })(request('https://site.test'));
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /secret-key|customer-password/);
});

test('provider rate limits reach the client without private diagnostics', async () => {
  await assert.rejects(() => registerEmail({ email: 'person@example.test', password: 'example-password', name: 'Person' }, 'en', config, async () => Response.json({ msg: 'private provider detail' }, { status: 429 })), (error: any) => error.status === 429 && error.code === 'auth_rate_limited');
});
