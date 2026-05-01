/**
 * repairSession.js — non-destructive recovery for common
 * Farroway state corruptions. Designed to be called after
 * login and before dashboard render so a stale localStorage
 * state never locks a returning farmer out.
 *
 * Strict-rule audit
 *   • Never clears all user data automatically — repairs are
 *     additive (write missing values; remove only individual
 *     corrupted JSON rows).
 *   • Returns the list of actions performed so callers can
 *     log / surface them.
 *   • SSR / locked-down localStorage safe — every read &
 *     write guards through `safeStorage()`.
 *
 * Repairs implemented (spec §7):
 *   1. farms exist but no active farm → set first as active
 *   2. active farm exists but onboardingCompleted=false → set true
 *   3. corrupted JSON in any tracked key → drop just that key
 *   4. legacy onboarding-store row present → mirror to spec keys
 *
 * Standardized keys (spec §5):
 *   farroway_user
 *   farroway_user_profile
 *   farroway_farms
 *   farroway_active_farm
 *   farroway_onboarding_completed
 */

const KEY = Object.freeze({
  user:                 'farroway_user',
  userProfile:          'farroway_user_profile',
  farms:                'farroway_farms',
  activeFarm:           'farroway_active_farm',
  onboardingCompleted:  'farroway_onboarding_completed',
});

// Legacy keys we migrate from (read-only, not removed unless
// they're confirmed corrupt).
const LEGACY_KEY = Object.freeze({
  onboardingProfile: 'farroway_onboarding_profile',
  legacyActiveFarm:  'farroway_active_farm',
  legacyCompleted:   'farroway_onboarding_completed',
});

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch { return null; }
}

// Inline read of the explicit-logout flag. We avoid importing
// `src/utils/explicitLogout.js` here to keep this module
// dependency-free (it ships in the recovery / boot path).
function _isExplicitLogout() {
  try {
    const ls = safeStorage();
    if (!ls) return false;
    return ls.getItem('farroway_explicit_logout') === 'true';
  } catch { return false; }
}

function readJson(key) {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return { __corrupt: true, __key: key }; }
}

function writeJson(key, value) {
  const ls = safeStorage();
  if (!ls) return false;
  try { ls.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

function writeString(key, value) {
  const ls = safeStorage();
  if (!ls) return false;
  try { ls.setItem(key, String(value)); return true; }
  catch { return false; }
}

function removeKey(key) {
  const ls = safeStorage();
  if (!ls) return false;
  try { ls.removeItem(key); return true; }
  catch { return false; }
}

/**
 * repairFarrowaySession — main entry. Idempotent; safe to run
 * on every app boot.
 *
 * @returns {{ actions: string[], snapshot: object }}
 */
export function repairFarrowaySession() {
  const actions = [];

  // Final logout-loop fix §2: if the farmer just hit Logout,
  // every repair below would re-stamp the onboarding flag and
  // re-select the cached farm — which is exactly the bug we're
  // closing. Bail before any write.
  if (_isExplicitLogout()) {
    actions.push('skipped_explicit_logout');
    return { actions, snapshot: null };
  }

  // ── 1. Drop only corrupted JSON rows (never wipe user data). ──
  for (const key of Object.values(KEY)) {
    const v = readJson(key);
    if (v && v.__corrupt && v.__key === key) {
      removeKey(key);
      actions.push(`removed_corrupt:${key}`);
    }
  }

  // ── 2. Mirror legacy onboarding profile → spec keys. ──
  const legacyProfile = readJson(LEGACY_KEY.onboardingProfile);
  if (legacyProfile && !legacyProfile.__corrupt) {
    if (legacyProfile.activeFarmId && !readJson(KEY.activeFarm)) {
      writeJson(KEY.activeFarm, {
        id: legacyProfile.activeFarmId,
        farmName: legacyProfile.farmName || null,
        crop: legacyProfile.cropId || null,
        country: legacyProfile.country || null,
        region: legacyProfile.region || null,
        plantingDate: legacyProfile.plantingDate || null,
        farmType: legacyProfile.farmType || null,
      });
      actions.push('migrated_legacy_active_farm');
    }
    if (legacyProfile.onboardingCompleted) {
      const cur = safeStorage()?.getItem(KEY.onboardingCompleted);
      if (cur !== '1' && cur !== 'true') {
        writeString(KEY.onboardingCompleted, '1');
        actions.push('migrated_legacy_completed');
      }
    }
  }

  // ── 3. farms exist but no active farm → set first. ──
  const farms = readJson(KEY.farms);
  const activeFarm = readJson(KEY.activeFarm);
  if (Array.isArray(farms) && farms.length > 0
      && (!activeFarm || (activeFarm && activeFarm.__corrupt))) {
    const first = farms.find((f) => f && (f.id || f.farmName));
    if (first) {
      writeJson(KEY.activeFarm, first);
      actions.push('set_active_farm_from_farms_list');
    }
  }

  // ── 4. active farm present → ensure onboardingCompleted=true. ──
  const finalActive = readJson(KEY.activeFarm);
  if (finalActive && finalActive.id && !finalActive.__corrupt) {
    const cur = safeStorage()?.getItem(KEY.onboardingCompleted);
    if (cur !== '1' && cur !== 'true') {
      writeString(KEY.onboardingCompleted, '1');
      actions.push('marked_onboarding_completed');
    }
  }

  // ── 5. experience ↔ farmType reconciliation (Final-Launch §2). ──
  // The U.S. experience chooser writes both `experience` and
  // `farmType` to the user_profile slot. If only one made it
  // (older clients, partial sync), backfill the other so the
  // BottomTabNav and regionUXEngine both see consistent state.
  const profile = readJson(KEY.userProfile);
  if (profile && !profile.__corrupt && typeof profile === 'object') {
    let mutated = false;
    const next = { ...profile };
    if (next.experience === 'backyard' && !next.farmType) {
      next.farmType = 'backyard';
      mutated = true;
      actions.push('repaired_farmType_for_backyard_experience');
    } else if (next.experience === 'farm' && !next.farmType) {
      next.farmType = 'small_farm';
      mutated = true;
      actions.push('repaired_farmType_for_farm_experience');
    } else if (!next.experience && next.farmType) {
      // The reverse case — farmType set but experience missing.
      // Mirror via the same simple lookup the chooser uses.
      if (next.farmType === 'backyard' || next.farmType === 'home_garden') {
        next.experience = 'backyard';
        mutated = true;
        actions.push('repaired_experience_for_backyard_farmType');
      } else if (next.farmType === 'small_farm' || next.farmType === 'large_farm' || next.farmType === 'farm') {
        next.experience = 'farm';
        mutated = true;
        actions.push('repaired_experience_for_farm_farmType');
      }
    }
    if (mutated) writeJson(KEY.userProfile, next);
  }

  // Mirror the experience hint into the dedicated localStorage
  // slot that FarmerTodayPage reads to flip its title — keeps
  // the today header in sync with whatever the profile says.
  if (profile && !profile.__corrupt && profile.experience) {
    try {
      const existing = safeStorage()?.getItem('farroway_experience');
      const want = JSON.stringify(profile.experience);
      if (existing !== want) {
        safeStorage()?.setItem('farroway_experience', want);
        actions.push('mirrored_experience_to_top_level_key');
      }
    } catch { /* ignore */ }
  }

  return {
    actions,
    snapshot: {
      hasUser:              !!readJson(KEY.user),
      hasProfile:           !!readJson(KEY.userProfile),
      farmsCount:           Array.isArray(farms) ? farms.length : 0,
      hasActiveFarm:        !!(finalActive && finalActive.id),
      onboardingCompleted:  safeStorage()?.getItem(KEY.onboardingCompleted) === '1'
        || safeStorage()?.getItem(KEY.onboardingCompleted) === 'true',
    },
  };
}

/**
 * clearFarrowayCacheKeepingAuth — surgical cache clear used by
 * the recovery error boundary. Removes every Farroway
 * localStorage row we own EXCEPT a denylist of auth-style
 * tokens that the wider app may rely on for sign-in.
 *
 * Strict-rule audit: never deletes anything that doesn't start
 * with one of the Farroway prefixes; never touches sessionStorage.
 */
const PREFIXES = ['farroway_', 'farroway:'];
const AUTH_KEEP = new Set([
  'farroway_auth_token',
  'farroway:auth',
  'farroway:refresh',
]);

export function clearFarrowayCacheKeepingAuth() {
  const ls = safeStorage();
  if (!ls) return { removed: [] };
  const removed = [];
  // Snapshot keys first — removeItem mutates the index.
  const keys = [];
  for (let i = 0; i < ls.length; i++) {
    try { const k = ls.key(i); if (k) keys.push(k); } catch { /* ignore */ }
  }
  for (const k of keys) {
    if (AUTH_KEEP.has(k)) continue;
    if (!PREFIXES.some((p) => k.startsWith(p))) continue;
    try { ls.removeItem(k); removed.push(k); } catch { /* ignore */ }
  }
  return { removed };
}

/**
 * clearFarrowayCache — aggressive variant per crash-prevention
 * spec §4. Removes EVERY `farroway_`-prefixed localStorage key
 * (including auth tokens), then forwards to /login.
 *
 *   • Use this when the user explicitly asked for a hard reset
 *     (e.g. "Clear cache and sign out").
 *   • For "clear cache but stay signed in" use the keep-auth
 *     variant above (the RecoveryErrorBoundary uses that one).
 *
 * Strict-rule audit
 *   * Only touches keys starting with `farroway_` so unrelated
 *     localStorage entries from other apps on the device are
 *     untouched. NOT swept: keys starting with `farroway:`
 *     (colon namespace, used by sync/i18n internals) — those
 *     are cleared by the keep-auth variant; this stricter
 *     variant intentionally limits its surface to the
 *     underscore-namespaced session keys.
 *   * Replaces — not pushes — the URL so the back button
 *     doesn't restore a stale page.
 *   * Never throws.
 */
export function clearFarrowayCache() {
  const ls = safeStorage();
  if (ls) {
    try {
      const keys = Object.keys(ls);
      for (const k of keys) {
        if (typeof k === 'string' && k.startsWith('farroway_')) {
          try { ls.removeItem(k); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
  try {
    if (typeof window !== 'undefined') window.location.replace('/login');
  } catch { /* ignore */ }
  return true;
}

/**
 * repairSession — caller-friendly alias used by AuthContext +
 * the App Store launch audit. Returns just the `actions` array
 * so existing destructures (`actions.length`) work correctly.
 *
 * Earlier code imported `{ repairSession }` from this file but
 * the only exported function was `repairFarrowaySession`, so the
 * destructure produced undefined and the repair pass silently
 * never ran. Adding the alias here un-breaks that wiring.
 */
export function repairSession() {
  try {
    const result = repairFarrowaySession();
    return Array.isArray(result?.actions) ? result.actions : [];
  } catch {
    return [];
  }
}

export const _internal = Object.freeze({ KEY, LEGACY_KEY, PREFIXES, AUTH_KEEP });
