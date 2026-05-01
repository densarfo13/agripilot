/**
 * activeContext.js — single resolver for the user's "active
 * context" across every role.
 *
 *   getActiveContext({ user })
 *     → {
 *         role,             // 'farmer' | 'super_admin' | etc.
 *         activeExperience, // 'garden' | 'farm' | 'buyer' |
 *                           //  'ngo_admin' | 'platform_admin'
 *         activeGardenId,
 *         activeFarmId,
 *         gardens,
 *         farms,
 *         onboardingCompleted,
 *         needsOnboarding,
 *       }
 *
 * Resolution rules (final architecture spec §3, §4)
 *   • role coming from the user object wins. For non-grower
 *     roles (`buyer`, `ngo_admin`, `program_admin`,
 *     `platform_admin`, `super_admin`, `institutional_admin`,
 *     `reviewer`, `field_officer`, `agent`, `investor_viewer`)
 *     we set `activeExperience` to a role-shaped tag and skip
 *     garden/farm context entirely.
 *   • For growers (`farmer`, missing role, unknown):
 *       1. If gardens exist + activeGardenId valid → 'garden'
 *       2. If farms   exist + activeFarmId   valid → 'farm'
 *       3. Else, fall through to multiExperience.getActiveExperience
 *          (which honors the explicit pin + farmType derivation).
 *       4. Else null → caller routes to onboarding.
 *
 * Strict-rule audit
 *   • Pure ESM. No React. No I/O on import.
 *   • Never throws — every store call is wrapped.
 *   • Reads from the post-migration arrays first, falls back
 *     to the legacy partition so this resolver works whether
 *     the user has run the migration or not.
 *   • Honors the explicit-logout flag — returns the "logged out"
 *     shape so callers don't repair / restore.
 */

import {
  getActiveExperience as _getXp,
  getGardens as _getGardensPartition,
  getFarmsOnly as _getFarmsPartition,
  getActiveGardenId,
  EXPERIENCE,
} from '../store/multiExperience.js';
import { getActiveFarmId } from '../store/farrowayLocal.js';
import {
  getMigratedGardens, getMigratedFarms,
} from '../utils/migrateLegacyFarms.js';
import { isExplicitLogout } from '../utils/explicitLogout.js';

// Roles that don't operate on a garden/farm context. The
// activeExperience for these roles is the role itself so
// downstream surfaces (nav, route guards) can branch on a
// single field.
const NON_GROWER_ROLE_TO_EXPERIENCE = Object.freeze({
  buyer:                  'buyer',
  ngo_admin:              'ngo_admin',
  program_admin:          'ngo_admin',
  reviewer:               'ngo_admin',
  field_officer:          'ngo_admin',
  super_admin:            'platform_admin',
  institutional_admin:    'ngo_admin',
  investor_viewer:        'platform_admin',
  agent:                  'ngo_admin',
});

function _readJson(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

function _readString(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

/**
 * Read gardens/farms preferring the post-migration first-class
 * arrays. Falls back to the legacy partition when the
 * migration hasn't run yet so the resolver works in both worlds.
 */
function _readGardens() {
  const migrated = getMigratedGardens();
  if (Array.isArray(migrated)) return migrated;
  try { return _getGardensPartition() || []; }
  catch { return []; }
}

function _readFarms() {
  const migrated = getMigratedFarms();
  if (Array.isArray(migrated)) return migrated;
  try { return _getFarmsPartition() || []; }
  catch { return []; }
}

function _onboardingCompletedFlag() {
  return _readString('farroway_onboarding_completed') === 'true';
}

/**
 * getActiveContext({ user }) → snapshot
 */
export function getActiveContext({ user } = {}) {
  // Explicit-logout short-circuit. Caller should not repair
  // anything when this returns; the bootstrap already bails.
  if (isExplicitLogout()) {
    return {
      role:                null,
      activeExperience:    null,
      activeGardenId:      null,
      activeFarmId:        null,
      gardens:             [],
      farms:                [],
      onboardingCompleted: false,
      needsOnboarding:     false,
      loggedOut:           true,
    };
  }

  const role = String((user && user.role) || '').toLowerCase() || null;

  // Non-grower roles — return a role-shaped activeExperience
  // and skip garden/farm context entirely.
  if (role && NON_GROWER_ROLE_TO_EXPERIENCE[role]) {
    return {
      role,
      activeExperience:    NON_GROWER_ROLE_TO_EXPERIENCE[role],
      activeGardenId:      null,
      activeFarmId:        null,
      gardens:             [],
      farms:               [],
      onboardingCompleted: true, // non-growers have no farm setup
      needsOnboarding:     false,
      loggedOut:           false,
    };
  }

  // Grower (or unknown role — default to grower behaviour).
  const gardens = _readGardens();
  const farms   = _readFarms();
  const activeGardenId = (() => {
    try { return getActiveGardenId(); } catch { return null; }
  })();
  const activeFarmId = (() => {
    try { return getActiveFarmId(); } catch { return null; }
  })();
  const gardenIdValid = activeGardenId
    && gardens.some((g) => String(g?.id) === String(activeGardenId));
  const farmIdValid   = activeFarmId
    && farms.some((f) => String(f?.id) === String(activeFarmId));

  let activeExperience = null;
  // Step 1 + 2 — pick the experience whose active id is valid
  // first, then fall through to the existing multiExperience
  // resolver for tie-breaks (it honors the explicit pin + the
  // farmType derivation introduced in the safe-launch commit).
  if (gardenIdValid && farmIdValid) {
    try { activeExperience = _getXp(); }
    catch { activeExperience = EXPERIENCE.FARM; }
  } else if (gardenIdValid) {
    activeExperience = EXPERIENCE.GARDEN;
  } else if (farmIdValid) {
    activeExperience = EXPERIENCE.FARM;
  } else if (gardens.length > 0 || farms.length > 0) {
    try { activeExperience = _getXp(); }
    catch { activeExperience = null; }
  }

  const onboardingCompleted = _onboardingCompletedFlag();
  const hasAnyEntity = (gardens.length + farms.length) > 0;
  const needsOnboarding = !hasAnyEntity || !onboardingCompleted;

  return {
    role:               role || 'farmer',
    activeExperience,
    activeGardenId:     gardenIdValid ? activeGardenId : null,
    activeFarmId:       farmIdValid   ? activeFarmId   : null,
    gardens,
    farms,
    onboardingCompleted,
    needsOnboarding,
    loggedOut:          false,
  };
}

/**
 * Convenience reader for surfaces that don't have a user object
 * handy (route guards, analytics). Reads the user from the
 * cached profile blob.
 */
export function getActiveContextFromStorage() {
  const profile = _readJson('farroway_user_profile') || _readJson('farroway_user') || null;
  return getActiveContext({ user: profile });
}

export default getActiveContext;
