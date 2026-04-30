/**
 * mapLocationToLanguage.js — pure mapper from a country code (or
 * locale string) to a suggested UI language.
 *
 * No I/O, no React, no side effects. Everything else in
 * src/i18n/localeDetection/ composes this.
 *
 * Languages currently SHIPPING in translations.js:
 *   en, fr, sw, ha, tw, hi
 *
 * Languages declared in the spec but NOT yet shipping (no
 * translations.js coverage). They appear in `alternatives` so
 * the picker can offer them, but `applyFarmLanguage` will
 * gracefully fall through to `en` if the user actually selects
 * one until the dictionaries land:
 *   ee, ga, yo, ig, es
 *
 * Adding a new country: append a row to COUNTRY_LANGUAGE.
 * Adding a new language: append the code to SHIPPING_LANGS in
 * applyFarmLanguage.js.
 */

// ─── Country → primary + alternative languages ────────────────
//
// Source: spec §2 — "Auto-map language by region".
// Country codes are ISO-3166 alpha-2 uppercase.
//
// Each entry has:
//   primary       — the language we propose first
//   alternatives  — ordered list of secondary options to surface
//                   in the "Choose another language" picker
//
// Anglophone West Africa proposes English as primary so a farmer
// in Lagos opening the app for the first time isn't auto-flipped
// to Hausa/Yoruba; the banner lets them switch in one tap.
export const COUNTRY_LANGUAGE = Object.freeze({
  // ── Anglophone West Africa ──
  GH: Object.freeze({ primary: 'en', alternatives: ['tw', 'ha', 'ee', 'ga'] }),
  NG: Object.freeze({ primary: 'en', alternatives: ['ha', 'yo', 'ig'] }),
  LR: Object.freeze({ primary: 'en', alternatives: [] }),
  SL: Object.freeze({ primary: 'en', alternatives: [] }),
  GM: Object.freeze({ primary: 'en', alternatives: [] }),

  // ── South Asia ──
  IN: Object.freeze({ primary: 'hi', alternatives: ['en'] }),
  PK: Object.freeze({ primary: 'en', alternatives: [] }),
  BD: Object.freeze({ primary: 'en', alternatives: [] }),
  LK: Object.freeze({ primary: 'en', alternatives: [] }),
  NP: Object.freeze({ primary: 'hi', alternatives: ['en'] }),

  // ── Anglophone everywhere else (default to English) ──
  US: Object.freeze({ primary: 'en', alternatives: [] }),
  CA: Object.freeze({ primary: 'en', alternatives: ['fr'] }),
  GB: Object.freeze({ primary: 'en', alternatives: [] }),
  AU: Object.freeze({ primary: 'en', alternatives: [] }),
  NZ: Object.freeze({ primary: 'en', alternatives: [] }),
  IE: Object.freeze({ primary: 'en', alternatives: [] }),
  ZA: Object.freeze({ primary: 'en', alternatives: [] }),

  // ── Francophone Africa & Europe ──
  CI: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  SN: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  ML: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  BF: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  BJ: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  TG: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  CM: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  GA: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  CG: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  CD: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  MG: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  NE: Object.freeze({ primary: 'fr', alternatives: ['ha', 'en'] }),
  TD: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  GN: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  FR: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  BE: Object.freeze({ primary: 'fr', alternatives: ['en'] }),
  CH: Object.freeze({ primary: 'fr', alternatives: ['en'] }),

  // ── Swahili-speaking East Africa ──
  KE: Object.freeze({ primary: 'sw', alternatives: ['en'] }),
  TZ: Object.freeze({ primary: 'sw', alternatives: ['en'] }),
  UG: Object.freeze({ primary: 'sw', alternatives: ['en'] }),
  RW: Object.freeze({ primary: 'sw', alternatives: ['en', 'fr'] }),
  BI: Object.freeze({ primary: 'sw', alternatives: ['fr', 'en'] }),

  // ── Spanish-speaking ──
  ES: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  MX: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  CO: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  AR: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  PE: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  CL: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  EC: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  GT: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  HN: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  NI: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  PA: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  CR: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  DO: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  CU: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  VE: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  BO: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  PY: Object.freeze({ primary: 'es', alternatives: ['en'] }),
  UY: Object.freeze({ primary: 'es', alternatives: ['en'] }),
});

// Default suggestion when no row matches.
const FALLBACK = Object.freeze({ primary: 'en', alternatives: [] });

/**
 * Normalise an arbitrary country input to ISO-2 uppercase, or
 * null when it's empty / unrecognisable.
 *
 *   'gh'        → 'GH'
 *   'GHA'       → 'GH' (rough alpha-3 → alpha-2 for the rows we ship)
 *   'Ghana'     → 'GH'
 *   ''          → null
 */
export function normaliseCountryCode(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  // Already an ISO-2 we recognise.
  if (upper.length === 2 && COUNTRY_LANGUAGE[upper]) return upper;
  // Unknown ISO-2 — still pass it through; mapLocationToLanguage
  // will return the FALLBACK for unmapped 2-letter codes.
  if (upper.length === 2) return upper;
  // Common alpha-3 → alpha-2 conversions for the markets we support.
  // Kept tiny on purpose — adding more is fine when needed.
  const ALPHA3 = {
    GHA: 'GH', NGA: 'NG', USA: 'US', CAN: 'CA', GBR: 'GB',
    IND: 'IN', KEN: 'KE', TZA: 'TZ', UGA: 'UG', RWA: 'RW',
    CIV: 'CI', SEN: 'SN', MLI: 'ML', BFA: 'BF', BEN: 'BJ',
    TGO: 'TG', CMR: 'CM', NER: 'NE', FRA: 'FR', ESP: 'ES',
    MEX: 'MX', COL: 'CO', ARG: 'AR', PER: 'PE',
  };
  if (ALPHA3[upper]) return ALPHA3[upper];
  // Bare country names — narrow lookup. Keeping this tiny: every
  // production flow ships an ISO code; this is just a safety net
  // for legacy strings.
  const NAME_TO_ISO = {
    GHANA: 'GH', NIGERIA: 'NG', INDIA: 'IN',
    KENYA: 'KE', TANZANIA: 'TZ', UGANDA: 'UG',
    'UNITED STATES': 'US', 'UNITED STATES OF AMERICA': 'US',
    USA: 'US', AMERICA: 'US',
    'UNITED KINGDOM': 'GB', UK: 'GB', BRITAIN: 'GB',
    FRANCE: 'FR', SPAIN: 'ES', MEXICO: 'MX',
  };
  if (NAME_TO_ISO[upper]) return NAME_TO_ISO[upper];
  return null;
}

/**
 * mapLocationToLanguage — primary suggestion + alternatives.
 *
 *   mapLocationToLanguage('GH')   → { primary: 'en', alternatives: ['tw','ha','ee','ga'] }
 *   mapLocationToLanguage('IN')   → { primary: 'hi', alternatives: ['en'] }
 *   mapLocationToLanguage('XYZ')  → { primary: 'en', alternatives: [] }
 *   mapLocationToLanguage(null)   → { primary: 'en', alternatives: [] }
 *
 * Returns a frozen object — callers can pass the result around
 * safely without defensive copies.
 */
export function mapLocationToLanguage(country) {
  const iso = normaliseCountryCode(country);
  if (!iso) return FALLBACK;
  return COUNTRY_LANGUAGE[iso] || FALLBACK;
}

/**
 * mapBrowserLocaleToLanguage — derive a UI language from
 * navigator.language ('en-GB', 'fr-CA', 'hi-IN', etc).
 *
 * Order of evaluation:
 *   1. Region tag (after the dash) → COUNTRY_LANGUAGE row, if any.
 *   2. Language tag (before the dash) → matched against shipping
 *      language codes.
 *   3. 'en' as last resort.
 */
export function mapBrowserLocaleToLanguage(locale) {
  if (!locale) return 'en';
  const raw = String(locale).trim();
  if (!raw) return 'en';
  const [langPart, regionPart] = raw.split(/[-_]/);
  if (regionPart) {
    const row = COUNTRY_LANGUAGE[regionPart.toUpperCase()];
    if (row) return row.primary;
  }
  // Common language-tag → suggested UI lang. Kept narrow on
  // purpose — only mappings that match a country row above.
  const LANG_DIRECT = {
    en: 'en', fr: 'fr', sw: 'sw', ha: 'ha', tw: 'tw',
    hi: 'hi', es: 'es',
  };
  if (langPart && LANG_DIRECT[langPart.toLowerCase()]) {
    return LANG_DIRECT[langPart.toLowerCase()];
  }
  return 'en';
}
