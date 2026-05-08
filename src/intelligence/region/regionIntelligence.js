/**
 * regionIntelligence.js — region/country awareness layer.
 *
 *   import { getRegionContext, getSeasonContext, getRegionalCropSuggestions }
 *     from '../intelligence/region/regionIntelligence.js';
 *
 *   const ctx = getRegionContext({
 *     countryCode: 'GH',
 *     month:       3,        // 1-12
 *     userMode:    'farm',
 *     cropSlug:    'tomato',
 *     weatherType: 'heat',
 *   });
 *
 * Output:
 *   {
 *     countryCode, regionLabel, climateZone, seasonLabel,
 *     rainySeason, drySeason, frostRisk, heatRisk,
 *     preferredLanguages, defaultUnits,
 *     commonCrops, seasonalCrops,
 *     guidanceModifiers,    // i18n keys for the insight chips
 *     confidence,           // 'high' | 'medium' | 'low'
 *   }
 *
 * Strict-rule audit
 *   • Pure module — no I/O, no React.
 *   • Always returns a fallback shape — never throws, never null.
 *   • No GPS lookup — caller passes countryCode (resolved upstream).
 *   • No hard "Set your location" prompts — silent fallback to
 *     UNKNOWN profile when input is missing.
 *   • Approximate, confidence-safe — never overclaims local agronomy.
 */

import { getProfile, UNKNOWN } from './regionProfiles.js';

// ─── Helpers ──────────────────────────────────────────────────────

function _safeMonth(m) {
  const n = Number(m);
  if (Number.isFinite(n) && n >= 1 && n <= 12) return Math.floor(n);
  // Default to current month so callers without a date input still
  // get a sensible season classification.
  try { return new Date().getMonth() + 1; }
  catch { return 1; }
}

function _includesMonth(monthList, month) {
  return Array.isArray(monthList) && monthList.indexOf(month) !== -1;
}

function _safeStr(s, fallback = '') {
  return (typeof s === 'string' && s.trim()) ? s.trim() : fallback;
}

// ─── Season context (spec §3) ─────────────────────────────────────

/**
 * getSeasonContext(countryCode, month, regionName?) → SeasonContext
 *
 * @param {string|null} countryCode
 * @param {number|null} month         1-12; defaults to "now"
 * @param {string|null} [regionName]  unused today; reserved for sub-region overrides
 * @returns {{
 *   seasonLabel: string,    // i18n key for the season name
 *   seasonLabelFallback: string,
 *   rainySeason:  boolean,
 *   drySeason:    boolean,
 *   harmattan:    boolean,
 *   frostRisk:    boolean,
 *   heatRisk:     boolean,
 *   plantingWindow: 'major' | 'minor' | 'off',
 *   harvestWindow:  'major' | 'minor' | 'off',
 *   confidence:   'high' | 'medium' | 'low',
 * }}
 */
export function getSeasonContext(countryCode, month, regionName) {
  void regionName; // reserved for future sub-region overrides

  const profile = getProfile(countryCode);
  const m       = _safeMonth(month);

  if (profile === UNKNOWN) {
    return Object.freeze({
      seasonLabel:         'region.season.unknown',
      seasonLabelFallback: 'current season',
      rainySeason:         false,
      drySeason:           false,
      harmattan:           false,
      frostRisk:           false,
      heatRisk:            false,
      plantingWindow:      'off',
      harvestWindow:       'off',
      confidence:          'low',
    });
  }

  const isRainy     = _includesMonth(profile.rainyMonths,     m);
  const isDry       = _includesMonth(profile.dryMonths,       m);
  const isHarmattan = _includesMonth(profile.harmattanMonths, m);
  const isFrost     = _includesMonth(profile.frostMonths,     m);
  const isHeat      = _includesMonth(profile.heatMonths,      m);

  // Planting / harvest windows — coarse approximation.
  // Tropical: planting at start of rainy; harvest 3-5 months later.
  let plantingWindow = 'off';
  let harvestWindow  = 'off';
  if (profile.rainyMonths.length > 0) {
    const firstRainy = profile.rainyMonths[0];
    if (m === firstRainy || m === ((firstRainy % 12) + 1)) plantingWindow = 'major';
    const lastRainy = profile.rainyMonths[profile.rainyMonths.length - 1];
    if (m === lastRainy || m === ((lastRainy % 12) + 1)) harvestWindow = 'major';
  }

  // Resolve a single primary season label.
  let seasonLabel         = 'region.season.transitional';
  let seasonLabelFallback = 'transitional season';
  if (isHarmattan) {
    seasonLabel         = 'region.season.harmattan';
    seasonLabelFallback = 'Harmattan / dry winds';
  } else if (isFrost) {
    seasonLabel         = 'region.season.frost';
    seasonLabelFallback = 'cold / frost season';
  } else if (isRainy && !isDry) {
    seasonLabel         = 'region.season.rainy';
    seasonLabelFallback = 'rainy season';
  } else if (isDry && !isRainy) {
    seasonLabel         = 'region.season.dry';
    seasonLabelFallback = 'dry season';
  } else if (isHeat) {
    seasonLabel         = 'region.season.hot';
    seasonLabelFallback = 'hot season';
  }

  // Confidence — known profile + clear month classification = medium.
  // Bimodal climates (Kenya) overlapping months get low confidence.
  const overlap = (isRainy && isDry);
  const confidence = overlap ? 'low' : 'medium';

  return Object.freeze({
    seasonLabel,
    seasonLabelFallback,
    rainySeason:  isRainy,
    drySeason:    isDry,
    harmattan:    isHarmattan,
    frostRisk:    isFrost,
    heatRisk:     isHeat,
    plantingWindow,
    harvestWindow,
    confidence,
  });
}

// ─── Crop suitability (spec §4) ─────────────────────────────────────

/**
 * getRegionalCropSuggestions(regionContext, month, mode) →
 *   { commonCrops, seasonalSuggestions, cautionNotes }
 *
 * All returned crop slugs are English (engine-internal). UI
 * displays them via the existing cropNames overlay so the dropdown
 * stays localized.
 *
 * @param {object} regionContext   output of getRegionContext (or getProfile)
 * @param {number} month           1-12
 * @param {'farm'|'garden'|null} mode
 */
export function getRegionalCropSuggestions(regionContext, month, mode) {
  const profile = (regionContext && regionContext.countryCode)
    ? getProfile(regionContext.countryCode)
    : UNKNOWN;

  const season = getSeasonContext(profile.countryCode, month);

  // Common crops — directly from the profile.
  const commonCrops = profile.commonCrops || [];

  // Garden mode bias: prefer container-friendly crops first.
  const GARDEN_BIAS = ['tomato', 'pepper', 'basil', 'spinach', 'lettuce', 'okra'];
  let seasonalSuggestions = commonCrops.slice(0, 6);
  if (mode === 'garden') {
    const biasMatched = commonCrops.filter((c) => GARDEN_BIAS.includes(c));
    if (biasMatched.length > 0) {
      seasonalSuggestions = [
        ...biasMatched,
        ...commonCrops.filter((c) => !GARDEN_BIAS.includes(c)),
      ].slice(0, 6);
    }
  }

  // Caution notes — translation-key tags the UI consumes via tSafe.
  const cautionNotes = [];
  if (season.frostRisk)  cautionNotes.push('region.caution.frostSensitive');
  if (season.heatRisk)   cautionNotes.push('region.caution.heatStress');
  if (season.rainySeason) cautionNotes.push('region.caution.drainage');
  if (season.harmattan)  cautionNotes.push('region.caution.harmattanMoisture');
  if (mode === 'garden' && (season.heatRisk || season.drySeason)) {
    cautionNotes.push('region.caution.smallContainer');
  }

  return Object.freeze({
    commonCrops:         Object.freeze([...commonCrops]),
    seasonalSuggestions: Object.freeze(seasonalSuggestions),
    cautionNotes:        Object.freeze(cautionNotes),
  });
}

// ─── Region context (spec §1) ──────────────────────────────────────

/**
 * getRegionContext(input) → RegionContext
 *
 * Composes the country profile + season classification + crop
 * suggestions + guidance modifiers into one consumable shape.
 *
 * @param {object} input
 *   countryCode   ISO-3166-1 alpha-2 (e.g. 'GH', 'IN', 'US')
 *   countryName   display name override (optional)
 *   regionName    sub-region (e.g. 'Ashanti'); display only today
 *   city          city name; display only
 *   lat, lng      coordinates; reserved (no GPS lookup here)
 *   language      currently-active UI language (informational)
 *   userMode      'farm' | 'garden' | null
 *   cropSlug      active crop / plant; informational
 *   weatherType   'rain' | 'heat' | 'dry' | 'wind' | 'cloudy' | 'unknown'
 *   month         1-12 (defaults to current month)
 *
 * Always returns a frozen RegionContext. Never throws.
 */
export function getRegionContext(input) {
  try {
    const safe    = (input && typeof input === 'object') ? input : {};
    const profile = getProfile(safe.countryCode);
    const month   = _safeMonth(safe.month);
    const season  = getSeasonContext(profile.countryCode, month, safe.regionName);
    const suggestions = getRegionalCropSuggestions(profile, month, safe.userMode);

    // Build a deduped guidanceModifiers list. These are translation
    // keys the UI feeds into tSafe to render the insight chip.
    const tags = new Set();
    for (const t of (profile.guidanceTags || [])) tags.add(t);
    if (season.rainySeason) tags.add('rainySeason');
    if (season.drySeason)   tags.add('drySeason');
    if (season.harmattan)   tags.add('harmattan');
    if (season.frostRisk)   tags.add('frost');
    if (season.heatRisk)    tags.add('heat');

    // Weather-modifier tag — when the live weather agrees with the
    // season, surface a stronger guidance line.
    const wt = String(safe.weatherType || '').toLowerCase();
    if (wt === 'rain' && season.rainySeason)        tags.add('heavyRainWaterlogging');
    if ((wt === 'heat' || wt === 'dry') && season.harmattan) tags.add('harmattanDryAir');
    if (wt === 'rain' && tags.has('monsoon'))       tags.add('monsoonLeafSpot');
    if (season.frostRisk && safe.userMode === 'garden') tags.add('coverContainersIndoor');
    if ((season.heatRisk || wt === 'heat') && safe.userMode === 'garden') {
      tags.add('smallPotWaterEarly');
    }

    // Build the regionLabel from the most specific input the
    // caller supplied.
    const regionLabel = _safeStr(safe.regionName)
      ? `${_safeStr(safe.regionName)}${profile.countryName !== UNKNOWN.countryName ? ', ' + profile.countryName : ''}`
      : profile.countryName;

    // Confidence — depends on how much the caller gave us:
    //   high   = countryCode + regionName + month
    //   medium = countryCode + month
    //   low    = unknown country
    let confidence = 'low';
    if (profile !== UNKNOWN) {
      confidence = _safeStr(safe.regionName) ? 'high' : 'medium';
    }
    // Bimodal seasons drag confidence down even with full input.
    if (season.confidence === 'low') confidence = 'low';

    return Object.freeze({
      countryCode:        profile.countryCode,
      countryName:        _safeStr(safe.countryName) || profile.countryName,
      regionLabel,
      climateZone:        profile.climateZone,
      seasonLabel:        season.seasonLabel,
      seasonLabelFallback: season.seasonLabelFallback,
      rainySeason:        season.rainySeason,
      drySeason:          season.drySeason,
      harmattan:          season.harmattan,
      frostRisk:          season.frostRisk,
      heatRisk:           season.heatRisk,
      plantingWindow:     season.plantingWindow,
      harvestWindow:      season.harvestWindow,
      preferredLanguages: profile.preferredLanguages,
      defaultUnits:       profile.defaultUnits,
      commonCrops:        suggestions.commonCrops,
      seasonalCrops:      suggestions.seasonalSuggestions,
      cautionNotes:       suggestions.cautionNotes,
      guidanceModifiers:  Object.freeze([...tags]),
      confidence,
      source:             'regionIntelligence-v1',
    });
  } catch {
    return _FALLBACK_CONTEXT;
  }
}

// Frozen canonical fallback — emitted on any failure path or when
// no input is supplied at all.
const _FALLBACK_CONTEXT = Object.freeze({
  countryCode:        'XX',
  countryName:        'Your area',
  regionLabel:        'Your area',
  climateZone:        'unknown',
  seasonLabel:        'region.season.unknown',
  seasonLabelFallback: 'current season',
  rainySeason:        false,
  drySeason:          false,
  harmattan:          false,
  frostRisk:          false,
  heatRisk:           false,
  plantingWindow:     'off',
  harvestWindow:      'off',
  preferredLanguages: Object.freeze(['en']),
  defaultUnits:       Object.freeze({ temperature: 'C', area: 'hectare', weight: 'kg' }),
  commonCrops:        Object.freeze([]),
  seasonalCrops:      Object.freeze([]),
  cautionNotes:       Object.freeze([]),
  guidanceModifiers:  Object.freeze([]),
  confidence:         'low',
  source:             'regionIntelligence-fallback',
});

// ─── Test surface ──────────────────────────────────────────────────
export const FALLBACK_CONTEXT = _FALLBACK_CONTEXT;
export const _internal = Object.freeze({
  _safeMonth,
  _includesMonth,
});
