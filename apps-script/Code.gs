// Google Apps Script for the RSVP sheet.
// 1. Create a Google Sheet, then Extensions > Apps Script, paste this file.
// 2. Deploy > New deployment > Web app: execute as "Me", access "Anyone".
// 3. Copy the /exec URL into SHEET_URL in src/store.js.
const HEADERS = ['at', 'name', 'coming', 'count', 'allergies', 'word', 'message'];

function sheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

function doPost(e) {
  const r = JSON.parse(e.postData.contents);
  // A leading ' keeps the cell plain text, so an answer starting with = + - @ is never run as a formula.
  const clean = (v, n) => String(v ?? '').slice(0, n).replace(/^(?=[=+\-@])/, "'");
  sheet_().appendRow([new Date(), clean(r.name, 80), r.coming ? 'SI' : 'NO', Number(r.count) || 0, clean(r.allergies, 200), clean(r.word, 200), clean(r.message, 500)]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

// The site reads back only what the teletext guestbook shows (names, head count, messages).
function doGet() {
  const rows = sheet_().getDataRange().getValues().slice(1);
  const guests = rows.map((r) => ({ at: r[0], name: r[1], coming: r[2] === 'SI', count: r[3], message: r[6] }));
  return ContentService.createTextOutput(JSON.stringify({ guests })).setMimeType(ContentService.MimeType.JSON);
}
