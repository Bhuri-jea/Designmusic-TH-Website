import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const id = '22222222-2222-4222-8222-222222222222';
const payload = { reportSecret: 'secret', bookingId: id, startAt: '2026-10-13T03:00:00Z', endAt: '2026-10-13T04:00:00Z', timeZone: 'Asia/Bangkok', customer: { name: '=SUM(A1)', email: 'buyer@example.test', phone: '+123' }, instrument: 'alto', service: 'basic', notes: '  @malicious', status: 'confirmed', version: 1 };
function fixture() {
 const rows: unknown[][] = [];
 const pendingRows = new Map<number, unknown[]>();
 const operations: string[] = [];
 const events = new Map<string, any>();
 let locked = false, calendarFails = false, sheetFails = false, flushFails = false, insertions = 0, permitLock = true;
 const visibleRows = () => { const visible = rows.slice(); pendingRows.forEach((value, row) => visible[row] = value); return visible; };
 const sheet = { getLastRow: () => visibleRows().length, getRange: (row: number, column: number, count: number, width: number) => ({
   getValues: () => visibleRows().slice(row - 1, row - 1 + count).map(value => value.slice(column - 1, column - 1 + width)),
   setValues: (values: unknown[][]) => { assert.equal(locked, true); if (sheetFails) throw Error('sheet failed'); operations.push('write'); values.forEach((v, i) => { const cells = [...(visibleRows()[row - 1 + i] ?? [])]; v.forEach((cell, offset) => cells[column - 1 + offset] = cell); pendingRows.set(row - 1 + i, cells); }); },
 }) };
 const context = vm.createContext({
   PropertiesService: { getScriptProperties: () => ({ getProperty: (name: string) => ({ BOOKING_REPORT_SECRET: 'secret', SPREADSHEET_ID: 'sheet', CALENDAR_ID: 'calendar' } as Record<string,string>)[name] }) },
   ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (text: string) => { operations.push(JSON.parse(text).ok ? 'ack:true' : 'ack:false'); return { text, setMimeType() { return this; } }; } },
   LockService: { getScriptLock: () => ({ tryLock: () => { locked = permitLock; return permitLock; }, releaseLock: () => { assert.equal(locked,true); operations.push('release'); locked = false; } }) },
   SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }), flush: () => { assert.equal(locked,true); operations.push('flush'); if (flushFails) throw Error('flush failed'); pendingRows.forEach((value, row) => rows[row] = value); pendingRows.clear(); } },
   Calendar: { Events: { get: (_calendar: string, eventId: string) => { assert.equal(locked,true); operations.push('calendar'); if (!events.has(eventId)) throw Error('404 Not Found'); return events.get(eventId); },
     insert: (event: any, calendar: string, options: any) => { assert.equal(locked,true); assert.equal(calendar,'calendar'); assert.equal(options.sendUpdates,'none'); assert.equal(event.visibility,'private'); assert.equal('attendees' in event,false); if(calendarFails) throw Error('calendar failed'); insertions++; events.set(event.id,event); return event; },
     patch: (event: any, calendar: string, eventId: string, options: any) => { assert.equal(locked,true); assert.equal(calendar,'calendar'); assert.equal(options.sendUpdates,'none'); if(calendarFails) throw Error('calendar failed'); events.set(eventId,{...events.get(eventId),...event}); },
     // Apps Script renames REST delete methods to remove.
     remove: (calendar: string, eventId: string, options: any) => { assert.equal(locked,true); assert.equal(calendar,'calendar'); assert.equal(options.sendUpdates,'none'); if(calendarFails) throw Error('calendar failed'); events.delete(eventId); },
     list: (_calendar: string, options: any) => { assert.equal(locked,true); assert.equal(_calendar,'calendar'); assert.equal(options.singleEvents,true); return { items: Array.from(events.values()) }; },
   } },
 });
 vm.runInContext(readFileSync(new URL('../scripts/google-sheets-booking-webhook.gs', import.meta.url), 'utf8'), context);
 return { rows, events, operations, pendingRows, set permitLock(v: boolean){permitLock=v;}, get insertions(){return insertions;}, set calendarFails(v: boolean){calendarFails=v;}, set sheetFails(v: boolean){sheetFails=v;}, set flushFails(v: boolean){flushFails=v;}, send: (body: unknown=payload) => JSON.parse((context.doPost({ postData: { contents: JSON.stringify(body) } })).text), get locked(){return locked;} };
}
test('Apps Script commits buffered booking rows under the lock before Calendar and positive acknowledgment', () => {
 const f=fixture(); assert.deepEqual(f.send(), {ok:true,bookingId:id});
 assert.deepEqual(f.operations, ['write','write','flush','calendar','ack:true','release']);
 assert.equal(f.rows[1][0],id); assert.equal(f.pendingRows.size,0); assert.equal(f.locked,false);
});
test('Apps Script flush failure gives a negative acknowledgment before Calendar and replay repairs pending rows', () => {
 const f=fixture(); f.flushFails=true; assert.deepEqual(f.send(), {ok:false});
 assert.deepEqual(f.operations, ['write','write','flush','ack:false','release']);
 assert.equal(f.rows.length,0); assert.equal(f.events.size,0); assert.equal(f.insertions,0); assert.equal(f.locked,false);
 f.flushFails=false; assert.deepEqual(f.send(), {ok:true,bookingId:id});
 assert.equal(f.rows.length,2); assert.equal(f.events.size,1); assert.equal(f.insertions,1); assert.equal(f.pendingRows.size,0);
});
test('Apps Script execution deduplicates sheet/event, escapes formulas and creates private event without invitations', () => {
 const f=fixture(); assert.deepEqual(f.send(), {ok:true,bookingId:id}); assert.deepEqual(f.send(), {ok:true,bookingId:id});
 assert.equal(f.rows.length,2); assert.equal(f.events.size,1); assert.equal(f.insertions,1); assert.equal(f.locked,false);
 assert.equal(f.rows[1][4], "'=SUM(A1)"); assert.equal(f.rows[1][6], "'+123"); assert.equal(f.rows[1][9], "'  @malicious");
 assert.equal(f.events.has(id.replaceAll('-','')),true); assert.equal(JSON.stringify(f.rows).includes('secret'),false);
});

test('Apps Script versioned reschedules and cancellation update/delete events idempotently', () => {
 const f=fixture(); assert.equal(f.send().ok,true);
 const eventId=id.replaceAll('-','');
 const moved={...payload,startAt:'2026-10-13T04:00:00Z',endAt:'2026-10-13T05:00:00Z',version:2};
 assert.deepEqual(f.send(moved),{ok:true,bookingId:id});
 assert.equal(f.events.get(eventId).start.dateTime,moved.startAt);
 assert.equal(f.events.get(eventId).extendedProperties.private.bookingVersion,'2');
 const cancelled={...moved,status:'cancelled',version:3};
 assert.deepEqual(f.send(cancelled),{ok:true,bookingId:id});
 assert.equal(f.events.has(eventId),false);
 assert.deepEqual(f.send(cancelled),{ok:true,bookingId:id});
 assert.deepEqual(f.send(payload),{ok:true,bookingId:id});
 assert.equal(f.events.has(eventId),false);
 assert.equal(f.rows[1][10],'cancelled');
 assert.equal(f.rows[1][11],3);
});

test('Apps Script availability filters overlapping Calendar events and transparent events', () => {
 const f=fixture();
 const blocked={ start:{dateTime:'2026-10-13T03:30:00Z'}, end:{dateTime:'2026-10-13T04:30:00Z'}, status:'confirmed' };
 const transparent={ start:{dateTime:'2026-10-13T05:00:00Z'}, end:{dateTime:'2026-10-13T06:00:00Z'}, transparency:'transparent' };
 const allDay={ start:{date:'2026-10-14'}, end:{date:'2026-10-15'}, status:'confirmed' };
 f.events.set('busy',blocked); f.events.set('free',transparent); f.events.set('all-day',allDay);
 const slots=[{startAt:'2026-10-13T03:00:00Z',endAt:'2026-10-13T04:00:00Z'},{startAt:'2026-10-13T05:00:00Z',endAt:'2026-10-13T06:00:00Z'},{startAt:'2026-10-14T03:00:00Z',endAt:'2026-10-14T04:00:00Z'}];
 const result=f.send({reportSecret:'secret',action:'availability',slots});
 assert.deepEqual(result,{ok:true,availableStartAt:[slots[1].startAt]});
});
test('Apps Script acknowledges only both destinations; replay repairs sheet-first and calendar-first partial writes', () => {
 const f=fixture(); f.calendarFails=true; assert.equal(f.send().ok,false); assert.equal(f.rows.length,2); assert.equal(f.events.size,0);
 f.calendarFails=false; assert.equal(f.send().ok,true); assert.equal(f.rows.length,2); assert.equal(f.events.size,1);
 const g=fixture(); assert.equal(g.send().ok,true); g.rows.splice(0); g.sheetFails=true; assert.equal(g.send().ok,false);
 g.sheetFails=false; assert.equal(g.send().ok,true); assert.equal(g.rows.length,2); assert.equal(g.insertions,1);
});
test('Apps Script rejects secret/shape/duration/ID errors before destination writes', () => {
 for(const patch of [{ reportSecret:'bad' },{ bookingId:'bad' },{ timeZone:'UTC' },{ endAt:'2026-10-13T05:00:00Z' },{ notes:'x'.repeat(2001) },{ instrument:'bassoon',service:'basic' }]) {
   const f=fixture(); assert.equal(f.send({...payload,...patch}).ok,false); assert.equal(f.rows.length,0); assert.equal(f.events.size,0);
 }
});

test('Apps Script lock failure returns a negative acknowledgment and does not release an unheld lock', () => {
 const f=fixture(); f.permitLock=false; assert.deepEqual(f.send(),{ok:false}); assert.equal(f.rows.length,0);
});

test('Apps Script accepts booking contact snapshots and preserves them through move, cancel and replay', () => {
 const f=fixture();
 const customer={name:'Account name',email:'buyer@example.test',contactName:'Booking name',contactInformation:'=LINE: musician / Facebook: Music',accountEmail:'buyer@example.test'};
 const booking={...payload,customer};
 assert.deepEqual(f.send(booking),{ok:true,bookingId:id});
 assert.equal(f.rows[0][12],'Contact information');
 assert.equal(f.rows[1][4],customer.contactName);
 assert.equal(f.rows[1][12],"'"+customer.contactInformation);
 const eventId=id.replaceAll('-','');
 assert.match(f.events.get(eventId).description,/Contact information: =LINE: musician/);
 const moved={...booking,startAt:'2026-10-13T04:00:00Z',endAt:'2026-10-13T05:00:00Z',version:2};
 assert.equal(f.send(moved).ok,true);assert.equal(f.send(moved).ok,true);
 assert.equal(f.insertions,1);assert.equal(f.rows.length,2);
 assert.equal(f.rows[1][12],"'"+customer.contactInformation);
 assert.equal(f.send({...moved,status:'cancelled',version:3}).ok,true);assert.equal(f.events.size,0);
 assert.equal(f.send(booking).ok,true);assert.equal(f.events.size,0);
});
test('Apps Script accepts long preferred contact but rejects invalid or unexpected customer fields before writes',()=>{
 const customer={name:'Name',email:'buyer@example.test',contactName:'Name',contactInformation:'x'.repeat(500),accountEmail:'buyer@example.test'};
 assert.equal(fixture().send({...payload,customer}).ok,true);
 for(const patch of [{contactInformation:'x'.repeat(501)},{contactName:42},{accountEmail:null},{unexpected:'x'},{contactInformation:'bad\u0000contact'}]){
  const f=fixture();assert.equal(f.send({...payload,customer:{...customer,...patch}}).ok,false);assert.equal(f.rows.length,0);
 }
});

test('Apps Script appends the contact column to an existing legacy Sheet without changing old rows',()=>{
 const f=fixture();assert.equal(f.send().ok,true);
 f.rows[0]=f.rows[0].slice(0,12);f.rows[1]=f.rows[1].slice(0,12);
 const oldRow=[...f.rows[1]];
 const secondId='33333333-3333-4333-8333-333333333333';
 const customer={name:'Name',email:'buyer@example.test',contactName:'Name',contactInformation:'LINE: player',accountEmail:'buyer@example.test',phone:null};
 assert.deepEqual(f.send({...payload,bookingId:secondId,customer}),{ok:true,bookingId:secondId});
 assert.equal(f.rows[0][12],'Contact information');assert.deepEqual(f.rows[1],oldRow);
 assert.equal(f.rows[2][12],customer.contactInformation);assert.equal(f.events.size,2);
});
