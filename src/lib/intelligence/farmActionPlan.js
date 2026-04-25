/**
 * farmActionPlan.js — Decision Timeline / "Your Farm Plan" engine.
 *
 * Composition layer. Synthesises the existing engines into a single
 * time-bucketed plan the UI can render directly:
 *
 *   buildFarmActionPlan({ farm, weather, date, tasks?, yieldEstimate? })
 *     → {
 *       now:        Action[],     // today (top 2–3)
 *       thisWeek:   Action[],     // next 7 days (3–4 items)
 *       comingUp:   ComingUp[],   // next stage / seasonal cue
 *       riskWatch:  Risk[],       // top matched crop-risk patterns
 *       recommendations: Rec[],   // 0–2 levers that affect yield most
 *       confidence: 'low' | 'medium' | 'high',
 *       generatedFor: { farmId, crop, stage, date, climate, season },
 *       assumptions: string[],    // why the plan looks the way it does
 *     } | null
 *
 * Returns null only when there is literally nothing to plan from
 * (no crop, no stage, and no farm id).
 *
 * Action shape:
 *   {
 *     id, title, description, why, type, priority, source,
 *     dueLabel  // 'now' | 'this_week' | { day: 'Mon' }
 *   }
 *
 * Contract guarantees:
 *   • Pure + deterministic (same inputs → same output).
 *   • Never throws. Partial inputs just mean thinner buckets.
 *   • Reuses existing engines; does NOT duplicate task logic.
 */

import { generateDailyTasks }    from '../dailyTasks/taskEngine.js';
import { TEMPLATES, GENERIC_FALLBACK, ALLOW_BY_FARM_TYPE }
                                  from '../dailyTasks/taskTemplates.js';
import { getCropTimeline }       from '../timeline/cropTimelineEngine.js';
import { estimateYield }         from './yieldEngine.js';
import { normalizeStageKey }     from '../../config/cropLifecycles.js';
import {
  normalizeCropKey,
  matchCropRiskPatterns,
  getCropSeasonalGuidance,
  getCropStageTasks,
} from '../../config/crops/index.js';

const MAX_NOW        = 3;
const MAX_THIS_WEEK  = 4;
const MAX_COMING_UP  = 3;
const MAX_RISK_WATCH = 3;
const MAX_RECS       = 2;

const TROPICAL = new Set(['GH', 'NG', 'KE', 'IN']);

// ─── Season inference (reused from recommendationEngine) ──────────
function inferSeason({ country, month }) {
  const m = Number.isFinite(month) ? month : null;
  if (m == null) return null;
  const c = country ? String(country).toUpperCase() : null;
  if (c && TROPICAL.has(c)) {
    if (c === 'KE') return ([3, 4, 5, 10, 11, 12].includes(m)) ? 'wet' : 'dry';
    return (m >= 4 && m <= 10) ? 'wet' : 'dry';
  }
  if ([12, 1, 2].includes(m)) return 'winter';
  if ([3, 4, 5].includes(m))  return 'spring';
  if ([6, 7, 8].includes(m))  return 'summer';
  return 'fall';
}

function inferClimate(country) {
  if (!country) return null;
  const c = String(country).toUpperCase();
  if (TROPICAL.has(c)) return 'tropical';
  if (c === 'US') return 'temperate';
  return null;
}

function canonicalFarmType(t) {
  const s = String(t || 'small_farm').toLowerCase().trim();
  if (s === 'backyard' || s === 'home' || s === 'home_food') return 'backyard';
  if (s === 'commercial' || s === 'large' || s === 'enterprise') return 'commercial';
  return 'small_farm';
}

// ─── Action decoration ────────────────────────────────────────────
function actionFrom(template, { source, dueLabel, farmId, date }) {
  return Object.freeze({
    id: template.id
      ? `${farmId || 'farm'}:${date || ''}:${template.id}:${source}`
      : `${farmId || 'farm'}:${date || ''}:${source}:${template.title}`,
    templateId:  template.id || null,
    title:       template.title || '',
    description: template.description || '',
    why:         template.why || '',
    type:        template.type || 'scout',
    priority:    template.priority || 'medium',
    source,                 // 'task_engine' | 'crop_stage' | 'weather' | 'lifecycle'
    dueLabel,               // 'now' | 'this_week' | 'coming_up' | { day: 'Mon' }
  });
}

// ─── Bucket: NOW (today) ──────────────────────────────────────────
function buildNowBucket({ farm, weather, date, tasks }) {
  // If the caller already generated today's tasks (e.g. the daily
  // task scheduler), reuse them verbatim — don't duplicate logic.
  if (Array.isArray(tasks) && tasks.length > 0) {
    return tasks.slice(0, MAX_NOW).map((t) => Object.freeze({
      ...t,
      source:   t.source   || 'task_engine',
      dueLabel: t.dueLabel || 'now',
    }));
  }
  // Otherwise, delegate to the daily task engine for today.
  const daily = generateDailyTasks({ farm, weather, date });
  if (!daily || !Array.isArray(daily.tasks)) return [];
  return daily.tasks.slice(0, MAX_NOW).map((t) => Object.freeze({
    id:          t.id,
    templateId:  t.templateId || null,
    title:       t.title,
    description: t.description,
    why:         t.why,
    type:        t.type,
    priority:    t.priority,
    source:      'task_engine',
    dueLabel:    'now',
  }));
}

// ─── Bucket: THIS WEEK ────────────────────────────────────────────
// Pulls the stage's template pool MINUS the items we already put in
// `now`, so the week view gives the farmer a glimpse of what else is
// coming at the same stage. Kept farm-type-filtered so backyard
// farmers don't see commercial-scale tasks.
function buildThisWeekBucket({ farm, now, date, canonicalCrop, stageKey }) {
  const farmType = canonicalFarmType(farm && farm.farmType);
  const allow = ALLOW_BY_FARM_TYPE[farmType] || ALLOW_BY_FARM_TYPE.small_farm;
  const usedIds = new Set(now.map((a) => a.templateId).filter(Boolean));

  // Prefer crop-specific pool from the Crop Intelligence Layer
  // (covers cassava/maize/rice/tomato/etc.); fall back to the
  // generic stage pool for crops without a bespoke pool.
  let pool = [];
  if (canonicalCrop && stageKey) {
    pool = Array.from(getCropStageTasks(canonicalCrop, stageKey) || []);
  }
  if (pool.length === 0) {
    const stagePool = stageKey && TEMPLATES[stageKey];
    const genericPool = stagePool ? stagePool.generic : GENERIC_FALLBACK;
    pool = Array.from(genericPool || []);
  }

  const filtered = pool
    .filter((tmpl) => !usedIds.has(tmpl.id))
    .filter((tmpl) => allow.has(tmpl.type))
    .slice(0, MAX_THIS_WEEK);

  return filtered.map((tmpl) => actionFrom(tmpl, {
    source: 'crop_stage', dueLabel: 'this_week',
    farmId: farm && farm.id, date,
  }));
}

// ─── Bucket: COMING UP ────────────────────────────────────────────
// Projects the lifecycle forward: "in ~X days you'll move to {next
// stage} — key task: ..." plus any seasonal cue from the catalogue.
function buildComingUpBucket({ farm, date, canonicalCrop, timeline }) {
  const out = [];
  if (!timeline) return out;

  // Next-stage preview
  if (timeline.nextStage && timeline.estimatedDaysRemainingInStage != null) {
    const daysUntil = Math.max(0, timeline.estimatedDaysRemainingInStage);
    const nextStageKey = normalizeStageKey(timeline.nextStage);
    const nextPool = canonicalCrop && nextStageKey
      ? getCropStageTasks(canonicalCrop, nextStageKey)
      : null;
    const firstTask = nextPool && nextPool.length > 0 ? nextPool[0] : null;
    out.push(Object.freeze({
      id:          `${farm && farm.id || 'farm'}:coming_up:${nextStageKey}`,
      type:        'lifecycle',
      priority:    'medium',
      source:      'lifecycle',
      dueLabel:    'coming_up',
      stageKey:    nextStageKey,
      daysUntil,
      title:       firstTask ? firstTask.title : `Enter the ${humanise(nextStageKey)} stage`,
      description: firstTask
        ? firstTask.description
        : `In about ${daysUntil} day${daysUntil === 1 ? '' : 's'} your crop moves into ${humanise(nextStageKey)}.`,
      why:         firstTask
        ? firstTask.why
        : `Planning the transition now avoids scrambling when the stage changes.`,
    }));
  }

  // Seasonal cue (plant/harvest window advisory from the registry)
  const guidance = canonicalCrop
    ? getCropSeasonalGuidance(canonicalCrop, farm && farm.country)
    : null;
  if (guidance && guidance.harvestCue) {
    out.push(Object.freeze({
      id:          `${farm && farm.id || 'farm'}:coming_up:harvest_cue`,
      type:        'scout',
      priority:    'low',
      source:      'lifecycle',
      dueLabel:    'coming_up',
      title:       'Watch for harvest readiness',
      description: guidance.harvestCue,
      why:         'Harvesting at the right moment locks in the best quality and price.',
    }));
  }

  return out.slice(0, MAX_COMING_UP);
}

// ─── Bucket: RISK WATCH ───────────────────────────────────────────
function buildRiskWatch({ canonicalCrop, climate, season, stageKey }) {
  if (!canonicalCrop) return [];
  const matches = matchCropRiskPatterns({
    canonicalKey: canonicalCrop, climate, season, stage: stageKey,
  });
  return matches.slice(0, MAX_RISK_WATCH).map((p) => Object.freeze({
    id:         `risk:${canonicalCrop}:${p.messageKey || p.type}`,
    type:       p.type || 'pest',
    severity:   p.severity || 'medium',
    message:    p.message || '',
    messageKey: p.messageKey || null,
    why:        p.why || '',
  }));
}

// ─── Bucket: RECOMMENDATIONS (yield levers) ───────────────────────
// Reuses estimateYield's built-in recommendation derivation so the
// same levers power both the yield card and the action plan.
function buildRecommendations({
  farm, weather, climate, season, stageKey, yieldEstimate,
}) {
  // Prefer the caller-supplied estimate (avoids recomputing).
  if (yieldEstimate && Array.isArray(yieldEstimate.recommendations)) {
    return yieldEstimate.recommendations.slice(0, MAX_RECS);
  }
  if (!farm || !farm.crop) return [];
  const est = estimateYield({
    crop:              farm.crop,
    normalizedAreaSqm: farm.normalizedAreaSqm,
    size:              farm.farmSize || farm.size,
    sizeUnit:          farm.sizeUnit,
    farmType:          farm.farmType,
    cropStage:         stageKey || farm.cropStage,
    countryCode:       farm.country || farm.countryCode,
    weather,
    climate,
    season,
  });
  if (!est || !Array.isArray(est.recommendations)) return [];
  return est.recommendations.slice(0, MAX_RECS);
}

// ─── Confidence resolution ────────────────────────────────────────
function resolveConfidence({ timeline, yieldEst, hasCrop, hasStage }) {
  if (!hasCrop || !hasStage) return 'low';
  if (timeline && timeline.confidenceLevel === 'high')   return 'high';
  if (yieldEst && yieldEst.confidenceLevel === 'high')   return 'high';
  if (timeline && timeline.confidenceLevel === 'medium') return 'medium';
  return 'low';
}

// ─── Helpers ──────────────────────────────────────────────────────
function humanise(key) {
  return String(key || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function ymd(d) {
  const x = d instanceof Date ? d : new Date(d || Date.now());
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

// ─── Public entry point ───────────────────────────────────────────
/**
 * buildFarmActionPlan(ctx)
 *
 *   ctx.farm           — farm object (crop, cropStage, country, farmType, ...)
 *   ctx.weather        — optional weather object ({ status, ... })
 *   ctx.date           — optional date (string | Date); defaults to now
 *   ctx.tasks          — optional already-generated daily tasks; when
 *                        present, the engine reuses them instead of
 *                        calling generateDailyTasks (avoids dup)
 *   ctx.yieldEstimate  — optional precomputed yield estimate; when
 *                        present, its recommendations power the
 *                        `recommendations` bucket
 */
export function buildFarmActionPlan(ctx = {}) {
  const farm = ctx.farm || null;
  if (!farm) return null;

  const canonicalCrop = normalizeCropKey(farm.crop || farm.cropType);
  // Compute the stored fallback first; we prefer the timeline's
  // computed stage below, but fall back to the stored value when
  // the timeline can't resolve (no plantingDate + no lifecycle).
  const storedStageKey = farm.cropStage
    ? normalizeStageKey(farm.cropStage) || String(farm.cropStage).toLowerCase()
    : null;
  if (!canonicalCrop && !storedStageKey && !farm.id) return null;

  const dateStr = ymd(ctx.date);
  const now = ctx.date instanceof Date ? ctx.date : new Date(dateStr);
  const month = now.getMonth() + 1;

  const climate = ctx.climate || inferClimate(farm.country || farm.countryCode);
  const season  = ctx.season  || inferSeason({
    country: farm.country || farm.countryCode, month,
  });

  // Lifecycle projection (handles partial inputs safely).
  const timeline = getCropTimeline({ farm, now: dateStr });

  // Stage source-of-truth precedence (Fix 7 — production-stability sprint):
  //   1. timeline.currentStage      → computed from plantingDate+lifecycle
  //                                   (already respects manualStageOverride)
  //   2. farm.cropStage              → stored field, used only when the
  //                                   timeline engine returned nothing
  // Using the stored field as the primary source caused stage task
  // leakage: a farm last edited at "vegetative" but actually 6+ weeks
  // past planting kept showing vegetative weed-row tasks while the
  // computed stage was already flowering or harvest.
  const computedStageKey = timeline && timeline.currentStage
    ? normalizeStageKey(timeline.currentStage) || String(timeline.currentStage).toLowerCase()
    : null;
  const stageKey = computedStageKey || storedStageKey;

  // Buckets — each one is self-contained and can return [].
  const nowBucket     = buildNowBucket({ farm, weather: ctx.weather, date: dateStr, tasks: ctx.tasks });
  const thisWeekBkt   = buildThisWeekBucket({
    farm, now: nowBucket, date: dateStr, canonicalCrop, stageKey,
  });
  const comingUp      = buildComingUpBucket({
    farm, date: dateStr, canonicalCrop, timeline,
  });
  const riskWatch     = buildRiskWatch({ canonicalCrop, climate, season, stageKey });
  const recommendations = buildRecommendations({
    farm, weather: ctx.weather, climate, season, stageKey,
    yieldEstimate: ctx.yieldEstimate,
  });

  const assumptions = [];
  if (!canonicalCrop) assumptions.push('No crop selected — plan limited to generic daily tasks.');
  if (!stageKey)      assumptions.push('No growth stage — using the crop\'s first stage for planning.');
  if (!climate)       assumptions.push('Unknown climate — skipping climate-driven risk hints.');
  if (!season)        assumptions.push('Unknown season — skipping season-driven risk hints.');
  if (ctx.weather && ctx.weather.status === 'unavailable') {
    assumptions.push('Weather data unavailable — plan is based on crop + stage only today.');
  }

  return Object.freeze({
    now:             Object.freeze(nowBucket),
    thisWeek:        Object.freeze(thisWeekBkt),
    comingUp:        Object.freeze(comingUp),
    riskWatch:       Object.freeze(riskWatch),
    recommendations: Object.freeze(recommendations),
    confidence: resolveConfidence({
      timeline,
      yieldEst: ctx.yieldEstimate,
      hasCrop:  !!canonicalCrop,
      hasStage: !!stageKey,
    }),
    generatedFor: Object.freeze({
      farmId: farm.id || null,
      crop:   canonicalCrop,
      stage:  stageKey,
      date:   dateStr,
      climate,
      season,
    }),
    assumptions: Object.freeze(assumptions),
    generatedAt: new Date().toISOString(),
  });
}

export const _internal = Object.freeze({
  inferSeason, inferClimate,
  buildNowBucket, buildThisWeekBucket, buildComingUpBucket,
  buildRiskWatch, buildRecommendations,
  MAX_NOW, MAX_THIS_WEEK, MAX_COMING_UP, MAX_RISK_WATCH, MAX_RECS,
});
