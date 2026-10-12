// Deploy with Advanced Calendar service enabled. Secrets/destinations come only from Script Properties.
function doPost(e) {
  var lock;
  var lockHeld = false;
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('BOOKING_REPORT_SECRET');
    var spreadsheetId = props.getProperty('SPREADSHEET_ID');
    var calendarId = props.getProperty('CALENDAR_ID');
    if (!secret || !spreadsheetId || !calendarId || !e || !e.postData || typeof e.postData.contents !== 'string' || e.postData.contents.length > 16384) throw new Error('configuration_or_body');
    var body = JSON.parse(e.postData.contents);
    validateReport(body, secret);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('lock_unavailable');
    lockHeld = true;
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheetName = props.getProperty('SHEET_NAME') || 'Repair Bookings';
    var sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    if (!sheet.getLastRow()) sheet.getRange(1, 1, 1, 10).setValues([['Booking ID','Start UTC','End UTC','Time zone','Name','Email','Phone','Instrument','Service','Notes']]);
    var values = sheet.getRange(1, 1, sheet.getLastRow(), 10).getValues();
    var row = -1;
    for (var i = 1; i < values.length; i++) if (String(values[i][0]) === body.bookingId) { row = i + 1; break; }
    if (row === -1) row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, 10).setValues([[
      body.bookingId, body.startAt, body.endAt, body.timeZone, safeCell(body.customer.name),
      safeCell(body.customer.email), safeCell(body.customer.phone || ''), body.instrument, body.service, safeCell(body.notes)
    ]]);
    // Commit buffered sheet writes while the exclusive lock is still held.
    SpreadsheetApp.flush();
    var eventId = body.bookingId.replace(/-/g, '').toLowerCase();
    var event = null;
    try { event = Calendar.Events.get(calendarId, eventId); }
    catch (error) { if (!/404|not found/i.test(String(error && error.message || error))) throw error; }
    if (event) {
      if (!event.extendedProperties || !event.extendedProperties.private || event.extendedProperties.private.bookingId !== body.bookingId) throw new Error('event_collision');
    } else {
      Calendar.Events.insert({
        id: eventId,
        summary: 'Design Music repair: ' + body.instrument + ' / ' + body.service,
        description: 'Booking ID: ' + body.bookingId + '\nName: ' + body.customer.name + '\nEmail: ' + body.customer.email + '\nPhone: ' + (body.customer.phone || '') + '\nNotes: ' + body.notes,
        start: { dateTime: body.startAt, timeZone: 'Asia/Bangkok' },
        end: { dateTime: body.endAt, timeZone: 'Asia/Bangkok' },
        visibility: 'private',
        extendedProperties: { private: { bookingId: body.bookingId } }
      }, calendarId, { sendUpdates: 'none' });
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
    Object.keys(body).sort().join(',') !== ['reportSecret','bookingId','startAt','endAt','timeZone','customer','instrument','service','notes'].sort().join(',') ||
    typeof body.bookingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.bookingId) ||
    body.timeZone !== 'Asia/Bangkok' || ['soprano','alto','tenor','baritone','bassoon','other'].indexOf(body.instrument) < 0 ||
    ['basic','standard','overhaul','assessment'].indexOf(body.service) < 0 || body.instrument === 'bassoon' && body.service === 'basic' ||
    typeof body.notes !== 'string' || body.notes.length > 2000 ||
    !validInstant(body.startAt) || !validInstant(body.endAt) || Date.parse(body.endAt) - Date.parse(body.startAt) !== 3600000) throw new Error('invalid_report');
  var customer = body.customer;
  if (!customer || typeof customer !== 'object' || Array.isArray(customer) ||
    Object.keys(customer).sort().join(',') !== 'email,name,phone' ||
    typeof customer.name !== 'string' || customer.name.length > 120 ||
    typeof customer.email !== 'string' || customer.email.length > 320 ||
    customer.phone !== null && (typeof customer.phone !== 'string' || customer.phone.length > 40)) throw new Error('invalid_customer');
}
function validInstant(value) {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?(?:Z|\+00:00)$/.test(value) &&
    isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
}
