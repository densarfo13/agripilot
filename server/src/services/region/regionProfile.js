/**
 * regionProfile.js — one entry point that turns a structured
 * location ({country, state, city?}) into the agronomic signals
 * the rest of the system relies on.
 *
 *   resolveRegionProfile({country, state, city}) →
 *     {
 *       country,               // 'US' | 'GH' | 'NG' | ...
 *       state,                 // 'Maryland' | 'Ashanti' | ...
 *       stateCode,             // 'MD' when resolvable
 *       city,
 *       climateSubregion,      // 'MID_ATLANTIC' etc.
 *       climateType,           // 'temperate' | 'subtropical' | 'tropical' | 'arid' | ...
 *       rainfallBand,          // 'low' | 'medium' | 'high'
 *       heatBand,              // 'low' | 'medium' | 'high'
 *       frostRisk,             // 'low' | 'medium' | 'high'
 *       supportTier,           // FULL_SUPPORT | BASIC_SUPPORT | LIMITED_SUPPORT | COMING_SOON
 *       displayRegion,
 *       displayRegionLabel,
 *     }
 *
 * The scoring, risk, and task engines call this instead of reading
 * raw text so there's exactly one place to add a new country or
 * refine a climate rule.
 */

import {
  resolveLocationProfile,
  resolveStateCode,
  US_STATES,
  DISPLAY_REGION_LABELS,
  CLIMATE_SUBREGIONS,
} from '../../domain/us/usStates.js';

// ─── Climate-type classifier ──────────────────────────────
// Maps a climate subregion to a broad type the scoring/risk
// engines can read without knowing about subregions directly.
const SUBREGION_TO_TYPE = Object.freeze({
  [CLIMATE_SUBREGIONS.NORTHEAST_COASTAL]:        'temperate',
  [CLIMATE_SUBREGIONS.MID_ATLANTIC]:             'temperate',
  [CLIMATE_SUBREGIONS.SOUTHEAST_COASTAL]:        'subtropical',
  [CLIMATE_SUBREGIONS.FLORIDA_SUBTROPICAL]:      'subtropical',
  [CLIMATE_SUBREGIONS.LOWER_MISSISSIPPI_HUMID]:  'subtropical',
  [CLIMATE_SUBREGIONS.SOUTH_CENTRAL_MIXED]:      'subtropical',
  [CLIMATE_SUBREGIONS.MIDWEST_HUMID]:            'continental',
  [CLIMATE_SUBREGIONS.GREAT_PLAINS_DRY]:         'semi_arid',
  [CLIMATE_SUBREGIONS.MOUNTAIN_COOL_DRY]:        'continental',
  [CLIMATE_SUBREGIONS.SOUTHWEST_ARID]:           'arid',
  [CLIMATE_SUBREGIONS.DESERT_IRRIGATED]:         'arid',
  [CLIMATE_SUBREGIONS.PACIFIC_NORTHWEST_COOL]:   'temperate',
  [CLIMATE_SUBREGIONS.WEST_COAST_MEDITERRANEAN]: 'mediterranean',
  [CLIMATE_SUBREGIONS.ALASKA_SHORT_SEASON]:      'boreal',
  [CLIMATE_SUBREGIONS.HAWAII_TROPICAL]:          'tropical',
});

// Support tier by country. Matches the client `countrySupport.js`
// but re-declared here so the server doesn't reach into /src.
const COUNTRY_SUPPORT = Object.freeze({
  US: 'FULL_SUPPORT',
  USA: 'FULL_SUPPORT',
  GH: 'BASIC_SUPPORT',
  NG: 'BASIC_SUPPORT',
  KE: 'BASIC_SUPPORT',
  IN: 'LIMITED_SUPPORT',
  ZA: 'LIMITED_SUPPORT',
});

function normalizeCountry(raw) {
  if (!raw) return null;
  const u = String(raw).trim().toUpperCase();
  if (u === 'USA' || u === 'UNITED STATES' || u === 'UNITED STATES OF AMERICA') return 'US';
  return u;
}

export function getSupportTier(countryCode) {
  const c = normalizeCountry(countryCode);
  return COUNTRY_SUPPORT[c] || 'COMING_SOON';
}

export function getClimateType(subregion) {
  return SUBREGION_TO_TYPE[subregion] || 'unknown';
}

/**
 * resolveRegionProfile(location)
 *
 * Handles both a structured `{country, state, city}` object and a
 * single `stateCode` string (legacy callers). Returns null when the
 * state cannot be resolved.
 */
export function resolveRegionProfile(location = {}) {
  const loc = typeof location === 'string' ? { state: location } : (location || {});
  const countryCode = normalizeCountry(loc.country || 'US');
  const stateCode = resolveStateCode(loc.state || loc.stateCode);
  const us = stateCode ? resolveLocationProfile(stateCode) : null;

  if (countryCode === 'US' && !us) return null;

  // For countries outside the US we don't have a per-state table yet,
  // so we synthesize a coarse profile from the country alone.
  if (countryCode !== 'US') {
    return {
      country: countryCode,
      state: loc.state || null,
      stateCode: null,
      city: loc.city || null,
      climateSubregion: null,
      climateType: 'unknown',
      rainfallBand: 'medium',
      heatBand: 'medium',
      frostRisk: 'low',
      supportTier: getSupportTier(countryCode),
      displayRegion: null,
      displayRegionLabel: null,
    };
  }

  return {
    country: 'US',
    state: us.name,
    stateCode: us.code,
    city: loc.city || null,
    climateSubregion: us.climateSubregion,
    climateType: getClimateType(us.climateSubregion),
    rainfallBand: us.rainfallBand,
    heatBand: us.heatBand,
    frostRisk: us.frostRisk,
    supportTier: getSupportTier('US'),
    displayRegion: us.displayRegion,
    displayRegionLabel: us.displayRegionLabel
      || DISPLAY_REGION_LABELS[us.displayRegion]
      || us.displayRegion,
  };
}

/** Handy predicate for the scoring engine. */
export function isTropicalRegion(profile) {
  if (!profile) return false;
  return profile.climateType === 'tropical' || profile.climateType === 'subtropical';
}

export const _internal = { SUBREGION_TO_TYPE, COUNTRY_SUPPORT };
