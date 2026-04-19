/**
 * scoringEngine.js — pure functions that score a candidate crop for
 * a given (state × farmType × month × style × purpose × beginnerLevel)
 * context and bucket the results.
 *
 * Factor weights (section-by-section from the spec):
 *   - suitabilityBaseScore  from cropRules (subregion or override)
 *   - season / month        (±12) — in-window / out-of-window
 *   - frost sensitivity     ( −8) high-frost zone × frost-sensitive crop
 *   - heat tolerance        (±10) state heatBand × crop heatTolerance
 *   - growing style         (±10) backyard only — container / raised_bed / in_ground
 *   - beginner level        (±10) beginner × difficulty
 *   - purpose               (+4..+6) backyard only — home_food / sell_locally / learning
 *   - market strength       (−4..+8) commercial / small_farm
 *   - water vs rainfall     ( −8)
 *
 * Final score clamped 0..100 and bucketed:
 *   bestMatch ≥ 75, alsoConsider 55–74, notRecommendedNow <55 or out-of-window.
 */

import { CROP_PROFILES } from './cropProfiles.js';
import { STATE_OVERRIDES } from './cropRules.js';
import { evaluateTiming } from './timeEngine.js';
import { assessRisks } from './riskEngine.js';
import { buildActionPlan } from './actionEngine.js';
import { assessMarket } from './marketEngine.js';

const VIABILITY_CUTOFF = 55;
const BEST_MATCH_FLOOR = 75;

/* ─── Growing-style boost / penalty tables (spec §I) ─────── */
const CONTAINER_BOOST = new Set([
  'tomato', 'pepper', 'herbs', 'lettuce', 'strawberry', 'green_onion', 'eggplant',
]);
const RAISED_BED_BOOST = new Set([
  'tomato', 'pepper', 'lettuce', 'kale', 'beans', 'bush_beans', 'pole_beans',
  'carrot', 'cucumber', 'onion',
]);
const IN_GROUND_BOOST = new Set([
  'squash', 'sweet_potato', 'pumpkin', 'okra', 'potato', 'corn', 'sweet_corn', 'melon',
]);
const CONTAINER_PENALTY = new Set([
  'corn', 'sweet_corn', 'sorghum', 'cotton', 'rice', 'sugarcane', 'pumpkin', 'melon',
]);

/* ─── Purpose boost tables (spec §J) ───────────────────── */
const HOME_FOOD_BOOST = new Set([
  'tomato', 'lettuce', 'pepper', 'herbs', 'beans', 'bush_beans', 'pole_beans',
  'cucumber', 'sweet_potato', 'kale',
]);
const LEARNING_BOOST = new Set([
  'lettuce', 'beans', 'herbs', 'radish', 'tomato', 'pepper',
]);
const SELL_LOCALLY_BOOST = new Set([
  'tomato', 'pepper', 'herbs', 'strawberry', 'lettuce', 'cucumber',
]);

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function waterLabel(wn) { return wn === 'low' ? 'low' : wn === 'high' ? 'high' : 'medium'; }

/** True when `month` ∈ [start..end], supporting year-wrap (e.g. 10..2). */
function monthInWindow(month, start, end) {
  if (!Number.isFinite(month) || !Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

function buildFactors({
  rule, profile, month, beginnerLevel, growingStyle, purpose, farmType, stateProfile,
}) {
  const reasons = [];
  const riskNotes = [];

  // 1) Base suitability (already subregion/state-weighted).
  let score = rule.suitabilityBaseScore;
  reasons.push(`Known to grow well in ${stateProfile.displayRegionLabel || stateProfile.displayRegion}`);

  // 2) Season / planting window.
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

  // 3) Frost risk vs frost sensitivity.
  if (profile.frostSensitive && stateProfile.frostRisk === 'high') {
    score -= 8;
    riskNotes.push('Frost-sensitive — plant after last frost');
  }
  if (!profile.frostSensitive && stateProfile.frostRisk === 'high') {
    reasons.push('Hardy — handles cool spring mornings');
  }

  // 4) Heat tolerance vs heatBand.
  if (stateProfile.heatBand === 'high' && profile.heatTolerance === 'low') {
    score -= 10;
    riskNotes.push('Bolts or stresses in peak heat — prefer shoulder season');
  }
  if (stateProfile.heatBand === 'high' && profile.heatTolerance === 'high') {
    score += 4;
  }

  // 5) Growing style (backyard only).
  if (farmType === 'backyard' && growingStyle) {
    if (growingStyle === 'container') {
      if (CONTAINER_PENALTY.has(rule.crop)) {
        score -= 20;
        riskNotes.push('Needs more space than a container');
      } else if (CONTAINER_BOOST.has(rule.crop) && profile.containerFriendly) {
        score += 8;
        reasons.push('Great in containers');
      } else if (!profile.containerFriendly) {
        score -= 10;
        riskNotes.push('Not ideal for containers');
      }
    } else if (growingStyle === 'raised_bed') {
      if (RAISED_BED_BOOST.has(rule.crop) && profile.raisedBedFriendly) {
        score += 6;
        reasons.push('Fits a raised bed');
      } else if (profile.raisedBedFriendly) {
        score += 3;
      } else if (CONTAINER_PENALTY.has(rule.crop)) {
        score -= 12;
      }
    } else if (growingStyle === 'in_ground') {
      if (IN_GROUND_BOOST.has(rule.crop) && profile.inGroundFriendly) {
        score += 6;
        reasons.push('Suits in-ground planting');
      } else if (profile.inGroundFriendly) {
        score += 3;
      }
    }
  }

  // 6) Beginner level × difficulty.
  if (beginnerLevel === 'beginner') {
    if (profile.difficulty === 'beginner' || rule.beginnerFriendly) {
      score += 6;
      reasons.push('Beginner-friendly');
    } else if (profile.difficulty === 'advanced') {
      score -= 10;
      riskNotes.push('Harder to grow — try after one easier season');
    }
  }

  // 7) Purpose (backyard only) — spec §J.
  if (farmType === 'backyard' && purpose) {
    if (purpose === 'home_food' && HOME_FOOD_BOOST.has(rule.crop)) {
      score += 4; reasons.push('Good yield for home eating');
    }
    if (purpose === 'sell_locally' && (SELL_LOCALLY_BOOST.has(rule.crop) || rule.localSellValue === 'high')) {
      score += 6; reasons.push('Sells well at local markets');
    }
    if (purpose === 'learning' && LEARNING_BOOST.has(rule.crop)) {
      score += 4; reasons.push('Forgiving crop — good to learn on');
    }
  }

  // 8) Market strength (commercial / small_farm only).
  if (farmType !== 'backyard') {
    const ms = rule.marketStrength;
    if (ms === 'high') { score += 8; reasons.push('Strong market demand in this region'); }
    else if (ms === 'medium') { score += 3; }
    else if (ms === 'low') { score -= 4; }
  }

  // 9) Water need vs rainfall band — penalize thirsty crops in dry zones.
  if (profile.waterNeed === 'high' && stateProfile.rainfallBand === 'low') {
    score -= 8;
    riskNotes.push('High water need in a dry zone — irrigation required');
  }

  return { score, reasons, riskNotes, inWindow };
}

function applyStateOverride(rule, stateCode) {
  const ovr = STATE_OVERRIDES[stateCode]?.[rule.crop]?.[rule.farmType];
  if (!ovr) return rule;
  return { ...rule, ...ovr };
}

export function scoreCrop({ rule, stateProfile, ctx }) {
  const profile = CROP_PROFILES[rule.crop];
  if (!profile) return null;
  const effectiveRule = applyStateOverride(rule, stateProfile.code);

  const { score, reasons, riskNotes, inWindow } = buildFactors({
    rule: effectiveRule, profile,
    month: ctx.currentMonth,
    beginnerLevel: ctx.beginnerLevel,
    growingStyle: ctx.growingStyle,
    purpose: ctx.purpose,
    farmType: ctx.farmType,
    stateProfile,
  });

  // ─── Layered intelligence: time, risk, action plan, market ──
  const timing = evaluateTiming({
    currentMonth: ctx.currentMonth,
    plantingStartMonth: effectiveRule.plantingStartMonth,
    plantingEndMonth: effectiveRule.plantingEndMonth,
  });
  const risks = assessRisks({
    profile, stateProfile, currentMonth: ctx.currentMonth,
  });
  // Merge risk notes into the existing riskNotes array so the UI has
  // one canonical place to read from.
  for (const n of risks.notes) if (!riskNotes.includes(n)) riskNotes.push(n);

  const actionPlan = buildActionPlan({
    cropKey: rule.crop, cropName: profile.name, timing,
  });
  const market = assessMarket({ rule: effectiveRule, farmType: ctx.farmType });

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
    marketStrength: effectiveRule.marketStrength || 'medium',
    // ─── Time intelligence ──────────────────────────────
    timing,                       // { recommendation, inWindow, monthsUntilWindow, monthsSinceWindowClose }
    // ─── Risk intelligence ──────────────────────────────
    risks: {
      frostRisk: risks.frostRisk,
      heatRisk: risks.heatRisk,
      waterStressRisk: risks.waterStressRisk,
      overallRisk: risks.overallRisk,
    },
    riskLevel: risks.overallRisk,  // convenient top-level for UI badges
    // ─── Action guidance ────────────────────────────────
    doThisNow: actionPlan.doThisNow,
    nextAction: actionPlan.nextAction,
    actionSteps: actionPlan.actionSteps,
    weeklyGuide: actionPlan.weeklyGuide,
    // ─── Market layer ───────────────────────────────────
    marketDemand: market.marketDemand,     // 'high_demand' | 'medium' | 'low'
    profitability: market.profitability,   // 'low' | 'medium' | 'high'
    plantingWindow: {
      startMonth: effectiveRule.plantingStartMonth,
      endMonth: effectiveRule.plantingEndMonth,
      active: inWindow,
    },
    harvestWindow: approximateHarvestWindow(effectiveRule, profile),
    tags: buildTags(profile, effectiveRule, stateProfile, ctx, market),
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

function buildTags(profile, rule, stateProfile, ctx, market) {
  const tags = new Set(profile.defaultTags || []);
  if (rule.beginnerFriendly) tags.add('beginner_friendly');
  if (profile.containerFriendly && ctx.growingStyle === 'container') tags.add('container_friendly');
  if (rule.marketStrength === 'high' || rule.localSellValue === 'high') tags.add('strong_local_market');
  if (profile.heatTolerance === 'high') tags.add('heat_tolerant');
  if (profile.frostSensitive && stateProfile.frostRisk === 'high') tags.add('frost_risk');
  if (market?.marketTags) for (const t of market.marketTags) tags.add(t);
  return Array.from(tags);
}

export function normalizeScore(n) { return clamp(Math.round(n), 0, 100); }

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
