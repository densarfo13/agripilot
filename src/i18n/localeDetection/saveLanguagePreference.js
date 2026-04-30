/**
 * saveLanguagePreference.js — persist the farmer's language
 * choice at user-level + farm-level, plus the metadata needed
 * to reconstruct WHY we suggested it.
 *
 * Strict-rule audit: never touches the backend or the auth /
 * profile API. This module only writes to localStorage so we
 * stay reversible and offline-safe; the existing farm sync
 * pipeline (when it lands) can pick the preference up from
 * here without changes here.
 *
 * Storage layout (localStorage, JSON):
 *
 *   farroway:userLanguagePref
 *     { lang: 'tw', updatedAt: '2026-04-30T12:34:56Z' }
 *
 *   farroway:farmLanguagePref:<farmId>
 *     {
 *       lang: 'tw',
 *       country: 'GH',
 *       region: 'Ashanti',
 *       localeSource: 'gps' | 'farm_profile' | 'browser' | 'manual' | 'fallback',
 *       updatedAt: '2026-04-30T12:34:56Z',
 *     }
 *
 * Reads are tolerant of missing / corrupt data — every helper
 * returns null instead of throwing so callers can stay happy
 * in private-mode browsers and SSR.
 */

const USER_KEY = 'farroway:userLanguagePref';
const FARM_KEY_PREFIX = 'farroway:farmLanguagePref:';

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
    const v = JSON.parse(raw);
    return (v && typeof v === 'object') ? v : null;
  } catch { return null; }
}

function writeJson(key, value) {
  const ls = safeStorage();
  if (!ls) return false;
  try {
    ls.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

function nowIso() {
  try { return new Date().toISOString(); } catch { return ''; }
}

/**
 * saveLanguagePreference — main entry. Writes user-level pref
 * always; writes farm-level pref iff `farmId` is provided.
 *
 * @param  {object} args
 * @param  {string} args.lang          e.g. 'tw' (required)
 * @param  {string} [args.farmId]      farm to scope this to
 * @param  {string} [args.country]     ISO-2
 * @param  {string} [args.region]
 * @param  {string} [args.localeSource] one of:
 *   'gps' | 'farm_profile' | 'browser' | 'manual' | 'fallback'
 *
 * @returns {{ user: boolean, farm: boolean }}
 *   booleans indicate which writes succeeded.
 */
export function saveLanguagePreference({
  lang,
  farmId = null,
  country = null,
  region = null,
  localeSource = 'manual',
} = {}) {
  if (!lang) return { user: false, farm: false };
  const updatedAt = nowIso();

  const user = writeJson(USER_KEY, { lang, updatedAt });

  let farm = false;
  if (farmId) {
    farm = writeJson(`${FARM_KEY_PREFIX}${farmId}`, {
      lang,
      country: country || null,
      region: region || null,
      localeSource: localeSource || 'manual',
      updatedAt,
    });
  }

  // Telemetry side channel — admin dashboards can subscribe.
  // Wrapped in try so a noisy listener never breaks the save.
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('farroway:languagePrefSaved', {
        detail: { lang, farmId, country, region, localeSource, updatedAt },
      }));
    }
  } catch { /* swallow */ }

  return { user, farm };
}

/**
 * loadUserLanguagePreference — read the user-level pref.
 * Returns null if absent / unreadable.
 */
export function loadUserLanguagePreference() {
  return readJson(USER_KEY);
}

/**
 * loadFarmLanguagePreference — read the farm-level pref.
 * Returns null if absent / unreadable.
 */
export function loadFarmLanguagePreference(farmId) {
  if (!farmId) return null;
  return readJson(`${FARM_KEY_PREFIX}${farmId}`);
}

/**
 * resolveLanguagePreference — preferred resolver order:
 *   1. farm-level pref for the active farm
 *   2. user-level pref
 *   3. null (caller decides what to do — usually run detection)
 */
export function resolveLanguagePreference(farmId = null) {
  if (farmId) {
    const farmPref = loadFarmLanguagePreference(farmId);
    if (farmPref && farmPref.lang) return { ...farmPref, scope: 'farm' };
  }
  const userPref = loadUserLanguagePreference();
  if (userPref && userPref.lang) return { ...userPref, scope: 'user' };
  return null;
}

/**
 * clearFarmLanguagePreference — useful for tests + admin tools.
 */
export function clearFarmLanguagePreference(farmId) {
  const ls = safeStorage();
  if (!ls || !farmId) return;
  try { ls.removeItem(`${FARM_KEY_PREFIX}${farmId}`); } catch { /* ignore */ }
}

/**
 * Internal exports for tests / admin tooling. Not part of the
 * public API.
 */
export const _internal = Object.freeze({
  USER_KEY,
  FARM_KEY_PREFIX,
});
