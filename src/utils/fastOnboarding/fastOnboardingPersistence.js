/**
 * fastOnboardingPersistence.js — saves the fast-track flow's
 * progress + the auto-created farm so returning users are
 * never sent through onboarding twice.
 *
 * Persisted shape (localStorage key `farroway.fastOnboarding.v1`):
 *   {
 *     schemaVersion,
 *     hasSeenIntro:       boolean,
 *     farmerType:         'new' | 'existing' | null,
 *     currentStep:        FAST_STEPS.*,
 *     setup: {
 *       language, country, stateCode, city,
 *       locationSource: 'detect' | 'manual' | 'skipped' | null,
 *     },
 *     selectedCrop:       string | null,
 *     farm: {
 *       created: boolean,
 *       crop, stage, startDate, tasks, countryCode,
 *     } | null,
 *     completedAt:        number | null,
 *   }
 *
 * Every mutation goes through patchFastState so the nested
 * objects merge safely. Degrades cleanly when localStorage is
 * unavailable (tests / SSR).
 */

import { FAST_STEPS } from './stepIds.js';

const STORAGE_KEY    = 'farroway.fastOnboarding.v1';
const SCHEMA_VERSION = 1;

function hasStorage() {
  try { return typeof window !== 'undefined' && !!window.localStorage; }
  catch { return false; }
}

export function defaultFastState(language = 'en') {
  return {
    schemaVersion: SCHEMA_VERSION,
    hasSeenIntro: false,
    farmerType: null,
    currentStep: FAST_STEPS.INTRO,
    setup: {
      language: String(language || 'en'),
      country:   null,
      stateCode: null,
      city:      null,
      locationSource: null,
    },
    selectedCrop: null,
    farm: null,
    completedAt: null,
  };
}

export function loadFastState() {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveFastState(state) {
  if (!hasStorage() || !state || typeof state !== 'object') return false;
  try {
    const safe = { ...state, schemaVersion: SCHEMA_VERSION };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

export function clearFastState() {
  if (!hasStorage()) return;
  try { window.localStorage.removeItem(STORAGE_KEY); }
  catch { /* noop */ }
}

/**
 * patchFastState — immutable merge that preserves nested fields
 * (`setup`, `farm`). Top-level scalars overwrite; nested objects
 * deep-merge.
 */
export function patchFastState(prev, patch = {}) {
  const base = prev || defaultFastState();
  const next = { ...base, ...(patch || {}) };
  if (patch.setup) next.setup = { ...(base.setup || {}), ...patch.setup };
  if (patch.farm)  next.farm  = patch.farm === null
    ? null
    : { ...(base.farm  || {}), ...patch.farm };
  return next;
}

/**
 * hasCompletedFastOnboarding — single predicate the router uses
 * to decide "send this user to Home instead of intro."
 */
export function hasCompletedFastOnboarding(state = null) {
  const s = state || loadFastState();
  if (!s) return false;
  return !!(s.hasSeenIntro
         && s.farmerType
         && s.farm?.created
         && s.completedAt);
}

export const _internal = { STORAGE_KEY, SCHEMA_VERSION, hasStorage };
