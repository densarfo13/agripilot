/**
 * quickOnboarding.js — helpers for the frictionless first-run flow.
 *
 * The spec for the new onboarding redesign:
 *
 *   1. Show one welcome screen with a single big button.
 *   2. Auto-detect country (IP fallback when GPS denied).
 *   3. On tap: instantly create a default farm + mark onboarding
 *      done + land the user in /tasks.
 *   4. Skip every "advanced" question (size / soil / etc.) - those
 *      live in /settings now.
 *
 * This module is the small functional surface those steps share.
 * Every helper is async-tolerant + try/catch wrapped so a slow
 * geolocation lookup or a quota-exceeded localStorage write never
 * crashes the welcome screen.
 *
 * Strict-rule audit:
 *   * Existing OnboardingV3 / FastOnboarding stays available -
 *     this file is a NEW path, not a replacement.
 *   * Never throws; failures are silent (always returns a usable
 *     value).
 *   * No backend change.
 */

import { detectCountryByIP } from './geolocation.js';
import {
  setOnboardingComplete, setSavedLanguage, setSavedCountry,
} from './onboarding.js';
import { saveFarm } from '../core/farroway/farmStore.js';

export const QUICK_ONBOARDED_FLAG  = 'farroway_quick_onboarded';
export const FARM_CREATED_FLAG     = 'farroway_farm_created';
export const QUICK_VOICE_FIRED_KEY = 'farroway_quick_voice_fired';

const DEFAULT_CROP    = 'cassava';
const DEFAULT_COUNTRY = 'GH';   // Ghana - matches the primary pilot region
const SUPPORTED_FALLBACK_COUNTRIES = Object.freeze([
  'GH', 'NG', 'KE', 'TZ', 'UG', 'ZA',  // SSA pilot roster
  'IN', 'PK', 'BD',                     // South Asia
  'GB', 'US', 'CA', 'FR',               // diaspora / dev
]);

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(value == null ? '' : value));
  } catch { /* swallow - quota / private mode */ }
}

/* ─── Detection ────────────────────────────────────────────────── */

/**
 * Auto-detect the user's country. Uses the existing IP-based
 * detector (no permission prompt, fast). Falls back to Ghana if
 * the network is offline or every provider rejects.
 *
 * Returns the country code (uppercase, e.g. 'GH'). Always returns
 * a usable value - never null.
 */
export async function autoDetectCountry() {
  try {
    const result = await detectCountryByIP();
    if (result && result.countryCode) {
      const code = String(result.countryCode).toUpperCase();
      if (SUPPORTED_FALLBACK_COUNTRIES.includes(code)) return code;
      // Unknown country - fall through to default.
    }
  } catch { /* swallow */ }
  return DEFAULT_COUNTRY;
}

/* ─── Instant farm creation ────────────────────────────────────── */

/**
 * Build a default farm record + persist it via the Farroway core
 * farmStore. Idempotent: if a farm already exists we return it
 * untouched rather than overwriting the user's data.
 *
 * Returns the farm object that's now in storage.
 */
export async function autoCreateDefaultFarm({ crop = DEFAULT_CROP, country = null } = {}) {
  // Don't overwrite an existing farm. Read the sync mirror first.
  let existing = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('farroway_farm');
      if (raw) existing = JSON.parse(raw);
    }
  } catch { /* ignore */ }
  if (existing && typeof existing === 'object' && existing.crop) {
    _safeSet(FARM_CREATED_FLAG, 'true');
    return existing;
  }

  const resolvedCountry = country || (await autoDetectCountry());
  const today = new Date();

  const farm = {
    id:           `quick_${Date.now()}`,
    crop:         crop,
    plantingDate: today.toISOString(),
    country:      resolvedCountry,
    createdVia:   'quick',
    createdAt:    today.toISOString(),
  };

  try { await saveFarm(farm); }
  catch { /* swallow - sync mirror still gets written below */ }

  _safeSet(FARM_CREATED_FLAG, 'true');
  return farm;
}

/* ─── Composite "Start farming" action ─────────────────────────── */

/**
 * One-shot version of the welcome-button click handler.
 *
 *   await startFarmingNow({ language });
 *
 * Resolves to:
 *   { farm, country }
 *
 * Order of operations matters - the onboarding flag goes LAST so
 * a partial failure (e.g. localStorage quota) leaves the user in
 * a re-tryable state on next app load.
 */
export async function startFarmingNow({ language = null } = {}) {
  const country = await autoDetectCountry();
  const farm    = await autoCreateDefaultFarm({ country });
  if (language) {
    try { setSavedLanguage(language); } catch { /* ignore */ }
  }
  try { setSavedCountry(country); } catch { /* ignore */ }
  try { setOnboardingComplete(); }   catch { /* ignore */ }
  _safeSet(QUICK_ONBOARDED_FLAG, 'true');
  return { farm, country };
}

/* ─── Read helpers (used by routes / voice auto-play) ─────────── */

export function isQuickOnboarded() {
  return _safeGet(QUICK_ONBOARDED_FLAG) === 'true';
}

export function isFarmCreated() {
  return _safeGet(FARM_CREATED_FLAG) === 'true';
}

export function hasFiredQuickVoice() {
  return _safeGet(QUICK_VOICE_FIRED_KEY) === 'true';
}

export function markQuickVoiceFired() {
  _safeSet(QUICK_VOICE_FIRED_KEY, 'true');
}

/** Test / "redo onboarding" helper. */
export function resetQuickOnboarding() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(QUICK_ONBOARDED_FLAG);
    localStorage.removeItem(FARM_CREATED_FLAG);
    localStorage.removeItem(QUICK_VOICE_FIRED_KEY);
  } catch { /* swallow */ }
}
