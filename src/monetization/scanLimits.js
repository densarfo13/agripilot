/**
 * scanLimits.js — tier-aware scan limits.
 *
 * Free tier
 *   • Scan history capped at 10 entries when displayed.
 *   • Soft cap on scans-per-day (40) — we never block the scan
 *     button outright (acceptance rule: "do not block onboarding
 *     or daily plan"; we extend the same posture to a single
 *     scan). The cap exists so power-use can be metered later
 *     when payment lands.
 *
 * Pro tier
 *   • Unlimited scans.
 *   • Unlimited history surfaced.
 *
 * The monetization flag (`monetization`) is the master switch. When
 * off, every helper here returns the unbounded values regardless
 * of stored tier — pilots not yet on the monetization track see
 * no limits.
 *
 * Strict-rule audit
 *   • Pure functions. No DOM access.
 *   • Never throws.
 *   • Limits are hint-only — the surfaces decide whether to apply
 *     them. Engines never gate themselves.
 */

import { isFeatureEnabled } from '../config/features.js';
import { isPro } from './userTier.js';

export const FREE_HISTORY_CAP = 10;
export const FREE_DAILY_SCAN_CAP = 40;

function _enforced() {
  // When the monetization flag is off, every limit lifts.
  return isFeatureEnabled('monetization');
}

/** Cap a list of history entries to the tier limit. */
export function capScanHistory(history) {
  const arr = Array.isArray(history) ? history : [];
  if (!_enforced() || isPro()) return arr;
  if (arr.length <= FREE_HISTORY_CAP) return arr;
  return arr.slice(0, FREE_HISTORY_CAP);
}

/** How many entries the user is currently allowed to see. */
export function getScanHistoryLimit() {
  if (!_enforced() || isPro()) return Infinity;
  return FREE_HISTORY_CAP;
}

/** Daily scan budget. Returns Infinity for pro / flag-off. */
export function getDailyScanCap() {
  if (!_enforced() || isPro()) return Infinity;
  return FREE_DAILY_SCAN_CAP;
}

/**
 * `true` when an entry is hidden because of the cap. UIs can use
 * this to render a "Upgrade to see all" footer instead of a hard
 * cut-off with no explanation.
 */
export function isHistoryTruncated(history) {
  if (!Array.isArray(history)) return false;
  if (!_enforced() || isPro()) return false;
  return history.length > FREE_HISTORY_CAP;
}

export default {
  FREE_HISTORY_CAP,
  FREE_DAILY_SCAN_CAP,
  capScanHistory,
  getScanHistoryLimit,
  getDailyScanCap,
  isHistoryTruncated,
};
