import { bookingSlots, validateBooking } from '../booking.ts';
import type { BookingInstrument, BookingService, ValidatedBooking } from '../booking.ts';
import { requireCustomer, type Customer } from './customer.ts';
import { HttpError } from './http.ts';
import { rpc, select } from './supabase.ts';

type BookingRecord = {
  id: string;
  customerId?: string;
  customer_id?: string;
  requestKey?: string;
  fingerprint?: string;
  startAt?: string;
  start_at?: string;
  endAt?: string;
  end_at?: string;
  instrument: BookingInstrument;
  service: BookingService;
  notes: string;
  locale: string;
  status: string;
  createdAt?: string;
  created_at?: string;
};

export type BookingDependencies = {
  now: () => number;
  customer: (request: Request) => Promise<Customer>;
  rpc: <T>(name: string, args: Record<string, unknown>) => Promise<T>;
  select: <T>(table: string, filters: Record<string, string>) => Promise<T[]>;
};

export const bookingDependencies: BookingDependencies = {
  now: Date.now,
  customer: requireCustomer,
  rpc,
  select,
};

function publicBooking(value: unknown) {
  const row = (Array.isArray(value) ? value[0] : value) as BookingRecord | null;
  if (!row || typeof row.id !== 'string' || typeof row.instrument !== 'string' ||
      typeof row.service !== 'string' || typeof row.notes !== 'string' ||
      typeof row.locale !== 'string' || typeof row.status !== 'string') {
    throw new Error('booking_record_invalid');
  }
  return {
    id: row.id,
    startAt: row.startAt ?? row.start_at,
    endAt: row.endAt ?? row.end_at,
    instrument: row.instrument,
    service: row.service,
    notes: row.notes,
    locale: row.locale,
    status: row.status,
    createdAt: row.createdAt ?? row.created_at,
  };
}

export async function createBooking(
  request: Request,
  body: unknown,
  deps: BookingDependencies = bookingDependencies,
) {
  const customer = await deps.customer(request);
  let booking: ValidatedBooking;
  try {
    booking = await validateBooking(body, deps.now());
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_booking_slot') {
      throw new HttpError(409, 'booking_slot_unavailable');
    }
    throw new HttpError(400, 'invalid_booking');
  }
  const result = await deps.rpc<BookingRecord>('create_booking', {
    p_customer_id: customer.id,
    p_request_key: booking.requestKey,
    p_fingerprint: booking.fingerprint,
    p_start_at: booking.startAt,
    p_end_at: booking.endAt,
    p_instrument: booking.instrument,
    p_service: booking.service,
    p_notes: booking.notes,
    p_locale: booking.locale,
  });
  const record = publicBooking(result);
  if (record.startAt !== booking.startAt || record.endAt !== booking.endAt) {
    throw new HttpError(409, 'booking_request_conflict');
  }
  return record;
}

export async function ownedBookings(
  request: Request,
  id?: string,
  deps: BookingDependencies = bookingDependencies,
) {
  const customer = await deps.customer(request);
  if (id !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, 'invalid_booking_id');
  }
  const rows = await deps.select<BookingRecord>('bookings', {
    customer_id: `eq.${customer.id}`,
    ...(id ? { id: `eq.${id}` } : { order: 'created_at.desc', limit: '100' }),
  });
  if (id && rows.length === 0) throw new HttpError(404, 'booking_not_found');
  return rows.map(publicBooking);
}

export function availableBookings(now = Date.now()) {
  return { timeZone: 'Asia/Bangkok', slots: bookingSlots(now) };
}
