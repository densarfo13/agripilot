/**
 * simpleModeEngine.js — three-tier complexity engine for the Simple
 * Mode spec.
 *
 *   const mode = getSimpleMode();      // 'SIMPLE' | 'STANDARD' | 'ADVANCED'
 *   if (isFeatureVisible('funding', mode)) ...
 *
 * Why a separate engine
 * ─────────────────────
 *   userExperienceMode.js (shipped earlier) categorises WHO the user
 *   is — new_gardener / experienced_gardener / smallholder_farmer /
 *   commercial_farmer / ngo_manager. That's the persona axis.
 *
 *   This module is the SECOND axis: HOW MUCH COMPLEXITY do they want
 *   on screen right now. A new_gardener AND a commercial_farmer can
 *   both prefer SIMPLE mode; an experienced_gardener can graduate
 *   to ADVANCED while still being a gardener.
 *
 *   Defaults are conservative — new users get SIMPLE, and they only
 *   graduate when they've demonstrated readiness through real
 *   engagement signals (scans completed, tasks completed, no
 *   recent abandoned flows). Manual override is always available.
 *
 * What this module does NOT do
 * ────────────────────────────
 *   • It doesn't modify existing UI surfaces. Each surface (Home,
 *     BottomNav, Tasks, Scan) chooses when/how to adopt — the
 *     engine exposes the gates and visibility rules; consumers
 *     opt in.
 *   • It doesn't "force" the user up or down a tier. The promotion
 *     engine only RECOMMENDS — the user (or a future settings UI)
 *     decides.
 *   • It doesn't track keystrokes or anything privacy-sensitive.
 *     Signals are derived from existing aiMemoryStore counters
 *     and explicit user actions.
 *
 * Strict-rule audit
 *   • Pure helpers + a small localStorage-backed mode store.
 *     Never throws. SSR-safe.
 *   • Empty store / brand-new user → SIMPLE (the conservative
 *     default the spec calls out: "new users start in SIMPLE").
 *   • Manual override persists indefinitely. Adaptive promotion
 *     never overrides an explicit user choice.
 */

export const SIMPLE_MODE_STORAGE_KEY = 'farroway_simple_mode_v1';

export const COMPLEXITY_MODES = Object.freeze({
  SIMPLE:   'SIMPLE',
  STANDARD: 'STANDARD',
  ADVANCED: 'ADVANCED',
});

const _MODE_ORDER = Object.freeze([
  COMPLEXITY_MODES.SIMPLE,
  COMPLEXITY_MODES.STANDARD,
  COMPLEXITY_MODES.ADVANCED,
]);

// ─── Feature-visibility matrix ────────────────────────────────
// Single source of truth for which surfaces / signals / nav items
// show in each mode. The spec lists features explicitly — we
// encode them here so every consumer reads from one place.

const _FEATURE_VISIBILITY = Object.freeze({
  // Always visible (operational core — nothing surfaces below SIMPLE).
  home:               { SIMPLE: true, STANDARD: true, ADVANCED: true },
  scan:               { SIMPLE: true, STANDARD: true, ADVANCED: true },
  tasks:              { SIMPLE: true, STANDARD: true, ADVANCED: true },
  progress:           { SIMPLE: true, STANDARD: true, ADVANCED: true },
  journal:            { SIMPLE: true, STANDARD: true, ADVANCED: true },
  care:               { SIMPLE: true, STANDARD: true, ADVANCED: true },

  // Commercial surfaces — hidden in SIMPLE per spec §3.
  funding:            { SIMPLE: false, STANDARD: true, ADVANCED: true },
  sell:               { SIMPLE: false, STANDARD: true, ADVANCED: true },
  market_opportunity: { SIMPLE: false, STANDARD: true, ADVANCED: true },
  buyer_ecosystem:    { SIMPLE: false, STANDARD: true, ADVANCED: true },

  // Detail surfaces — hidden until STANDARD.
  weather_detail:     { SIMPLE: false, STANDARD: true, ADVANCED: true },
  crop_trends:        { SIMPLE: false, STANDARD: true, ADVANCED: true },
  daily_briefing:     { SIMPLE: false, STANDARD: true, ADVANCED: true },
  field_memory:       { SIMPLE: false, STANDARD: true, ADVANCED: true },

  // Advanced-only — operational dashboards, advanced analytics.
  operational_dash:   { SIMPLE: false, STANDARD: false, ADVANCED: true },
  raw_telemetry:      { SIMPLE: false, STANDARD: false, ADVANCED: true },
  ngo_admin:          { SIMPLE: false, STANDARD: false, ADVANCED: true },
  yield_forecast:     { SIMPLE: false, STANDARD: false, ADVANCED: true },
  multi_farm_compare: { SIMPLE: false, STANDARD: true, ADVANCED: true },
});

// ─── Promotion thresholds ─────────────────────────────────────
// Conservative gates. The user has to demonstrate sustained
// engagement before the engine recommends graduating them.

export const PROMOTION_THRESHOLDS = Object.freeze({
  // SIMPLE → STANDARD
  TO_STANDARD_SCAN_COUNT:    3,
  TO_STANDARD_TASK_COMPLETIONS: 5,
  TO_STANDARD_MIN_DAYS:      7,

  // STANDARD → ADVANCED
  TO_ADVANCED_SCAN_COUNT:    15,
  TO_ADVANCED_TASK_COMPLETIONS: 20,
  TO_ADVANCED_MIN_DAYS:      30,

  // Abandonment signal — too many in the rolling window pushes
  // toward simplification rather than promotion.
  ABANDONMENT_CAP:           3,
});

// ─── Helpers ──────────────────────────────────────────────────

function _normMode(raw) {
  const s = String(raw || '').toUpperCase().trim();
  if (s === 'SIMPLE' || s === 'STANDARD' || s === 'ADVANCED') return s;
  return null;
}

function _readStored() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SIMPLE_MODE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch { return null; }
}

function _write(state) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SIMPLE_MODE_STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota / private mode — non-fatal */ }
}

// ─── Public API: mode store ───────────────────────────────────

/**
 * Read the user's current complexity mode. Defaults to SIMPLE for
 * brand-new users.
 *
 * @returns {'SIMPLE'|'STANDARD'|'ADVANCED'}
 */
export function getSimpleMode() {
  const stored = _readStored();
  if (!stored) return COMPLEXITY_MODES.SIMPLE;
  const mode = _normMode(stored.mode);
  return mode || COMPLEXITY_MODES.SIMPLE;
}

/**
 * Set the user's complexity mode. `setBy` lets the caller record
 * whether this was an explicit user choice ('user') vs an adaptive
 * recommendation accepted on their behalf ('adaptive'). Manual
 * user choices are protected — adaptive promotion never overrides
 * them.
 *
 * @param {'SIMPLE'|'STANDARD'|'ADVANCED'} mode
 * @param {'user'|'adaptive'} [setBy='user']
 * @returns {boolean}
 */
export function setSimpleMode(mode, setBy) {
  const norm = _normMode(mode);
  if (!norm) return false;
  const source = (setBy === 'adaptive') ? 'adaptive' : 'user';
  _write({
    mode:     norm,
    setBy:    source,
    updatedAt: (() => { try { return new Date().toISOString(); } catch { return null; } })(),
  });
  return true;
}

/**
 * Whether the current stored mode was set by an explicit user
 * choice (vs the default or an adaptive accept).
 */
export function isModeUserSet() {
  const stored = _readStored();
  return !!(stored && stored.setBy === 'user');
}

/** Clear the stored mode (sign-out / debug). */
export function clearSimpleMode() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SIMPLE_MODE_STORAGE_KEY);
    }
  } catch { /* swallow */ }
}

// ─── Public API: feature visibility ───────────────────────────

/**
 * Whether a named feature is visible in the supplied mode.
 *
 * @param {string} feature   — key from _FEATURE_VISIBILITY
 * @param {'SIMPLE'|'STANDARD'|'ADVANCED'} [mode]
 * @returns {boolean}        — true when the feature should render
 */
export function isFeatureVisible(feature, mode) {
  const key = String(feature || '').toLowerCase().trim();
  if (!key) return false;
  const norm = _normMode(mode) || getSimpleMode();
  const entry = _FEATURE_VISIBILITY[key];
  if (!entry) {
    // Unknown features default to visible — the engine should not
    // accidentally hide something we forgot to register.
    return true;
  }
  return entry[norm] === true;
}

/** Read-only access to the visibility matrix (debug / settings UI). */
export function getFeatureVisibilityMatrix() {
  return Object.keys(_FEATURE_VISIBILITY).map((k) => ({
    feature:  k,
    SIMPLE:   _FEATURE_VISIBILITY[k].SIMPLE,
    STANDARD: _FEATURE_VISIBILITY[k].STANDARD,
    ADVANCED: _FEATURE_VISIBILITY[k].ADVANCED,
  }));
}

// ─── Public API: navigation gating ────────────────────────────

const _SIMPLE_NAV = Object.freeze({
  farmer:   Object.freeze(['home', 'tasks', 'scan', 'progress']),
  gardener: Object.freeze(['home', 'care',  'scan', 'journal']),
});

const _STANDARD_NAV = Object.freeze({
  farmer:   Object.freeze(['home', 'tasks', 'scan', 'progress', 'sell', 'funding']),
  gardener: Object.freeze(['home', 'care',  'scan', 'journal']),   // gardeners never see sell/funding by default
});

/**
 * Canonical nav-item list for the current mode + userType.
 *
 * @param {'farmer'|'gardener'} userType
 * @param {'SIMPLE'|'STANDARD'|'ADVANCED'} [mode]
 * @returns {string[]}
 */
export function getSimpleModeNavConfig(userType, mode) {
  const t = (userType === 'gardener') ? 'gardener' : 'farmer';
  const m = _normMode(mode) || getSimpleMode();
  if (m === COMPLEXITY_MODES.SIMPLE)   return _SIMPLE_NAV[t].slice();
  if (m === COMPLEXITY_MODES.STANDARD) return _STANDARD_NAV[t].slice();
  // ADVANCED — same as STANDARD plus any admin items the surface
  // chooses to render. We do NOT enumerate enterprise items here;
  // those belong to whichever admin module they live in.
  return _STANDARD_NAV[t].slice();
}

// ─── Public API: adaptive promotion ───────────────────────────

/**
 * Inspect engagement signals and decide whether the user is ready
 * to graduate to the next complexity tier. Returns null when the
 * current tier is still the right fit OR when the user has
 * explicitly set their mode (we never override).
 *
 * Signals input is the caller's responsibility (typically derived
 * from aiMemoryStore + scanHistoryStore + scanToTask):
 *   { scanCount, completedTaskCount, accountAgeDays, abandonedFlows }
 *
 * @param {object} signals
 * @returns {{ from: string, to: string, reason: string }|null}
 */
export function shouldPromote(signals) {
  // Never override an explicit user choice.
  if (isModeUserSet()) return null;
  const current = getSimpleMode();
  if (current === COMPLEXITY_MODES.ADVANCED) return null;

  const safe = (signals && typeof signals === 'object') ? signals : {};
  const scanCount        = Math.max(0, Number(safe.scanCount) || 0);
  const completedTasks   = Math.max(0, Number(safe.completedTaskCount) || 0);
  const accountAgeDays   = Math.max(0, Number(safe.accountAgeDays) || 0);
  const abandonedFlows   = Math.max(0, Number(safe.abandonedFlows) || 0);

  // If the user is struggling (too many abandoned flows), the
  // engine should NEVER promote — it should keep them in their
  // current tier (or, in a separate function, simplify further).
  if (abandonedFlows >= PROMOTION_THRESHOLDS.ABANDONMENT_CAP) return null;

  // SIMPLE → STANDARD: demonstrate routine engagement.
  if (current === COMPLEXITY_MODES.SIMPLE) {
    if (scanCount      >= PROMOTION_THRESHOLDS.TO_STANDARD_SCAN_COUNT
        && completedTasks >= PROMOTION_THRESHOLDS.TO_STANDARD_TASK_COMPLETIONS
        && accountAgeDays >= PROMOTION_THRESHOLDS.TO_STANDARD_MIN_DAYS) {
      return {
        from:   COMPLEXITY_MODES.SIMPLE,
        to:     COMPLEXITY_MODES.STANDARD,
        reason: `${scanCount} scans, ${completedTasks} completed tasks, account ${accountAgeDays} days old`,
      };
    }
    return null;
  }

  // STANDARD → ADVANCED: demonstrate deeper engagement.
  if (current === COMPLEXITY_MODES.STANDARD) {
    if (scanCount      >= PROMOTION_THRESHOLDS.TO_ADVANCED_SCAN_COUNT
        && completedTasks >= PROMOTION_THRESHOLDS.TO_ADVANCED_TASK_COMPLETIONS
        && accountAgeDays >= PROMOTION_THRESHOLDS.TO_ADVANCED_MIN_DAYS) {
      return {
        from:   COMPLEXITY_MODES.STANDARD,
        to:     COMPLEXITY_MODES.ADVANCED,
        reason: `${scanCount} scans, ${completedTasks} completed tasks, account ${accountAgeDays} days old`,
      };
    }
    return null;
  }

  return null;
}

/**
 * The inverse — should we SIMPLIFY further (e.g., user is
 * struggling)? Returns the target mode or null.
 *
 * @param {object} signals
 * @returns {{ from: string, to: string, reason: string }|null}
 */
export function shouldSimplify(signals) {
  if (isModeUserSet()) return null;
  const current = getSimpleMode();
  if (current === COMPLEXITY_MODES.SIMPLE) return null;

  const safe = (signals && typeof signals === 'object') ? signals : {};
  const abandonedFlows = Math.max(0, Number(safe.abandonedFlows) || 0);
  if (abandonedFlows < PROMOTION_THRESHOLDS.ABANDONMENT_CAP) return null;

  // We step DOWN one tier at a time — never SIMPLIFY directly from
  // ADVANCED to SIMPLE.
  const idx = _MODE_ORDER.indexOf(current);
  const target = _MODE_ORDER[idx - 1];
  if (!target) return null;
  return {
    from:   current,
    to:     target,
    reason: `${abandonedFlows} abandoned flows recently`,
  };
}

export default {
  COMPLEXITY_MODES,
  PROMOTION_THRESHOLDS,
  SIMPLE_MODE_STORAGE_KEY,
  getSimpleMode,
  setSimpleMode,
  isModeUserSet,
  clearSimpleMode,
  isFeatureVisible,
  getFeatureVisibilityMatrix,
  getSimpleModeNavConfig,
  shouldPromote,
  shouldSimplify,
};
