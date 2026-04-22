/**
 * farrowayScoreEngine.js — Farroway Score (0–100).
 *
 * Rolls up how well a farmer is managing their farm into a single
 * explainable number + a 5-category breakdown. Every category is a
 * transparent weighted sum — no ML, no hidden terms.
 *
 *   computeFarrowayScore({ farm, weather?, plan?, completedTaskIds?,
 *                           previousScore?, date? })
 *     → {
 *       overall:      0..100 integer,
 *       band:         'excellent' | 'strong' | 'improving' | 'needs_help',
 *       trend:        'up' | 'down' | 'flat' | null,
 *       delta:        overall - previousScore.overall (or null),
 *       categories: {
 *         execution:   { score, weight, confidence, signals, suggestion? },
 *         timing:      { ... },
 *         riskMgmt:    { ... },
 *         cropFit:     { ... },
 *         yieldAlign:  { ... },
 *       },
 *       suggestions: [{ category, action, reason }],   // top 1–2
 *       confidence:  'low' | 'medium' | 'high',
 *       assumptions: string[],
 *       generatedFor: { farmId, date },
 *       generatedAt:  ISO,
 *     }
 *
 * Contract guarantees
 *   • Pure + deterministic (same inputs → same output).
 *   • Never throws. Missing inputs collapse the relevant category
 *     to a neutral 50 with confidence='low' (documented in
 *     `assumptions`). Overall stays honest.
 *   • Result is frozen.
 *
 * Scoring philosophy
 *   • Every category caps at 100; 50 is "we don't know".
 *   • A category we can't assess uses 50 AND drops its confidence
 *     to low — the overall confidence is the worst-of.
 *   • Weights sum to 100 so the overall is a 0..100 integer.
 */

import { buildFarmActionPlan } from './farmActionPlan.js';
import { estimateYield }       from './yieldEngine.js';
import {
  matchCropRiskPatterns,
  normalizeCropKey,
} from '../../config/crops/index.js';
import { RULES as RECOMMENDATION_RULES }
  from '../../config/cropRecommendationRules.js';

// ─── Weights (sum = 100) ─────────────────────────────────────────
const WEIGHTS = Object.freeze({
  execution:  25,
  timing:     20,
  riskMgmt:   20,
  cropFit:    20,
  yieldAlign: 15,
});

// ─── Band thresholds ─────────────────────────────────────────────
const BANDS = Object.freeze([
  { min: 85, band: 'excellent'  },
  { min: 70, band: 'strong'     },
  { min: 50, band: 'improving'  },
  { min: 0,  band: 'needs_help' },
]);

function bandFor(score) {
  for (const b of BANDS) if (score >= b.min) return b.band;
  return 'needs_help';
}

// ─── Helpers ─────────────────────────────────────────────────────
function clamp(n, lo = 0, hi = 100) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
function ymd(d) {
  const x = d instanceof Date ? d : new Date(d || Date.now());
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

// ─── Category: Execution (task completion rate) ──────────────────
function scoreExecution({ plan, completedTaskIds }) {
  if (!plan || !Array.isArray(plan.now) || plan.now.length === 0) {
    return {
      score: 50, confidence: 'low', weight: WEIGHTS.execution,
      signals: { expectedTasks: 0, completedTasks: 0 },
      reason:  'no_plan_tasks',
    };
  }
  if (!(completedTaskIds instanceof Set)) {
    return {
      score: 50, confidence: 'low', weight: WEIGHTS.execution,
      signals: { expectedTasks: plan.now.length, completedTasks: null },
      reason:  'no_completion_data',
    };
  }
  const expected = plan.now.length;
  let done = 0;
  for (const t of plan.now) {
    const id = t.templateId || t.id;
    if (id && completedTaskIds.has(id)) done += 1;
  }
  const rate = expected > 0 ? done / expected : 0;
  // Linear mapping: 0% = 40 (not zero — participating still counts),
  // 100% = 100. Slight floor so a single day without any completions
  // doesn't slam the overall below the "improving" band.
  const score = clamp(Math.round(40 + rate * 60));
  return {
    score,
    confidence: expected >= 3 ? 'high' : 'medium',
    weight: WEIGHTS.execution,
    signals: { expectedTasks: expected, completedTasks: done, rate },
    reason: 'computed',
  };
}

// ─── Category: Timing (critical tasks handled in time) ───────────
function scoreTiming({ plan, completedTaskIds, now }) {
  if (!plan || !Array.isArray(plan.now) || plan.now.length === 0) {
    return {
      score: 50, confidence: 'low', weight: WEIGHTS.timing,
      signals: { critical: 0, lateCritical: 0 },
      reason: 'no_plan_tasks',
    };
  }
  const criticals = plan.now.filter((t) => t.priority === 'high');
  if (criticals.length === 0) {
    // No critical tasks today — nothing to be late on. Neutral-high.
    return {
      score: 80, confidence: 'medium', weight: WEIGHTS.timing,
      signals: { critical: 0, lateCritical: 0 },
      reason: 'no_critical_tasks',
    };
  }
  // "Late" = plan is >24h old AND the critical task isn't in the
  // completed set. Same rule the smart-alert engine uses.
  const planAge = plan.generatedAt
    ? (now - new Date(plan.generatedAt).getTime())
    : 0;
  const stale = planAge > 24 * 60 * 60 * 1000;
  if (!(completedTaskIds instanceof Set)) {
    return {
      score: stale ? 45 : 70,
      confidence: 'low', weight: WEIGHTS.timing,
      signals: { critical: criticals.length, lateCritical: null, stale },
      reason: 'no_completion_data',
    };
  }
  const late = criticals.filter((t) => {
    const id = t.templateId || t.id;
    return stale && !(id && completedTaskIds.has(id));
  }).length;
  // Each late critical drops score by a large chunk. One late
  // critical → 75; two → 50; three+ → 25. Zero late → 100.
  const penaltyPerLate = 25;
  const score = clamp(100 - late * penaltyPerLate);
  return {
    score,
    confidence: 'high',
    weight: WEIGHTS.timing,
    signals: { critical: criticals.length, lateCritical: late, stale },
    reason: 'computed',
  };
}

// ─── Category: Risk Management (exposure to high-severity risks) ─
function scoreRiskMgmt({ canonicalCrop, climate, season, stageKey }) {
  if (!canonicalCrop) {
    return {
      score: 50, confidence: 'low', weight: WEIGHTS.riskMgmt,
      signals: { matched: 0, high: 0 },
      reason: 'no_crop',
    };
  }
  const matches = matchCropRiskPatterns({
    canonicalKey: canonicalCrop, climate, season, stage: stageKey,
  });
  const high   = matches.filter((p) => p.severity === 'high').length;
  const medium = matches.filter((p) => p.severity === 'medium').length;
  // Exposure score: 0 matched = 100. Each high-severity match is
  // -25; each medium is -10. Floor 0.
  const score = clamp(100 - (high * 25) - (medium * 10));
  return {
    score,
    confidence: (climate && season) ? 'high' : 'medium',
    weight: WEIGHTS.riskMgmt,
    signals: { matched: matches.length, high, medium },
    reason: 'computed',
  };
}

// ─── Category: Crop Fit (crop × country/state) ───────────────────
function scoreCropFit({ canonicalCrop, country, state }) {
  if (!canonicalCrop || !country) {
    return {
      score: 50, confidence: 'low', weight: WEIGHTS.cropFit,
      signals: {},
      reason: 'no_region',
    };
  }
  const c = String(country).toUpperCase();
  const s = state ? String(state).toUpperCase() : null;
  const countryRules = RECOMMENDATION_RULES[c];
  if (!countryRules) {
    return {
      score: 50, confidence: 'low', weight: WEIGHTS.cropFit,
      signals: { country: c },
      reason: 'unsupported_country',
    };
  }
  // Prefer state-level rules when present.
  const pool = (s && countryRules.states && countryRules.states[s]
    ? countryRules.states[s]
    : countryRules.defaults) || [];
  const lookupKeys = new Set([canonicalCrop, canonicalCrop.replace(/-/g, '_')]);
  const rule = pool.find((r) => lookupKeys.has(String(r.crop).toLowerCase()));
  if (!rule) {
    // Crop isn't on the local fit list — assume medium confidence,
    // neutral-low score. Farmer might still be growing something
    // that works but isn't in our rulebook; we don't penalize hard.
    return {
      score: 55, confidence: 'low', weight: WEIGHTS.cropFit,
      signals: { country: c, state: s, canonicalCrop, matchedRule: null },
      reason: 'crop_not_in_region_rules',
    };
  }
  const score = rule.fit === 'high'   ? 95
              : rule.fit === 'medium' ? 75
              : rule.fit === 'low'    ? 55
              : 50;
  return {
    score,
    confidence: s && countryRules.states && countryRules.states[s] ? 'high' : 'medium',
    weight: WEIGHTS.cropFit,
    signals: { country: c, state: s, canonicalCrop, fit: rule.fit },
    reason: 'computed',
  };
}

// ─── Category: Yield Alignment (confidence + weather drag) ───────
function scoreYieldAlign({ farm, weather, climate, season, stageKey }) {
  if (!farm || !farm.crop) {
    return {
      score: 50, confidence: 'low', weight: WEIGHTS.yieldAlign,
      signals: {},
      reason: 'no_crop',
    };
  }
  const est = estimateYield({
    crop:              farm.crop,
    normalizedAreaSqm: farm.normalizedAreaSqm,
    size:              farm.farmSize || farm.size,
    sizeUnit:          farm.sizeUnit,
    farmType:          farm.farmType,
    cropStage:         stageKey || farm.cropStage,
    countryCode:       farm.country || farm.countryCode,
    weather, climate, season,
  });
  if (!est) {
    return {
      score: 50, confidence: 'low', weight: WEIGHTS.yieldAlign,
      signals: { estimate: null },
      reason: 'no_estimate',
    };
  }
  let score = est.confidenceLevel === 'high'   ? 90
            : est.confidenceLevel === 'medium' ? 75
                                                : 55;
  // Weather dragging the band → extra penalty.
  const dragStatuses = new Set(['low_rain', 'dry_ahead', 'excessive_heat']);
  if (est.weatherStatus && dragStatuses.has(est.weatherStatus)) {
    score -= 10;
  }
  // Recommendations present → the engine thinks there's something
  // actionable; slight nudge down since "alignment" implies we're
  // not leaving yield on the table. Cap at single-digit penalty
  // so a farmer with two levers isn't punished hard.
  if (Array.isArray(est.recommendations) && est.recommendations.length > 0) {
    score -= Math.min(5, est.recommendations.length * 3);
  }
  return {
    score: clamp(score),
    confidence: est.confidenceLevel,
    weight: WEIGHTS.yieldAlign,
    signals: {
      confidenceLevel: est.confidenceLevel,
      weatherStatus:   est.weatherStatus,
      recommendations: (est.recommendations || []).length,
    },
    reason: 'computed',
  };
}

// ─── Suggestion derivation ───────────────────────────────────────
// Pick the 1–2 lowest-scoring categories and emit a short, concrete
// action. Reuses the signals already captured above so suggestions
// stay grounded in what the engine actually saw.
function deriveSuggestions(categories) {
  const ranked = Object.entries(categories)
    .map(([key, cat]) => ({ key, ...cat }))
    .filter((c) => c.reason === 'computed' || c.score < 65)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  return Object.freeze(ranked.map((c) => {
    switch (c.key) {
      case 'execution':
        return Object.freeze({
          category: 'execution', labelKey: 'score.suggestion.execution',
          action:   'Mark today\u2019s top task done as soon as you finish it — the score updates in real time.',
          reason:   'Completion rate is the biggest single driver of your score.',
        });
      case 'timing':
        return Object.freeze({
          category: 'timing', labelKey: 'score.suggestion.timing',
          action:   'Tackle the high-priority task first, not last — that\u2019s what the plan flags with a red dot.',
          reason:   'Late critical tasks drop your score fast.',
        });
      case 'riskMgmt':
        return Object.freeze({
          category: 'riskMgmt', labelKey: 'score.suggestion.riskMgmt',
          action:   'Act on the top Smart Alert for your crop\u2013stage today.',
          reason:   'You have high-severity risk patterns matching your conditions.',
        });
      case 'cropFit':
        return Object.freeze({
          category: 'cropFit', labelKey: 'score.suggestion.cropFit',
          action:   'Next season, consider a higher-fit crop for your region.',
          reason:   'Your current crop has a lower regional fit score.',
        });
      case 'yieldAlign':
        return Object.freeze({
          category: 'yieldAlign', labelKey: 'score.suggestion.yieldAlign',
          action:   'Save your planting date + keep the stage current — both sharpen the yield estimate and your score.',
          reason:   'Yield confidence is the main lever for this category.',
        });
      default:
        return Object.freeze({
          category: c.key, labelKey: null,
          action:   'Open the Farm Plan for concrete next steps.',
          reason:   '',
        });
    }
  }));
}

// ─── Public entry point ──────────────────────────────────────────
export function computeFarrowayScore(ctx = {}) {
  const farm = ctx.farm || null;
  if (!farm) {
    return Object.freeze({
      overall: 0, band: 'needs_help', trend: null, delta: null,
      categories: Object.freeze({}),
      suggestions: Object.freeze([]),
      confidence: 'low',
      assumptions: Object.freeze(['No farm supplied — cannot compute score.']),
      generatedFor: Object.freeze({ farmId: null, date: ymd(ctx.date) }),
      generatedAt: new Date().toISOString(),
    });
  }

  const dateStr = ymd(ctx.date);
  const nowTs = (ctx.date instanceof Date ? ctx.date : new Date(dateStr)).getTime();

  const canonicalCrop = normalizeCropKey(farm.crop || farm.cropType);
  const stageKey = farm.cropStage ? String(farm.cropStage).toLowerCase() : null;

  const plan = ctx.plan || buildFarmActionPlan({
    farm, weather: ctx.weather, date: dateStr,
  });

  const climate = ctx.climate || (plan && plan.generatedFor && plan.generatedFor.climate);
  const season  = ctx.season  || (plan && plan.generatedFor && plan.generatedFor.season);

  const completedTaskIds = ctx.completedTaskIds instanceof Set
    ? ctx.completedTaskIds
    : Array.isArray(ctx.completedTaskIds)
      ? new Set(ctx.completedTaskIds)
      : null;

  const categories = Object.freeze({
    execution:  Object.freeze(scoreExecution({ plan, completedTaskIds })),
    timing:     Object.freeze(scoreTiming({ plan, completedTaskIds, now: nowTs })),
    riskMgmt:   Object.freeze(scoreRiskMgmt({
                  canonicalCrop, climate, season, stageKey,
                })),
    cropFit:    Object.freeze(scoreCropFit({
                  canonicalCrop,
                  country: farm.country || farm.countryCode,
                  state:   farm.state,
                })),
    yieldAlign: Object.freeze(scoreYieldAlign({
                  farm, weather: ctx.weather, climate, season, stageKey,
                })),
  });

  // Weighted sum → 0..100.
  let weightedSum = 0;
  let totalWeight = 0;
  for (const cat of Object.values(categories)) {
    weightedSum += cat.score * cat.weight;
    totalWeight += cat.weight;
  }
  const overall = Math.round(clamp(weightedSum / Math.max(totalWeight, 1)));
  const band = bandFor(overall);

  // Confidence = worst of category confidences (honest about data gaps).
  const confOrder = { high: 3, medium: 2, low: 1 };
  const confidence = Object.values(categories).reduce((acc, c) => (
    confOrder[c.confidence] < confOrder[acc] ? c.confidence : acc
  ), 'high');

  // Trend (if caller supplied a previous score).
  let trend = null, delta = null;
  if (ctx.previousScore && Number.isFinite(ctx.previousScore.overall)) {
    delta = overall - ctx.previousScore.overall;
    trend = Math.abs(delta) < 2 ? 'flat' : (delta > 0 ? 'up' : 'down');
  }

  // Assumptions trail.
  const assumptions = [];
  for (const [key, cat] of Object.entries(categories)) {
    if (cat.reason === 'no_completion_data') {
      assumptions.push(`${key}: no task-completion data — using neutral baseline.`);
    } else if (cat.reason === 'no_plan_tasks') {
      assumptions.push(`${key}: no plan tasks generated today.`);
    } else if (cat.reason === 'no_region' || cat.reason === 'unsupported_country') {
      assumptions.push(`${key}: region data missing or unsupported country.`);
    } else if (cat.reason === 'crop_not_in_region_rules') {
      assumptions.push(`${key}: this crop isn\u2019t catalogued for your region.`);
    } else if (cat.reason === 'no_estimate') {
      assumptions.push(`${key}: yield estimate unavailable.`);
    }
  }

  const suggestions = deriveSuggestions(categories);

  return Object.freeze({
    overall,
    band,
    trend,
    delta,
    categories,
    suggestions,
    confidence,
    assumptions: Object.freeze(assumptions),
    generatedFor: Object.freeze({ farmId: farm.id || null, date: dateStr }),
    generatedAt: new Date().toISOString(),
  });
}

export const _internal = Object.freeze({
  WEIGHTS, BANDS,
  scoreExecution, scoreTiming, scoreRiskMgmt, scoreCropFit, scoreYieldAlign,
  deriveSuggestions, bandFor,
});
