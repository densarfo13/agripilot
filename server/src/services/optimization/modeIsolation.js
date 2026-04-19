/**
 * modeIsolation.js — enforces that Backyard and Farm optimization
 * outputs never contaminate each other.
 *
 * The guarantees this module provides:
 *
 *   1. Adjustments keyed for mode=backyard NEVER apply when the
 *      caller is in mode=farm (and vice versa).
 *   2. Listing-quality optimization is FARM-ONLY by default.
 *      Backyard users don't list produce the same way — feature
 *      flag needed to extend this to backyard later.
 *   3. Personal adjustments carry the user's mode; if their mode
 *      changes, the old mode's adjustments stop applying
 *      immediately rather than bleeding into the new one.
 *   4. A validator surfaces mode mismatches so dev tooling can
 *      flag them.
 *
 * All functions are pure — they never mutate their input.
 */

import { parseContextKey } from './contextKey.js';
import { parseScopeFromKey, regionalKeyFromPersonal } from './personalVsRegional.js';

export const MODES = Object.freeze({
  BACKYARD: 'backyard',
  FARM:     'farm',
});

const LISTING_MODE_ALLOWLIST = Object.freeze(new Set([MODES.FARM]));

function keyToMode(key) {
  const scope = parseScopeFromKey(key);
  const pure = scope === 'personal' ? regionalKeyFromPersonal(key) : key;
  const parsed = parseContextKey(pure);
  return String(parsed.mode || '').toLowerCase();
}

/**
 * enforceModeIsolation — filter an adjustments-by-key map to
 * entries that match the caller's current mode. Keys with no
 * mode (e.g. the listing `|country|state||` shape) are kept
 * because they're regional-only metadata.
 *
 * @param {object} adjustments  either { byContext } or a raw map
 * @param {{ mode: 'backyard'|'farm'|null }} opts
 */
export function enforceModeIsolation(adjustments = {}, { mode = null } = {}) {
  const byContext = adjustments.byContext || adjustments;
  if (!mode) {
    return { byContext: { ...byContext }, dropped: [] };
  }
  const target = String(mode).toLowerCase();
  const next = {};
  const dropped = [];
  for (const [key, adj] of Object.entries(byContext || {})) {
    const km = keyToMode(key);
    if (km && km !== target) {
      dropped.push({ key, mode: km });
      continue;
    }
    next[key] = adj;
  }
  return { byContext: next, dropped };
}

/**
 * validateModeAwareOptimization — dev-facing check that an
 * adjustment matches the caller's mode. Used by the dev panel
 * to flag mode-mismatched adjustments that would otherwise be
 * silently dropped.
 */
export function validateModeAwareOptimization(adjustment, mode) {
  if (!adjustment || !adjustment.contextKey) {
    return { valid: true };
  }
  const km = keyToMode(adjustment.contextKey);
  const target = String(mode || '').toLowerCase();
  if (!km) return { valid: true, reason: 'no_mode_in_key' };
  if (target && km !== target) {
    return {
      valid: false,
      reason: 'mode_mismatch',
      keyMode: km,
      callerMode: target,
    };
  }
  return { valid: true };
}

/**
 * stripListingDeltasForBackyard — listing quality optimization
 * is FARM-ONLY. If a backyard adjustment somehow carries a
 * listingQualityDelta, zero it out. Returns a new object.
 */
export function stripListingDeltasForBackyard(adjustment, mode) {
  if (!adjustment || typeof adjustment !== 'object') return adjustment;
  const target = String(mode || '').toLowerCase();
  if (LISTING_MODE_ALLOWLIST.has(target)) return adjustment;
  if (Number(adjustment.listingQualityDelta) === 0) return adjustment;
  return { ...adjustment, listingQualityDelta: 0 };
}

/**
 * enforceListingModeAllowlist — apply the listing-mode gate
 * across every adjustment in a map.
 */
export function enforceListingModeAllowlist(adjustments = {}, { mode = null } = {}) {
  if (LISTING_MODE_ALLOWLIST.has(String(mode || '').toLowerCase())) {
    return adjustments;
  }
  const byContext = adjustments.byContext || adjustments;
  const next = {};
  for (const [k, v] of Object.entries(byContext || {})) {
    next[k] = stripListingDeltasForBackyard(v, mode);
  }
  return { byContext: next };
}

/**
 * summarizeModeCoverage — dashboard-friendly rollup so the dev
 * panel can show "we have X backyard adjustments, Y farm
 * adjustments" at a glance.
 */
export function summarizeModeCoverage(adjustments = {}) {
  const byContext = adjustments.byContext || adjustments;
  const out = { backyard: 0, farm: 0, unspecified: 0 };
  for (const key of Object.keys(byContext || {})) {
    const km = keyToMode(key);
    if (km === MODES.BACKYARD) out.backyard += 1;
    else if (km === MODES.FARM) out.farm += 1;
    else out.unspecified += 1;
  }
  return out;
}

export const _internal = { LISTING_MODE_ALLOWLIST, keyToMode };
