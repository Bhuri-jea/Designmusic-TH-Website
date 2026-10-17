import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/google-outbox-scheduler.gs', import.meta.url), 'utf8');
const success = { payments: { errors: 1 }, outbox: { claimed: 0, sent: 0, errors: 0, deferred: 0 } };
function fixture(secret = 'test-private-secret', status = 200, body = JSON.stringify(success), networkFailure = false) {
  const requests: { url: string; options: any }[] = [];
  const logs: string[] = [];
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => { assert.equal(key, 'WEBSITE_CRON_SECRET'); return secret; } }) },
    UrlFetchApp: { fetch: (url: string, options: any) => {
      requests.push({ url, options });
      if (networkFailure) throw Error('private-provider-detail');
      return { getResponseCode: () => status, getContentText: () => body };
    } },
    console: { log: (value: string) => logs.push(value), warn: (value: string) => logs.push(value) },
  });
  vm.runInContext(source, context);
  return { run: () => vm.runInContext('processWebsiteJobs()', context), requests, logs };
}

test('scheduler makes one authenticated POST without redirects and logs only counts and payment warning', () => {
  const f = fixture(); f.run();
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, 'https://designmusic-th.com/api/cron/outbox');
  const options = f.requests[0].options;
  assert.equal(options.method, 'post');
  assert.equal(options.headers.Authorization, 'Bearer test-private-secret');
  assert.equal(options.followRedirects, false);
  assert.equal(options.muteHttpExceptions, true);
  assert.equal(options.timeoutSeconds, 120);
  assert.equal(f.logs[0], JSON.stringify(success.outbox));
  assert.match(f.logs[1], /Payment reconciliation/);
  assert.doesNotMatch(f.logs.join(''), /test-private-secret/);
});

test('scheduler refuses missing credentials, redirects, invalid responses and transport failures without leaking data', () => {
  const missing = fixture('');
  assert.throws(missing.run, /scheduler_secret_missing/);
  assert.equal(missing.requests.length, 0);
  for (const status of [301, 302, 401, 500]) {
    const f = fixture('test-private-secret', status, 'private-provider-detail');
    assert.throws(f.run, new RegExp('scheduler_http_' + status));
    assert.equal(f.logs.length, 0);
  }
  for (const body of ['private-provider-detail', '{}', 'x'.repeat(4097), JSON.stringify({ outbox: { ...success.outbox, errors: '0' } })]) {
    assert.throws(fixture('test-private-secret', 200, body).run, /scheduler_invalid_response/);
  }
  assert.throws(fixture('test-private-secret', 200, '', true).run, /scheduler_request_failed/);
});

test('HTTP 200 with outbox errors fails the trigger instead of reporting a successful delivery', () => {
  const f = fixture('test-private-secret', 200, JSON.stringify({ outbox: { claimed: 1, sent: 0, errors: 1, deferred: 0 } }));
  assert.throws(f.run, /scheduler_outbox_errors_check_supabase/);
  assert.equal(f.requests.length, 1);
});
