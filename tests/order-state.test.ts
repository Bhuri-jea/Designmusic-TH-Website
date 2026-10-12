import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPaymentEvent, createOrderState, type OrderState } from '../src/lib/server/order-state.ts';
import { SupabaseRequestError } from '../src/lib/server/supabase.ts';
import { errorResponse } from '../src/lib/server/http.ts';

const order = () => createOrderState({
  id: 'o1', customerId: 'customer-1', requestKey: 'request-1', fingerprint: 'fp', currency: 'usd', locale: 'en',
  amountTotal: 1500, items: [], status: 'pending', createdAt: '2026-10-12T00:00:00.000Z', expiresAt: '2026-10-12T01:00:00.000Z',
  checkoutSessionId: 'cs_1', checkoutUrl: 'https://checkout.stripe.test/cs_1',
  checkoutParameters: { customerEmail: 'buyer@example.test', successUrl: 'https://example.test/ok', cancelUrl: 'https://example.test/cancel', allowedCountries: ['TH'], expiresAt: 1791766800 },
});
const evt = (overrides = {}) => ({ eventId: 'evt_1', eventType: 'checkout.session.completed', sessionId: 'cs_1', currency: 'usd', amountTotal: 1500, paymentStatus: 'paid', ...overrides });

test('database conflicts produce a sanitized 409 response', async () => {
  const response = errorResponse(new SupabaseRequestError(409, '23514'));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'database_conflict' });
});

test('only a paid event matching session, currency and amount commits', () => {
  assert.equal(applyPaymentEvent(order(), evt({ paymentStatus: 'unpaid' })).status, 'pending');
  for (const event of [evt({ sessionId: 'other' }), evt({ currency: 'jpy' }), evt({ amountTotal: 1 })]) assert.throws(() => applyPaymentEvent(order(), event), /payment_metadata_mismatch/);
  assert.equal(applyPaymentEvent(order(), evt()).status, 'paid');
});

test('event deduplication and late expiration cannot regress paid order', () => {
  const paid = applyPaymentEvent(order(), evt());
  assert.deepEqual(applyPaymentEvent(paid, evt()), paid);
  const expired = applyPaymentEvent(paid, evt({ eventId: 'evt_exp', eventType: 'checkout.session.expired', paymentStatus: 'unpaid' }));
  assert.equal(expired.status, 'paid');
  assert.equal(expired.stockReleased, undefined);
});

test('paid after a verified release requires review', () => {
  const released: OrderState = { ...order(), status: 'expired', stockReleased: true };
  assert.equal(applyPaymentEvent(released, evt()).status, 'review');
});

test('a later expiry preserves paid-after-release review', () => {
  const expired = applyPaymentEvent(order(), evt({ eventId: 'evt_exp_first', eventType: 'checkout.session.expired', paymentStatus: 'unpaid' }));
  const review = applyPaymentEvent(expired, evt({ eventId: 'evt_paid_late' }));
  const later = applyPaymentEvent(review, evt({ eventId: 'evt_exp_distinct', eventType: 'checkout.session.expired', paymentStatus: 'unpaid' }));
  assert.equal(later.status, 'review');
  assert.equal(later.stockReleased, true);
});

test('unattached events are retryable without consuming their event ID', () => {
  const unattached = { ...order(), checkoutSessionId: null };
  assert.throws(() => applyPaymentEvent(unattached, evt()), /checkout_attachment_pending/);
  assert.deepEqual(unattached.eventIds, []);
});

test('failed payments retain stock until verified expiry and may later succeed', () => {
  const failed = applyPaymentEvent(order(), evt({ eventType: 'checkout.session.async_payment_failed', paymentStatus: 'unpaid' }));
  assert.equal(failed.stockReleased, undefined);
  assert.equal(failed.checkoutUrl, null);
  assert.equal(applyPaymentEvent(failed, evt({ eventId: 'evt_success' })).status, 'paid');
  const expired = applyPaymentEvent(failed, evt({ eventId: 'evt_exp_failed', eventType: 'checkout.session.expired', paymentStatus: 'unpaid' }));
  assert.equal(expired.status, 'expired');
  assert.equal(expired.stockReleased, true);
});

