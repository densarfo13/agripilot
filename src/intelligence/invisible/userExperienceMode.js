/**
 * userExperienceMode.js — adaptive experience depth detector
 * (Invisible Intelligence spec §10).
 *
 *   const mode = resolveUserExperienceMode(profile);
 *   if (canSurface('buyer_opportunity', mode)) ...
 *
 * Modes
 * ─────
 *   • new_gardener         — first-week garden user
 *   • experienced_gardener — established garden user
 *   • smallholder_farmer   — primary farmer persona
 *   • commercial_farmer    — large-area / multi-crop / engaged
 *   • ngo_manager          — NGO / staff / admin role
 *
 * Gating rules (spec §10 — strict)
 * ─────────────────────────────────
 *   • beginner users see simple guidance only
 *   • advanced users see more detail
 *   • NGO/admin users see aggregated intelligence
 *   • gardeners never see funding/sell unless explicitly enabled
 *   • farmers see operational signals
 *
 *   Specifically, the canSurface() predicate enforces:
 *     - 'buyer_opportunity' / 'market_opportunity' / 'funding_opportunity'
 *       / 'cooperative_opportunity'  → farmer modes + ngo_manager only
 *     - 'admin_aggregate'             → ngo_manager only
 *     - 'crop_health' / 'severe_weather' / 'urgent_task' /
 *       'scan_followup' / 'yield_risk' / 'encouragement'
 *                                      → every mode (operational signals)
 *
 *   Defaulting: when the profile is missing or ambiguous, we lean
 *   to 'smallholder_farmer' for farmer-experience users and
 *   'new_gardener' for backyard-experience users. We never default
 *   to ngo_manager (no accidental admin elevation).
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • The gating predicate is the SINGLE source of truth — the
 *     orchestrator + UI both consult it; we never split logic
 *     between two places.
 */

export const EXPERIENCE_MODES = Object.freeze({
  NEW_GARDENER:         'new_gardener',
  EXPERIENCED_GARDENER: 'experienced_gardener',
  SMALLHOLDER_FARMER:   'smallholder_farmer',
  COMMERCIAL_FARMER:    'commercial_farmer',
  NGO_MANAGER:          'ngo_manager',
});

const _COMMERCIAL_SIGNALS = new Set([
  'buyer_opportunity',
  'market_opportunity',
  'funding_opportunity',
  'cooperative_opportunity',
]);

const _ADMIN_ONLY_SIGNALS = new Set([
  'admin_aggregate',
  'regional_hotspots',
  'cohort_risk',
  'training_gaps',
]);

function _safeStr(v) {
  return String(v == null ? '' : v).toLowerCase().trim();
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Map a user profile to one of the five canonical modes.
 *
 * @param {object} profile — { role, experience, scanCount, farmSize, accountAgeDays }
 * @returns {string}
 */
export function resolveUserExperienceMode(profile) {
  const safe = (profile && typeof profile === 'object') ? profile : {};
  const role       = _safeStr(safe.role);
  const experience = _safeStr(safe.experience);
  const scanCount  = Math.max(0, Number(safe.scanCount) || 0);
  const farmSize   = Math.max(0, Number(safe.farmSize) || 0);
  const accountAgeDays = Math.max(0, Number(safe.accountAgeDays) || 0);

  // NGO / staff / admin role — explicit override.
  if (role === 'ngo' || role === 'ngo_manager' || role === 'admin' || role === 'staff') {
    return EXPERIENCE_MODES.NGO_MANAGER;
  }

  // Backyard / gardener experience.
  if (experience === 'backyard' || experience === 'garden') {
    if (accountAgeDays < 7 || scanCount < 2) {
      return EXPERIENCE_MODES.NEW_GARDENER;
    }
    return EXPERIENCE_MODES.EXPERIENCED_GARDENER;
  }

  // Farmer side — bucket by scale.
  if (farmSize >= 5 || scanCount >= 10) {
    return EXPERIENCE_MODES.COMMERCIAL_FARMER;
  }
  return EXPERIENCE_MODES.SMALLHOLDER_FARMER;
}

/**
 * Whether a signal kind is allowed to surface for the given mode.
 *
 * @param {string} signalKind   — orchestrator output's `kind` field
 * @param {string} mode         — resolveUserExperienceMode return
 * @returns {boolean}
 */
export function canSurface(signalKind, mode) {
  const kind = _safeStr(signalKind);
  const m    = _safeStr(mode);
  if (!kind) return false;

  // Admin-only signals.
  if (_ADMIN_ONLY_SIGNALS.has(kind)) {
    return m === EXPERIENCE_MODES.NGO_MANAGER;
  }

  // Commercial signals — farmer modes + NGO.
  if (_COMMERCIAL_SIGNALS.has(kind)) {
    return m === EXPERIENCE_MODES.SMALLHOLDER_FARMER
        || m === EXPERIENCE_MODES.COMMERCIAL_FARMER
        || m === EXPERIENCE_MODES.NGO_MANAGER;
  }

  // Operational signals — every mode.
  return true;
}

/**
 * Whether this mode is "beginner" — UI surfaces can use this to
 * trim detail (hide confidence pills, hide source tags, etc).
 */
export function isBeginnerMode(mode) {
  const m = _safeStr(mode);
  return m === EXPERIENCE_MODES.NEW_GARDENER;
}

export default {
  resolveUserExperienceMode,
  canSurface,
  isBeginnerMode,
  EXPERIENCE_MODES,
};
