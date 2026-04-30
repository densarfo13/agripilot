/**
 * languageService.js — frontend service for the language API
 * endpoints called out in §12 of the localization rollout
 * spec. The backend routes do not exist yet; until they do,
 * this module routes every write/read to localStorage so the
 * feature works end-to-end.
 *
 * Endpoints (when the backend ships):
 *   POST /api/user/language
 *   POST /api/farms/:farmId/language
 *   GET  /api/admin/language-analytics
 *
 * The fetch calls below are gated behind an env flag
 * (VITE_LANGUAGE_API). When unset, every call short-circuits
 * to the localStorage fallback so the rest of the app keeps
 * working offline + during pilot.
 */

import {
  saveLanguagePreference,
  loadUserLanguagePreference,
  loadFarmLanguagePreference,
} from '../i18n/localeDetection/saveLanguagePreference.js';
import { getLanguageDistribution } from '../i18n/localeDetection/languageDistribution.js';

function backendEnabled() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_LANGUAGE_API === '1'
        || import.meta.env.VITE_LANGUAGE_API === 'true';
    }
  } catch { /* SSR */ }
  return false;
}

async function safeFetch(input, init) {
  try {
    const res = await fetch(input, init);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw Object.assign(new Error('HTTP ' + res.status),
        { status: res.status, body });
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  } catch (err) {
    return { _failed: true, error: err };
  }
}

/**
 * postUserLanguage — POST /api/user/language
 * Body: { userId, language, source }
 *
 * @returns { ok, fallback?: 'localStorage' }
 */
export async function postUserLanguage({ userId, language, source = 'manual' } = {}) {
  if (!language) return { ok: false, error: 'missing-language' };

  // Persist to localStorage FIRST so the UI is consistent even
  // if the API call fails / is offline.
  saveLanguagePreference({
    lang: language,
    farmId: null,
    localeSource: source,
  });

  if (!backendEnabled()) {
    return { ok: true, fallback: 'localStorage' };
  }

  const result = await safeFetch('/api/user/language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId, language, source }),
  });
  if (result && result._failed) {
    return { ok: true, fallback: 'localStorage', error: result.error };
  }
  return { ok: true, response: result };
}

/**
 * postFarmLanguage — POST /api/farms/:farmId/language
 * Body: { language, source, detectedCountry, detectedRegion }
 */
export async function postFarmLanguage({
  farmId, language, source = 'manual',
  detectedCountry = null, detectedRegion = null,
} = {}) {
  if (!farmId || !language) return { ok: false, error: 'missing-args' };

  saveLanguagePreference({
    lang: language,
    farmId,
    country: detectedCountry,
    region: detectedRegion,
    localeSource: source,
  });

  if (!backendEnabled()) {
    return { ok: true, fallback: 'localStorage' };
  }

  const result = await safeFetch(
    `/api/farms/${encodeURIComponent(farmId)}/language`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        language, source, detectedCountry, detectedRegion,
      }),
    },
  );
  if (result && result._failed) {
    return { ok: true, fallback: 'localStorage', error: result.error };
  }
  return { ok: true, response: result };
}

/**
 * getLanguageAnalytics — GET /api/admin/language-analytics
 *
 * Returns:
 *   {
 *     farmersByLanguage,     farmsByLanguage,
 *     farmsByCountry,        languageSourceBreakdown,
 *     missingTranslationKeys, languageSwitchEvents,
 *   }
 *
 * When the backend isn't enabled, computes the same shape from
 * the localStorage telemetry that languageDistribution.js
 * already gathers.
 */
export async function getLanguageAnalytics() {
  if (backendEnabled()) {
    const result = await safeFetch('/api/admin/language-analytics', {
      method: 'GET',
      credentials: 'include',
    });
    if (result && !result._failed) return result;
    // Fall through to localStorage on failure.
  }

  // localStorage fallback — bundle the existing telemetry into
  // the spec shape.
  const dist = getLanguageDistribution();
  return {
    farmersByLanguage:        dist.byLanguage,
    farmsByLanguage:          dist.byLanguage,
    farmsByCountry:           dist.byCountry,
    languageSourceBreakdown:  dist.bySource,
    missingTranslationKeys:   dist.missingTranslations || [],
    languageSwitchEvents:     null,  // event log lives in
                                     // src/data/eventLogger.js
                                     // — admin reads through
                                     // its own API
    fallback:                 'localStorage',
  };
}

/**
 * loadUserLanguageFromAnywhere — convenience for callers that
 * just want "what should the UI render in?". Tries the
 * underlying canonical persistence first.
 */
export function loadUserLanguageFromAnywhere() {
  const userPref = loadUserLanguagePreference();
  if (userPref && userPref.lang) return userPref.lang;
  return null;
}

/**
 * loadFarmLanguageFromAnywhere — same, scoped to a farm.
 */
export function loadFarmLanguageFromAnywhere(farmId) {
  if (!farmId) return null;
  const farmPref = loadFarmLanguagePreference(farmId);
  if (farmPref && farmPref.lang) return farmPref.lang;
  return null;
}
