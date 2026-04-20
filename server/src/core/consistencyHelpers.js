/**
 * consistencyHelpers.js — pure, test-first helpers that close
 * the structural / data-reliability gaps in the NGO platform.
 *
 *   isActiveFarmer(lastActivity, nowMs?)        — §4
 *   enforceProgramOnFarm(user, farm)            — §1
 *   validateImportRowWithProgram(row, knownPrograms) — §8
 *   paginate(rows, {page, limit})               — §7
 *   buildEnhancedExportRow(summary)             — §10
 *
 * No React, no Prisma, no network. Every function returns
 * frozen data where feasible.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * toMs — parse anything to milliseconds or null.
 */
function toMs(x) {
  if (x == null) return null;
  if (x instanceof Date) return x.getTime();
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  const t = Date.parse(String(x));
  return Number.isFinite(t) ? t : null;
}

/**
 * isActiveFarmer — spec §4.
 * "Active = lastActivity within 7 days"
 *
 *   lastActivity: Date | ISO string | ms number | null
 *   nowMs:        optional, for deterministic testing
 */
function isActiveFarmer(lastActivity, nowMs = Date.now(), windowDays = 7) {
  const t = toMs(lastActivity);
  if (t == null) return false;
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const age = now - t;
  if (!Number.isFinite(age) || age < 0) return false;
  return age <= windowDays * DAY_MS;
}

/**
 * farmerStatus — string form of §6 status field.
 *   'Active'   when isActiveFarmer
 *   'Inactive' otherwise (missing / > 7 days)
 */
function farmerStatus(lastActivity, nowMs = Date.now()) {
  return isActiveFarmer(lastActivity, nowMs) ? 'Active' : 'Inactive';
}

/**
 * enforceProgramOnFarm — spec §1.
 * Returns the farm object with `program` forced to match the
 * user's program. If the user has no program, the farm's own
 * program (if any) survives. Pure — never mutates inputs.
 *
 * Returns { farm, changed, reason }:
 *   changed === true  → the farm.program was adjusted
 *   reason  === 'user_program_missing' | 'match_user_program' | 'already_consistent'
 */
function enforceProgramOnFarm(user, farm) {
  const f = (farm && typeof farm === 'object') ? farm : {};
  const userProgram = (user && typeof user === 'object' && user.program) || null;
  const farmProgram = f.program || null;

  if (!userProgram) {
    return Object.freeze({
      farm: Object.freeze({ ...f }),
      changed: false,
      reason: 'user_program_missing',
    });
  }

  if (farmProgram === userProgram) {
    return Object.freeze({
      farm: Object.freeze({ ...f }),
      changed: false,
      reason: 'already_consistent',
    });
  }

  return Object.freeze({
    farm: Object.freeze({ ...f, program: userProgram }),
    changed: true,
    reason: 'match_user_program',
  });
}

/**
 * programsConsistent — boolean predicate for dev assertions and
 * test scenarios.
 */
function programsConsistent(user, farm) {
  const up = user?.program || null;
  const fp = farm?.program || null;
  if (!up) return true; // nothing to enforce when user has no program
  return up === fp;
}

/**
 * validateImportRowWithProgram — spec §8. Extends the existing
 * ngoImport normalizer with program enforcement.
 *
 *   knownPrograms: optional array — when supplied, the row's
 *   program must be one of them or the row is invalid.
 *
 * Returns { row, errors, ok } — row is frozen on success.
 */
function validateImportRowWithProgram(raw = {}, knownPrograms = null) {
  const row = raw && typeof raw === 'object' ? { ...raw } : {};
  const errors = [];
  if (!row.name || typeof row.name !== 'string' || !row.name.trim()) {
    errors.push('missing_name');
  }
  if (!row.phone || typeof row.phone !== 'string' || !row.phone.trim()) {
    errors.push('missing_phone');
  }
  // Program required by spec §8.
  const program = (row.program || '').trim();
  if (!program) {
    errors.push('missing_program');
  } else if (Array.isArray(knownPrograms) && knownPrograms.length > 0) {
    const lower = new Set(knownPrograms.map((p) => String(p).trim().toLowerCase()));
    if (!lower.has(program.toLowerCase())) errors.push('unknown_program');
  }
  if (errors.length === 0) row.program = program;
  return {
    row: Object.freeze(row),
    errors: Object.freeze(errors),
    ok: errors.length === 0,
  };
}

/**
 * validateImportBatchWithPrograms — dedupes by phone AND enforces
 * §8. Matches the NGO-import return shape for drop-in use.
 */
function validateImportBatchWithPrograms(rows = [], knownPrograms = null) {
  const src = Array.isArray(rows) ? rows : [];
  const valid   = [];
  const invalid = [];
  const phones  = new Set();
  for (const raw of src) {
    const { row, errors, ok } = validateImportRowWithProgram(raw, knownPrograms);
    if (!ok) { invalid.push({ row, errors }); continue; }
    if (row.phone && phones.has(row.phone)) {
      invalid.push({ row, errors: ['duplicate_phone'] });
      continue;
    }
    if (row.phone) phones.add(row.phone);
    valid.push(row);
  }
  return {
    imported: valid.length,
    failed:   invalid.length,
    valid, invalid,
  };
}

/**
 * paginate — spec §7 pure pagination. Returns both the page
 * window AND metadata so consumers can render pager UI.
 *
 *   paginate(rows, {page, limit}) → {
 *     data, page, limit, total, totalPages, hasMore
 *   }
 *
 * Defaults: page=1, limit=50. Clamped to sensible bounds.
 */
function paginate(rows, { page = 1, limit = 50 } = {}) {
  const src = Array.isArray(rows) ? rows : [];
  const total = src.length;
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 50));
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.max(1, Math.min(totalPages, Number(page) || 1));
  const offset = (safePage - 1) * safeLimit;
  return Object.freeze({
    data:       src.slice(offset, offset + safeLimit),
    page:       safePage,
    limit:      safeLimit,
    total,
    totalPages,
    hasMore:    safePage < totalPages,
  });
}

/**
 * buildEnhancedExportRow — spec §10 adds completionRate + location
 * to the CSV row. Accepts the "summary" row shape produced by
 * buildProgramFarmers (which already has most fields).
 *
 * Returns a plain string-keyed object so the CSV escaper can
 * stringify it uniformly. Always includes every expected column,
 * even when the source row is missing fields.
 */
function buildEnhancedExportRow(summary = {}) {
  const s = summary && typeof summary === 'object' ? summary : {};
  const completion = Number.isFinite(s.completionRate)
    ? `${Math.round(s.completionRate * 100)}%`
    : '';
  return Object.freeze({
    farmer_name:     s.farmerName || '',
    crop:            s.crop || '',
    location:        s.location || '',
    risk:            s.risk || '',
    score:           Number.isFinite(s.score) ? s.score : '',
    completion_rate: completion,
    last_activity:   s.lastActivity || '',
  });
}

/** EXPORT_COLUMNS_V2 — frozen column order for the §10 CSV. */
const EXPORT_COLUMNS_V2 = Object.freeze([
  'farmer_name', 'crop', 'location', 'risk',
  'score', 'completion_rate', 'last_activity',
]);

const _internal = { toMs, DAY_MS };
export {
  isActiveFarmer,
  farmerStatus,
  enforceProgramOnFarm,
  programsConsistent,
  validateImportRowWithProgram,
  validateImportBatchWithPrograms,
  paginate,
  buildEnhancedExportRow,
  EXPORT_COLUMNS_V2,
  _internal,
};
export default {
  isActiveFarmer, farmerStatus,
  enforceProgramOnFarm, programsConsistent,
  validateImportRowWithProgram, validateImportBatchWithPrograms,
  paginate, buildEnhancedExportRow, EXPORT_COLUMNS_V2, _internal,
};
