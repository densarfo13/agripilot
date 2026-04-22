/**
 * smartAlertEngine.js — Farroway's context-aware alert generator.
 *
 * Pure function. Composes over existing engines (farmActionPlan,
 * estimateYield, cropRiskPatterns, cropSeasonalGuidance, crop
 * timeline) to produce structured alerts with a consistent shape:
 *
 *   {
 *     id:           stable string — same inputs same day produce
 *                   the same id, so the dispatcher can dedup.
 *     type:         'weather' | 'missed_task' | 'planting_window'
 *                    | 'pest' | 'yield' | 'stage_transition',
 *     priority:     'high' | 'medium' | 'low',
 *     action:       imperative sentence — WHAT to do today.
 *     reason:       why this matters right now.
 *     consequence:  what happens if the farmer ignores it.
 *     messageKey:   i18n key (optional; UI may prefer fallback copy).
 *     triggeredBy:  { rule, signals } for analytics + "why this?" UX.
 *     createdAt:    ISO string.
 *   }
 *
 * Contract guarantees
 *   • Deterministic for a given (farm, weather, plan, date).
 *   • Never throws. Missing inputs → fewer alerts, not an error.
 *   • Returns a frozen array so callers can't mutate it.
 *   • Alerts are ordered by priority (high → low), then by insertion.
 *
 * Non-goals
 *   • No ML. Every rule is explicit below.
 *   • No side effects — persistence is the dispatcher's job.
 *   • No push delivery — in-app only in this layer; push providers
 *     consume the persisted FarmerNotification rows downstream.
 */

import { buildFarmActionPlan } from './farmActionPlan.js';
import { estimateYield }       from './yieldEngine.js';
import {
  normalizeCropKey,
  matchCropRiskPatterns,
  getCropSeasonalGuidance,
} from '../../config/crops/index.js';
import { getCropTimeline }     from '../timeline/cropTimelineEngine.js';
import { RULES as RECOMMENDATION_RULES }
  from '../../config/cropRecommendationRules.js';

// ─── Helpers ─────────────────────────────────────────────────────
function ymd(d) {
  const x = d instanceof Date ? d : new Date(d || Date.now());
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function alertId({ farmId, date, rule, ref = '' }) {
  const safe = (s) => String(s || '').replace(/[^A-Za-z0-9_.-]+/g, '_');
  return `alert:${safe(farmId || 'farm')}:${safe(date)}:${safe(rule)}${ref ? `:${safe(ref)}` : ''}`;
}
function alert({ farmId, date, rule, ref, type, priority, action, reason, consequence, messageKey, signals }) {
  return Object.freeze({
    id:           alertId({ farmId, date, rule, ref }),
    type,
    priority,
    action,
    reason,
    consequence,
    messageKey: messageKey || null,
    triggeredBy: Object.freeze({ rule, signals: Object.freeze(signals || {}) }),
    createdAt:  new Date().toISOString(),
  });
}

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };
function rank(a, b) {
  return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
}

// ─── Rule: weather-driven advisories ─────────────────────────────
function weatherRules({ farmId, date, canonicalCrop, stageKey, weather }) {
  if (!weather || !weather.status) return [];
  const out = [];
  const sig = {
    weatherStatus: weather.status,
    crop: canonicalCrop, stage: stageKey,
  };

  if (weather.status === 'rain_expected' || weather.status === 'heavy_rain') {
    out.push(alert({
      farmId, date, rule: 'weather.rain.delay_fertilizer',
      type: 'weather', priority: 'high',
      action:      'Delay fertilizer application until after the rain.',
      reason:      'Heavy rain washes fertilizer off the soil before roots take it up.',
      consequence: 'Applying now wastes the fertilizer and pollutes runoff.',
      messageKey:  'alerts.weather.delay_fertilizer',
      signals: sig,
    }));
  }

  if (weather.status === 'low_rain' || weather.status === 'dry_ahead') {
    out.push(alert({
      farmId, date, rule: 'weather.dry.irrigate',
      type: 'weather', priority: 'high',
      action:      'Irrigate the driest rows today.',
      reason:      `A dry stretch is ${weather.status === 'dry_ahead' ? 'forecast' : 'underway'}; soil moisture is dropping fast.`,
      consequence: 'Even one unirrigated dry week at growth stages caps yield 10–20%.',
      messageKey:  'alerts.weather.irrigate',
      signals: sig,
    }));
  }

  if (weather.status === 'excessive_heat') {
    // Heat-stress at flowering/grain-fill is the hardest-hitting case.
    const critical = ['flowering', 'tasseling', 'grain_fill', 'fruiting'].includes(stageKey);
    out.push(alert({
      farmId, date, rule: 'weather.heat.water_morning',
      type: 'weather', priority: critical ? 'high' : 'medium',
      action:      'Water early morning and mulch the root zone.',
      reason:      'Afternoon heat stress shuts photosynthesis and speeds evaporation.',
      consequence: critical
        ? 'Heat during flowering/grain-fill can drop kernel weight 20–30%.'
        : 'Repeated heat stress slows growth and trims final yield.',
      messageKey:  'alerts.weather.heat_morning',
      signals: sig,
    }));
  }

  return out;
}

// ─── Rule: missed critical tasks ─────────────────────────────────
// Missed = a high-priority action the plan surfaced 24h+ ago whose
// templateId doesn't appear in `completedTaskIds`. Caller passes
// that set; when absent we skip the rule.
function missedTaskRules({ farmId, date, plan, completedTaskIds, now }) {
  if (!plan || !Array.isArray(plan.now) || plan.now.length === 0) return [];
  if (!(completedTaskIds instanceof Set)) return [];
  const out = [];
  const critical = plan.now.filter((a) => a.priority === 'high');
  for (const task of critical) {
    const templateId = task.templateId || task.id;
    if (completedTaskIds.has(templateId)) continue;

    // Only fire if the plan was generated > 24h ago (so we don't
    // nag farmers at the start of the day).
    const planAge = plan.generatedAt
      ? (now - new Date(plan.generatedAt).getTime())
      : 0;
    if (planAge < 24 * 60 * 60 * 1000) continue;

    out.push(alert({
      farmId, date, rule: 'task.missed_critical', ref: templateId,
      type: 'missed_task', priority: 'high',
      action:      `Still pending: ${task.title}`,
      reason:      task.why || 'This was flagged as the day\'s top action and hasn\'t been marked done.',
      consequence: 'Delaying a high-priority task compounds risk through the week.',
      messageKey:  'alerts.task.missed_critical',
      signals: { templateId, crop: plan.generatedFor && plan.generatedFor.crop },
    }));
  }
  return out;
}

// ─── Rule: planting-window warnings ──────────────────────────────
// Fires when the farmer is still at the 'planting' stage but the
// crop's seasonal planting window for the region has likely closed.
function plantingWindowRules({ farmId, date, canonicalCrop, stageKey, country, month }) {
  if (!canonicalCrop || stageKey !== 'planting') return [];

  // Prefer cropRecommendationRules.plantingWindow (which carries
  // explicit month tokens like 'Apr–Jun' or 'Nov–Mar') over
  // cropSeasonalGuidance (prose). The former powers the onboarding
  // recommender, so if a country/crop is mapped there the window
  // is authoritative.
  const windowStr = lookupPlantingWindow({ country, canonicalCrop })
    || (getCropSeasonalGuidance(canonicalCrop, country) || {}).plantingWindow
    || '';
  const allowedMonths = parseMonths(windowStr);
  if (allowedMonths.size === 0) return [];

  const maxAllowed = Math.max(...allowedMonths);
  if (month <= maxAllowed) return [];
  // Guard against two-season windows (e.g. Mar–May / Aug–Sep):
  // if the gap to the next season start is ≤3 months, suppress.
  const minAllowed = Math.min(...allowedMonths);
  const monthsToNextWindow = ((minAllowed + 12) - month) % 12;
  if (monthsToNextWindow > 0 && monthsToNextWindow <= 3) return [];

  return [alert({
    farmId, date, rule: 'planting.window_closing',
    type: 'planting_window', priority: 'high',
    action:      'Plant now or shift to a shorter-cycle variety.',
    reason:      `The main planting window for ${canonicalCrop} in this region is ${windowStr}.`,
    consequence: 'Planting late risks heat/dry stress at flowering and lower yield.',
    messageKey:  'alerts.planting.window_closing',
    signals: { canonicalCrop, stageKey, month, window: windowStr },
  })];
}

function lookupPlantingWindow({ country, canonicalCrop }) {
  if (!country || !canonicalCrop) return null;
  const c = String(country).toUpperCase();
  const byCountry = RECOMMENDATION_RULES[c];
  if (!byCountry || !Array.isArray(byCountry.defaults)) return null;
  // Match by the registry-canonical key OR the underscore variant
  // (crops.js uses underscore form, recommendation rules use either).
  const keys = new Set([canonicalCrop, canonicalCrop.replace(/-/g, '_')]);
  const rule = byCountry.defaults.find((r) => keys.has(String(r.crop).toLowerCase()));
  return rule ? rule.plantingWindow : null;
}

const MONTH_TOKENS = Object.freeze({
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
});
function parseMonths(windowStr) {
  const out = new Set();
  const s = String(windowStr).toLowerCase();
  // Tokenise any sequence of month abbreviations; expand ranges like
  // "apr–jun" or "apr-jun" inclusive.
  const rangeRe = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b(?:\s*[–-]\s*\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b)?/g;
  let m; while ((m = rangeRe.exec(s)) !== null) {
    const start = MONTH_TOKENS[m[1]];
    const end   = m[2] ? MONTH_TOKENS[m[2]] : start;
    if (end >= start) {
      for (let i = start; i <= end; i += 1) out.add(i);
    } else {
      for (let i = start; i <= 12;  i += 1) out.add(i);
      for (let i = 1;     i <= end; i += 1) out.add(i);
    }
  }
  return out;
}

// ─── Rule: pest risk alerts ──────────────────────────────────────
function pestRiskRules({ farmId, date, canonicalCrop, stageKey, climate, season }) {
  if (!canonicalCrop) return [];
  const matches = matchCropRiskPatterns({
    canonicalKey: canonicalCrop, climate, season, stage: stageKey,
  });
  // Only promote HIGH-severity patterns to alerts — medium/low stay
  // in the Farm Plan's riskWatch bucket to avoid notification spam.
  return matches
    .filter((p) => p.severity === 'high')
    .slice(0, 2)
    .map((p) => alert({
      farmId, date, rule: 'pest.high_severity', ref: p.messageKey,
      type: p.type === 'disease' ? 'pest' : (p.type || 'pest'),
      priority: 'high',
      action:      `Scout your field for ${cleanMsgHint(p.message)}`,
      reason:      p.why || 'Conditions now favour this problem on your crop.',
      consequence: 'Catching it early is 10× cheaper than trying to control it after it spreads.',
      messageKey:  p.messageKey,
      signals: { canonicalCrop, stageKey, climate, season, severity: p.severity },
    }));
}
function cleanMsgHint(msg) {
  // Lowercase the first letter so "Watch for whitefly" → "watch for
  // whitefly" reads naturally after "Scout for …". Fall back to the
  // original string when it doesn't start with a capital.
  if (!msg) return 'signs of damage today.';
  const s = String(msg);
  return (/^[A-Z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
}

// ─── Rule: yield-impact alerts ───────────────────────────────────
function yieldRules({ farmId, date, farm, weather, climate, season, stageKey, canonicalCrop }) {
  if (!farm || !farm.crop) return [];
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
  if (!est) return [];

  const out = [];
  // The yield engine already drops confidence to 'low' when weather
  // is eating into the band; treat that as a yield-impact signal.
  const weatherDrag = weather && ['low_rain', 'dry_ahead', 'excessive_heat'].includes(weather.status);
  if (weatherDrag) {
    // Pick the first recommendation as the specific action.
    const rec = Array.isArray(est.recommendations) && est.recommendations[0];
    out.push(alert({
      farmId, date, rule: 'yield.weather_drag',
      type: 'yield', priority: 'high',
      action:      rec ? rec.label : 'Protect the crop from the current weather stress.',
      reason:      `The current weather (${weather.status}) is trimming the top of your yield band.`,
      consequence: 'Left unaddressed, the upper end of your yield estimate will fall over the next 7–14 days.',
      messageKey:  'alerts.yield.weather_drag',
      signals: { weatherStatus: weather.status, crop: canonicalCrop, stage: stageKey,
                 confidence: est.confidenceLevel },
    }));
  }
  return out;
}

// ─── Rule: stage-transition alerts ───────────────────────────────
function stageTransitionRules({ farmId, date, farm, dateStr }) {
  if (!farm) return [];
  const timeline = getCropTimeline({ farm, now: dateStr });
  if (!timeline || !timeline.nextStage) return [];
  const daysUntil = timeline.estimatedDaysRemainingInStage;
  if (!Number.isFinite(daysUntil) || daysUntil > 3 || daysUntil < 0) return [];
  const human = String(timeline.nextStage).replace(/_/g, ' ');
  return [alert({
    farmId, date, rule: 'stage.transition', ref: timeline.nextStage,
    type: 'stage_transition', priority: 'medium',
    action:      `Prepare for the ${human} stage in ~${daysUntil} day${daysUntil === 1 ? '' : 's'}.`,
    reason:      `Your crop is about to move from ${timeline.currentStage} to ${timeline.nextStage}.`,
    consequence: 'Stage transitions are where a lot of yield is won or lost — preparing now pays back.',
    messageKey:  'alerts.stage.transition',
    signals: { currentStage: timeline.currentStage, nextStage: timeline.nextStage, daysUntil },
  })];
}

// ─── Public entry point ──────────────────────────────────────────
/**
 * generateSmartAlerts(ctx)
 *
 *   ctx.farm              — required: the farm object
 *   ctx.weather           — optional: weather snapshot { status, ... }
 *   ctx.plan              — optional: precomputed farmActionPlan output.
 *                           When absent, the engine builds one on the
 *                           fly from ctx.farm + weather + date.
 *   ctx.completedTaskIds  — optional: Set<string>|string[]. When
 *                           present, missed-task rules fire for
 *                           critical tasks not in this set.
 *   ctx.date              — optional: date or ISO string. Defaults now.
 *   ctx.climate / season  — optional overrides; inferred from country/
 *                           month when absent.
 */
export function generateSmartAlerts(ctx = {}) {
  const farm = ctx.farm || null;
  if (!farm) return Object.freeze([]);

  const dateStr = ymd(ctx.date);
  const nowDate = ctx.date instanceof Date ? ctx.date : new Date(dateStr);
  const month = nowDate.getMonth() + 1;

  const canonicalCrop = normalizeCropKey(farm.crop || farm.cropType);
  const stageKey = farm.cropStage ? String(farm.cropStage).toLowerCase() : null;
  const climate = ctx.climate || null;
  const season  = ctx.season  || null;

  const plan = ctx.plan || buildFarmActionPlan({
    farm, weather: ctx.weather, date: dateStr,
  });

  const completedTaskIds = ctx.completedTaskIds instanceof Set
    ? ctx.completedTaskIds
    : Array.isArray(ctx.completedTaskIds)
      ? new Set(ctx.completedTaskIds)
      : null;

  const ctxInner = {
    farmId: farm.id, date: dateStr, dateStr,
    canonicalCrop, stageKey,
    climate: climate || (plan && plan.generatedFor && plan.generatedFor.climate),
    season:  season  || (plan && plan.generatedFor && plan.generatedFor.season),
    weather: ctx.weather || null,
    plan,
    completedTaskIds,
    country: farm.country || farm.countryCode || null,
    month,
    now:     nowDate.getTime(),
    farm,
  };

  const alerts = [];
  alerts.push(...weatherRules(ctxInner));
  alerts.push(...missedTaskRules(ctxInner));
  alerts.push(...plantingWindowRules(ctxInner));
  alerts.push(...pestRiskRules(ctxInner));
  alerts.push(...yieldRules(ctxInner));
  alerts.push(...stageTransitionRules(ctxInner));

  // Dedup by id — the id is stable for (farmId, date, rule, ref)
  // so multiple rule runs on the same day produce the same row.
  const seen = new Set();
  const unique = [];
  for (const a of alerts) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    unique.push(a);
  }

  unique.sort(rank);
  return Object.freeze(unique);
}

export const _internal = Object.freeze({
  alertId, parseMonths,
  weatherRules, missedTaskRules, plantingWindowRules,
  pestRiskRules, yieldRules, stageTransitionRules,
  PRIORITY_WEIGHT,
});
