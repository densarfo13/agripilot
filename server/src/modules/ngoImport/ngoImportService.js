/**
 * ngoImportService.js — pure helpers for the NGO CSV import flow.
 *
 * Separation of concerns:
 *   • parseCsvImport(text)        — RFC-light CSV → row objects
 *   • normalizeImportRow(row)     — trim / validate a single row
 *   • dedupeByPhone(rows)         — drop duplicates; first wins
 *   • validateImportBatch(rows)   — {valid, invalid} split
 *
 * Nothing here touches Prisma or the network — the Express route
 * (routes.js) composes these to validate the payload, then calls
 * Prisma. Keeping imports pure means every rule is regression-
 * tested without spinning up a database.
 */

const REQUIRED = Object.freeze(['name', 'phone']);
const OPTIONAL = Object.freeze(['location', 'region', 'crop', 'program', 'email']);
const ALL_FIELDS = Object.freeze([...REQUIRED, ...OPTIONAL]);

/**
 * Simple CSV parser (quoted fields + escaped quotes). Not a full
 * RFC-4180 implementation; just enough for NGO spreadsheets that
 * use UTF-8 with comma separators. Returns an array of row
 * objects keyed by header name. Empty rows and rows with only
 * commas are skipped.
 */
export function parseCsvImport(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const lines = splitCsvLines(text);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => String(h).trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cells = splitCsvLine(line);
    if (cells.every((c) => c === '' || c == null)) continue;
    const row = {};
    headers.forEach((h, idx) => {
      const cell = cells[idx];
      row[h] = cell == null ? '' : String(cell);
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLines(text) {
  // Split on line endings while respecting quoted fields.
  const out = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { buf += '"'; i++; }
      else inQuotes = !inQuotes;
      buf += ch;
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

function splitCsvLine(line) {
  const out = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { buf += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf);
  return out;
}

/** Normalize one row — trim + standardize + validate required fields. */
export function normalizeImportRow(raw = {}) {
  const row = {};
  for (const f of ALL_FIELDS) {
    const v = raw[f];
    row[f] = typeof v === 'string' ? v.trim() : (v == null ? '' : String(v));
  }
  const errors = [];
  for (const f of REQUIRED) {
    if (!row[f]) errors.push(`missing_${f}`);
  }
  // Normalize phone — strip spaces / dashes, keep leading +.
  if (row.phone) {
    const normalized = row.phone.replace(/[\s-]/g, '');
    row.phone = normalized;
    if (!/^\+?\d{6,20}$/.test(normalized)) errors.push('invalid_phone');
  }
  if (row.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) {
    errors.push('invalid_email');
  }
  if (row.crop) row.crop = row.crop.trim().toUpperCase();
  return { row: Object.freeze(row), errors: Object.freeze(errors), ok: errors.length === 0 };
}

/**
 * dedupeByPhone — drop rows whose phone has already been seen.
 * First occurrence wins. Returns {kept, dropped} so consumers
 * can log what was skipped.
 */
export function dedupeByPhone(rows = []) {
  const seen = new Set();
  const kept = [];
  const dropped = [];
  if (!Array.isArray(rows)) return { kept, dropped };
  for (const r of rows) {
    const phone = (r && r.phone) || '';
    if (!phone) { kept.push(r); continue; }
    if (seen.has(phone)) { dropped.push({ reason: 'duplicate_phone', row: r }); continue; }
    seen.add(phone);
    kept.push(r);
  }
  return { kept, dropped };
}

/**
 * validateImportBatch — accept an array of raw rows and return
 * {valid, invalid} where invalid carries the error reasons. Also
 * dedupes by phone before validating.
 */
export function validateImportBatch(rows = []) {
  const src = Array.isArray(rows) ? rows : [];
  const valid = [];
  const invalid = [];
  const phones = new Set();

  for (const raw of src) {
    const { row, errors, ok } = normalizeImportRow(raw);
    if (!ok) { invalid.push({ row, errors }); continue; }
    if (row.phone && phones.has(row.phone)) {
      invalid.push({ row, errors: ['duplicate_phone'] });
      continue;
    }
    if (row.phone) phones.add(row.phone);
    valid.push(row);
  }
  return { valid, invalid };
}

export const _internal = { splitCsvLine, splitCsvLines, REQUIRED, OPTIONAL, ALL_FIELDS };
