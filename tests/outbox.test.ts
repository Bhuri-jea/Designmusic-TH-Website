import test from 'node:test';
import assert from 'node:assert/strict';
import { sendGoogleReport, dispatchOutbox, runScheduler, type OutboxDependencies } from '../src/lib/server/outbox.ts';
import { notification } from '../src/lib/server/notifications.ts';
const id = '22222222-2222-4222-8222-222222222222';
const payload = { bookingId: id, startAt: '2026-10-13T03:00:00Z', endAt: '2026-10-13T04:00:00Z', timeZone: 'Asia/Bangkok', customer: { name: '<Name>', email: 'buyer@example.test', phone: '=123' }, instrument: 'alto', service: 'basic', notes: '<script>bad</script>', locale: 'ja', recipient: 'buyer@example.test' };
const config: Record<string, string> = { GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/deploy/exec', GOOGLE_SHEETS_WEBHOOK_SECRET: 'secret', RESEND_API_KEY: 'test-key', EMAIL_FROM: 'sender@example.test', SELLER_EMAIL: 'seller@example.test', CRON_SECRET: 'cron-secret' };
const ack = () => new Response(JSON.stringify({ ok: true, bookingId: id }), { headers: { 'content-type': 'application/json' } });
test('Google direct acknowledgment and exactly one 302/303 GET redirect succeed without secret/header forwarding', async () => {
  await sendGoogleReport(payload, n => config[n], async () => ack());
  for (const status of [302, 303]) {
    const calls: { url: string; init?: RequestInit }[] = [];
    await sendGoogleReport(payload, n => config[n], async (url, init) => { calls.push({ url: String(url), init }); return calls.length === 1 ? new Response(null, { status, headers: { location: 'https://script.googleusercontent.com/opaque?token=abc' } }) : ack(); });
    assert.equal(calls[0].init?.redirect, 'manual');
    assert.match(String(calls[0].init?.body), /reportSecret/);
    assert.equal(calls[1].init?.method, 'GET');
    assert.equal(calls[1].init?.body, undefined);
    assert.equal(calls[1].init?.headers, undefined);
    assert.equal(calls[1].init?.redirect, 'manual');
  }
});
test('Google rejects untrusted redirects, additional hops and malformed/oversized/wrong-ID acknowledgments', async () => {
  for (const location of ['https://accounts.google.com/login', 'https://script.googleusercontent.com.evil.test/x', 'http://script.googleusercontent.com/x', 'https://user@script.googleusercontent.com/x', 'https://script.googleusercontent.com:444/x', '/relative', 'https://script.googleusercontent.com/x#fragment'])
    await assert.rejects(sendGoogleReport(payload, n => config[n], async () => new Response(null, { status: 302, headers: { location } })));
  for (const status of [301, 307, 308]) await assert.rejects(sendGoogleReport(payload, n => config[n], async () => new Response(null, { status, headers: { location: 'https://script.googleusercontent.com/x' } })));
  await assert.rejects(sendGoogleReport(payload, n => config[n], async () => new Response(null, { status: 302, headers: { location: 'https://script.googleusercontent.com/x' } })));
  for (const body of ['<html>login</html>', JSON.stringify({ ok: false, bookingId: id }), JSON.stringify({ ok: true, bookingId: 'wrong' }), JSON.stringify({ ok: true, bookingId: id, extra: 1 }), ' '.repeat(4097)])
    await assert.rejects(sendGoogleReport(payload, n => config[n], async () => new Response(body, { headers: { 'content-type': 'application/json' } })));
  for (const endpoint of ['https://script.google.com/macros/s/x/exec?secret=bad', 'https://script.google.com:444/macros/s/x/exec', 'https://script.google.com.evil.test/macros/s/x/exec'])
    await assert.rejects(sendGoogleReport(payload, n => n === 'GOOGLE_SHEETS_WEBHOOK_URL' ? endpoint : config[n], async () => ack()));
});
function fixture(topic = 'booking_google') {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const sends: RequestInit[] = [];
  const deps: OutboxDependencies = { env: n => config[n], elapsedNow: () => performance.now(), fetch: async (_url, init) => { sends.push(init!); return topic === 'booking_google' ? ack() : new Response('{"id":"email-id"}', { headers: { 'content-type': 'application/json' } }); }, rpc: async <T>(name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return (name === 'claim_outbox' ? [{ id: 1, topic, dedupe_key: `booking:${id}:buyer`, payload, attempts: 1 }] : true) as T; } };
  return { deps, calls, sends };
}
test('dispatcher completes only acknowledged jobs under a fresh lease owner, using stable email idempotency', async () => {
  const f = fixture('booking_buyer');
  assert.equal((await dispatchOutbox(f.deps)).sent, 1);
  assert.equal((await dispatchOutbox(f.deps)).sent, 1);
  const claims = f.calls.filter(c => c.name === 'claim_outbox');
  assert.notEqual(claims[0].args.p_worker_id, claims[1].args.p_worker_id);
  const completes = f.calls.filter(c => c.name === 'complete_outbox');
  assert.equal(completes[0].args.p_worker_id, claims[0].args.p_worker_id);
  assert.equal(new Headers(f.sends[0].headers).get('Idempotency-Key'), 'booking:' + id + ':buyer');
  assert.equal(new Headers(f.sends[1].headers).get('Idempotency-Key'), 'booking:' + id + ':buyer');
});
test('missing configuration and ambiguous responses retain jobs, never complete; errors are sanitized', async () => {
  for (const mode of ['missing', 'ambiguous', 'wrong']) {
    const f = fixture();
    if (mode === 'missing') f.deps.env = () => undefined;
    else f.deps.fetch = async () => { if (mode === 'ambiguous') throw Error('secret private provider URL'); return new Response('{"ok":true,"bookingId":"wrong"}'); };
    assert.equal((await dispatchOutbox(f.deps)).sent, 0);
    assert.equal(f.calls.some(c => c.name === 'complete_outbox'), false);
    assert.equal(f.calls.find(c => c.name === 'fail_outbox')?.args.p_error, mode === 'missing' ? 'transport_configuration_unavailable' : 'transport_failed');
  }
});
test('localized notification templates escape customer text and send only transactional snapshot data', () => {
  const en = notification('booking_buyer', { ...payload, locale: 'en' }, n => config[n]);
  const ja = notification('booking_buyer', payload, n => config[n]);
  assert.notEqual(en.subject, ja.subject);
  assert.equal(ja.to, 'buyer@example.test');
  assert.match(ja.html, /&lt;script&gt;/);
  assert.doesNotMatch(ja.html, /<script>/);
  assert.equal(notification('booking_seller', payload, n => config[n]).to, 'seller@example.test');
  assert.match(notification('order_paid_buyer', { locale: 'th', recipient: 'buyer@example.test', orderId: id, currency: 'thb', amountTotal: 20000, items: [{ name: '<plug>', quantity: 1 }] }, n => config[n]).html, /&lt;plug&gt;/);
});
test('dispatcher caps batch and elapsed budget; scheduler requires protected Bearer and stays private', async () => {
  const f = fixture();
  await dispatchOutbox(f.deps, { maxBatch: 100, budgetMs: 999999 });
  assert.equal(f.calls[0].args.p_limit, 5);
  let elapsed = 0;
  f.deps.elapsedNow = () => elapsed;
  f.deps.rpc = async <T>(name: string) => { if (name === 'claim_outbox') { elapsed = 60000; return [{ id: 1, topic: 'booking_google', payload, dedupe_key: 'x', attempts: 1 }] as T; } return true as T; };
  const sends = f.sends.length;
  await dispatchOutbox(f.deps, { budgetMs: 100 });
  assert.equal(f.sends.length, sends);
  const denied = await runScheduler(new Request('https://shop.test/api/cron/outbox', { method: 'POST' }), f.deps, async () => ({ checked: 0 }));
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get('cache-control')!, /no-store/);
  let reconciles = 0;
  const ok = await runScheduler(new Request('https://shop.test/api/cron/outbox', { method: 'POST', headers: { authorization: 'Bearer cron-secret' } }), f.deps, async () => { reconciles++; return { checked: 0 }; });
  assert.equal(ok.status, 200);
  assert.equal(reconciles, 1);
});
