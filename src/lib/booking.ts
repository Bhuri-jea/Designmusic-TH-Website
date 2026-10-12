import type { Locale } from './catalog.ts';
export const BOOKING_TIME_ZONE = 'Asia/Bangkok';
export const instruments = ['soprano', 'alto', 'tenor', 'baritone', 'bassoon', 'other'] as const;
export const services = ['basic', 'standard', 'overhaul', 'assessment'] as const;
export type BookingSlot = { startAt: string; endAt: string };
export function bookingSlots(now = Date.now()): BookingSlot[] {
  const local = new Date(now + 7 * 3600000);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const slots: BookingSlot[] = [];
  for (let day = 1; day <= 14; day++) {
    const date = midnight + day * 86400000;
    if (new Date(date).getUTCDay() === 0) continue;
    for (const hour of [10, 11, 13, 14, 15, 16, 17]) {
      const start = date + (hour - 7) * 3600000;
      slots.push({ startAt: new Date(start).toISOString(), endAt: new Date(start + 3600000).toISOString() });
    }
  }
  return slots;
}
export function bookingUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export async function validateBooking(body: Record<string, unknown>, now = Date.now(), options: { checkWindow?: boolean } = {}) {
  const { requestKey, slot, instrument, service } = body;
  const locale = body.locale === undefined ? 'en' : body.locale;
  const notes = body.notes === undefined ? '' : body.notes;
  if (Object.keys(body).some(k => !['requestKey', 'slot', 'instrument', 'service', 'notes', 'locale'].includes(k)) ||
    !bookingUuid(requestKey) || typeof slot !== 'string' || typeof instrument !== 'string' ||
    !(instruments as readonly string[]).includes(instrument) || typeof service !== 'string' ||
    !(services as readonly string[]).includes(service) || instrument === 'bassoon' && service === 'basic' ||
    typeof locale !== 'string' || !['en', 'ja', 'zh-CN', 'th'].includes(locale) ||
    typeof notes !== 'string' || notes.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(notes)) throw Error('invalid_booking');
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(slot) || !Number.isFinite(Date.parse(slot))) throw Error('invalid_booking_slot');
  const startAt = new Date(slot).toISOString();
  if (startAt.slice(0, 19) !== slot.slice(0, 19)) throw Error('invalid_booking_slot');
  const endAt = new Date(Date.parse(slot) + 3600000).toISOString();
  if (options.checkWindow !== false && !bookingSlots(now).some(s => s.startAt === startAt)) throw Error('invalid_booking_slot');
  const normalized = { requestKey: requestKey.toLowerCase(), startAt, endAt, instrument, service, notes: notes.trim(), locale: locale as Locale };
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(['booking-v1', startAt, endAt, instrument, service, normalized.notes, locale])));
  const fingerprint = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
  return { ...normalized, fingerprint };
}
