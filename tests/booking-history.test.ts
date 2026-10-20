import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveCancelledBooking } from '../src/lib/server/booking-history.ts';

const customerId = '22222222-2222-4222-8222-222222222222';
const bookingId = '33333333-3333-4333-8333-333333333333';
const customer = { id: customerId, googleSubject: 'subject', email: 'customer@example.test', name: 'Customer', phone: null, shippingAddress: null };
function fixture(status: string, owner = customerId) {
  const calls: string[] = [];
  const deps = {
    customer: async () => customer,
    select: async <T>() => [{ id: bookingId, customer_id: owner, status, archived_at: null }] as T[],
    rpc: async <T>(name: string) => { calls.push(name); return { id: bookingId, customerId, status: 'cancelled', archivedAt: '2026-10-21T00:00:00Z' } as T; },
  };
  return { deps, calls };
}

test('archive accepts a customer-owned cancelled booking through the soft archive RPC', async () => {
  const f = fixture('cancelled');
  const result = await archiveCancelledBooking(new Request('https://shop.test'), bookingId, f.deps);
  assert.deepEqual(result, { id: bookingId, archivedAt: '2026-10-21T00:00:00Z' });
  assert.deepEqual(f.calls, ['archive_cancelled_booking']);
});

test('archive rejects active bookings and does not call the archive RPC', async () => {
  const f = fixture('confirmed');
  await assert.rejects(archiveCancelledBooking(new Request('https://shop.test'), bookingId, f.deps), /booking_not_archivable/);
  assert.deepEqual(f.calls, []);
});

test('archive rejects records owned by another customer', async () => {
  const f = fixture('cancelled', '44444444-4444-4444-8444-444444444444');
  await assert.rejects(archiveCancelledBooking(new Request('https://shop.test'), bookingId, f.deps), /booking_not_found/);
  assert.deepEqual(f.calls, []);
});
