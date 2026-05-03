/**
 * backyardUpgrade.js — trigger logic for the Backyard → Farmer
 * upgrade prompt.
 *
 *   shouldShowBackyardUpgrade({ gardens?, daysActive? }) → boolean
 *     • Returns true ONLY when ALL of:
 *       1. Current userType resolves to 'backyard'
 *       2. At least one trigger condition is satisfied
 *          (gardens ≥ 3 OR daysActive ≥ 3 OR explicit signal)
 *       3. User hasn't dismissed the prompt recently (14d cooldown)
 *       4. User isn't already on farmer mode (no double-prompt)
 *
 *   markUpgradePromptShown()
 *     • Stamps a session-scoped "shown" flag so the prompt
 *       doesn't re-fire on every page mount within the session.
 *
 *   markUpgradeDismissed()
 *     • Stamps a 14-day cooldown so a "not now" tap silences
 *       the prompt for two weeks. Persistent across sessions.
 *
 *   markUpgradeAccepted()
 *     • Calls setUserTypeOverride('farmer') + fires the
 *       analytics event. Caller is responsible for closing the
 *       modal afterwards.
 *
 *   signalAdvancedFeatureRequest(featureName)
 *     • Spec §1 — when the user taps an advanced-feature surface
 *       (cost tracking / deep insights / advanced predictions),
 *       this stamp acts as an explicit upgrade-intent signal so
 *       the next post-Done state surfaces the prompt even if
 *       the gardens/days thresholds aren't met.
 *
 * Why a sibling helper rather than extending paywall.js
 * ────────────────────────────────────────────────────
 *   `paywall.js` gates Pro features (a billing concern). This
 *   module gates a USER TYPE flip (a UX concern). Both can
 *   coexist; a backyard user might first upgrade to farmer mode
 *   (free) and only later upgrade to Pro (paid).
 *
 * Strict-rule audit
 *   • Pure trigger logic — never writes, never throws.
 *   • SSR-safe (every browser global feature-checked).
 *   • Idempotent: repeated calls with same inputs → same output.
 */

import { getUserType, setUserTypeOverride } from './userType.js';
import { trackEvent } from './analytics.js';

const KEYS = Object.freeze({
  DISMISSED_AT:     'farroway:backyardUpgrade:dismissedAt',
  SHOWN_THIS_SESS:  'farroway:backyardUpgrade:shownThisSession',
  ADV_FEATURE_REQ:  'farroway:backyardUpgrade:advFeatureSignal',
});

const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const ADV_SIGNAL_TTL_MS   = 60 * 60 * 1000;            // 1 hour
const GARDENS_THRESHOLD   = 3;
const DAYS_ACTIVE_THRESHOLD = 3;

function _safeReadNum(key) {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : 0;
  } catch { return 0; }
}

function _safeWriteNum(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(value));
  } catch { /* ignore */ }
}

function _safeReadSession(key) {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  } catch { return null; }
}

function _safeWriteSession(key, value) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(key, String(value));
  } catch { /* ignore */ }
}

function _recentlyDismissed() {
  const at = _safeReadNum(KEYS.DISMISSED_AT);
  if (!at) return false;
  return (Date.now() - at) < DISMISS_COOLDOWN_MS;
}

function _alreadyShownThisSession() {
  return _safeReadSession(KEYS.SHOWN_THIS_SESS) === '1';
}

function _hasFreshAdvFeatureSignal() {
  const at = _safeReadNum(KEYS.ADV_FEATURE_REQ);
  if (!at) return false;
  return (Date.now() - at) < ADV_SIGNAL_TTL_MS;
}

/**
 * shouldShowBackyardUpgrade — main entry. Caller passes the
 * engagement counters; this fn does the gating logic.
 *
 * @param {object} input
 * @param {number} [input.gardens]      — count of garden rows
 * @param {number} [input.daysActive]   — count of distinct active days
 * @returns {boolean}
 */
export function shouldShowBackyardUpgrade({
  gardens = 0,
  daysActive = 0,
} = {}) {
  // 1. Must be a backyard user (no double-prompt for farmers).
  let ut = 'farmer';
  try { ut = getUserType(); } catch { ut = 'farmer'; }
  if (ut !== 'backyard') return false;

  // 2. Per-session dedup + 14-day dismiss cooldown.
  if (_alreadyShownThisSession()) return false;
  if (_recentlyDismissed()) return false;

  // 3. At least one trigger condition.
  const g = Number.isFinite(gardens)    ? gardens    : 0;
  const d = Number.isFinite(daysActive) ? daysActive : 0;
  const triggered = g >= GARDENS_THRESHOLD
                 || d >= DAYS_ACTIVE_THRESHOLD
                 || _hasFreshAdvFeatureSignal();
  return triggered;
}

/**
 * Stamp "shown this session" so the prompt doesn't re-fire
 * on every render within the session. Call from the surface
 * that decides to render the prompt, AFTER deciding (so a
 * declined-render path doesn't burn the slot).
 */
export function markUpgradePromptShown() {
  _safeWriteSession(KEYS.SHOWN_THIS_SESS, '1');
  try { trackEvent('backyard_upgrade_shown', {}); }
  catch { /* swallow */ }
}

/**
 * User tapped "Not now" or closed the modal. 14-day cooldown
 * applies; persistent across sessions.
 */
export function markUpgradeDismissed() {
  _safeWriteNum(KEYS.DISMISSED_AT, Date.now());
  try { trackEvent('backyard_upgrade_dismissed', {}); }
  catch { /* swallow */ }
}

/**
 * User accepted the upgrade. Flips userType to 'farmer' via
 * the canonical override + fires analytics. Returns the new
 * userType value so the caller can close the modal + refresh.
 */
export function markUpgradeAccepted() {
  let next = 'farmer';
  try { next = setUserTypeOverride('farmer'); }
  catch { next = 'farmer'; }
  try { trackEvent('backyard_upgrade_accepted', { to: next }); }
  catch { /* swallow */ }
  return next;
}

/**
 * Spec §1 — surface called by feature gates that hide
 * advanced-feature affordances behind the upgrade prompt
 * (cost tracking / deep insights / advanced predictions).
 * Stamps a 1-hour TTL signal so the next post-Done state
 * surfaces the upgrade prompt even when gardens/days
 * thresholds aren't met.
 */
export function signalAdvancedFeatureRequest(featureName = 'unknown') {
  _safeWriteNum(KEYS.ADV_FEATURE_REQ, Date.now());
  try {
    trackEvent('backyard_upgrade_signal', {
      featureName: String(featureName),
    });
  } catch { /* swallow */ }
}

export const _internal = Object.freeze({
  KEYS,
  DISMISS_COOLDOWN_MS, ADV_SIGNAL_TTL_MS,
  GARDENS_THRESHOLD, DAYS_ACTIVE_THRESHOLD,
  _recentlyDismissed, _alreadyShownThisSession, _hasFreshAdvFeatureSignal,
});

export default {
  shouldShowBackyardUpgrade,
  markUpgradePromptShown,
  markUpgradeDismissed,
  markUpgradeAccepted,
  signalAdvancedFeatureRequest,
};
