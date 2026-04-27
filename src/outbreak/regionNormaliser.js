/**
 * regionNormaliser.js — turn free-text region names into a stable
 * canonical key for the outbreak cluster engine.
 *
 * Why
 * ───
 * In v1 the cluster grouping was a case-insensitive trim only.
 * That made "Volta", "Volta Region", and "VOLTA REGION" cluster
 * separately even though they're the same place. This module
 * fixes that with two passes:
 *
 *   1. Strip common administrative suffixes
 *      ("Region", "State", "Province", "District", "County", ...).
 *   2. Apply a small per-country alias map for the obvious
 *      variants ("KP" -> "khyber pakhtunkhwa",
 *      "Cape Coast Metropolitan" -> "cape coast", ...).
 *
 * The canonical form is lowercase, single-spaced, and trimmed.
 * The same canonicaliser runs at write time (in
 * outbreakStore.saveOutbreakReport) and at read time (in
 * outbreakClusterEngine), so a typo on one screen still groups
 * cleanly with reports captured on another.
 *
 * Strict-rule audit:
 *   * Pure (no I/O, no side effects).
 *   * Never throws on missing / non-string input.
 *   * Lightweight: small static maps, single-pass regex.
 */

const SUFFIX_PATTERNS = [
  // Order matters - longer matches first so "Region" doesn't
  // hide "Region Government" etc.
  /\b(autonomous\s+region)\b/gi,
  /\b(metropolitan\s+area|metropolitan)\b/gi,
  /\b(municipal(?:ity)?)\b/gi,
  /\b(prefecture)\b/gi,
  /\b(governorate)\b/gi,
  /\b(province)\b/gi,
  /\b(district)\b/gi,
  /\b(county)\b/gi,
  /\b(region)\b/gi,
  /\b(state)\b/gi,
  /\b(territory)\b/gi,
  /\b(division)\b/gi,
];

/**
 * Per-country alias map. Keys are lowercase post-suffix-strip
 * canonical forms; values are the FINAL canonical key.
 *
 * Add new entries when telemetry shows split clusters that
 * should have merged. Adding here is cheap; the cluster engine
 * picks up changes on the next render.
 */
const ALIASES = Object.freeze({
  GH: Object.freeze({
    // Ghana - 16 regions, common variants
    'cape coast metropolitan': 'cape coast',
    'sekondi takoradi':         'sekondi-takoradi',
    'sekondi-takoradi metropolitan': 'sekondi-takoradi',
    'greater accra':            'greater accra',
    'greater-accra':            'greater accra',
    'ashanti':                  'ashanti',
    'volta':                    'volta',
    'oti':                      'oti',
    'eastern':                  'eastern',
    'western':                  'western',
    'western north':            'western north',
    'central':                  'central',
    'northern':                 'northern',
    'savannah':                 'savannah',
    'north east':               'north east',
    'upper east':               'upper east',
    'upper west':               'upper west',
    'bono':                     'bono',
    'bono east':                'bono east',
    'ahafo':                    'ahafo',
  }),
  NG: Object.freeze({
    // Nigeria - common abbreviations + capital territory
    'fct':                      'federal capital territory',
    'fct abuja':                'federal capital territory',
    'abuja fct':                'federal capital territory',
    'akwa-ibom':                'akwa ibom',
  }),
  IN: Object.freeze({
    // India - common short forms
    'up':                       'uttar pradesh',
    'mp':                       'madhya pradesh',
    'ap':                       'andhra pradesh',
    'tn':                       'tamil nadu',
    'wb':                       'west bengal',
    'jk':                       'jammu and kashmir',
    'j and k':                  'jammu and kashmir',
    'jammu & kashmir':          'jammu and kashmir',
  }),
  PK: Object.freeze({
    // Pakistan
    'kp':                       'khyber pakhtunkhwa',
    'kpk':                      'khyber pakhtunkhwa',
    'nwfp':                     'khyber pakhtunkhwa', // historical
    'gb':                       'gilgit baltistan',
    'azad kashmir':             'azad jammu and kashmir',
    'ajk':                      'azad jammu and kashmir',
  }),
  KE: Object.freeze({
    'nairobi city':             'nairobi',
  }),
  TZ: Object.freeze({
    'dar es salaam':            'dar es salaam',
    'dar-es-salaam':            'dar es salaam',
  }),
});

function _stripSuffixes(s) {
  let out = s;
  for (const re of SUFFIX_PATTERNS) {
    out = out.replace(re, ' ');
  }
  return out;
}

function _collapse(s) {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * normaliseRegion(rawRegion, countryCode?)
 *
 *   "Volta Region"             -> "volta"
 *   "VOLTA REGION"             -> "volta"
 *   "Cape Coast Metropolitan"  -> "cape coast"     (GH alias)
 *   "KP" + country='PK'        -> "khyber pakhtunkhwa"
 *   "" / null / non-string     -> ""
 */
export function normaliseRegion(rawRegion, countryCode) {
  if (rawRegion == null) return '';
  let s = String(rawRegion);
  if (!s.trim()) return '';

  s = s.toLowerCase();
  s = _stripSuffixes(s);
  s = _collapse(s);
  // Replace remaining punctuation that isn't a hyphen/space with space.
  s = s.replace(/[._/\\,;:]+/g, ' ');
  s = _collapse(s);
  if (!s) return '';

  if (countryCode) {
    const cc = String(countryCode).toUpperCase();
    const map = ALIASES[cc];
    if (map && map[s]) return map[s];
  }
  return s;
}

/** Country code normaliser (uppercase, trimmed). */
export function normaliseCountry(rawCountry) {
  if (rawCountry == null) return '';
  return String(rawCountry).trim().toUpperCase();
}

export const _internal = Object.freeze({
  SUFFIX_PATTERNS, ALIASES, _stripSuffixes, _collapse,
});
