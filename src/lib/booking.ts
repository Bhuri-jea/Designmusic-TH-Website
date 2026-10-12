import { isSupportedLocale, type SupportedLocale } from './server/locales.ts';

export const bookingTimeZone = 'Asia/Bangkok';
const bookingHours = [10, 11, 13, 14, 15, 16, 17] as const;
const instruments = ['soprano', 'alto', 'tenor', 'baritone', 'bassoon', 'other'] as const;
const services = ['basic', 'standard', 'overhaul', 'assessment'] as const;

export type BookingInstrument = typeof instruments[number];
export type BookingService = typeof services[number];
export type BookingSlot = { startAt: string; endAt: string };
export type ValidatedBooking = BookingSlot & {
  requestKey: string;
  fingerprint: string;
  instrument: BookingInstrument;
  service: BookingService;
  notes: string;
  locale: SupportedLocale;
};

function localDate(now: number): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: bookingTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find(value => value.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

export function bookingSlots(now = Date.now()): BookingSlot[] {
  if (!Number.isFinite(now)) throw new Error('invalid_booking_time');
  const today = localDate(now);
  const slots: BookingSlot[] = [];
  for (let offset = 1; offset <= 14; offset++) {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    if (date.getUTCDay() === 0) continue;
    for (const hour of bookingHours) {
      const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour - 7);
      slots.push({ startAt: new Date(start).toISOString(), endAt: new Date(start + 60 * 60 * 1000).toISOString() });
    }
  }
  return slots;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function validateBooking(value: unknown, now = Date.now()): Promise<ValidatedBooking> {
  if (!isRecord(value) || Object.keys(value).some(key =>
    !['requestKey', 'slot', 'instrument', 'service', 'notes', 'locale'].includes(key))) {
    throw new Error('invalid_booking');
  }
  const { requestKey, slot, instrument, service } = value;
  const notes = value.notes === undefined ? '' : value.notes;
  const locale = value.locale === undefined ? 'en' : value.locale;
  if (!isUuid(requestKey) || typeof slot !== 'string' ||
      typeof instrument !== 'string' || !instruments.includes(instrument as BookingInstrument) ||
      typeof service !== 'string' || !services.includes(service as BookingService) ||
      instrument === 'bassoon' && service === 'basic' ||
      typeof notes !== 'string' || notes.length > 2000 ||
      typeof locale !== 'string' || !isSupportedLocale(locale)) {
    throw new Error('invalid_booking');
  }

  const selected = bookingSlots(now).find(candidate => candidate.startAt === slot);
  if (!selected) throw new Error('invalid_booking_slot');
  const canonical = {
    requestKey,
    startAt: selected.startAt,
    endAt: selected.endAt,
    instrument,
    service,
    notes: notes.trim(),
    locale,
  };
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(canonical)),
  );
  const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return { ...canonical, instrument: instrument as BookingInstrument, service: service as BookingService, locale, fingerprint };
}
