// Short-lived, tab-local draft, removed as soon as it is restored after sign-in.
export const BOOKING_DRAFT_KEY = 'designmusic.booking-draft';
export type BookingDraft = { instrument: string; service: string; slot: string; notes: string; savedAt: number };
export function readBookingDraft(raw: string | null, now = Date.now()): BookingDraft | null {
  try {
    if (!raw || raw.length > 16000) return null;
    const value = JSON.parse(raw);
    if (!value || !['soprano', 'alto', 'tenor', 'baritone', 'bassoon', 'other'].includes(value.instrument)
      || !['basic', 'standard', 'overhaul', 'assessment'].includes(value.service)
      || (value.instrument === 'bassoon' && value.service === 'basic')
      || typeof value.slot !== 'string' || !Number.isFinite(Date.parse(value.slot))
      || typeof value.notes !== 'string' || value.notes.length > 2000
      || !Number.isFinite(value.savedAt) || now < value.savedAt || now - value.savedAt > 30 * 60 * 1000) return null;
    return { instrument: value.instrument, service: value.service, slot: value.slot, notes: value.notes, savedAt: value.savedAt };
  } catch { return null; }
}
