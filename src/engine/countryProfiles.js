/**
 * Country Profiles — small, extensible registry of launch-footprint
 * countries with the metadata the decision engine needs.
 *
 * Each entry feeds three systems:
 *   1. the region bucket layer (regionProfiles.js) so task wording
 *      adapts without per-country forks
 *   2. the crop-calendar resolver (cropCalendar.js) so the current
 *      stage is picked from country + crop + month
 *   3. the language selector defaults
 *
 * Add a new country by appending one object. The engine never
 * branches on countryCode; it just reads whichever profile resolves.
 */

import { resolveRegionProfile } from './regionProfiles.js';

export const COUNTRY_PROFILES = Object.freeze({
  GH: {
    countryCode: 'GH',
    countryName: 'Ghana',
    regionBucket: 'tropical_manual',
    farmingStyle: 'manual',
    climateType: 'tropical',
    supportedCrops: ['MAIZE', 'CASSAVA'],
    defaultLanguages: ['en', 'tw'],
  },
  NG: {
    countryCode: 'NG',
    countryName: 'Nigeria',
    regionBucket: 'tropical_manual',
    farmingStyle: 'manual',
    climateType: 'tropical',
    supportedCrops: ['MAIZE'],
    defaultLanguages: ['en', 'ha'],
  },
  IN: {
    countryCode: 'IN',
    countryName: 'India',
    regionBucket: 'monsoon_mixed',
    farmingStyle: 'mixed',
    climateType: 'monsoon',
    supportedCrops: ['RICE', 'ONION'],
    defaultLanguages: ['en'],
  },
  US: {
    countryCode: 'US',
    countryName: 'United States',
    regionBucket: 'temperate_mechanized',
    farmingStyle: 'mechanized',
    climateType: 'temperate',
    supportedCrops: ['MAIZE', 'TOMATO', 'ONION'],
    defaultLanguages: ['en'],
  },
});

// ─── Resolver ─────────────────────────────────────────────

/**
 * Look up a country profile from an ISO-2 code, ISO-3 code, or free-form
 * country name. Returns null when we don't recognise the country.
 */
export function getCountryProfile(code) {
  if (!code) return null;
  const norm = String(code).trim().toUpperCase();
  if (COUNTRY_PROFILES[norm]) return COUNTRY_PROFILES[norm];
  // ISO-3 best effort — take first two letters
  if (norm.length === 3 && COUNTRY_PROFILES[norm.slice(0, 2)]) {
    return COUNTRY_PROFILES[norm.slice(0, 2)];
  }
  return null;
}

/**
 * Produce the full region profile (from regionProfiles.js) for a
 * country. The two layers stay in sync: the country profile names the
 * bucket, the region profile ships the actual taskHints and climate
 * metadata the decision engine consumes.
 */
export function getRegionForCountry(countryCode) {
  const profile = getCountryProfile(countryCode);
  if (!profile) return resolveRegionProfile(countryCode); // fall-through
  return resolveRegionProfile(profile.countryCode);
}

export function listCountries() {
  return Object.values(COUNTRY_PROFILES);
}

/**
 * Dev-time: are we supporting this crop for this country? Callers use
 * this to steer the recommendation engine away from crops that have
 * no calendar data yet.
 */
export function isCropSupportedInCountry(countryCode, cropCode) {
  const profile = getCountryProfile(countryCode);
  if (!profile || !cropCode) return false;
  return profile.supportedCrops.includes(String(cropCode).toUpperCase());
}
