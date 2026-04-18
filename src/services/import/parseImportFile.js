/**
 * parseImportFile — read an uploaded CSV/XLSX into an array of rows.
 *
 * V2 supports CSV natively with a dependency-free parser that handles
 * quoted cells, embedded commas, and common line-ending variants. XLSX
 * is stubbed behind the same interface — a future pass can install a
 * library (e.g. SheetJS) and fill in `parseXlsxBuffer()` without touching
 * any caller.
 *
 * Returns: { rows: Array<Object>, headers: string[], totalRows: number,
 *           fileName, fileSize, format }
 *
 * Each row is a { headerKey: cellValue } object. Empty cells become ''.
 */

const MAX_BYTES = 5 * 1024 * 1024;      // 5 MB upper bound for V2
const MAX_ROWS = 10000;                 // stay responsive on low-end devices
const ACCEPTED_EXT = ['csv', 'tsv', 'xlsx', 'xls'];

// ─── Header normalisation ──────────────────────────────────
// Map whatever spelling/casing a partner uses to our canonical keys.
// Keep conservative: accept a few common aliases but don't guess.

const HEADER_ALIASES = {
  full_name: ['full_name', 'fullname', 'name', 'farmer_name', 'farmername', 'farmer name', 'full name'],
  phone_number: ['phone_number', 'phone', 'phonenumber', 'mobile', 'msisdn', 'cell', 'phone number'],
  country: ['country', 'country_code'],
  region_or_state: ['region_or_state', 'region', 'state', 'province'],
  district: ['district'],
  village: ['village', 'community', 'town'],
  preferred_language: ['preferred_language', 'language', 'lang'],
  crop: ['crop', 'crop_type', 'main_crop', 'primary_crop'],
  land_size: ['land_size', 'farm_size', 'acres', 'hectares'],
  gender: ['gender'],
  age_range: ['age_range', 'age_group', 'age'],
  organization_id: ['organization_id', 'org_id', 'partner_id'],
  external_farmer_id: ['external_farmer_id', 'external_id', 'partner_farmer_id', 'id'],
  notes: ['notes', 'note', 'comment', 'comments'],
};

function canonicalizeHeader(raw) {
  const normalized = String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalized)) return canonical;
  }
  // Unknown header — keep as-is so callers can surface it in errors
  return normalized;
}

// ─── CSV parser ────────────────────────────────────────────
// Intentionally tiny, no deps. Handles:
//   - quoted fields with commas
//   - escaped quotes (doubled)
//   - \r\n / \n line endings
//   - trailing whitespace

function parseCsvString(text, delimiter = ',') {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; continue; }
      if (ch === '"') { inQuotes = false; continue; }
      field += ch;
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delimiter) { row.push(field); field = ''; continue; }
    if (ch === '\r') continue; // swallow — handle \r\n
    if (ch === '\n') { row.push(field); rows.push(row); field = ''; row = []; continue; }
    field += ch;
  }
  // Final field / row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(sample) {
  const firstLine = sample.split(/\r?\n/)[0] || '';
  const counts = {
    ',': (firstLine.match(/,/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ',';
}

// ─── Public API ────────────────────────────────────────────

/**
 * Parse a File (from <input type="file">) into canonical rows.
 * Throws a localized error key on fatal issues so the caller can t() it.
 */
export async function parseImportFile(file) {
  if (!file) throw new Error('import.error.noFile');
  if (file.size > MAX_BYTES) throw new Error('import.error.fileTooLarge');

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ACCEPTED_EXT.includes(ext)) throw new Error('import.error.unsupportedFormat');

  if (ext === 'xlsx' || ext === 'xls') {
    // XLSX support is stubbed for V2 — the parser architecture is ready
    // but the binary format needs a library. Until that ships, ask the
    // partner to upload CSV.
    throw new Error('import.error.xlsxNotYet');
  }

  const text = await file.text();
  const delimiter = detectDelimiter(text);
  const raw = parseCsvString(text, delimiter);

  if (raw.length === 0) throw new Error('import.error.emptyFile');

  // First non-empty row = headers
  const headerRow = raw.find(r => r.some(c => String(c).trim() !== ''));
  if (!headerRow) throw new Error('import.error.emptyFile');

  const headers = headerRow.map(canonicalizeHeader);
  const dataRows = raw.slice(raw.indexOf(headerRow) + 1);

  if (dataRows.length > MAX_ROWS) throw new Error('import.error.tooManyRows');

  const rows = dataRows
    .filter(r => r.some(c => String(c).trim() !== ''))
    .map((r, idx) => {
      const obj = { _rowNumber: idx + 2 }; // header is row 1
      headers.forEach((h, i) => {
        obj[h] = r[i] != null ? String(r[i]).trim() : '';
      });
      return obj;
    });

  return {
    rows,
    headers,
    totalRows: rows.length,
    fileName: file.name,
    fileSize: file.size,
    format: ext,
  };
}

export const _internal = { parseCsvString, detectDelimiter, canonicalizeHeader, HEADER_ALIASES };
