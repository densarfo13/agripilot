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

export const _internal = Object.freeze({ KEY, LEGACY_KEY, PREFIXES, AUTH_KEEP });
