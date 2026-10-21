import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingSlots, bookingCalendarSlots, bookingDateWindow, bookingDayHours, DEFAULT_WEEKLY_BOOKING_HOURS, validateBooking, type DailyBookingHours } from '../src/lib/booking.ts';
import { bookingAvailability, cancelBooking, createBooking, ownedBookings, rescheduleBooking, type BookingDependencies } from '../src/lib/server/bookings.ts';
const key = '22222222-2222-4222-8222-222222222222';
const now = Date.parse('2026-10-12T16:59:59Z'); // 23:59:59 Monday Bangkok
const body = { requestKey: key, slot: '2026-10-13T03:00:00.000Z', instrument: 'alto', service: 'basic', notes: '  careful  ', locale: 'ja' };
test('weekly opening range generates half-hours with an exclusive closing time', () => {
  assert.deepEqual(bookingDayHours('08:00','18:00'), DEFAULT_WEEKLY_BOOKING_HOURS['1']);
  assert.deepEqual(bookingDayHours('17:00','18:00'), {'17:00':'available','17:30':'available'});
  for (const [from,to] of [['18:00','08:00'],['08:15','18:00'],['07:00','18:00'],['08:00','20:30']]) assert.throws(()=>bookingDayHours(from,to));
});
test('Bangkok tomorrow rolls over at local midnight; rolling two-month window exposes half-hour starts', () => {
  const slots = bookingSlots(now);
  assert.equal(slots[0].startAt, '2026-10-13T01:00:00.000Z');
  assert.equal(slots.at(-1)?.startAt, '2026-12-11T10:00:00.000Z');
  assert.equal(slots.length, 836);
  assert.equal(bookingSlots(now + 1000)[0].startAt, '2026-10-13T01:00:00.000Z');
  assert.deepEqual(bookingDateWindow(now), { from: '2026-10-12', to: '2026-12-12' });
  for (const s of slots) assert.equal(Date.parse(s.endAt) - Date.parse(s.startAt), 3600000);
});
test('calendar month bounds include today and clamp month-end dates in Bangkok', () => {
  assert.deepEqual(bookingDateWindow(Date.parse('2026-10-31T12:00:00Z')), { from: '2026-10-31', to: '2026-12-31' });
  assert.deepEqual(bookingDateWindow(Date.parse('2026-12-31T12:00:00Z')), { from: '2026-12-31', to: '2027-02-28' });
  const today = Date.parse('2026-10-20T12:00:00Z'); // 19:00 Bangkok: day remains editable, starts are too early to book.
  const calendar = bookingCalendarSlots(today);
  assert.ok(calendar.some(slot => slot.startAt === '2026-10-20T01:00:00.000Z'));
  assert.ok(calendar.some(slot => slot.startAt === '2026-12-18T10:00:00.000Z'));
  assert.ok(!calendar.some(slot => slot.startAt.startsWith('2026-12-21')));
  assert.ok(bookingSlots(today).every(slot => Date.parse(slot.startAt) > today));
});
test('booking canonical IDs, strict schema, notes bounds and locale determine fingerprint', async () => {
  const valid = await validateBooking(body, now);
  assert.equal(valid.notes, 'careful');
  assert.equal(valid.locale, 'ja');
  assert.equal((await validateBooking({ ...body, locale: undefined }, now)).locale, 'en');
  assert.equal(valid.fingerprint, (await validateBooking({ ...body, notes: 'careful' }, now)).fingerprint);
  assert.notEqual(valid.fingerprint, (await validateBooking({ ...body, locale: 'th' }, now)).fingerprint);
  for (const patch of [{ requestKey: 'bad' }, { instrument: 'Alto' }, { instrument: ['alto'] }, { service: 'Basic' }, { instrument: 'bassoon', service: 'basic' }, { locale: 'xx' }, { notes: 'x'.repeat(2001) }, { customerId: key }, { email: 'attacker@example.test' }, { slot: '2026-10-12T03:00:00Z' }, { slot: '2026-10-18T03:00:00Z' }, { slot: '2027-01-12T03:00:00Z' }, { slot: '2026-10-13T19:00:00Z' }, { slot: '2026-10-13T03:00:01Z' }])
    await assert.rejects(validateBooking({ ...body, ...patch }, now));
});
function fixture() {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const customer = { id: key, googleSubject: 'google-stable', email: 'server@example.test', name: 'Name', phone: null, shippingAddress: null };
  const deps: BookingDependencies = { now: () => now, customer: async () => customer,
    rpc: async <T>(name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { id: key, customerId: key, requestKey: key, fingerprint: args.p_fingerprint, startAt: body.slot, endAt: '2026-10-13T04:00:00.000Z', instrument: 'alto', service: 'basic', notes: 'careful', locale: 'ja', status: 'confirmed', createdAt: '2026-10-12T00:00:00Z' } as T; },
    select: async <T>(_table: string, filters: Record<string, string>) => {
      if (filters.request_key) return [] as T[];
      if (filters.select === 'start_at,end_at') return [] as T[];
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
    filters.select === 'start_at,end_at' ? [{ start_at: body.slot, end_at: '2026-10-13T04:00:00.000Z' }] as T[] : [];
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
    filters.request_key ? [{ id: key }] as T[] : filters.select === 'start_at,end_at' ? [] as T[] : [];
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
test('admin availability remains editable when Google fails, while public availability fails closed', async () => {
  const f = fixture();
  f.deps.calendarAvailability = async () => { throw Error('transport_http_503'); };
  const admin = await bookingAvailability(f.deps, { googleFailure: 'unavailable' });
  assert.equal(admin.source, 'unavailable');
  assert.equal(admin.availabilityError, 'google_calendar_unavailable');
  assert.ok(admin.calendarSlots.some(slot => slot.status === 'unavailable'));
  assert.deepEqual(admin.slots, []);
  await assert.rejects(bookingAvailability(f.deps), /transport_http_503/);
});
test('public calendar omits past starts, admin calendar retains today, and database range ends after the final Bangkok day', async () => {
  const f = fixture();
  f.deps.calendarAvailability = async slots => slots;
  let filtersSeen: Record<string, string> = {};
  f.deps.select = async <T>(_table: string, filters: Record<string, string>) => {
    filtersSeen = filters;
    return [] as T[];
  };
  const publicResult = await bookingAvailability(f.deps);
  assert.equal(publicResult.from, '2026-10-12');
  assert.equal(publicResult.to, '2026-12-12');
  assert.ok(publicResult.calendarSlots.every(slot => Date.parse(slot.startAt) > now));
  assert.equal(filtersSeen.start_at, 'lt.2026-12-12T17:00:00.000Z');
  const adminResult = await bookingAvailability(f.deps, { includePast: true });
  assert.ok(adminResult.calendarSlots.some(slot => slot.startAt.startsWith('2026-10-12')));
});
test('owned booking reads filter stable customer; malformed ID and missing owned record fail', async () => {
  const f = fixture();
  assert.equal((await ownedBookings(new Request('https://shop.test'), undefined, f.deps)).length, 1);
  let newestOrder = '';
  f.deps.select = async <T>(_table: string, filters: Record<string, string>) => {
    newestOrder = filters.order;
    return [{ id: key, customer_id: key, archived_at: null, start_at: body.slot, end_at: '2026-10-13T04:00:00Z', instrument: 'alto', service: 'basic', notes: 'careful', locale: 'ja', status: 'confirmed', created_at: '2026-10-12T00:00:00Z' }] as T[];
  };
  assert.equal((await ownedBookings(new Request('https://shop.test'), undefined, f.deps)).length, 1);
  assert.equal(newestOrder, 'created_at.desc');
  let archivedFilter = '';
  f.deps.select = async <T>(_table: string, filters: Record<string, string>) => {
    archivedFilter = filters.archived_at;
    return [] as T[];
  };
  assert.deepEqual(await ownedBookings(new Request('https://shop.test'), undefined, f.deps), []);
  assert.equal(archivedFilter, 'is.null');
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
      if (filters.select === 'start_at,end_at') return [] as T[];
      return [{ id: key, customer_id: key, archived_at: null, start_at: body.slot, end_at: '2026-10-13T04:00:00Z', instrument: 'alto', service: 'basic', notes: 'careful', locale: 'ja', status: 'confirmed', created_at: '2026-10-12T00:00:00Z' }] as T[];
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

test('reschedule retries can reach the idempotent RPC after their new slot becomes occupied', async () => {
  const nextSlot = '2026-10-13T04:00:00.000Z';
  let currentSlot = body.slot;
  let availabilityChecks = 0;
  let rpcCalls = 0;
  const deps: BookingDependencies = {
    now: () => now,
    customer: async () => ({ id: key, googleSubject: 'google-stable', email: 'server@example.test', name: 'Name', phone: null, shippingAddress: null }),
    select: async <T>(_table: string, filters: Record<string, string>) => {
      if (filters.select === 'start_at,end_at') return [{ start_at: currentSlot, end_at: new Date(Date.parse(currentSlot) + 3600000).toISOString() }] as T[];
      return [{ id: key, customer_id: key, start_at: currentSlot, end_at: new Date(Date.parse(currentSlot) + 3600000).toISOString(), instrument: 'alto', service: 'basic', notes: '', locale: 'en', status: 'confirmed', created_at: '2026-10-12T00:00:00Z' }] as T[];
    },
    calendarAvailability: async slots => { availabilityChecks++; return slots; },
    rpc: async <T>(_name: string, args: Record<string, unknown>) => {
      rpcCalls++;
      if (rpcCalls === 1) currentSlot = (args.p_start_at as string).replace('.000Z', '+00:00');
      return { id: key, customerId: key, requestKey: key, fingerprint: '', startAt: currentSlot,
        endAt: new Date(Date.parse(currentSlot) + 3600000).toISOString(), instrument: 'alto', service: 'basic', notes: '', locale: 'en', status: 'confirmed', createdAt: '2026-10-12T00:00:00Z' } as T;
    },
  };
  const request = new Request('https://shop.test');
  const change = { changeKey: key, slot: nextSlot };
  assert.equal(Date.parse((await rescheduleBooking(request, key, change, deps)).startAt), Date.parse(nextSlot));
  assert.equal(Date.parse((await rescheduleBooking(request, key, change, deps)).startAt), Date.parse(nextSlot));
  assert.equal(availabilityChecks, 1);
  assert.equal(rpcCalls, 2);
  await assert.rejects(rescheduleBooking(request, key, { changeKey: key, slot: body.slot }, deps), /booking_conflict/);
});

test('reschedule validates database timestamps by instant while rejecting different times', async () => {
  const f = fixture();
  const nextSlot = bookingSlots(now)[1];
  f.deps.rpc = async <T>() => ({ id: key, customerId: key, status: 'confirmed',
    startAt: nextSlot.startAt.replace('.000Z', '+00:00'),
    endAt: nextSlot.endAt.replace('.000Z', '+00:00'),
  }) as T;
  const request = new Request('https://shop.test');
  const change = { changeKey: key, slot: nextSlot.startAt };
  assert.equal(Date.parse((await rescheduleBooking(request, key, change, f.deps)).endAt), Date.parse(nextSlot.endAt));
  for (const patch of [{ startAt: body.slot }, { endAt: body.slot }, { startAt: 'invalid' }, { customerId: 'foreign' }]) {
    f.deps.rpc = async <T>() => ({ id: key, customerId: key, status: 'confirmed', ...nextSlot, ...patch }) as T;
    await assert.rejects(rescheduleBooking(request, key, change, f.deps), /booking_conflict/);
  }
});

test('date overrides change only the selected day and an empty override closes it',()=>{const overrides:DailyBookingHours={'2026-10-13':{},'2026-10-14':{'12:00':'available','12:30':'available','13:00':'contact_directly','13:30':'contact_directly'}};const slots=bookingCalendarSlots(now,DEFAULT_WEEKLY_BOOKING_HOURS,overrides);assert.equal(slots.some(s=>s.startAt.startsWith('2026-10-13')),false);const day=slots.filter(s=>s.startAt.startsWith('2026-10-14'));assert.deepEqual(day.map(s=>s.startAt.slice(11,16)),['05:00','05:30','06:00']);assert.equal(day[2].status,'contact_directly');assert.ok(slots.some(s=>s.startAt==='2026-10-15T01:00:00.000Z'));});
