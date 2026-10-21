import type { Locale } from './catalog.ts';
export const BOOKING_TIME_ZONE = 'Asia/Bangkok';
export const instruments = ['soprano', 'alto', 'tenor', 'baritone', 'bassoon', 'other'] as const;
export const services = ['basic', 'standard', 'overhaul', 'assessment'] as const;
export type BookingSlot = { startAt: string; endAt: string };
export type BookingSlotStatus = 'available' | 'booked' | 'contact_directly' | 'unavailable';
export type WeeklyBookingHours = Record<string, Record<string, 'available' | 'contact_directly'>>;
export type DailyBookingHours = Record<string, Record<string, 'available' | 'contact_directly'>>;
export function bookingDayHours(start: string, end: string): Record<string, 'available'> {
  if (!/^(0[8-9]|1[0-9]):(00|30)$/.test(start) || !/^(?:(0[8-9]|1[0-9]):(00|30)|20:00)$/.test(end) || start >= end) throw Error('invalid_booking_hours');
  const hours: Record<string, 'available'> = {};
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  for (let m = minutes(start); m < minutes(end); m += 30) hours[`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`] = 'available';
  return hours;
}
function bangkokDate(now: number) {
  const local = new Date(now + 7 * 3600000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}
function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
export function addCalendarMonths(date: Date, months: number) {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return first;
}
export function bookingDateWindow(now = Date.now()) {
  const today = bangkokDate(now);
  return { from: dateKey(today), to: dateKey(addCalendarMonths(today, 2)) };
}
export const DEFAULT_WEEKLY_BOOKING_HOURS: WeeklyBookingHours = Object.fromEntries(
  Array.from({ length: 5 }, (_, index) => [String(index + 1), Object.fromEntries(
    Array.from({ length: 20 }, (_, slot) => {
      const minutes = 8 * 60 + slot * 30;
      return [`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`, 'available'];
    }),
  )]),
) as WeeklyBookingHours;
export type BookingCalendarSlot = BookingSlot & { status: BookingSlotStatus };
export function bookingCalendarSlots(now = Date.now(), weeklyHours: WeeklyBookingHours = DEFAULT_WEEKLY_BOOKING_HOURS, dailyHours: DailyBookingHours = {}): BookingCalendarSlot[] {
  const window = bookingDateWindow(now);
  const first = Date.parse(`${window.from}T00:00:00Z`);
  const last = Date.parse(`${window.to}T00:00:00Z`);
  const slots: BookingCalendarSlot[] = [];
  for (let date = first; date <= last; date += 86400000) {
    const key = new Date(date).toISOString().slice(0, 10);
    const schedule = Object.hasOwn(dailyHours,key) ? dailyHours[key] : weeklyHours[String(new Date(date).getUTCDay())] ?? {};
    for (const [time, status] of Object.entries(schedule)) {
      if (status !== 'available' && status !== 'contact_directly') continue;
      const [hour, minute] = time.split(':').map(Number);
      const start = date + (hour - 7) * 3600000 + minute * 60000;
      const nextMinute = minute === 30 ? 0 : 30;
      const nextHour = minute === 30 ? hour + 1 : hour;
      const nextTime = `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
      const nextStatus = schedule[nextTime];
      // Each 30-minute entry describes the status of an appointment start.
      // The following half-hour only needs to be within opening hours for the
      // one-hour appointment to fit; its own status belongs to its own start.
      if (nextStatus !== 'available' && nextStatus !== 'contact_directly') continue;
      slots.push({ startAt: new Date(start).toISOString(), endAt: new Date(start + 3600000).toISOString(), status });
    }
  }
  return slots.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}
export function bookingSlots(now = Date.now(), weeklyHours: WeeklyBookingHours = DEFAULT_WEEKLY_BOOKING_HOURS, dailyHours: DailyBookingHours = {}): BookingSlot[] {
  return bookingCalendarSlots(now, weeklyHours, dailyHours).filter(slot => slot.status === 'available' && Date.parse(slot.startAt) > now).map(({ startAt, endAt }) => ({ startAt, endAt }));
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
