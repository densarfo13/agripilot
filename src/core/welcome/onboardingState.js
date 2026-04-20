/**
 * onboardingState.js — pure helper for the minimal localStorage
 * state written by the new WelcomeScreen (first-impression entry).
 *
 *   saveOnboardingState({ isNewFarmer, location })
 *   readOnboardingState() → { isNewFarmer, location } | null
 *   clearOnboardingState()
 *
 * Storage key: `farroway_onboarding` (matches the spec). Data
 * is JSON-safe; corrupted entries are quietly dropped so the
 * UI never inherits garbage.
 *
 * Pure. No React. Degrades safely when localStorage is absent
 * (SSR, Safari private mode, offline WebView).
 */

const STORAGE_KEY = 'farroway_onboarding';

function hasStorage() {
  try { return typeof window !== 'undefined' && !!window.localStorage; }
  catch { return false; }
}

/** Validate the shape — we store only two fields. */
function normalize(state) {
  if (!state || typeof state !== 'object') return null;
  const out = {};
  if (state.isNewFarmer === true || state.isNewFarmer === false) {
    out.isNewFarmer = state.isNewFarmer;
  } else out.isNewFarmer = null;

  if (state.location
      && typeof state.location === 'object'
      && Number.isFinite(state.location.lat)
      && Number.isFinite(state.location.lng)) {
    out.location = {
      lat: Number(state.location.lat),
      lng: Number(state.location.lng),
    };
  } else out.location = null;

  return Object.freeze(out);
}

export function saveOnboardingState(state) {
  if (!hasStorage()) return false;
  const clean = normalize(state);
  if (!clean) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch { return false; }
}

export function readOnboardingState() {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalize(parsed);
  } catch { return null; }
}

export function clearOnboardingState() {
  if (!hasStorage()) return;
  try { window.localStorage.removeItem(STORAGE_KEY); }
  catch { /* ignore */ }
}

export const _internal = { STORAGE_KEY };
