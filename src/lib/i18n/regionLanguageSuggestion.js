/**
 * regionLanguageSuggestion.js — pure helper for "would the farmer
 * prefer a different language based on their country?".
 *
 *   suggestLanguagesForCountry('GH') → ['en', 'tw']
 *   suggestLanguagesForCountry('IN') → ['hi', 'en']
 *   suggestLanguagesForCountry('CI') → ['fr', 'en']
 *
 *   shouldOfferLanguageSwitch({ activeLang, country })
 *     → { suggestion: 'tw', reason: 'GH primary' } | null
 *
 * Constraints (per i18n upgrade spec, item #2):
 *   • DO NOT auto-switch the language. Return only a suggestion.
 *   • The active language always wins; we only suggest when the
 *     active language is NOT in the country's preferred set.
 *   • Caller is responsible for rendering the prompt and persisting
 *     the user's confirm/dismiss choice (we do not write storage).
 *
 * The country → language map is intentionally small and conservative.
 * Adding a country should be a one-line change.
 */

import { isSupported, DEFAULT_LANGUAGE } from '../../config/languages.js';

// ISO 3166-1 alpha-2 → ordered list of preferred Farroway language
// codes (most-likely first). English is always last as a safe
// fallback for any country we ship to.
const COUNTRY_LANGUAGE_MAP = Object.freeze({
  // Anglophone West / East Africa
  GH: ['en', 'tw'],          // Ghana — Twi as second
  NG: ['en', 'ha'],          // Nigeria — Hausa second (north)
  KE: ['sw', 'en'],          // Kenya — Swahili primary
  TZ: ['sw', 'en'],          // Tanzania — Swahili primary
  UG: ['en', 'sw'],          // Uganda — Swahili shared
  MW: ['en'],                // Malawi
  ZM: ['en'],                // Zambia
  ZW: ['en'],                // Zimbabwe

  // Francophone Africa
  CI: ['fr', 'en'],          // Côte d'Ivoire
  SN: ['fr', 'en'],          // Senegal
  BF: ['fr', 'en'],          // Burkina Faso
  ML: ['fr', 'en'],          // Mali
  CM: ['fr', 'en'],          // Cameroon
  BJ: ['fr', 'en'],          // Benin
  TG: ['fr', 'en'],          // Togo
  NE: ['fr', 'ha'],          // Niger — Hausa also widely spoken

  // South Asia
  IN: ['hi', 'en'],          // India — Hindi primary, English fallback

  // Default fallback for any unmapped country: English only.
});

/**
 * suggestLanguagesForCountry — return the preferred-language list
 * for the country code, or [] if unmapped. Codes are filtered
 * through `isSupported` so a country mapped to a future language
 * we don't ship yet doesn't return ghost codes.
 */
export function suggestLanguagesForCountry(country) {
  if (!country) return [];
  const code = String(country).trim().toUpperCase();
  const list = COUNTRY_LANGUAGE_MAP[code];
  if (!Array.isArray(list)) return [];
  return list.filter(isSupported);
}

/**
 * shouldOfferLanguageSwitch — given the currently-active UI
 * language + the farmer's country, decide whether to surface a
 * "Switch to X?" suggestion.
 *
 *   • Returns null when the active language is already in the
 *     country's preferred list (no suggestion needed).
 *   • Returns null when the country is unmapped.
 *   • Returns null when the caller has already dismissed this
 *     suggestion (passed via `dismissedFor`, an array of country
 *     codes the farmer has explicitly declined).
 *   • Otherwise returns { suggestion, alternatives, reason }.
 */
export function shouldOfferLanguageSwitch({
  activeLang,
  country,
  dismissedFor = [],
} = {}) {
  if (!country) return null;
  const code = String(country).trim().toUpperCase();
  if (Array.isArray(dismissedFor) && dismissedFor.includes(code)) return null;

  const preferred = suggestLanguagesForCountry(code);
  if (preferred.length === 0) return null;

  // If the farmer is already on a preferred language, don't nag.
  if (activeLang && preferred.includes(activeLang)) return null;

  // Top non-active preference is the suggestion.
  const suggestion = preferred[0] || DEFAULT_LANGUAGE;
  if (!suggestion || suggestion === activeLang) return null;

  return Object.freeze({
    suggestion,
    alternatives: preferred,
    reason: `${code} primary`,
  });
}

// Storage key for "I've dismissed the suggestion for country X"
// so we don't pester the farmer on every page. Caller (UI) reads /
// writes this list; we expose the canonical key so we don't drift.
export const REGION_DISMISS_STORAGE_KEY = 'farroway.langSuggest.dismissed';

/**
 * loadDismissedSet — convenience reader for the localStorage list.
 * Always returns an array; never throws.
 */
export function loadDismissedSet() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(REGION_DISMISS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch { return []; }
}

/**
 * markDismissed — append a country code to the dismissed list
 * (idempotent). Caller invokes this when the farmer taps "Not now".
 */
export function markDismissed(country) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!country) return;
    const code = String(country).trim().toUpperCase();
    const cur = loadDismissedSet();
    if (cur.includes(code)) return;
    cur.push(code);
    localStorage.setItem(REGION_DISMISS_STORAGE_KEY, JSON.stringify(cur));
  } catch { /* quota / locked — ignore */ }
}

export const _internal = Object.freeze({ COUNTRY_LANGUAGE_MAP });
