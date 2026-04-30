/**
 * applyFarmLanguage.js — flip the live UI language and, when
 * asked, persist the choice at user + farm scope.
 *
 * Single chokepoint for "user clicked a language button" so the
 * detection banner, the profile picker, and the farm-settings
 * picker all go through the same path. Anything that needs to
 * happen on a language switch (broadcasting, telemetry,
 * persistence) lives here.
 */

import { setLanguage, LANGUAGES } from '../index.js';
import { saveLanguagePreference } from './saveLanguagePreference.js';
import { logEvent, EVENT_TYPES } from '../../data/eventLogger.js';

// Languages that actually have translations.js coverage. The
// mapper proposes some langs that aren't shipping yet (es / yo /
// ig / ee / ga); applying one of those would leave the UI mostly
// English anyway, so we transparently fall back to English and
// flag it via localeSource:'fallback' so admin dashboards can
// see the unmet demand.
const SHIPPING_LANGS = new Set(LANGUAGES.map((l) => l.code));

/**
 * applyFarmLanguage — switch language + (optionally) persist.
 *
 * @param  {object} args
 * @param  {string} args.lang           target language code
 * @param  {string} [args.farmId]       persist farm-scoped pref
 * @param  {string} [args.country]      ISO-2 (for telemetry)
 * @param  {string} [args.region]
 * @param  {string} [args.localeSource] 'gps' | 'farm_profile' |
 *                                      'browser' | 'manual' |
 *                                      'fallback'
 * @param  {boolean} [args.persist]     default true
 *
 * @returns {{ applied: string, fallbackUsed: boolean,
 *             persisted: { user: boolean, farm: boolean } }}
 */
export function applyFarmLanguage({
  lang,
  farmId = null,
  country = null,
  region = null,
  localeSource = 'manual',
  persist = true,
} = {}) {
  const requested = String(lang || '').toLowerCase().trim();
  const fallbackUsed = !SHIPPING_LANGS.has(requested);
  const applied = fallbackUsed ? 'en' : requested;

  // Flip the live UI. The existing setLanguage already persists
  // to localStorage and fires `farroway:langchange`, so every
  // subscriber (useTranslation, voice, html lang) updates.
  try { setLanguage(applied); } catch { /* swallow */ }

  let persisted = { user: false, farm: false };
  if (persist) {
    persisted = saveLanguagePreference({
      lang: applied,
      farmId,
      country,
      region,
      // If we fell back, surface that so the dashboard can see
      // the demand for an as-yet-unimplemented language.
      localeSource: fallbackUsed ? 'fallback' : localeSource,
    });
  }

  // Audit-friendly event — feeds the language-distribution
  // dashboard. Wrapped in try so a logger error never blocks
  // the language switch.
  try {
    logEvent(EVENT_TYPES.LANGUAGE_CHANGED, {
      requested,
      applied,
      fallbackUsed,
      farmId: farmId || null,
      country: country || null,
      region: region || null,
      localeSource: fallbackUsed ? 'fallback' : localeSource,
    });
  } catch { /* swallow */ }

  return { applied, fallbackUsed, persisted };
}
