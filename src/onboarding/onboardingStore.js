/**
 * onboardingStore.js — localStorage persistence for the
 * Simple Onboarding flow.
 *
 * Strict-rule audit
 *   • No backend / API calls. The flow saves locally; an
 *     existing sync pass (when the backend ships) can read
 *     these rows and push them up.
 *   • Every helper guards its own try/catch so SSR and
 *     locked-down browsers never crash the React tree.
 *
 * Storage keys (spec §13):
 *   farroway_onboarding_profile      OnboardingProfile
 *   farroway_active_farm             string (active farm id)
 *   farroway_onboarding_completed    '1' | '0'
 */

const KEY_PROFILE   = 'farroway_onboarding_profile';
const KEY_ACTIVE    = 'farroway_active_farm';
const KEY_COMPLETED = 'farroway_onboarding_completed';

/**
 * @typedef {Object} OnboardingProfile
 * @property {'new'|'experienced'|null} farmerType
 * @property {string|null}              country
 * @property {string|null}              region
 * @property {'gps'|'manual'|null}      locationSource
 * @property {string|null}              language
 * @property {string|null}              cropId
 * @property {string|null}              cropName
 * @property {string|null}              farmName
 * @property {string|null}              farmSize
 * @property {string|null}              plantingDate
 * @property {boolean}                  plantingDateKnown
 * @property {boolean}                  onboardingCompleted
 * @property {string|null}              activeFarmId
 * @property {string|null}              startedAt
 * @property {string|null}              completedAt
 */

const EMPTY_PROFILE = Object.freeze({
  farmerType:           null,
  country:              null,
  region:               null,
  locationSource:       null,
  language:             null,
  cropId:               null,
  cropName:             null,
  farmName:             null,
  farmSize:             null,
  plantingDate:         null,
  plantingDateKnown:    false,
  onboardingCompleted:  false,
  activeFarmId:         null,
  startedAt:            null,
  completedAt:          null,
});

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch { return null; }
}

function readJson(key, fallback) {
  const ls = safeStorage();
  if (!ls) return fallback;
  try {
    const raw = ls.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return (v && typeof v === 'object') ? v : fallback;
  } catch { return fallback; }
}

function writeJson(key, value) {
  const ls = safeStorage();
  if (!ls) return false;
  try { ls.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

function nowIso() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function uuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch { /* swallow */ }
  return 'farm_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
}

/**
 * loadOnboardingProfile — read the in-progress profile, or
 * an empty shell when nothing's been saved yet.
 */
export function loadOnboardingProfile() {
  const stored = readJson(KEY_PROFILE, null);
  if (!stored) return { ...EMPTY_PROFILE, startedAt: nowIso() };
  return { ...EMPTY_PROFILE, ...stored };
}

/**
 * patchOnboardingProfile — merge fields onto whatever is
 * persisted. Caller passes only the keys that changed.
 */
export function patchOnboardingProfile(patch) {
  const cur = loadOnboardingProfile();
  const next = { ...cur, ...(patch || {}) };
  if (!cur.startedAt) next.startedAt = nowIso();
  writeJson(KEY_PROFILE, next);
  return next;
}

/**
 * completeOnboarding — flips the completion flags + assigns
 * an activeFarmId if the caller hasn't already.
 *
 * @returns the persisted final profile
 */
export function completeOnboarding(profilePatch = null) {
  const cur = loadOnboardingProfile();
  const merged = { ...cur, ...(profilePatch || {}) };
  if (!merged.activeFarmId) merged.activeFarmId = uuid();
  merged.onboardingCompleted = true;
  merged.completedAt = nowIso();
  writeJson(KEY_PROFILE, merged);
  writeJson(KEY_ACTIVE, merged.activeFarmId);
  // Plain-string flag — easy to read from non-JS surfaces.
  try { safeStorage()?.setItem(KEY_COMPLETED, '1'); } catch { /* ignore */ }
  return merged;
}

/**
 * isOnboardingCompleted — used by route guards.
 */
export function isOnboardingCompleted() {
  try { return safeStorage()?.getItem(KEY_COMPLETED) === '1'; }
  catch { return false; }
}

/**
 * clearOnboarding — admin / test / "start over" helper.
 */
export function clearOnboarding() {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.removeItem(KEY_PROFILE);
    ls.removeItem(KEY_ACTIVE);
    ls.removeItem(KEY_COMPLETED);
  } catch { /* ignore */ }
}

export const _internal = Object.freeze({
  KEY_PROFILE, KEY_ACTIVE, KEY_COMPLETED, EMPTY_PROFILE,
});
