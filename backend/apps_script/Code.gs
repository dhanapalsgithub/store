/**
 * 3 Star Grocery Store — Google Sheets API (Apps Script Web App)
 * Made by RI Billing Pro
 *
 * SETUP STEPS:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1dVgh3ha6NXwP5G8dlsvNwLtzCLYltqe861xg4HQRvDo
 * 2. Extensions -> Apps Script. Delete any code, paste this entire file, Save.
 * 3. Deploy -> New deployment -> type "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 4. Copy the Web App URL and set it as APPS_SCRIPT_URL in the app backend .env, then restart.
 *    (After every code change here: Deploy -> Manage deployments -> Edit -> New version -> Deploy)
 */

const SHEET_ID = "1dVgh3ha6NXwP5G8dlsvNwLtzCLYltqe861xg4HQRvDo";

const HEADERS = {
  Users: ["Mobile", "Password", "Role", "Name", "Email", "Address", "UserType"],
  Products: ["ProductID", "Category", "ProductName", "ProductNameEn", "Rate", "CostRate", "StockQty", "Unit", "Image"],
  Orders: ["OrderID", "CustomerMobile", "CustomerName", "ItemsJSON", "TotalAmount", "PaymentStatus", "PaymentMethod", "Date", "Status", "Address"],
  Transactions: ["TransactionID", "OrderID", "CustomerMobile", "Amount", "PaymentMethod", "Date"],
  Wishlist: ["CustomerMobile", "ProductID"]
};

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json({ ok: true, data: { service: "3 Star Grocery Store Sheets API", time: new Date().toISOString() } });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, sheet, key, value, row } = body;
    if (!HEADERS[sheet]) return json({ ok: false, error: "Unknown sheet: " + sheet });
    const sh = getSheet(sheet);
    let data = null;
    if (action === "list") data = listRows(sh);
    else if (action === "insert") { appendRow(sh, row); data = row; }
    else if (action === "update") data = updateRow(sh, key, value, row);
    else if (action === "delete") data = deleteRow(sh, key, value);
    else return json({ ok: false, error: "Unknown action: " + action });
    return json({ ok: true, data: data });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
  }
  return sh;
}

function listRows(sh) {
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(r => r.some(c => c !== "" && c !== null))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
}

function appendRow(sh, row) {
  const headers = HEADERS[sh.getName()];
  sh.appendRow(headers.map(h => (row[h] !== undefined ? row[h] : "")));
}

function findRowIndex(sh, key, value) {
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const col = headers.indexOf(key);
  if (col === -1) throw new Error("Key column not found: " + key);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][col]) === String(value)) return i + 1; // 1-based sheet row
  }
  return -1;
}

function updateRow(sh, key, value, patch) {
  const rowIdx = findRowIndex(sh, key, value);
  if (rowIdx === -1) return false;
  const headers = HEADERS[sh.getName()];
  Object.keys(patch).forEach(field => {
    const col = headers.indexOf(field);
    if (col !== -1) sh.getRange(rowIdx, col + 1).setValue(patch[field]);
  });
  return true;
}

function deleteRow(sh, key, value) {
  const rowIdx = findRowIndex(sh, key, value);
  if (rowIdx === -1) return false;
  sh.deleteRow(rowIdx);
  return true;
}
