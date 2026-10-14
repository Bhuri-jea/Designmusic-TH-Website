import { bookingSlots, bookingUuid, validateBooking, BOOKING_TIME_ZONE, type BookingSlot } from '../booking.ts';
import { requireCustomer, type Customer } from './customer.ts';
import { rpc, select, SupabaseRequestError } from './supabase.ts';
import { HttpError } from './http.ts';
import { filterGoogleCalendarAvailability } from './outbox.ts';
import type { Locale } from '../catalog.ts';
export type BookingRecord = { id: string; customerId: string; requestKey: string; fingerprint: string; startAt: string; endAt: string; instrument: string; service: string; notes: string; locale: Locale; status: string; createdAt: string };
type BookingRow = { id: string; customer_id: string; start_at: string; end_at: string; instrument: string; service: string; notes: string; locale: Locale; status: string; created_at: string };
export type BookingDependencies = {
  now: () => number;
  customer: (request: Request) => Promise<Customer>;
  rpc: <T>(name: string, args: Record<string, unknown>) => Promise<T>;
  select: <T>(table: string, filters: Record<string, string>) => Promise<T[]>;
  calendarAvailability?: (slots: BookingSlot[]) => Promise<BookingSlot[] | null>;
};
export const bookingDependencies: BookingDependencies = { now: Date.now, customer: requireCustomer, rpc, select, calendarAvailability: filterGoogleCalendarAvailability };
function publicBooking(record: BookingRecord) {
  const { id, startAt, endAt, instrument, service, notes, locale, status, createdAt } = record;
  return { id, startAt, endAt, timeZone: BOOKING_TIME_ZONE, instrument, service, notes, locale, status, createdAt };
}
export async function createBooking(request: Request, body: Record<string, unknown>, deps = bookingDependencies) {
  const customer = await deps.customer(request);
  let validated;
  try { validated = await validateBooking(body, deps.now(), { checkWindow: false }); }
  catch { throw new HttpError(400, 'invalid_booking'); }
  const existingRequest = await deps.select<{ id: string }>('bookings', {
    customer_id: `eq.${customer.id}`, request_key: `eq.${validated.requestKey}`, limit: '1',
  });
  if (!existingRequest.length) {
    const availability = await bookingAvailability(deps);
    if (!availability.slots.some(slot => slot.startAt === validated.startAt)) throw new HttpError(409, 'booking_conflict');
  }
  let record: BookingRecord;
  try {
    record = await deps.rpc<BookingRecord>('create_booking', { p_customer_id: customer.id, p_request_key: validated.requestKey, p_fingerprint: validated.fingerprint, p_start_at: validated.startAt, p_end_at: validated.endAt, p_instrument: validated.instrument, p_service: validated.service, p_notes: validated.notes, p_locale: validated.locale });
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.status === 409) throw new HttpError(409, 'booking_conflict');
    if (error instanceof SupabaseRequestError && error.databaseCode === '22023') throw new HttpError(400, 'invalid_booking');
    throw error;
  }
  if (!record || record.customerId !== customer.id || record.requestKey !== validated.requestKey || record.fingerprint !== validated.fingerprint) throw new HttpError(409, 'booking_conflict');
  return publicBooking(record);
}
export async function ownedBookings(request: Request, id?: string, deps = bookingDependencies) {
  const customer = await deps.customer(request);
  if (id !== undefined && !bookingUuid(id)) throw new HttpError(400, 'invalid_booking_id');
  const rows = await deps.select<BookingRow>('bookings', { customer_id: `eq.${customer.id}`, ...(id ? { id: `eq.${id.toLowerCase()}` } : { order: 'start_at.desc', limit: '100' }) });
  if (id && !rows.length) throw new HttpError(404, 'booking_not_found');
  return rows.map(row => {
    if (row.customer_id !== customer.id) throw new HttpError(404, 'booking_not_found');
    return publicBooking({ id: row.id, customerId: row.customer_id, requestKey: '', fingerprint: '', startAt: row.start_at, endAt: row.end_at, instrument: row.instrument, service: row.service, notes: row.notes, locale: row.locale, status: row.status, createdAt: row.created_at });
  });
}
export async function bookingAvailability(deps = bookingDependencies) {
  const slots = bookingSlots(deps.now());
  const taken = await deps.select<{ start_at: string }>('bookings', {
    select: 'start_at', status: 'eq.confirmed', start_at: `lt.${slots.at(-1)!.endAt}`,
    end_at: `gt.${slots[0].startAt}`, limit: '100',
  });
  const occupied = new Set(taken.map(row => Date.parse(row.start_at)));
  const databaseAvailable = slots.filter(slot => !occupied.has(Date.parse(slot.startAt)));
  const calendarAvailable = deps.calendarAvailability ? await deps.calendarAvailability(databaseAvailable) : null;
  return {
    timeZone: BOOKING_TIME_ZONE,
    source: calendarAvailable === null ? 'database' : 'google-calendar',
    slots: calendarAvailable ?? databaseAvailable,
  };
}

function mutationError(error: unknown): never {
  if (error instanceof SupabaseRequestError) {
    if (error.status === 409) throw new HttpError(409, 'booking_conflict');
    if (error.databaseCode === '22023') throw new HttpError(400, 'invalid_booking');
    if (error.databaseCode === 'P0002') throw new HttpError(404, 'booking_not_found');
  }
  throw error;
}

export async function rescheduleBooking(request: Request, id: string, body: Record<string, unknown>, deps = bookingDependencies) {
  const customer = await deps.customer(request);
  if (!bookingUuid(id) || Object.keys(body).sort().join(',') !== 'changeKey,slot' ||
    !bookingUuid(body.changeKey) || typeof body.slot !== 'string') throw new HttpError(400, 'invalid_booking');
  const slot = bookingSlots(deps.now()).find(candidate => candidate.startAt === body.slot);
  if (!slot) throw new HttpError(400, 'invalid_booking');
  const booking = (await ownedBookings(request, id, deps))[0];
  if (booking.status !== 'confirmed' || Date.parse(booking.startAt) <= deps.now()) throw new HttpError(409, 'booking_not_modifiable');
  const availability = await bookingAvailability(deps);
  if (!availability.slots.some(candidate => candidate.startAt === slot.startAt)) throw new HttpError(409, 'booking_conflict');
  let updated: BookingRecord;
  try {
    updated = await deps.rpc<BookingRecord>('reschedule_booking', {
      p_customer_id: customer.id, p_booking_id: id.toLowerCase(), p_change_key: (body.changeKey as string).toLowerCase(),
      p_start_at: slot.startAt, p_end_at: slot.endAt,
    });
  } catch (error) { mutationError(error); }
  if (!updated || updated.id !== id.toLowerCase() || updated.customerId !== customer.id || updated.status !== 'confirmed') {
    throw new HttpError(409, 'booking_conflict');
  }
  return publicBooking(updated);
}

export async function cancelBooking(request: Request, id: string, deps = bookingDependencies) {
  const customer = await deps.customer(request);
  if (!bookingUuid(id)) throw new HttpError(400, 'invalid_booking_id');
  let updated: BookingRecord;
  try {
    updated = await deps.rpc<BookingRecord>('cancel_booking', {
      p_customer_id: customer.id, p_booking_id: id.toLowerCase(),
    });
  } catch (error) { mutationError(error); }
  if (!updated || updated.id !== id.toLowerCase() || updated.customerId !== customer.id || updated.status !== 'cancelled') {
    throw new HttpError(409, 'booking_conflict');
  }
  return publicBooking(updated);
}
