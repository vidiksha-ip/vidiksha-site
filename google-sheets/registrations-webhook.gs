/**
 * VIDIKSHA training registrations -> Google Sheet.
 *
 * Install once, from the Google account that owns the sheet:
 *   1. Open the sheet, Extensions -> Apps Script, delete the sample code, paste this file, save.
 *   2. Deploy -> New deployment -> type "Web app" -> Execute as "Me", Who has access "Anyone" -> Deploy.
 *      Authorise when asked. Copy the Web app URL (ends in /exec).
 *   3. Put that URL in content/site.json under "sheetWebhook" (or set SHEET_WEBHOOK_URL on the server) and rebuild.
 *
 * Two kinds of row arrive, both as one JSON object per POST, passwords never included:
 *   - live training registrations (from the site)            -> sheet "Registrations"
 *   - paid course enrolments, body.type === "enrolment"       -> sheet "Course enrolments"
 *     (sent by the Supabase Edge Function only after Razorpay confirms the payment)
 * Header rows are created the first time each sheet is used.
 * After editing this file: Deploy -> Manage deployments -> pencil -> Version: New version -> Deploy (same URL).
 */
var SHEET_NAME = 'Registrations';
var HEADERS = ['Timestamp', 'Session', 'Session date', 'Full name', 'Email', 'WhatsApp', 'Profession', 'Academic qualification', 'Account status', 'Source'];

var ENROL_SHEET = 'Course enrolments';
var ENROL_HEADERS = ['Timestamp', 'Course', 'Amount (INR)', 'Payment ID', 'Order ID', 'Full name', 'Email', 'WhatsApp', 'Profession', 'Organisation', 'Address', 'City', 'State', 'PIN', 'Status'];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (body.type === 'enrolment') return appendEnrolment(ss, body);
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([
      new Date(),
      String(body.session_title || ''),
      String(body.session_date || ''),
      String(body.full_name || ''),
      String(body.email || ''),
      "'" + String(body.whatsapp || ''),   // keep leading + and zeros as text
      String(body.profession || ''),
      String(body.qualification || ''),
      String(body.account_status || ''),
      String(body.source || 'website'),
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

/** Paid course enrolments. Sent by the Supabase Edge Function only after Razorpay confirms the payment. */
function appendEnrolment(ss, body) {
  var sheet = ss.getSheetByName(ENROL_SHEET) || ss.insertSheet(ENROL_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ENROL_HEADERS);
    sheet.getRange(1, 1, 1, ENROL_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    new Date(), String(body.course || ''), Number(body.amount_inr || 0), String(body.payment_id || ''), String(body.order_id || ''),
    String(body.full_name || ''), String(body.email || ''), "'" + String(body.whatsapp || ''), String(body.profession || ''), String(body.organisation || ''),
    String(body.address_line || ''), String(body.city || ''), String(body.state || ''), "'" + String(body.pincode || ''), String(body.status || 'paid'),
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('VIDIKSHA registrations webhook is up.');
}
