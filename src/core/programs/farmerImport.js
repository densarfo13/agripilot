/**
 * farmerImport.js — schema + validator for NGO bulk-import
 * (NGO Onboarding spec §3).
 *
 *   import {
 *     validateFarmerRow, importFarmers,
 *   } from '../core/programs/farmerImport.js';
 *
 *   const result = importFarmers([
 *     { farmerId: 'f001', displayName: 'Densuah', phoneNumber: '+233...',
 *       country: 'GH', region: 'Ashanti', crop: 'maize' },
 *     ...
 *   ]);
 *   // result = { ok: [...], rejected: [{ row, reason }, ...], total }
 *
 * Spec §3 schema
 * ──────────────
 *   REQUIRED:
 *     - farmerId
 *     - farmerName  (or  displayName  alias)
 *     - phoneNumber (or  appUserId    alias)
 *     - country
 *     - region
 *
 *   OPTIONAL:
 *     - crop
 *     - farmSize           ('small' | 'medium' | 'large' | 'unknown'
 *                            OR a free-text string we collapse to 'unknown')
 *     - language           (BCP-47-ish code; not validated here)
 *     - village
 *     - gender             ('female' | 'male' | 'other' | '' )
 *     - ageRange           ('under_18' | '18_25' | '26_40' | '41_60' | 'over_60')
 *
 * Privacy spec (§7 of the data-moat layer + spec rule "Do not
 * require sensitive data"):
 *   The validator REJECTS rows that include obvious sensitive
 *   fields (national ID, exact GPS, exact address) so an NGO
 *   can't accidentally upload PII. Optional fields above are
 *   allow-listed; anything outside the allow-list is dropped
 *   silently from the normalised row, NOT persisted.
 *
 * Strict-rule audit
 *   • Pure functions. No I/O. The caller (a UI surface +
 *     programStore + farmerSource) decides what to do with
 *     the validated rows.
 *   • Never throws. Bad rows fall into `rejected` with a
 *     human-readable reason.
 */

const REQUIRED_KEYS = ['farmerId', 'country', 'region'];
const ALLOWED_FARM_SIZE = new Set(['small', 'medium', 'large', 'unknown']);
const ALLOWED_GENDER    = new Set(['female', 'male', 'other', '']);
const ALLOWED_AGE_RANGE = new Set([
  'under_18', '18_25', '26_40', '41_60', 'over_60',
]);
// Sensitive fields the NGO must NOT include. Even the
// presence of one of these keys rejects the row \u2014 we don't
// silently drop them because that would mask a privacy
// violation upstream.
const SENSITIVE_KEYS = new Set([
  'nationalId', 'national_id', 'ssn', 'socialSecurityNumber',
  'exactAddress', 'street', 'streetAddress', 'addressLine1',
  'gpsLat', 'gpsLng', 'latitude', 'longitude',
  'email', 'emailAddress',
  'dateOfBirth', 'dob',
]);

function _str(v) { return (typeof v === 'string' && v.trim()) ? v.trim() : null; }

/**
 * validateFarmerRow(row) → { ok, normalized?, reason? }
 *
 * Single-row validator. Used by importFarmers and any future
 * single-row entry UI.
 *
 * Required fields:
 *   farmerId, country, region, AND
 *   (farmerName || displayName), AND
 *   (phoneNumber || appUserId)
 */
export function validateFarmerRow(row) {
  if (!row || typeof row !== 'object') {
    return { ok: false, reason: 'row must be an object' };
  }
  // Sensitive fields trip an immediate rejection.
  for (const k of Object.keys(row)) {
    if (SENSITIVE_KEYS.has(k)) {
      return {
        ok: false,
        reason: `sensitive field "${k}" not allowed (use region-level only)`,
      };
    }
  }
  // Required core fields.
  for (const k of REQUIRED_KEYS) {
    if (!_str(row[k])) {
      return { ok: false, reason: `missing required field: ${k}` };
    }
  }
  // Required name (either field).
  const name = _str(row.farmerName) || _str(row.displayName);
  if (!name) {
    return { ok: false, reason: 'missing farmerName or displayName' };
  }
  // Required contact (either field).
  const contact     = _str(row.phoneNumber);
  const appUserId   = _str(row.appUserId);
  if (!contact && !appUserId) {
    return { ok: false, reason: 'missing phoneNumber or appUserId' };
  }
  // Optional farmSize collapse to canonical taxonomy.
  let farmSize = null;
  if (_str(row.farmSize)) {
    const v = String(row.farmSize).toLowerCase();
    farmSize = ALLOWED_FARM_SIZE.has(v) ? v : 'unknown';
  }
  // Optional gender / ageRange validation \u2014 unknown values
  // collapse to null rather than reject (the row is still
  // useful; we just drop the bad facet).
  let gender = null;
  if (_str(row.gender)) {
    const v = String(row.gender).toLowerCase();
    gender = ALLOWED_GENDER.has(v) ? v : null;
  }
  let ageRange = null;
  if (_str(row.ageRange)) {
    const v = String(row.ageRange).toLowerCase();
    ageRange = ALLOWED_AGE_RANGE.has(v) ? v : null;
  }
  const normalized = {
    farmerId:    _str(row.farmerId),
    displayName: name,
    country:     _str(row.country),
    region:      _str(row.region),
    crop:        _str(row.crop),
    farmSize,
    language:    _str(row.language),
    village:     _str(row.village),
    gender,
    ageRange,
  };
  if (contact)   normalized.phoneNumber = contact;
  if (appUserId) normalized.appUserId   = appUserId;
  return { ok: true, normalized };
}

/**
 * importFarmers(rows) → { ok, rejected, total }
 *
 * Bulk validator. Returns:
 *   ok        \u2014 array of normalised rows ready to feed into
 *                farmerContext + farmerSource
 *   rejected  \u2014 array of `{ row, reason }` for the UI to
 *                surface in an admin "errors" panel
 *   total     \u2014 the original row count (for "ok of total"
 *                metrics)
 *
 * Never throws. Non-array input collapses to an empty result.
 */
export function importFarmers(rows) {
  const out = { ok: [], rejected: [], total: 0 };
  if (!Array.isArray(rows)) return out;
  out.total = rows.length;
  for (const row of rows) {
    const result = validateFarmerRow(row);
    if (result.ok) {
      out.ok.push(result.normalized);
    } else {
      out.rejected.push({ row, reason: result.reason });
    }
  }
  return out;
}

export default { validateFarmerRow, importFarmers };
