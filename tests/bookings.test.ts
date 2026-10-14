import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingSlots, validateBooking } from '../src/lib/booking.ts';
import { bookingAvailability, cancelBooking, createBooking, ownedBookings, rescheduleBooking, type BookingDependencies } from '../src/lib/server/bookings.ts';
const key = '22222222-2222-4222-8222-222222222222';
const now = Date.parse('2026-10-12T16:59:59Z'); // 23:59:59 Monday Bangkok
const body = { requestKey: key, slot: '2026-10-13T03:00:00.000Z', instrument: 'alto', service: 'basic', notes: '  careful  ', locale: 'ja' };
test('Bangkok tomorrow rolls over at local midnight; fourteen days excludes Sunday', () => {
  const slots = bookingSlots(now);
  assert.equal(slots[0].startAt, body.slot);
  assert.equal(slots.at(-1)?.startAt, '2026-10-26T10:00:00.000Z');
  assert.equal(slots.length, 84);
  assert.equal(bookingSlots(now + 1000)[0].startAt, '2026-10-14T03:00:00.000Z');
  for (const s of slots) assert.equal(Date.parse(s.endAt) - Date.parse(s.startAt), 3600000);
});
test('booking canonical IDs, strict schema, notes bounds and locale determine fingerprint', async () => {
  const valid = await validateBooking(body, now);
  assert.equal(valid.notes, 'careful');
  assert.equal(valid.locale, 'ja');
  assert.equal((await validateBooking({ ...body, locale: undefined }, now)).locale, 'en');
  assert.equal(valid.fingerprint, (await validateBooking({ ...body, notes: 'careful' }, now)).fingerprint);
  assert.notEqual(valid.fingerprint, (await validateBooking({ ...body, locale: 'th' }, now)).fingerprint);
  for (const patch of [{ requestKey: 'bad' }, { instrument: 'Alto' }, { instrument: ['alto'] }, { service: 'Basic' }, { instrument: 'bassoon', service: 'basic' }, { locale: 'xx' }, { notes: 'x'.repeat(2001) }, { customerId: key }, { email: 'attacker@example.test' }, { slot: '2026-10-12T03:00:00Z' }, { slot: '2026-10-18T03:00:00Z' }, { slot: '2026-10-27T03:00:00Z' }, { slot: '2026-10-13T05:00:00Z' }, { slot: '2026-10-13T03:00:01Z' }])
    await assert.rejects(validateBooking({ ...body, ...patch }, now));
});
function fixture() {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const customer = { id: key, googleSubject: 'google-stable', email: 'server@example.test', name: 'Name', phone: null, shippingAddress: null };
  const deps: BookingDependencies = { now: () => now, customer: async () => customer,
    rpc: async <T>(name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { id: key, customerId: key, requestKey: key, fingerprint: args.p_fingerprint, startAt: body.slot, endAt: '2026-10-13T04:00:00.000Z', instrument: 'alto', service: 'basic', notes: 'careful', locale: 'ja', status: 'confirmed', createdAt: '2026-10-12T00:00:00Z' } as T; },
    select: async <T>(_table: string, filters: Record<string, string>) => {
      if (filters.request_key) return [] as T[];
      if (filters.select === 'start_at') return [] as T[];
      assert.equal(filters.customer_id, `eq.${key}`);
      return [{ id: key, customer_id: key, start_at: body.slot, end_at: '2026-10-13T04:00:00Z', instrument: 'alto', service: 'basic', notes: 'careful', locale: 'ja', status: 'confirmed', created_at: '2026-10-12T00:00:00Z' }] as T[];
    } };
  return { calls, deps };
}
test('creation resolves stable server customer and passes validated immutable locale to one atomic RPC', async () => {
  const f = fixture();
  const result = await createBooking(new Request('https://shop.test'), body, f.deps);
  assert.equal(result.id, key);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].name, 'create_booking');
  assert.equal(f.calls[0].args.p_customer_id, key);
  assert.equal(f.calls[0].args.p_locale, 'ja');
  assert.equal('customerId' in result, false);
  assert.equal('fingerprint' in result, false);
});
test('creation rejects a slot taken in the database or Google Calendar before reserving it', async () => {
  const databaseBusy = fixture();
  databaseBusy.deps.select = async <T>(_table: string, filters: Record<string, string>) =>
    filters.select === 'start_at' ? [{ start_at: body.slot }] as T[] : [];
  await assert.rejects(createBooking(new Request('https://shop.test'), body, databaseBusy.deps), /booking_conflict/);
  assert.equal(databaseBusy.calls.length, 0);

  const calendarBusy = fixture();
  calendarBusy.deps.calendarAvailability = async () => [];
  await assert.rejects(createBooking(new Request('https://shop.test'), body, calendarBusy.deps), /booking_conflict/);
  assert.equal(calendarBusy.calls.length, 0);
});
test('an identical booking retry reaches the database idempotency check without rechecking its occupied slot', async () => {
  const f = fixture();
  f.deps.select = async <T>(_table: string, filters: Record<string, string>) =>
    filters.request_key ? [{ id: key }] as T[] : [];
  f.deps.calendarAvailability = async () => { throw Error('availability must not be queried for an idempotent retry'); };
  const result = await createBooking(new Request('https://shop.test'), body, f.deps);
  assert.equal(result.id, key);
  assert.equal(f.calls[0].name, 'create_booking');
});
test('availability reports whether the result came from Google Calendar', async () => {
  const f = fixture();
  f.deps.calendarAvailability = async slots => slots.slice(1);
  const result = await bookingAvailability(f.deps);
  assert.equal(result.source, 'google-calendar');
  assert.equal(result.slots[0].startAt, bookingSlots(now)[1].startAt);
});
test('owned booking reads filter stable customer; malformed ID and missing owned record fail', async () => {
  const f = fixture();
  assert.equal((await ownedBookings(new Request('https://shop.test'), undefined, f.deps)).length, 1);
  await assert.rejects(ownedBookings(new Request('https://shop.test'), 'bad', f.deps));
  f.deps.select = async () => [];
  await assert.rejects(ownedBookings(new Request('https://shop.test'), key, f.deps), /booking_not_found/);
});

test('rescheduling uses current availability and cancellation stays owner-scoped and idempotent', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const nextSlot = '2026-10-13T04:00:00.000Z';
  const deps: BookingDependencies = {
    now: () => now,
    customer: async () => ({ id: key, googleSubject: 'google-stable', email: 'server@example.test', name: 'Name', phone: null, shippingAddress: null }),
    select: async <T>(_table: string, filters: Record<string, string>) => {
      if (filters.request_key) return [] as T[];
      if (filters.select === 'start_at') return [] as T[];
      return [{ id: key, customer_id: key, start_at: body.slot, end_at: '2026-10-13T04:00:00Z', instrument: 'alto', service: 'basic', notes: 'careful', locale: 'ja', status: 'confirmed', created_at: '2026-10-12T00:00:00Z' }] as T[];
    },
    calendarAvailability: async slots => slots,
    rpc: async <T>(name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return {
        id: key, customerId: key, requestKey: key, fingerprint: 'a'.repeat(64),
        startAt: name === 'reschedule_booking' ? args.p_start_at : body.slot,
        endAt: name === 'reschedule_booking' ? args.p_end_at : '2026-10-13T04:00:00.000Z',
        instrument: 'alto', service: 'basic', notes: 'careful', locale: 'ja',
        status: name === 'cancel_booking' ? 'cancelled' : 'confirmed', createdAt: '2026-10-12T00:00:00Z',
      } as T;
    },
  };
  const request = new Request('https://shop.test');
  const moved = await rescheduleBooking(request, key, { changeKey: key, slot: nextSlot }, deps);
  assert.equal(moved.startAt, nextSlot);
  assert.equal(calls[0].name, 'reschedule_booking');
  assert.equal(calls[0].args.p_customer_id, key);
  const cancelled = await cancelBooking(request, key, deps);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(calls[1].name, 'cancel_booking');
  assert.equal(calls[1].args.p_customer_id, key);
  await assert.rejects(rescheduleBooking(request, key, { changeKey: 'bad', slot: nextSlot }, deps), /invalid_booking/);
});
