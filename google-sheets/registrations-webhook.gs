/**
 * VIDIKSHA training registrations -> Google Sheet.
 *
 * Install once, from the Google account that owns the sheet:
 *   1. Open the sheet, Extensions -> Apps Script, delete the sample code, paste this file, save.
 *   2. Deploy -> New deployment -> type "Web app" -> Execute as "Me", Who has access "Anyone" -> Deploy.
 *      Authorise when asked. Copy the Web app URL (ends in /exec).
 *   3. Put that URL in content/site.json under "sheetWebhook" (or set SHEET_WEBHOOK_URL on the server) and rebuild.
 *
 * The site's server (serve.js) POSTs one JSON object per registration. Passwords are never sent here.
 * Rows go to the sheet named below; the header row is created the first time.
 */
var SHEET_NAME = 'Registrations';
var HEADERS = ['Timestamp', 'Session', 'Session date', 'Full name', 'Email', 'WhatsApp', 'Profession', 'Academic qualification', 'Account status', 'Source'];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
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

function doGet() {
  return ContentService.createTextOutput('VIDIKSHA registrations webhook is up.');
}
