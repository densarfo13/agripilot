/**
 * global — multi-country scaling facade.
 *
 *   import {
 *     resolveCountry, supportedCountries, supportedLanguages,
 *     convertUnit, isImperialCountry,
 *   } from 'src/global';
 *
 * Wires together:
 *   • src/config/regionConfig.js          — region detection
 *   • src/intelligence/region/regionIntelligence.js — season + crops
 *   • src/i18n/                           — language packs
 *
 * Spec §9 — operate uniformly across Ghana / Nigeria / Kenya /
 * India / USA and future countries. Localization across Twi /
 * Hausa / English / French / Swahili / Hindi. Adapt crops /
 * seasons / units / weather guidance / funding sources.
 *
 * This facade DOES NOT implement region-specific logic — the
 * canonical engines already do. It exists so new callers have
 * one stable import path instead of three.
 */

import {
  getRegionConfig as _getRegionConfig,
  shouldUseBackyardExperience as _shouldUseBackyard,
} from '../config/regionConfig.js';

export const SUPPORTED_COUNTRIES = Object.freeze([
  'GH', 'NG', 'KE', 'IN', 'US',
] as const);

export const SUPPORTED_LANGUAGES = Object.freeze([
  'en', 'fr', 'sw', 'ha', 'tw', 'hi',
] as const);

export type SupportedCountry = typeof SUPPORTED_COUNTRIES[number];
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export interface CountryContext {
  readonly code:     string | null;
  readonly imperial: boolean;
  readonly language: SupportedLanguage;
}

/**
 * Resolve a country context from an explicit code or from the
 * cached region config. Returns the safe defaults when nothing
 * is known.
 */
export function resolveCountry(code?: string | null): CountryContext {
  const c = String(code || '').toUpperCase().trim().slice(0, 3) || null;
  const imperial = c === 'US';
  // Language fallback per country — extended by the i18n layer.
  let language: SupportedLanguage = 'en';
  switch (c) {
    case 'GH': language = 'en'; break;  // Twi available via tSafe
    case 'NG': language = 'en'; break;
    case 'KE': language = 'sw'; break;
    case 'IN': language = 'hi'; break;
    case 'US': language = 'en'; break;
    default:   language = 'en';
  }
  return Object.freeze({ code: c, imperial, language });
}

/** Re-export the canonical region-config helpers. */
export const getRegionConfig = _getRegionConfig;
export const shouldUseBackyardExperience = _shouldUseBackyard;

/**
 * Convert acres ↔ hectares + sq ft ↔ sq metres. Pure / never
 * throws. Returns NaN on bad input so callers can fall through.
 */
export function convertUnit(
  value: number,
  from: 'acres' | 'hectares' | 'sqft' | 'sqm',
  to:   'acres' | 'hectares' | 'sqft' | 'sqm',
): number {
  if (!Number.isFinite(value)) return Number.NaN;
  if (from === to) return value;
  // Convert to sqm as canonical.
  let sqm: number;
  switch (from) {
    case 'acres':    sqm = value * 4046.8564;   break;
    case 'hectares': sqm = value * 10000;       break;
    case 'sqft':     sqm = value * 0.092903;    break;
    case 'sqm':      sqm = value;               break;
    default:         return Number.NaN;
  }
  switch (to) {
    case 'acres':    return sqm / 4046.8564;
    case 'hectares': return sqm / 10000;
    case 'sqft':     return sqm / 0.092903;
    case 'sqm':      return sqm;
    default:         return Number.NaN;
  }
}

/** True when the country defaults to imperial units. */
export function isImperialCountry(code?: string | null): boolean {
  return resolveCountry(code).imperial;
}

export function supportedCountries(): ReadonlyArray<SupportedCountry> {
  return SUPPORTED_COUNTRIES;
}
export function supportedLanguages(): ReadonlyArray<SupportedLanguage> {
  return SUPPORTED_LANGUAGES;
}

export default Object.freeze({
  SUPPORTED_COUNTRIES,
  SUPPORTED_LANGUAGES,
  resolveCountry,
  getRegionConfig,
  shouldUseBackyardExperience,
  convertUnit,
  isImperialCountry,
  supportedCountries,
  supportedLanguages,
});
