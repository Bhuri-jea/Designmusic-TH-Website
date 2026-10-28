import test from 'node:test';
import assert from 'node:assert/strict';
import { notification } from '../src/lib/server/notifications.ts';

test('booking changes notify buyer and seller in four languages with escaped admin reason', () => {
 const env = (name: string) => ({ EMAIL_FROM: 'shop@example.test', SELLER_EMAIL: 'seller@example.test' })[name];
 for (const locale of ['en', 'th', 'ja', 'zh-CN']) {
  const base = { bookingId: '22222222-2222-4222-8222-222222222222', startAt: '2026-10-28T04:00:00Z', previousStartAt: '2026-10-27T04:00:00Z', instrument: 'alto', service: 'basic', notes: '', locale, recipient: 'buyer@example.test', customer: { name: 'Buyer', email: 'buyer@example.test', contactInformation: 'LINE: buyer' } };
  for (const topic of ['booking_buyer', 'booking_seller']) {
   const moved = notification(topic, { ...base, event: 'rescheduled' }, env);
   assert.notEqual(moved.subject, notification(topic, base, env).subject);
   assert.match(moved.html, /2026|2026年|2569/);
   const cancelled = notification(topic, { ...base, event: 'cancelled', cancelledBy: 'admin', cancellationReason: '<Workshop> closed' }, env);
   assert.match(cancelled.html, /&lt;Workshop&gt; closed/);
   assert.doesNotMatch(cancelled.html, /<Workshop>/);
   assert.notEqual(cancelled.subject, moved.subject);
   const customerCancelled = notification(topic, { ...base, event: 'cancelled', cancelledBy: 'customer' }, env);
   assert.doesNotMatch(customerCancelled.html, /&lt;Workshop&gt;/);
  }
 }
});
