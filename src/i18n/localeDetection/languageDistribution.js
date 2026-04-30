/**
 * languageDistribution.js — admin-side telemetry for the
 * language-adaptation feature.
 *
 * Computes the four stats the spec asks for, sourced entirely
 * from the per-farm preference rows that saveLanguagePreference
 * writes:
 *
 *   1. Number of farmers by language        — distinct user-pref langs
 *   2. Number of farms by country/region    — grouped count
 *   3. Manual vs auto-selected language     — localeSource breakdown
 *   4. Missing translation reports          — readMissingTranslationQueue()
 *
 * Pure read-side helpers, no React, safe to call from anywhere.
 * The shapes returned here are stable so an Admin dashboard
 * page can render them with a thin presentational layer later.
 */

import { _internal as _saveInternal } from './saveLanguagePreference.js';
import { readMissingTranslationQueue } from './logMissingTranslation.js';

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch { return null; }
}

/**
 * Walk every farm-preference key currently in localStorage and
 * yield the parsed entry along with its farmId.
 */
function* iterateFarmPrefs() {
  const ls = safeStorage();
  if (!ls) return;
  const prefix = _saveInternal.FARM_KEY_PREFIX;
  for (let i = 0; i < ls.length; i++) {
    let key;
    try { key = ls.key(i); } catch { continue; }
    if (!key || !key.startsWith(prefix)) continue;
    let parsed;
    try { parsed = JSON.parse(ls.getItem(key) || ''); } catch { continue; }
    if (!parsed || typeof parsed !== 'object') continue;
    yield { farmId: key.slice(prefix.length), ...parsed };
  }
}

/**
 * getLanguageDistribution — bundle every stat the dashboard
 * needs into a single immutable snapshot.
 *
 * Result shape:
 *   {
 *     byLanguage:   { en: 12, sw: 3, hi: 1 },
 *     byCountry:    { GH: 4, NG: 2, KE: 3 },
 *     byRegion:     { 'GH/Ashanti': 2, 'NG/Kano': 1 },
 *     bySource:     { manual: 9, gps: 4, farm_profile: 1, browser: 2, fallback: 0 },
 *     totalFarms:   16,
 *     missingTranslations: [...] // up to MAX_QUEUE entries
 *   }
 */
export function getLanguageDistribution() {
  const byLanguage = Object.create(null);
  const byCountry  = Object.create(null);
  const byRegion   = Object.create(null);
  const bySource   = Object.create(null);
  let totalFarms = 0;

  for (const entry of iterateFarmPrefs()) {
    totalFarms += 1;
    const lang = entry.lang || 'en';
    byLanguage[lang] = (byLanguage[lang] || 0) + 1;
    if (entry.country) {
      byCountry[entry.country] = (byCountry[entry.country] || 0) + 1;
      if (entry.region) {
        const key = `${entry.country}/${entry.region}`;
        byRegion[key] = (byRegion[key] || 0) + 1;
      }
    }
    const source = entry.localeSource || 'manual';
    bySource[source] = (bySource[source] || 0) + 1;
  }

  return Object.freeze({
    byLanguage: Object.freeze({ ...byLanguage }),
    byCountry:  Object.freeze({ ...byCountry }),
    byRegion:   Object.freeze({ ...byRegion }),
    bySource:   Object.freeze({ ...bySource }),
    totalFarms,
    missingTranslations: Object.freeze(readMissingTranslationQueue()),
  });
}

/**
 * sortedTopN — convenience for chart rendering. Given a count
 * map ({ key: count }), return the top N keys sorted desc.
 */
export function sortedTopN(map, n = 10) {
  return Object.entries(map || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}
