/**
 * farmerSource.js — single source of truth for "how did this
 * farmer arrive in the app?" (NGO Onboarding spec §1).
 *
 *   import {
 *     getFarmerSource, setFarmerSource, isProgramFarmer,
 *     clearFarmerSource,
 *   } from '../core/farmerSource.js';
 *
 *   // After NGO bulk-import:
 *   setFarmerSource({
 *     source:         'ngo',
 *     programId:      'prog_001',
 *     organizationId: 'org_001',
 *     farmerId:       'farmer_xyz',
 *   });
 *
 *   // Anywhere a route guard needs to know:
 *   isProgramFarmer();   // \u2192 true for ngo/program; false for individual
 *
 * Storage
 * ───────
 *   farroway_farmer_source  \u2192  JSON `{ source, programId?, organizationId?, farmerId? }`
 *
 * Spec rule (§1):
 *   source: 'individual' | 'ngo' | 'program'
 *   programId?:      string (NGO/program flows only)
 *   organizationId?: string (NGO/program flows only)
 *
 * Routing rule (§1):
 *   source === 'ngo' or 'program'   \u2192 skip full onboarding,
 *                                     route to Today / Plan Ready
 *   source === 'individual'         \u2192 normal onboarding flow
 *
 * Strict-rule audit
 *   \u2022 Pure outside the localStorage I/O. Wrapped + safe.
 *   \u2022 SSR-safe: typeof localStorage check before every access.
 *   \u2022 Unknown / corrupt entries return null (callers default
 *     to 'individual' \u2014 the additive, safer behaviour).
 *   \u2022 Idempotent: setting the same source twice is a no-op.
 *   \u2022 Privacy: only the source taxonomy + the program /
 *     organization / farmer IDs the NGO supplied. No personal
 *     fields beyond what the import already carries.
 */

export const FARMER_SOURCE_KEY = 'farroway_farmer_source';

const ALLOWED_SOURCES = new Set(['individual', 'ngo', 'program']);

function _safeGet() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(FARMER_SOURCE_KEY);
  } catch { return null; }
}

function _safeSet(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(FARMER_SOURCE_KEY, String(value));
  } catch { /* swallow \u2014 quota / private mode */ }
}

function _safeRemove() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(FARMER_SOURCE_KEY);
  } catch { /* swallow */ }
}

/**
 * getFarmerSource() \u2192 source object | null.
 *
 * Returns null when nothing is stored OR the entry is
 * unparseable / wrong-shape. Callers should treat null as
 * "individual user, no program" \u2014 the safe default that
 * keeps the existing onboarding flow intact.
 *
 * @returns {{
 *   source:          'individual' | 'ngo' | 'program',
 *   programId?:      string,
 *   organizationId?: string,
 *   farmerId?:       string,
 * } | null}
 */
export function getFarmerSource() {
  const raw = _safeGet();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const source = typeof parsed.source === 'string' ? parsed.source : '';
    if (!ALLOWED_SOURCES.has(source)) return null;
    const out = { source };
    if (typeof parsed.programId      === 'string' && parsed.programId)      out.programId      = parsed.programId;
    if (typeof parsed.organizationId === 'string' && parsed.organizationId) out.organizationId = parsed.organizationId;
    if (typeof parsed.farmerId       === 'string' && parsed.farmerId)       out.farmerId       = parsed.farmerId;
    return out;
  } catch {
    // Corrupt entry \u2014 wipe so next read isn't doomed to fail.
    _safeRemove();
    return null;
  }
}

/**
 * setFarmerSource(input) \u2192 stored shape | null.
 *
 * Persists the canonical shape. Returns null when the input
 * is invalid (unknown source value, wrong type). Idempotent:
 * the same input twice produces the same state.
 */
export function setFarmerSource(input) {
  const i = (input && typeof input === 'object') ? input : {};
  const source = typeof i.source === 'string' ? i.source : '';
  if (!ALLOWED_SOURCES.has(source)) return null;
  const record = { source };
  if (typeof i.programId      === 'string' && i.programId)      record.programId      = i.programId;
  if (typeof i.organizationId === 'string' && i.organizationId) record.organizationId = i.organizationId;
  if (typeof i.farmerId       === 'string' && i.farmerId)       record.farmerId       = i.farmerId;
  try {
    _safeSet(JSON.stringify(record));
  } catch { /* swallow */ }
  return record;
}

/**
 * isProgramFarmer() \u2192 boolean.
 *
 * Convenience wrapper: true when the source is 'ngo' or
 * 'program' (i.e. the routing rule should skip individual
 * onboarding). False for 'individual' or missing source.
 */
export function isProgramFarmer() {
  const cur = getFarmerSource();
  if (!cur) return false;
  return cur.source === 'ngo' || cur.source === 'program';
}

/** Reset \u2014 used by the privacy clear surface. */
export function clearFarmerSource() {
  _safeRemove();
}

export default {
  FARMER_SOURCE_KEY,
  getFarmerSource,
  setFarmerSource,
  isProgramFarmer,
  clearFarmerSource,
};
