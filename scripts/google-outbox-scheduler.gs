// Add as a separate file in the existing booking Apps Script project.
// Store the website's CRON_SECRET as the Script Property WEBSITE_CRON_SECRET.
// Run once manually to authorize, then add one five-minute time-driven trigger.
function processWebsiteJobs() {
  var secret = PropertiesService.getScriptProperties().getProperty('WEBSITE_CRON_SECRET');
  if (!secret || !secret.trim()) throw new Error('scheduler_secret_missing');

  // Do not hold a ScriptLock here: the website calls doPost in this same project.
  var response;
  try {
    response = UrlFetchApp.fetch('https://designmusic-th.com/api/cron/outbox', {
      method: 'post',
      headers: { Authorization: 'Bearer ' + secret.trim() },
      followRedirects: false,
      muteHttpExceptions: true,
      timeoutSeconds: 120
    });
  } catch (_) {
    throw new Error('scheduler_request_failed');
  }
  if (response.getResponseCode() !== 200) {
    throw new Error('scheduler_http_' + response.getResponseCode());
  }
  var result;
  try {
    var text = response.getContentText();
    if (text.length > 4096) throw new Error('oversized');
    result = JSON.parse(text);
  } catch (_) {
    throw new Error('scheduler_invalid_response');
  }
  var outbox = result && result.outbox;
  if (!outbox || !['claimed', 'sent', 'errors', 'deferred'].every(function(key) {
    return Number.isInteger(outbox[key]) && outbox[key] >= 0;
  })) throw new Error('scheduler_invalid_response');

  // Log counts only. Never log the request headers, secret, or raw response.
  console.log(JSON.stringify({ claimed: outbox.claimed, sent: outbox.sent, errors: outbox.errors, deferred: outbox.deferred }));
  if (result.payments && result.payments.errors > 0) {
    console.warn('Payment reconciliation needs attention; Stripe setup is separate from booking delivery.');
  }
  if (outbox.errors > 0) throw new Error('scheduler_outbox_errors_check_supabase');
}
