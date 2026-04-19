/**
 * scoringEngine.js — pure functions that score a single crop for a
 * given (state × farmType × month × style × purpose × beginnerLevel)
 * context and bucket the results.
 *
 * Every function here is deterministic and has no I/O — they compose
 * the core prior (suitability base from cropRules) with contextual
 * adjustments (season, frost, style, beginner) and clamp to 0..100.
 *
 * The output is a ranked list you can slice into:
 *   bestMatch          — top scores, stable and clearly applicable
 *   alsoConsider       — mid tier, viable with caveats
 *   notRecommendedNow  — below the viability cutoff (seasonal, arid, etc.)
 */

import { CROP_PROFILES } from './cropProfiles.js';
import { STATE_OVERRIDES } from './cropRules.js';

const VIABILITY_CUTOFF = 55;
const BEST_MATCH_FLOOR = 75;

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function waterLabel(wn) { return wn === 'low' ? 'low' : wn === 'high' ? 'high' : 'medium'; }

/** True when `month` falls inside [start..end] (supports wrap, e.g. 10..2). */
function monthInWindow(month, start, end) {
  if (!Number.isFinite(month) || !Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

/**
 * Core score factors returned for introspection + UI badges.
 */
function buildFactors({
  rule, profile, month, beginnerLevel, growingStyle, purpose, farmType,
  stateProfile,
}) {
  const reasons = [];
  const riskNotes = [];

  // 1) Base suitability (already weighted per subregion in cropRules).
  let score = rule.suitabilityBaseScore;
  reasons.push(`Known to grow well in ${stateProfile.displayRegion}`);

  // 2) Season / planting window
  let inWindow = false;
  if (Number.isFinite(month)) {
    inWindow = monthInWindow(month, rule.plantingStartMonth, rule.plantingEndMonth);
    if (inWindow) {
      score += 8;
      reasons.push('Right time to plant this crop');
    } else {
      score -= 12;
      riskNotes.push('Out of usual planting window for this state');
    }
  }

  // 3) Frost risk / cool-season fit
  if (profile.frostSensitive && stateProfile.frostRisk === 'high') {
    score -= 8;
    riskNotes.push('Frost-sensitive — plant after last frost');
  }
  if (!profile.frostSensitive && stateProfile.frostRisk === 'high') {
    reasons.push('Hardy — handles cool spring mornings');
  }

  // 4) Heat tolerance vs state heat band
  if (stateProfile.heatBand === 'high' && profile.heatTolerance === 'low') {
    score -= 10;
    riskNotes.push('Bolts or stresses in peak heat — prefer shoulder season');
  }
  if (stateProfile.heatBand === 'high' && profile.heatTolerance === 'high') {
    score += 4;
  }

  // 5) Growing style (backyard only matters)
  if (farmType === 'backyard' && growingStyle) {
    if (growingStyle === 'container') {
      if (profile.containerFriendly) { score += 6; reasons.push('Great in containers'); }
      else { score -= 10; riskNotes.push('Not ideal for containers'); }
    } else if (growingStyle === 'raised_bed') {
      if (profile.raisedBedFriendly) { score += 4; reasons.push('Fits a raised bed'); }
    } else if (growingStyle === 'in_ground') {
      if (profile.inGroundFriendly) { score += 3; reasons.push('Suits in-ground planting'); }
    }
    // mixed: no adjustment either way
  }

  // 6) Beginner level × difficulty
  if (beginnerLevel === 'beginner') {
    if (profile.difficulty === 'easy' || rule.beginnerFriendly) {
      score += 6;
      reasons.push('Beginner-friendly');
    } else if (profile.difficulty === 'hard') {
      score -= 10;
      riskNotes.push('Harder to grow — consider once you have one season under your belt');
    }
  }

  // 7) Purpose (backyard only)
  if (farmType === 'backyard' && purpose) {
    if (purpose === 'home_food' && rule.homeUseValue === 'high') {
      score += 4; reasons.push('Good yield for home eating');
    }
    if (purpose === 'sell_locally' && (rule.localSellValue === 'high' || rule.localSellValue === 'very_high')) {
      score += 6; reasons.push('Sells well at local markets');
    }
    if (purpose === 'learning' && (profile.difficulty === 'easy' || rule.beginnerFriendly)) {
      score += 4; reasons.push('Forgiving crop — good to learn on');
    }
  }

  // 8) Market strength (commercial / small_farm only)
  if (farmType !== 'backyard') {
    const ms = rule.marketStrength;
    if (ms === 'very_high') { score += 8; reasons.push('Strong market demand in this region'); }
    else if (ms === 'high') { score += 4; reasons.push('Solid market in this region'); }
    else if (ms === 'low')  { score -= 4; }
  }

  // 9) Water need vs rainfall band — penalize thirsty crops in dry zones.
  if (profile.waterNeed === 'high' && stateProfile.rainfallBand === 'low') {
    score -= 8;
    riskNotes.push('High water need in a dry zone — irrigation required');
  }

  return { score, reasons, riskNotes, inWindow };
}

/** Apply optional per-state override onto a rule row. */
function applyStateOverride(rule, stateCode) {
  const ovr = STATE_OVERRIDES[stateCode]?.[rule.crop]?.[rule.farmType];
  if (!ovr) return rule;
  return { ...rule, ...ovr };
}

/**
 * Given a matching rule + inputs, produce a recommendation card.
 */
export function scoreCrop({ rule, stateProfile, ctx }) {
  const profile = CROP_PROFILES[rule.crop];
  if (!profile) return null;

  const effectiveRule = applyStateOverride(rule, stateProfile.code);

  const { score, reasons, riskNotes, inWindow } = buildFactors({
    rule: effectiveRule,
    profile,
    month: ctx.currentMonth,
    beginnerLevel: ctx.beginnerLevel,
    growingStyle: ctx.growingStyle,
    purpose: ctx.purpose,
    farmType: ctx.farmType,
    stateProfile,
  });

  return {
    key: rule.crop,
    name: profile.name,
    score: clamp(Math.round(score), 0, 100),
    difficulty: profile.difficulty,
    waterNeed: waterLabel(profile.waterNeed),
    growthWeeksMin: profile.growthWeeksMin,
    growthWeeksMax: profile.growthWeeksMax,
    reasons,
    riskNotes,
    marketStrength: effectiveRule.marketStrength || 'unknown',
    plantingWindow: {
      startMonth: effectiveRule.plantingStartMonth,
      endMonth: effectiveRule.plantingEndMonth,
      active: inWindow,
    },
    harvestWindow: approximateHarvestWindow(effectiveRule, profile),
    tags: buildTags(profile, effectiveRule, stateProfile, ctx),
  };
}

function approximateHarvestWindow(rule, profile) {
  if (!Number.isFinite(rule.plantingStartMonth)) return null;
  const avgWeeks = Math.round(((profile.growthWeeksMin || 8) + (profile.growthWeeksMax || 12)) / 2);
  const monthsToHarvest = Math.max(1, Math.round(avgWeeks / 4.3));
  const startMonth = ((rule.plantingStartMonth - 1 + monthsToHarvest) % 12) + 1;
  const endMonth = ((rule.plantingEndMonth - 1 + monthsToHarvest) % 12) + 1;
  return { startMonth, endMonth };
}

function buildTags(profile, rule, stateProfile, ctx) {
  const tags = new Set(profile.defaultTags || []);
  if (rule.beginnerFriendly) tags.add('beginner_friendly');
  if (profile.containerFriendly && ctx.growingStyle === 'container') tags.add('container_friendly');
  if (rule.marketStrength === 'very_high' || rule.localSellValue === 'very_high') tags.add('strong_local_market');
  if (profile.heatTolerance === 'high') tags.add('heat_tolerant');
  if (profile.frostSensitive && stateProfile.frostRisk === 'high') tags.add('frost_risk');
  return Array.from(tags);
}

/** Normalize a score so the callers can swap scales later if needed. */
export function normalizeScore(n) { return clamp(Math.round(n), 0, 100); }

/**
 * Bucket ranked recommendations into the three UI-ready sections.
 *   bestMatch         score >= BEST_MATCH_FLOOR
 *   alsoConsider      score >= VIABILITY_CUTOFF
 *   notRecommendedNow below cutoff OR out of planting window
 */
export function buildRecommendationBuckets(recs, { maxBest = 6, maxAlso = 6, maxNot = 4 } = {}) {
  const best = [];
  const also = [];
  const not = [];
  for (const r of recs) {
    if (r.score >= BEST_MATCH_FLOOR) best.push(r);
    else if (r.score >= VIABILITY_CUTOFF) also.push(r);
    else not.push(r);
  }
  return {
    bestMatch: best.slice(0, maxBest),
    alsoConsider: also.slice(0, maxAlso),
    notRecommendedNow: not.slice(0, maxNot),
  };
}
