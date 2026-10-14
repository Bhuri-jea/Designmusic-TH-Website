import test from 'node:test';
import assert from 'node:assert/strict';
import { rpc } from '../src/lib/server/supabase.ts';
import { authenticateEmail } from '../src/lib/server/email-auth.ts';

test('modern server key reaches REST as apikey without an invalid Bearer JWT', async (t) => {
  const names = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const previous = names.map(name => process.env[name]);
  t.after(() => names.forEach((name, i) => previous[i] === undefined ? delete process.env[name] : process.env[name] = previous[i]));
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-test';
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://project.supabase.co/rest/v1/rpc/resolve_customer');
    const headers = new Headers(init.headers);
    assert.equal(headers.get('apikey'), 'sb_secret_test');
    assert.equal(headers.has('authorization'), false);
    return Response.json({ id: 'customer' });
  });
  assert.deepEqual(await rpc('resolve_customer', {}), { id: 'customer' });
});

test('legacy server key remains supported during migration', async (t) => {
  const names = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const previous = names.map(name => process.env[name]);
  t.after(() => names.forEach((name, i) => previous[i] === undefined ? delete process.env[name] : process.env[name] = previous[i]));
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-test';
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    assert.equal(headers.get('apikey'), 'legacy-test');
    assert.equal(headers.get('authorization'), 'Bearer legacy-test');
    return Response.json([]);
  });
  assert.deepEqual(await rpc('resolve_customer', {}), []);
});

test('email login consumes the publishable configuration without the secret key', async (t) => {
  const names = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'APP_ORIGIN'];
  const previous = names.map(name => process.env[name]);
  t.after(() => names.forEach((name, i) => previous[i] === undefined ? delete process.env[name] : process.env[name] = previous[i]));
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  delete process.env.SUPABASE_ANON_KEY;
  process.env.APP_ORIGIN = 'https://designmusic-th.vercel.app';
  let called = false;
  await authenticateEmail({ email: 'owner@example.test', password: 'test-password' }, undefined, async (_url, init) => {
    called = true;
    assert.equal(new Headers(init?.headers).get('apikey'), 'sb_publishable_test');
    return Response.json({ user: { id: '12345678-1234-4234-8234-123456789abc', email: 'owner@example.test', email_confirmed_at: '2026-10-14T00:00:00Z' } });
  });
  assert.equal(called, true);
});
