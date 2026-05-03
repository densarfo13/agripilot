/**
 * userType.js — derives the spec's `userType: 'farmer' | 'backyard'`
 * field from the existing experience signal.
 *
 *   getUserType() → 'farmer' | 'backyard'
 *
 *   isBackyardUser() / isFarmerUser() — sugar for call sites
 *   that just want a boolean.
 *
 *   onUserTypeChange(handler) — subscribes to the existing
 *   `farroway:experience_switched` event so any consumer can
 *   re-render when the user flips mode. Returns an unsubscribe.
 *
 * Why a separate helper rather than coupling to multiExperience
 * ────────────────────────────────────────────────────────────
 *   The existing model uses `activeExperience: 'farm' | 'garden'`
 *   + `farmType: 'backyard' | 'small_farm'` on rows. The Dual-
 *   Mode UX spec asks for a top-level `userType` field with the
 *   exact values 'farmer' | 'backyard'. Rather than introduce a
 *   third storage key (drift risk), this helper DERIVES the
 *   userType from the existing signals — it's always in sync.
 *
 * Resolution
 *   1. Sticky override in localStorage (Settings → Mode switch)
 *      so a user can manually flip even if the active row would
 *      suggest otherwise. Spec §7.
 *   2. Active experience: 'garden' → 'backyard'
 *   3. Active row farmType: 'backyard' / 'home_garden' / 'home'
 *      → 'backyard'
 *   4. Fall through → 'farmer' (the conservative default — full
 *      feature set, never hides functionality the user might
 *      need).
 *
 * Strict-rule audit
 *   • Pure derivation (read-only).
 *   • Never throws — every storage call wrapped.
 *   • SSR-safe (every browser global is feature-checked).
 *   • Idempotent — repeated calls produce identical output.
 */

import {
  getActiveExperience,
  getActiveEntity,
  EXPERIENCE,
  SWITCH_EVENT,
} from '../store/multiExperience.js';

const OVERRIDE_KEY = 'farroway:userType:override';

function _safeReadOverride() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const v = localStorage.getItem(OVERRIDE_KEY);
    return (v === 'farmer' || v === 'backyard') ? v : null;
  } catch { return null; }
}

function _safeWriteOverride(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null) localStorage.removeItem(OVERRIDE_KEY);
    else                localStorage.setItem(OVERRIDE_KEY, String(value));
  } catch { /* ignore */ }
}

/**
 * getUserType() — returns 'farmer' | 'backyard' for the current
 * session. Pure read; never writes.
 */
export function getUserType() {
  // 1. Sticky override (spec §7 manual mode switch).
  const override = _safeReadOverride();
  if (override) return override;

  // 2. Active experience.
  let exp = null;
  try { exp = getActiveExperience(); }
  catch { exp = null; }
  if (exp === EXPERIENCE.GARDEN) return 'backyard';

  // 3. Active row farmType (defensive — covers cases where
  //    activeExperience hasn't been pinned yet).
  let entity = null;
  try { entity = getActiveEntity(); }
  catch { entity = null; }
  const ft = String(entity && entity.farmType || '').toLowerCase();
  if (ft === 'backyard' || ft === 'home_garden' || ft === 'home') {
    return 'backyard';
  }

  // 4. Conservative default — full feature set.
  return 'farmer';
}

/** Sugar: true when the active session is a backyard user. */
export function isBackyardUser() { return getUserType() === 'backyard'; }

/** Sugar: true when the active session is a farmer user. */
export function isFarmerUser() { return getUserType() === 'farmer'; }

/**
 * setUserTypeOverride(value) — Settings page calls this when the
 * user manually flips mode (spec §7). Pass null to clear and
 * fall back to the derived value.
 *
 * Dual-Mode Analytics §7 — fires a `mode_switched` event
 * carrying { from, to } so the analytics pipeline can attribute
 * upgrade signals (backyard→farmer) and downgrade signals
 * (farmer→backyard) without ambiguity. Same payload shape
 * regardless of whether the override was set, cleared, or
 * unchanged. Wrapped in try/catch so analytics never blocks
 * the override write.
 */
export function setUserTypeOverride(value) {
  const previous = getUserType();
  let result = null;
  if (value === 'farmer' || value === 'backyard') {
    _safeWriteOverride(value);
    result = value;
  } else if (value === null || value === undefined) {
    _safeWriteOverride(null);
    result = null;
  } else {
    return null;
  }
  // Resolve the post-write effective value. When `result` is
  // null (override cleared), the next derivation chain step
  // takes over — this lets us emit the actual current state
  // rather than the literal arg.
  const next = result || getUserType();
  if (next !== previous) {
    try {
      // Top-level import would create a cycle (analytics.js →
      // userType.js → analytics.js); a fire-and-forget dynamic
      // import keeps the pipeline decoupled.
      import('./analytics.js').then((mod) => {
        if (mod && typeof mod.trackEvent === 'function') {
          try { mod.trackEvent('mode_switched', { from: previous, to: next }); }
          catch { /* analytics never blocks state */ }
        }
      }).catch(() => { /* swallow */ });
    } catch { /* swallow */ }
  }
  return result;
}

/**
 * onUserTypeChange(handler) — subscribes to the existing
 * `farroway:experience_switched` event so consumers can re-
 * render when the active mode flips. Returns an unsubscribe.
 *
 * Caller pattern:
 *   useEffect(() => onUserTypeChange((t) => setUt(t)), []);
 */
export function onUserTypeChange(handler) {
  if (typeof handler !== 'function'
      || typeof window === 'undefined') {
    return () => {};
  }
  const wrapped = () => {
    try { handler(getUserType()); } catch { /* never propagate */ }
  };
  try { window.addEventListener(SWITCH_EVENT, wrapped); }
  catch { return () => {}; }
  return () => {
    try { window.removeEventListener(SWITCH_EVENT, wrapped); }
    catch { /* ignore */ }
  };
}

export const _internal = Object.freeze({
  OVERRIDE_KEY,
  _safeReadOverride, _safeWriteOverride,
});

export default {
  getUserType, isBackyardUser, isFarmerUser,
  setUserTypeOverride, onUserTypeChange,
};
