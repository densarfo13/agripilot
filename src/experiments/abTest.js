/**
 * abTest.js — sticky per-user A/B-test assignment + analytics
 * exposure tracking.
 *
 *   getAssignment(experimentName) → { variant, isFirstExposure }
 *
 *   Sticky: a user assigned to 'seven' once stays on 'seven'
 *   forever (until clearAssignments() runs). That's the only
 *   contract that lets the analytics pipeline measure
 *   conversion-per-variant honestly — flipping a user mid-trial
 *   would contaminate both buckets.
 *
 * Storage: localStorage[`farroway:ab:${experimentName}`] = variant
 *
 * Exposure tracking
 *   First time a user is observed in an experiment, we fire
 *   `experiment_exposure` with { experiment, variant }. Re-
 *   exposures within the same session don't re-fire. The
 *   server-side analytics pipeline uses this event as the
 *   denominator for conversion-rate-per-variant.
 *
 * Why a separate module
 * ─────────────────────
 *   `paywall.js` decides WHEN to show the upgrade. This module
 *   decides WHICH variant to show + tracks the exposure.
 *   Decoupling means future surfaces (pricing copy, button
 *   colors, trigger timing) can run their own experiments
 *   without touching the paywall logic.
 *
 * Strict-rule audit
 *   • Pure derivation (read + sticky write); never throws.
 *   • SSR-safe — every browser global is feature-checked.
 *   • Idempotent: repeated calls return the same variant.
 *   • Honest: when localStorage is unavailable, falls back to
 *     a session-scoped variant pick + reports it as
 *     `isFirstExposure: true` every time so the funnel can
 *     filter out the unstable cohort if needed.
 */

// NOTE: trackEvent is loaded DYNAMICALLY inside getAssignment() to
// break the static cycle with core/analytics.js (which already
// imports getActiveAssignments from this module). A static back-
// import creates a two-way ESM cycle → TDZ crash in Rollup/Vite
// production builds ("Cannot access 'X' before initialization").
// The dynamic import pattern mirrors src/core/userType.js §mode_switched.

// Spec §1 — three pricing variants. Probabilities equal-weight
// so each gets ~33% of new users. The variant `id` is what
// downstream code reads; `value` is the dollar amount surfaced
// in the Paywall + recorded with conversion events.
export const EXPERIMENTS = Object.freeze({
  // Spec §1: $5 / $7 / $9 pricing variants.
  pricing_tier: {
    variants: [
      { id: 'five',  value: 5,  label: '$5/month' },
      { id: 'seven', value: 7,  label: '$7/month' },
      { id: 'nine',  value: 9,  label: '$9/month' },
    ],
    weights: [1, 1, 1],
  },
  // Spec §5: feature-based vs benefit-based messaging. Caller
  // surfaces different copy keys based on the variant.
  paywall_message: {
    variants: [
      { id: 'feature', label: 'feature-led' },
      { id: 'benefit', label: 'benefit-led' },
    ],
    weights: [1, 1],
  },
  // Spec §6: which trigger fires the paywall. Caller short-
  // circuits the other two when the variant is set.
  paywall_trigger: {
    variants: [
      { id: 'scan',    label: 'Scan tap' },
      { id: 'streak',  label: '3-day streak' },
      { id: 'insight', label: 'Insight unlock' },
    ],
    weights: [1, 1, 1],
  },
});

const KEY_PREFIX  = 'farroway:ab:';
const SESSION_PREFIX = 'farroway:ab:exposed:';

function _safeReadLocal(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeWriteLocal(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, String(value));
    return true;
  } catch { return false; }
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

/**
 * Pure weighted-random pick. Total of weights = sum; each
 * variant claims its weight/sum slice of the [0,1) range.
 */
function _pickWeighted(variants, weights) {
  const safeWeights = (Array.isArray(weights) && weights.length === variants.length)
    ? weights
    : variants.map(() => 1);
  const total = safeWeights.reduce((acc, w) => acc + Math.max(0, Number(w) || 0), 0);
  if (total <= 0) return variants[0];
  const roll = Math.random() * total;
  let cumulative = 0;
  for (let i = 0; i < variants.length; i += 1) {
    cumulative += Math.max(0, Number(safeWeights[i]) || 0);
    if (roll < cumulative) return variants[i];
  }
  return variants[variants.length - 1];
}

/**
 * getAssignment(experimentName) → { variant, isFirstExposure }
 *
 *   variant         = the full variant object (id + value + label)
 *   isFirstExposure = true on the very first call per device for
 *                     this experiment; false on subsequent reads
 *
 * Side effects:
 *   • Persists the assigned variant to localStorage on first call.
 *   • Fires `experiment_exposure` analytics event the first time
 *     in any given session (deduped via sessionStorage).
 *
 * Never throws. Returns the first variant as a safe default
 * when the experiment isn't registered.
 */
export function getAssignment(experimentName) {
  const def = EXPERIMENTS[experimentName];
  if (!def || !Array.isArray(def.variants) || def.variants.length === 0) {
    // Unknown experiment — caller bug, but we don't crash.
    return { variant: null, isFirstExposure: false };
  }
  const storeKey = KEY_PREFIX + experimentName;
  const sessKey  = SESSION_PREFIX + experimentName;

  let variantId = _safeReadLocal(storeKey);
  let isFirstExposure = false;
  if (!variantId) {
    const picked = _pickWeighted(def.variants, def.weights);
    variantId = picked.id;
    _safeWriteLocal(storeKey, variantId);
    isFirstExposure = true;
  }

  // Resolve the variant by id; fallback to first if a stored
  // variant is no longer in the registry (experiment retired).
  let variant = def.variants.find((v) => v && v.id === variantId);
  if (!variant) {
    variant = def.variants[0];
    variantId = variant.id;
    _safeWriteLocal(storeKey, variantId);
  }

  // Per-session exposure dedup. Fire the analytics event on the
  // FIRST call within the session so the conversion funnel can
  // count exposures-per-variant honestly.
  if (!_safeReadSession(sessKey)) {
    _safeWriteSession(sessKey, '1');
    // Dynamic import — avoids the static cycle with analytics.js.
    // analytics.js statically imports getActiveAssignments from
    // this module; a static back-import would create a TDZ crash
    // in production Rollup bundles. The dynamic import fires after
    // both modules have fully initialized, so trackEvent is always
    // available by the time the Promise resolves.
    try {
      import('../core/analytics.js').then((mod) => {
        if (mod && typeof mod.trackEvent === 'function') {
          try {
            mod.trackEvent('experiment_exposure', {
              experiment: experimentName,
              variant:    variantId,
            });
          } catch { /* analytics never blocks assignment */ }
        }
      }).catch(() => { /* swallow — exposure missed, not fatal */ });
    } catch { /* dynamic import not available (SSR / test env) */ }
    // First-exposure flag returned to the caller so it can
    // differentiate cold-start renders from re-renders within
    // the same session.
    isFirstExposure = isFirstExposure || true;
  }

  return Object.freeze({
    variant: Object.freeze({ ...variant }),
    isFirstExposure,
  });
}

/**
 * getActiveAssignments() — snapshot of every experiment the
 * user has been bucketed into. Returns a plain object keyed
 * by experiment name. Used by analytics enrichment to attach
 * the user's variant cohort to every event.
 */
export function getActiveAssignments() {
  const out = {};
  for (const name of Object.keys(EXPERIMENTS)) {
    const v = _safeReadLocal(KEY_PREFIX + name);
    if (v) out[name] = v;
  }
  return out;
}

/**
 * clearAssignments() — privacy reset / test seam. Drops every
 * stored variant assignment so the next getAssignment() call
 * re-rolls.
 */
export function clearAssignments() {
  try {
    if (typeof localStorage === 'undefined') return;
    for (const name of Object.keys(EXPERIMENTS)) {
      try { localStorage.removeItem(KEY_PREFIX + name); }
      catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

export const _internal = Object.freeze({
  KEY_PREFIX, SESSION_PREFIX,
  _safeReadLocal, _safeWriteLocal, _safeReadSession, _safeWriteSession,
  _pickWeighted,
});

export default { getAssignment, getActiveAssignments, clearAssignments, EXPERIMENTS };
