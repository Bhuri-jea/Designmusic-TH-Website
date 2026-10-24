import test from 'node:test';
import assert from 'node:assert/strict';
import {groupBookingSlotsByDay,bookingDayKey,bookingCalendarSlots} from '../src/lib/booking.ts';

test('calendar slots are indexed by the date in Thailand across UTC midnight',()=>{
 const before={startAt:'2026-10-23T16:30:00Z'},after={startAt:'2026-10-23T17:00:00Z'};
 const days=groupBookingSlotsByDay([before,after]);
 assert.deepEqual(days.get('2026-10-23'),[before]);assert.deepEqual(days.get('2026-10-24'),[after]);
 assert.equal(bookingDayKey(after.startAt),'2026-10-24');
});
test('the rolling calendar is grouped once with every slot retained in its original order',()=>{
 const slots=bookingCalendarSlots(Date.parse('2026-10-24T03:00:00Z'));
 const days=groupBookingSlotsByDay(slots);
 assert.ok(slots.length>500);assert.deepEqual([...days.values()].flat(),slots);
 assert.deepEqual(groupBookingSlotsByDay([]),new Map());
});
