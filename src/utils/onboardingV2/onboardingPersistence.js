/**
 * onboardingPersistence.js — auto-saves the user's onboarding
 * progress to localStorage so an interrupted session resumes
 * on the exact step they left.
 *
 *   loadOnboardingState()       → persisted state | null
 *   saveOnboardingState(state)  → true if saved
 *   clearOnboardingState()      → removes the record
 *   resetOnboardingState(locale?) → fresh default state
 *
 * Shape is intentionally small — 1-2KB worst case — so the
 * localStorage write is cheap. No PII beyond the farmer's
 * coarse location, which we treat as consent-given once they
 * tap "Use this location".
 */

const STORAGE_KEY   = 'farroway.onboardingV2.state.v1';
const SCHEMA_VERSION = 1;

export function defaultOnboardingState(language = 'en') {
  return {
    schemaVersion: SCHEMA_VERSION,
    currentStep: 'welcome',
    language: String(language || 'en'),
    startedAt: Date.now(),
    completedAt: null,
    location: {
      source: null,         // 'detect' | 'manual' | null
      confirmed: false,
      country: null,        // 'GH'
      stateCode: null,      // 'MD'
      city: null,
      accuracyM: null,
    },
    growingType: null,       // 'backyard' | 'small' | 'medium' | 'large'
    mode: null,              // 'backyard' | 'farm' — derived from growingType
    experience: null,        // 'new' | 'experienced'
    sizeDetails: {
      spaceType: null,       // backyard-only
      approxArea: null,
      sizeBand: null,        // farm-only
      exactSize: null,       // { value, unit }
    },
    selectedCrop: null,
    missedDays: 0,
  };
}

function hasStorage() {
  try { return typeof window !== 'undefined' && !!window.localStorage; }
  catch { return false; }
}

export function loadOnboardingState() {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) {
      // Schema bumped — drop stale state so we never present the
      // user with a half-migrated flow.
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveOnboardingState(state) {
  if (!hasStorage() || !state || typeof state !== 'object') return false;
  try {
    // Never persist completedAt with nulls elsewhere — keep the
    // shape stable so tests can assert on it.
    const safe = { ...state, schemaVersion: SCHEMA_VERSION };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

export function clearOnboardingState() {
  if (!hasStorage()) return;
  try { window.localStorage.removeItem(STORAGE_KEY); }
  catch { /* noop */ }
}

export function resetOnboardingState(language = 'en') {
  const fresh = defaultOnboardingState(language);
  saveOnboardingState(fresh);
  return fresh;
}

/**
 * Immutable patcher. Preferred over raw Object.assign to keep
 * nested objects copy-on-write (location, sizeDetails).
 */
export function patchOnboardingState(prev, patch = {}) {
  const next = { ...(prev || defaultOnboardingState()), ...(patch || {}) };
  if (patch.location)    next.location    = { ...(prev?.location    || {}), ...patch.location };
  if (patch.sizeDetails) next.sizeDetails = { ...(prev?.sizeDetails || {}), ...patch.sizeDetails };
  return next;
}

export const _internal = { STORAGE_KEY, SCHEMA_VERSION };
