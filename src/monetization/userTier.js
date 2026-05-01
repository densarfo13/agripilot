/**
 * userTier.js — local-first user tier (free | pro) for the
 * Farroway monetization layer.
 *
 * Storage
 *   farroway_user_tier  : 'free' | 'pro'   (defaults to 'free')
 *
 * Why local-first
 *   Pilot ships ahead of the payment integration. The local store
 *   is the single source of truth today; when a backend
 *   `/api/billing/me` lands, this module is the only callsite that
 *   needs to swap its read path. Helpers stay stable.
 *
 * Strict-rule audit
 *   • Never throws — every storage op try/catch wrapped.
 *   • Works offline.
 *   • Pure module functions; safe to import from anywhere.
 *   • Emits `farroway:tier_changed` so subscribed surfaces
 *     refresh on cross-tab + same-tab tier flips.
 *   • Tier flips never affect onboarding or the daily plan —
 *     enforcement lives only in the surfaces that opt in
 *     (scan history cap, advanced-insights gate, weekly report
 *     gate, personalized-recs gate).
 */

export const TIER_KEY = 'farroway_user_tier';
export const TIER_FREE = 'free';
export const TIER_PRO  = 'pro';
const TIERS = Object.freeze([TIER_FREE, TIER_PRO]);
const CHANGE_EVENT = 'farroway:tier_changed';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TIER_KEY);
  } catch { return null; }
}

function _safeWrite(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(TIER_KEY, String(value || TIER_FREE));
  } catch { /* swallow quota / private mode */ }
}

function _emitChange(tier) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      const ev = (typeof CustomEvent === 'function')
        ? new CustomEvent(CHANGE_EVENT, { detail: { tier } })
        : new Event(CHANGE_EVENT);
      window.dispatchEvent(ev);
    }
  } catch { /* swallow */ }
}

/** Current tier. Defaults to `'free'` when unset / unrecognised. */
export function getUserTier() {
  const raw = _safeRead();
  const v = String(raw || '').toLowerCase();
  return TIERS.includes(v) ? v : TIER_FREE;
}

/** Set tier. Returns the resolved tier (clamped to known values). */
export function setUserTier(next) {
  const v = String(next || '').toLowerCase();
  const resolved = TIERS.includes(v) ? v : TIER_FREE;
  _safeWrite(resolved);
  _emitChange(resolved);
  return resolved;
}

export function isPro()  { return getUserTier() === TIER_PRO;  }
export function isFree() { return getUserTier() === TIER_FREE; }

/** Test / admin: clear the stored tier (becomes 'free' on next read). */
export function _resetUserTier() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TIER_KEY);
    }
  } catch { /* swallow */ }
  _emitChange(TIER_FREE);
}

export const TIER_CHANGED_EVENT = CHANGE_EVENT;

export default {
  TIER_KEY,
  TIER_FREE,
  TIER_PRO,
  TIER_CHANGED_EVENT,
  getUserTier,
  setUserTier,
  isPro,
  isFree,
};
