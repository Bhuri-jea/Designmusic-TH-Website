import test from 'node:test';
import assert from 'node:assert/strict';
import {orderSupportMailto, SUPPORT_EMAIL, supportCopy} from '../src/lib/order-support.ts';

const id = '22222222-2222-4222-8222-222222222222';
test('support drafts keep the fixed recipient and encode the localized order reference', () => {
 for (const locale of ['en', 'ja', 'th', 'zh-CN'] as const) {
  const url = new URL(orderSupportMailto(id, locale));
  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, SUPPORT_EMAIL);
  assert.equal(url.searchParams.get('subject'), `${supportCopy[locale].subject} — ${id}`);
  assert.ok(url.searchParams.get('body')?.startsWith(`${supportCopy[locale].reference}: ${id}\n`));
  assert.deepEqual([...url.searchParams.keys()], ['subject', 'body']);
 }
});
test('invalid references cannot inject mail recipients or headers', () => {
 for (const value of ['', `${id}\r\nBcc: attacker@example.test`, `${id}&bcc=attacker@example.test`]) {
  assert.throws(() => orderSupportMailto(value, 'en'), /Invalid order reference/);
 }
});
