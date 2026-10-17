// Deploy with Advanced Calendar service enabled. Secrets/destinations come only from Script Properties.
function doPost(e) {
  var lock;
  var lockHeld = false;
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('BOOKING_REPORT_SECRET');
    var calendarId = props.getProperty('CALENDAR_ID');
    if (!secret || !calendarId || !e || !e.postData || typeof e.postData.contents !== 'string' || e.postData.contents.length > 16384) throw new Error('configuration_or_body');
    var body = JSON.parse(e.postData.contents);
    if (!body || body.reportSecret !== secret) throw new Error('invalid_secret');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('lock_unavailable');
    lockHeld = true;
    if (body.action === 'availability') {
      validateAvailability(body);
      return reportJson({ ok: true, availableStartAt: availableStartTimes(calendarId, body.slots) });
    }
    var spreadsheetId = props.getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) throw new Error('configuration_or_body');
    validateReport(body, secret);
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheetName = props.getProperty('SHEET_NAME') || 'Repair Bookings';
    var sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    if (!sheet.getLastRow()) sheet.getRange(1, 1, 1, 12).setValues([['Booking ID','Start UTC','End UTC','Time zone','Name','Email','Phone','Instrument','Service','Notes','Status','Version']]);
    else if (sheet.getRange(1, 1, 1, 12).getValues()[0][10] !== 'Status' || sheet.getRange(1, 1, 1, 12).getValues()[0][11] !== 'Version') {
      sheet.getRange(1, 11, 1, 2).setValues([['Status','Version']]);
    }
    var values = sheet.getRange(1, 1, sheet.getLastRow(), 12).getValues();
    var row = -1;
    for (var i = 1; i < values.length; i++) if (String(values[i][0]) === body.bookingId) { row = i + 1; break; }
    if (row !== -1 && Number(values[row - 1][11] || 1) > body.version) {
      return reportJson({ ok: true, bookingId: body.bookingId });
    }
    if (row === -1) row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, 12).setValues([[
      body.bookingId, body.startAt, body.endAt, body.timeZone, safeCell(body.customer.name),
      safeCell(body.customer.email), safeCell(body.customer.phone || ''), body.instrument, body.service,
      safeCell(body.notes), body.status, body.version
    ]]);
    // Commit buffered sheet writes while the exclusive lock is still held.
    SpreadsheetApp.flush();
    var eventId = body.bookingId.replace(/-/g, '').toLowerCase();
    var event = null;
    try { event = Calendar.Events.get(calendarId, eventId); }
    catch (error) { if (!/404|not found/i.test(String(error && error.message || error))) throw error; }
    if (event) {
      if (!event.extendedProperties || !event.extendedProperties.private || event.extendedProperties.private.bookingId !== body.bookingId) throw new Error('event_collision');
      var eventVersion = Number(event.extendedProperties.private.bookingVersion || 1);
      if (eventVersion > body.version) return reportJson({ ok: true, bookingId: body.bookingId });
    }
    if (body.status === 'cancelled') {
      if (event) Calendar.Events.remove(calendarId, eventId, { sendUpdates: 'none' });
    } else {
      var eventBody = {
        summary: 'Design Music repair: ' + body.instrument + ' / ' + body.service,
        description: 'Booking ID: ' + body.bookingId + '\nName: ' + body.customer.name + '\nEmail: ' + body.customer.email + '\nPhone: ' + (body.customer.phone || '') + '\nNotes: ' + body.notes,
        start: { dateTime: body.startAt, timeZone: 'Asia/Bangkok' },
        end: { dateTime: body.endAt, timeZone: 'Asia/Bangkok' },
        visibility: 'private',
        extendedProperties: { private: { bookingId: body.bookingId, bookingVersion: String(body.version) } }
      };
      if (event) Calendar.Events.patch(eventBody, calendarId, eventId, { sendUpdates: 'none' });
      else Calendar.Events.insert(Object.assign({ id: eventId }, eventBody), calendarId, { sendUpdates: 'none' });
    }
    return reportJson({ ok: true, bookingId: body.bookingId });
  } catch (_) {
    // Never echo the secret, provider diagnostics, destination IDs or contact data.
    return reportJson({ ok: false });
  } finally {
    if (lockHeld) lock.releaseLock();
  }
}
function reportJson(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function safeCell(value) {
  return /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
}
function validateReport(body, secret) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.reportSecret !== secret ||
    Object.keys(body).sort().join(',') !== ['reportSecret','bookingId','startAt','endAt','timeZone','customer','instrument','service','notes','status','version'].sort().join(',') ||
    typeof body.bookingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.bookingId) ||
    body.timeZone !== 'Asia/Bangkok' || ['soprano','alto','tenor','baritone','bassoon','other'].indexOf(body.instrument) < 0 ||
    ['basic','standard','overhaul','assessment'].indexOf(body.service) < 0 || body.instrument === 'bassoon' && body.service === 'basic' ||
    ['confirmed','cancelled'].indexOf(body.status) < 0 || !Number.isInteger(body.version) || body.version < 1 ||
    typeof body.notes !== 'string' || body.notes.length > 2000 ||
    !validInstant(body.startAt) || !validInstant(body.endAt) || Date.parse(body.endAt) - Date.parse(body.startAt) !== 3600000) throw new Error('invalid_report');
  var customer = body.customer;
  if (!customer || typeof customer !== 'object' || Array.isArray(customer) ||
    Object.keys(customer).sort().join(',') !== 'email,name,phone' ||
    typeof customer.name !== 'string' || customer.name.length > 120 ||
    typeof customer.email !== 'string' || customer.email.length > 320 ||
    customer.phone !== null && (typeof customer.phone !== 'string' || customer.phone.length > 40)) throw new Error('invalid_customer');
}
function validateAvailability(body) {
  if (Object.keys(body).sort().join(',') !== 'action,reportSecret,slots' ||
    !Array.isArray(body.slots) || body.slots.length > 84) throw new Error('invalid_availability');
  var seen = {};
  body.slots.forEach(function(slot) {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot) ||
      Object.keys(slot).sort().join(',') !== 'endAt,startAt' ||
      !validInstant(slot.startAt) || !validInstant(slot.endAt) ||
      Date.parse(slot.endAt) - Date.parse(slot.startAt) !== 3600000 ||
      seen[slot.startAt]) throw new Error('invalid_availability');
    seen[slot.startAt] = true;
  });
}
function availableStartTimes(calendarId, slots) {
  if (!slots.length) return [];
  var first = slots.reduce(function(a, b) { return Date.parse(a.startAt) < Date.parse(b.startAt) ? a : b; });
  var last = slots.reduce(function(a, b) { return Date.parse(a.endAt) > Date.parse(b.endAt) ? a : b; });
  var events = [], pageToken;
  do {
    var response = Calendar.Events.list(calendarId, {
      timeMin: first.startAt, timeMax: last.endAt, singleEvents: true,
      showDeleted: false, maxResults: 2500, pageToken: pageToken
    });
    events = events.concat(response.items || []);
    pageToken = response.nextPageToken;
  } while (pageToken);
  return slots.filter(function(slot) {
    var start = Date.parse(slot.startAt), end = Date.parse(slot.endAt);
    return !events.some(function(event) {
      if (event.status === 'cancelled' || event.transparency === 'transparent' || !event.start || !event.end) return false;
      var eventStart = calendarInstant(event.start), eventEnd = calendarInstant(event.end);
      return isFinite(eventStart) && isFinite(eventEnd) && eventStart < end && eventEnd > start;
    });
  }).map(function(slot) { return slot.startAt; });
}
function calendarInstant(value) {
  if (value.dateTime) return Date.parse(value.dateTime);
  if (value.date) return Date.parse(value.date + 'T00:00:00+07:00');
  return NaN;
}
function validInstant(value) {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?(?:Z|\+00:00)$/.test(value) &&
    isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
}
