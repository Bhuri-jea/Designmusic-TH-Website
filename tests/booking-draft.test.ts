import test from 'node:test';
import assert from 'node:assert/strict';
import { readBookingDraft } from '../src/lib/booking-draft.ts';
const now = Date.parse('2026-10-17T10:00:00Z');
const draft = { instrument: 'alto', service: 'standard', slot: '2026-10-18T04:00:00Z', notes: 'Check pads', savedAt: now };
test('booking sign-in draft restores only validated service choices', () => {
  assert.deepEqual(readBookingDraft(JSON.stringify({ ...draft, customerId: 'untrusted' }), now), draft);
  assert.equal(readBookingDraft(JSON.stringify({ ...draft, notes: 'x'.repeat(2001) }), now), null);
  assert.equal(readBookingDraft('{', now), null);
  assert.equal(readBookingDraft(JSON.stringify({ ...draft, instrument: 'invalid' }), now), null);
  assert.equal(readBookingDraft(JSON.stringify({ ...draft, slot: 'invalid' }), now), null);
  assert.equal(readBookingDraft(JSON.stringify({ ...draft, instrument: 'bassoon', service: 'basic' }), now), null);
});
test('booking draft expires after thirty minutes and rejects future timestamps', () => {
  assert.equal(readBookingDraft(JSON.stringify(draft), now + 1800001), null);
  assert.equal(readBookingDraft(JSON.stringify(draft), now - 1), null);
});
