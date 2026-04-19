/**
 * scoreCropSuitability.js — explicit, weighted, explainable crop
 * scorer using the spec formula.
 *
 *   score = climateFit*0.30 + regionFit*0.20 + seasonFit*0.20
 *         + farmTypeFit*0.10 + beginnerFit*0.05
 *         + marketFit*0.10 + growingStyleFit*0.05
 *
 * Every fit component is a pure function normalized to 0..100 with
 * deterministic output so regressions are easy to catch. Guardrails
 * run after the weighted sum and cap the final score plus override
 * `plantingStatus` for edge cases (cassava outside the tropics,
 * container backyard hit with a row crop, major season miss, etc.).
 */

import { US_STATES, DISPLAY_REGION_LABELS, resolveLocationProfile } from './usStates.js';
import { CROP_PROFILES } from './cropProfiles.js';
import { RULE_INDEX } from './cropRules.js';
import { WEIGHTS, FIT_BANDS, GUARDRAILS, PLANTING_STATUS, DEFAULTS } from './suitabilityConfig.js';

// ─── helpers ───────────────────────────────────────────────

const BAND = { low: 0, medium: 1, high: 2 };
function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }
function pctFromMatch(crop, state) {
  // Rough numeric distance between coarse bands — lets the scorer
  // reward exact matches and gently penalise mismatches.
  if (crop == null || state == null) return 50;
  const diff = Math.abs(BAND[state] - BAND[crop]);
  return diff === 0 ? 100 : diff === 1 ? 65 : 30;
}

function monthInWindow(month, start, end) {
  if (!Number.isFinite(month) || !Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

function monthsUntil(current, target) {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return 0;
  return ((target - current) % 12 + 12) % 12;
}

function getRuleFor({ crop, farmType, climateSubregion, stateCode }) {
  const bucket = (RULE_INDEX[farmType] || {})[climateSubregion] || [];
  let best = null;
  for (const row of bucket) {
    if (row.crop !== crop) continue;
    // Prefer a state-specific override row over the generic subregion row.
    if (row.stateCode && row.stateCode === stateCode) return row;
    if (!best) best = row;
  }
  return best;
}

// ─── Modular fit components — each returns 0..100 ──────────

export function scoreClimateFit({ profile, stateProfile }) {
  if (!profile || !stateProfile) return 50;

  // Heat alignment — cool-loving crop in a hot band is painful,
  // heat-tolerant crop in a cool band is wasteful of potential.
  const heatFit = pctFromMatch(profile.heatTolerance, stateProfile.heatBand);

  // Water alignment — high-water crop in a low-rainfall zone
  // gets penalised; low-water crop in high-rainfall zone is fine.
  let waterFit;
  if (profile.waterNeed === 'high' && stateProfile.rainfallBand === 'low') waterFit = 25;
  else if (profile.waterNeed === 'high' && stateProfile.rainfallBand === 'medium') waterFit = 60;
  else if (profile.waterNeed === 'low' && stateProfile.rainfallBand === 'high') waterFit = 80;
  else waterFit = 90;

  // Frost sensitivity vs state frost risk.
  let frostFit = 100;
  if (profile.frostSensitive && stateProfile.frostRisk === 'high') frostFit = 40;
  else if (profile.frostSensitive && stateProfile.frostRisk === 'medium') frostFit = 70;

  return clamp(Math.round(heatFit * 0.45 + waterFit * 0.30 + frostFit * 0.25));
}

export function scoreRegionFit({ crop, climateSubregion, farmType, stateCode }) {
  const rule = getRuleFor({ crop, farmType, climateSubregion, stateCode });
  if (!rule) return 40;                       // no rule = off the standard list
  const base = Number.isFinite(rule.suitabilityBaseScore) ? rule.suitabilityBaseScore : 70;
  return clamp(Math.round(base));
}

export function scoreSeasonFit({ crop, climateSubregion, farmType, stateCode, currentMonth }) {
  const rule = getRuleFor({ crop, farmType, climateSubregion, stateCode });
  if (!rule || !Number.isFinite(rule.plantingStartMonth)) return 60;
  if (!Number.isFinite(currentMonth)) return 70; // no month → neutral
  const inWindow = monthInWindow(currentMonth, rule.plantingStartMonth, rule.plantingEndMonth);
  if (inWindow) return 100;
  const untilOpen = monthsUntil(currentMonth, rule.plantingStartMonth);
  if (untilOpen <= DEFAULTS.plantSoonMonths) return 75; // plant_soon-ish
  if (untilOpen <= 2) return 55;
  if (untilOpen <= 4) return 35;
  return 10; // deep-off season
}

export function scoreFarmTypeFit({ crop, farmType, climateSubregion, stateCode }) {
  // If there's no rule for the requested farmType but there is for
  // another, it's still partially applicable — a small-farm rule
  // covers a commercial query at reduced confidence, etc.
  if (getRuleFor({ crop, farmType, climateSubregion, stateCode })) return 100;
  if (farmType === 'small_farm' && getRuleFor({ crop, farmType: 'commercial', climateSubregion, stateCode })) return 75;
  if (farmType === 'backyard' && getRuleFor({ crop, farmType: 'small_farm', climateSubregion, stateCode })) return 50;
  return 30;
}

export function scoreBeginnerFit({ profile, rule, beginnerLevel = 'beginner' }) {
  if (beginnerLevel !== 'beginner') return 90;     // not beginner → not penalized
  if (!profile) return 60;
  const diffPoints = profile.difficulty === 'beginner' ? 100
    : profile.difficulty === 'intermediate' ? 65 : 30;
  const flagBonus = rule?.beginnerFriendly ? 10 : 0;
  return clamp(diffPoints + flagBonus);
}

export function scoreMarketFit({ rule, farmType, purpose }) {
  if (!rule) return 50;
  const ms = rule.marketStrength || 'medium';
  const msBase = ms === 'high' ? 95 : ms === 'medium' ? 70 : 40;
  if (farmType === 'backyard') {
    // Backyard market fit is driven by purpose more than marketStrength.
    if (purpose === 'sell_locally' && (rule.localSellValue === 'high')) return 95;
    if (purpose === 'home_food' && rule.homeUseValue === 'high') return 90;
    return Math.round(msBase * 0.7 + 30 * 0.3);
  }
  return msBase;
}

export function scoreGrowingStyleFit({ profile, farmType, growingStyle }) {
  if (farmType !== 'backyard' || !growingStyle) return 90;
  if (!profile) return 50;
  if (growingStyle === 'container')  return profile.containerFriendly  ? 95 : 30;
  if (growingStyle === 'raised_bed') return profile.raisedBedFriendly  ? 95 : 55;
  if (growingStyle === 'in_ground')  return profile.inGroundFriendly   ? 95 : 60;
  return 85; // 'mixed'
}

// ─── Guardrails + plantingStatus ───────────────────────────

function derivePlantingStatus({ seasonFit, rule, currentMonth }) {
  if (!rule || !Number.isFinite(rule.plantingStartMonth) || !Number.isFinite(currentMonth)) {
    return PLANTING_STATUS.WAIT;
  }
  const inWindow = monthInWindow(currentMonth, rule.plantingStartMonth, rule.plantingEndMonth);
  if (inWindow) return PLANTING_STATUS.PLANT_NOW;
  const untilOpen = monthsUntil(currentMonth, rule.plantingStartMonth);
  if (untilOpen <= DEFAULTS.plantSoonMonths) return PLANTING_STATUS.PLANT_SOON;
  if (seasonFit < 15) return PLANTING_STATUS.AVOID;
  return PLANTING_STATUS.WAIT;
}

export function applyGuardrails({ score, status, reasons, riskNotes, ctx, info }) {
  let outScore = score;
  let outStatus = status;
  for (const rail of GUARDRAILS) {
    if (rail.when(ctx, info)) {
      if (outScore > rail.cap) outScore = rail.cap;
      if (rail.statusOverride) outStatus = rail.statusOverride;
      if (rail.reason) riskNotes.push(rail.reason);
    }
  }
  return { score: outScore, status: outStatus };
}

// ─── Top-level scorer ──────────────────────────────────────

/**
 * Score a single crop for the given inputs.
 *
 * @param {Object} input
 * @param {string} input.country
 * @param {string} input.state         postal code or full name
 * @param {string} [input.climateSubregion]  overrides derivation
 * @param {string} input.farmType      'backyard' | 'small_farm' | 'commercial'
 * @param {string} [input.growingStyle]
 * @param {string} [input.purpose]     backyard-only
 * @param {string} [input.beginnerLevel]
 * @param {number} [input.currentMonth] 1..12
 * @param {string} input.crop          canonical crop key
 */
export function scoreCropSuitability(input) {
  const stateProfile = resolveLocationProfile(input.state);
  const farmType = input.farmType || 'backyard';
  const country = String(input.country || '').toUpperCase() || 'US';
  const climateSubregion = input.climateSubregion || stateProfile?.climateSubregion || null;
  const stateCode = stateProfile?.code || null;
  const cropKey = String(input.crop || '').toLowerCase();
  const profile = CROP_PROFILES[cropKey];
  const rule = getRuleFor({ crop: cropKey, farmType, climateSubregion, stateCode });
  const currentMonth = Number.isFinite(input.currentMonth)
    ? Math.round(input.currentMonth)
    : new Date().getMonth() + 1;

  // Missing crop profile → cannot score; return a minimal shape.
  if (!profile) {
    return {
      crop: cropKey,
      suitabilityScore: 0,
      fitLevel: 'low',
      plantingStatus: PLANTING_STATUS.AVOID,
      reasons: [],
      riskNotes: ['Unknown crop.'],
      explain: { weights: WEIGHTS, components: {} },
    };
  }

  // ─── Fit components ─────────────────────────────────────
  const components = {
    climateFit: scoreClimateFit({ profile, stateProfile: stateProfile || {} }),
    regionFit: scoreRegionFit({ crop: cropKey, climateSubregion, farmType, stateCode }),
    seasonFit: scoreSeasonFit({ crop: cropKey, climateSubregion, farmType, stateCode, currentMonth }),
    farmTypeFit: scoreFarmTypeFit({ crop: cropKey, farmType, climateSubregion, stateCode }),
    beginnerFit: scoreBeginnerFit({ profile, rule, beginnerLevel: input.beginnerLevel }),
    marketFit: scoreMarketFit({ rule, farmType, purpose: input.purpose }),
    growingStyleFit: scoreGrowingStyleFit({ profile, farmType, growingStyle: input.growingStyle }),
  };

  let suitabilityScore = clamp(Math.round(
      components.climateFit      * WEIGHTS.climateFit
    + components.regionFit       * WEIGHTS.regionFit
    + components.seasonFit       * WEIGHTS.seasonFit
    + components.farmTypeFit     * WEIGHTS.farmTypeFit
    + components.beginnerFit     * WEIGHTS.beginnerFit
    + components.marketFit       * WEIGHTS.marketFit
    + components.growingStyleFit * WEIGHTS.growingStyleFit
  ));

  // ─── plantingStatus + reasons ───────────────────────────
  let plantingStatus = derivePlantingStatus({ seasonFit: components.seasonFit, rule, currentMonth });
  const reasons = [];
  const riskNotes = [];
  if (components.climateFit >= 80) reasons.push('Your climate suits this crop.');
  if (components.seasonFit === 100) reasons.push('You are inside the typical planting window.');
  if (components.marketFit >= 80) reasons.push('Strong market demand in your region.');
  if (components.beginnerFit >= 90 && input.beginnerLevel === 'beginner') reasons.push('Beginner-friendly.');
  if (components.growingStyleFit >= 90 && input.growingStyle) {
    reasons.push(`Good fit for ${input.growingStyle.replace('_', ' ')}.`);
  }
  if (components.climateFit < 50) riskNotes.push('Climate is a weak match — plan for extra care.');
  if (components.seasonFit < 30) riskNotes.push('You are outside the normal planting window.');
  if (components.marketFit < 40 && farmType !== 'backyard') riskNotes.push('Market for this crop is thin here.');

  // ─── Hard guardrails ───────────────────────────────────
  const ctx = { crop: cropKey, stateCode, country, climateSubregion, farmType, growingStyle: input.growingStyle };
  const info = { ...components };
  const capped = applyGuardrails({
    score: suitabilityScore, status: plantingStatus,
    reasons, riskNotes, ctx, info,
  });
  suitabilityScore = capped.score;
  plantingStatus = capped.status;

  const fitLevel = suitabilityScore >= FIT_BANDS.high ? 'high'
    : suitabilityScore >= FIT_BANDS.medium ? 'medium' : 'low';

  const regionLabel = stateProfile
    ? DISPLAY_REGION_LABELS[stateProfile.displayRegion] || stateProfile.displayRegion
    : null;

  return {
    crop: cropKey,
    cropName: profile.name,
    suitabilityScore,
    fitLevel,
    plantingStatus,
    reasons,
    riskNotes,
    // UI-integration fields
    regionLabel,
    fitBadge: fitLevel === 'high' ? 'Best fit' : fitLevel === 'medium' ? 'Worth considering' : 'Low fit',
    lowFitWarning: fitLevel === 'low',
    plantingWindowExplanation: buildPlantingWindowText(rule, plantingStatus),
    // Explain payload
    explain: {
      weights: WEIGHTS,
      components,
      guardrailsApplied: riskNotes.filter((n) => GUARDRAILS.some((g) => g.reason === n)),
      rule: rule ? {
        stateCode: rule.stateCode || null,
        suitabilityBaseScore: rule.suitabilityBaseScore,
        marketStrength: rule.marketStrength,
        plantingStartMonth: rule.plantingStartMonth,
        plantingEndMonth: rule.plantingEndMonth,
      } : null,
    },
  };
}

function buildPlantingWindowText(rule, status) {
  if (!rule) return null;
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const start = mo[(rule.plantingStartMonth || 1) - 1];
  const end = mo[(rule.plantingEndMonth || 1) - 1];
  const window = start === end ? start : `${start}–${end}`;
  switch (status) {
    case PLANTING_STATUS.PLANT_NOW:  return `Plant now — window runs ${window}.`;
    case PLANTING_STATUS.PLANT_SOON: return `Planting window opens soon (${window}).`;
    case PLANTING_STATUS.WAIT:       return `Wait — typical planting window is ${window}.`;
    case PLANTING_STATUS.AVOID:      return `Outside the season. Next window: ${window}.`;
    default: return `Typical planting window: ${window}.`;
  }
}

// ─── Bucket builder ────────────────────────────────────────

/**
 * Given a list of crops to score, return the full recommendation
 * payload with bestMatch / alsoConsider / notRecommendedNow buckets.
 */
export function buildRecommendationBuckets({
  country, state, farmType, growingStyle, purpose, beginnerLevel, currentMonth, crops,
} = {}) {
  const cropList = Array.isArray(crops) && crops.length
    ? crops
    : Object.keys(CROP_PROFILES);
  const scored = cropList
    .map((crop) => scoreCropSuitability({
      country, state, farmType, growingStyle, purpose, beginnerLevel, currentMonth, crop,
    }))
    .sort((a, b) => b.suitabilityScore - a.suitabilityScore);

  const best = [];
  const also = [];
  const not = [];
  for (const r of scored) {
    if (r.fitLevel === 'high') best.push(r);
    else if (r.fitLevel === 'medium') also.push(r);
    else not.push(r);
  }

  const stateProfile = resolveLocationProfile(state);
  return {
    location: stateProfile ? {
      country: 'USA',
      state: stateProfile.name,
      stateCode: stateProfile.code,
      displayRegion: stateProfile.displayRegion,
      displayRegionLabel: DISPLAY_REGION_LABELS[stateProfile.displayRegion] || stateProfile.displayRegion,
      climateSubregion: stateProfile.climateSubregion,
    } : null,
    bestMatch: best.slice(0, 6),
    alsoConsider: also.slice(0, 6),
    notRecommendedNow: not.slice(0, 6),
    weights: WEIGHTS,
    fitBands: FIT_BANDS,
  };
}

export const _internal = { derivePlantingStatus, getRuleFor };
