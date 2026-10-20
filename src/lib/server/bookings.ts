import { bookingCalendarSlots, bookingDateWindow, bookingSlots, bookingUuid, validateBooking, BOOKING_TIME_ZONE, DEFAULT_WEEKLY_BOOKING_HOURS, type BookingSlot, type BookingSlotStatus, type WeeklyBookingHours, type DailyBookingHours } from '../booking.ts';
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
  weeklyHours?: () => Promise<WeeklyBookingHours>;
  dailyHours?: () => Promise<DailyBookingHours>;
  calendarAvailability?: (slots: BookingSlot[]) => Promise<BookingSlot[] | null>;
};
export const bookingDependencies: BookingDependencies = { now: Date.now, customer: requireCustomer, rpc, select, weeklyHours: () => rpc<WeeklyBookingHours>('booking_weekly_hours', {}), dailyHours:()=>rpc<DailyBookingHours>('booking_date_hours',{}), calendarAvailability: filterGoogleCalendarAvailability };
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
  const rows = await deps.select<BookingRow>('bookings', { customer_id: `eq.${customer.id}`, archived_at: 'is.null', ...(id ? { id: `eq.${id.toLowerCase()}` } : { order: 'created_at.desc', limit: '100' }) });
  if (id && !rows.length) throw new HttpError(404, 'booking_not_found');
  return rows.map(row => {
    if (row.customer_id !== customer.id) throw new HttpError(404, 'booking_not_found');
    return publicBooking({ id: row.id, customerId: row.customer_id, requestKey: '', fingerprint: '', startAt: row.start_at, endAt: row.end_at, instrument: row.instrument, service: row.service, notes: row.notes, locale: row.locale, status: row.status, createdAt: row.created_at });
  });
}
export async function bookingAvailability(deps = bookingDependencies, options: { googleFailure?: 'throw' | 'unavailable'; includePast?: boolean } = {}) {
  const weeklyHours = deps.weeklyHours ? await deps.weeklyHours() : DEFAULT_WEEKLY_BOOKING_HOURS;
  const dailyHours=deps.dailyHours?await deps.dailyHours():{};
  const calendarOptions = bookingCalendarSlots(deps.now(), weeklyHours, dailyHours);
  const window = bookingDateWindow(deps.now());
  const startAt = options.includePast ? new Date(Date.parse(`${window.from}T00:00:00Z`)-7*3600000).toISOString() : new Date(deps.now()).toISOString();
  const endAt = new Date(Date.parse(`${window.to}T00:00:00Z`) - 7 * 3600000 + 86400000).toISOString();
  const taken = await deps.select<{ start_at: string; end_at: string }>('bookings', {
    select: 'start_at,end_at', status: 'eq.confirmed', start_at: `lt.${endAt}`,
    end_at: `gt.${startAt}`, limit: '1000',
  });
  const withBooking = calendarOptions.map(slot => taken.some(row => Date.parse(row.start_at) < Date.parse(slot.endAt) && Date.parse(row.end_at) > Date.parse(slot.startAt))
    ? { ...slot, status: 'booked' as BookingSlotStatus } : slot);
  const candidates = withBooking.filter(slot => slot.status === 'available' && Date.parse(slot.startAt) > deps.now());
  const calendarChecks = withBooking.filter(slot => Date.parse(slot.startAt) > deps.now() && (slot.status === 'available' || slot.status === 'contact_directly'));
  let calendarAvailable: BookingSlot[] | null;
  let calendarFailed = false;
  try { calendarAvailable = deps.calendarAvailability ? await deps.calendarAvailability(calendarChecks) : null; }
  catch (error) {
    if (options.googleFailure !== 'unavailable') throw error;
    calendarAvailable = [];
    calendarFailed = true;
  }
  const availableStarts = new Set(calendarAvailable?.map(slot => slot.startAt));
  const fullCalendarSlots = withBooking.map(slot => (slot.status === 'available' || slot.status === 'contact_directly') && calendarAvailable !== null && Date.parse(slot.startAt) > deps.now() && !availableStarts.has(slot.startAt)
    ? { ...slot, status: 'unavailable' as BookingSlotStatus } : slot);
  for (const booking of taken) if (!fullCalendarSlots.some(slot => slot.startAt === booking.start_at)) {
    fullCalendarSlots.push({ startAt: booking.start_at, endAt: booking.end_at, status: 'booked' });
  }
  fullCalendarSlots.sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
  const calendarSlots = options.includePast ? fullCalendarSlots : fullCalendarSlots.filter(slot => Date.parse(slot.startAt) > deps.now());
  const bookable = calendarAvailable === null ? candidates : candidates.filter(slot => availableStarts.has(slot.startAt));
  return {
    timeZone: BOOKING_TIME_ZONE,
    ...window,
    source: calendarFailed ? 'unavailable' : calendarAvailable === null ? 'database' : 'google-calendar',
    availabilityError: calendarFailed ? 'google_calendar_unavailable' : null,
    slots: bookable,
    calendarSlots,
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
  const weeklyHours = deps.weeklyHours ? await deps.weeklyHours() : DEFAULT_WEEKLY_BOOKING_HOURS;
  const dailyHours=deps.dailyHours?await deps.dailyHours():{};
  const slot = bookingSlots(deps.now(), weeklyHours, dailyHours).find(candidate => candidate.startAt === body.slot);
  if (!slot) throw new HttpError(400, 'invalid_booking');
  const booking = (await ownedBookings(request, id, deps))[0];
  if (booking.status !== 'confirmed' || Date.parse(booking.startAt) <= deps.now()) throw new HttpError(409, 'booking_not_modifiable');
  // PostgreSQL JSON uses offsets such as +00:00; generated slots use ISO Z.
  // Compare instants so a successful write/retry is not reported as occupied.
  if (Date.parse(booking.startAt) !== Date.parse(slot.startAt)) {
    const availability = await bookingAvailability(deps);
    if (!availability.slots.some(candidate => candidate.startAt === slot.startAt)) throw new HttpError(409, 'booking_conflict');
  }
  let updated: BookingRecord;
  try {
    updated = await deps.rpc<BookingRecord>('reschedule_booking', {
      p_customer_id: customer.id, p_booking_id: id.toLowerCase(), p_change_key: (body.changeKey as string).toLowerCase(),
      p_start_at: slot.startAt, p_end_at: slot.endAt,
    });
  } catch (error) { mutationError(error); }
  if (!updated || updated.id !== id.toLowerCase() || updated.customerId !== customer.id || updated.status !== 'confirmed' ||
    Date.parse(updated.startAt) !== Date.parse(slot.startAt) || Date.parse(updated.endAt) !== Date.parse(slot.endAt)) {
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
