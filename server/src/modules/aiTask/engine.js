/**
 * aiTask/engine.js — rules-based AI Task Engine v1.
 *
 *   const task = generateTodayTask(input);
 *
 * Why a rules engine, not an ML model
 * ───────────────────────────────────
 *   The spec is explicit: "Do not build complex machine
 *   learning yet. This is rules-based AI v1, not full ML.
 *   Keep it production-safe and easy to debug." This module is
 *   a deterministic dispatcher that picks ONE task based on a
 *   precedence ladder over the supplied context. Every branch
 *   is documented; an operator reading the logs can see which
 *   ruleId fired and why.
 *
 * Decision precedence
 * ───────────────────
 *   1. profile_missing     — crop OR stage missing      → "Complete your profile"
 *   2. heavy_rain_warning  — rainfall >= 25 mm in 24 h  → "Skip outdoor work today"
 *   3. heat_stress_warning — temperature >= 35 °C       → "Water early or late only"
 *   4. dry_irrigation      — weather=dry + crop in irrigation stages
 *   5. stage_default       — pick the existing farmTaskEngine
 *                            top task for the crop+stage
 *   6. fallback_check      — last resort: "Do a quick crop check"
 *
 *   Backyard branches are SHORTER, simpler, and never mention
 *   yield / income / sell-readiness (spec rule §3 — never mix
 *   farmer and backyard wording).
 *
 * Strict-rule audit
 *   • Pure function — no I/O, no DB. Caller resolves missing
 *     context (profile lookup, weather fetch) before invoking.
 *   • Never throws — bad input falls through to the
 *     fallback_check rule with a marker `fallback: true`.
 *   • Every output carries `ruleId` + `reasonCode` for
 *     auditability.
 *   • Pure ESM, top-level imports only.
 */

import { TASK_TEMPLATES } from './taskTemplates.js';

// Inputs the engine cares about. The route layer normalises the
// validated Zod payload into this shape before calling.
//
// @typedef {object} EngineInput
// @property {'farmer'|'backyard'} userType
// @property {string=} crop
// @property {string=} stage
// @property {string=} country
// @property {string=} region
// @property {{lat:number,lng:number}=} coordinates
// @property {string=} weather
// @property {number=} rainfallForecast
// @property {number=} temperature
// @property {string=} lastCompletedTask
// @property {string|number=} plantingDate
// @property {'en'|'fr'|'sw'|'ha'|'tw'|'hi'} language

const HEAVY_RAIN_THRESHOLD_MM = 25;
const HEAT_STRESS_THRESHOLD_C = 35;
const COLD_STRESS_THRESHOLD_C = 8;

/**
 * generateTodayTask(input) → task envelope.
 *
 * Picks ONE rule via the documented precedence and renders the
 * envelope in the requested language. Always returns a valid
 * envelope (never throws, never null).
 */
export function generateTodayTask(input) {
  const safe = _normalize(input);
  const ruleId = _pickRule(safe);
  const tmpl   = TASK_TEMPLATES[ruleId][safe.userType] || TASK_TEMPLATES[ruleId].farmer;
  const lang   = SUPPORTED_LANGUAGES.includes(safe.language) ? safe.language : 'en';

  // Localised text — pick the requested language; fall back to
  // English when the rule template doesn't carry the locale.
  const tr = (field) => {
    const m = (tmpl[field] && (tmpl[field][lang] || tmpl[field].en)) || '';
    return String(m);
  };

  const title           = tr('title');
  const reason          = tr('reason');
  const safetyNote      = tmpl.safetyNote ? tr('safetyNote') : null;
  const completionPrompt = tr('completionPrompt');
  const nextRecommended  = tr('nextRecommended');

  return {
    todayTaskTitle:   title,
    taskReason:       reason,
    urgency:          tmpl.urgency || 'medium',
    estimatedTime:    tmpl.estimatedTime || '5 min',
    safetyNote,
    localizedText: {
      title,
      reason,
      safetyNote,
      completionPrompt,
    },
    nextRecommendedTask: nextRecommended,
    completionPrompt,
    ruleId,
    userType:    safe.userType,
    fallback:    ruleId === 'profile_missing' || ruleId === 'fallback_check',
    reasonCode:  ruleId,
    language:    lang,
    generatedAt: new Date().toISOString(),
  };
}

// Imported AFTER the function definition to avoid a circular
// reference when the templates module is reloaded in tests.
const SUPPORTED_LANGUAGES = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];

// ─── Internal helpers ────────────────────────────────────

function _normalize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    userType: r.userType === 'backyard' ? 'backyard' : 'farmer',
    crop:     typeof r.crop === 'string'  ? r.crop.toLowerCase().trim() : null,
    stage:    typeof r.stage === 'string' ? r.stage.toLowerCase().trim() : null,
    country:  typeof r.country === 'string' ? r.country : null,
    region:   typeof r.region === 'string'  ? r.region  : null,
    coordinates: (r.coordinates && Number.isFinite(r.coordinates.lat) && Number.isFinite(r.coordinates.lng))
      ? { lat: Number(r.coordinates.lat), lng: Number(r.coordinates.lng) }
      : null,
    weather:           typeof r.weather === 'string' ? r.weather : null,
    rainfallForecast:  Number.isFinite(r.rainfallForecast) ? Number(r.rainfallForecast) : null,
    temperature:       Number.isFinite(r.temperature)      ? Number(r.temperature)      : null,
    lastCompletedTask: typeof r.lastCompletedTask === 'string' ? r.lastCompletedTask : null,
    plantingDate:      r.plantingDate || null,
    language:          typeof r.language === 'string' ? r.language : 'en',
  };
}

/**
 * Decide which rule fires. Walks the precedence ladder top-down
 * and returns the FIRST match.
 */
function _pickRule(ctx) {
  // 1. Profile missing — spec rule §5
  if (!ctx.crop || !ctx.stage) return 'profile_missing';

  // 2. Heavy rain — spec rule §4 weather adaptation
  if (Number.isFinite(ctx.rainfallForecast)
      && ctx.rainfallForecast >= HEAVY_RAIN_THRESHOLD_MM) {
    return 'heavy_rain_warning';
  }
  if (ctx.weather === 'rainy' && ctx.rainfallForecast == null) {
    // Weather summary says rain but we have no quantitative
    // forecast — still warn so the farmer doesn't head out.
    return 'heavy_rain_warning';
  }

  // 3. Heat stress
  if (Number.isFinite(ctx.temperature)
      && ctx.temperature >= HEAT_STRESS_THRESHOLD_C) {
    return 'heat_stress_warning';
  }
  if (ctx.weather === 'hot' && ctx.temperature == null) {
    return 'heat_stress_warning';
  }

  // 4. Cold stress (mainly for highland farms / temperate gardens)
  if (Number.isFinite(ctx.temperature)
      && ctx.temperature <= COLD_STRESS_THRESHOLD_C) {
    return 'cold_stress_warning';
  }

  // 5. Dry-spell irrigation reminder — applies to crops in
  //    germination / vegetative / flowering stages.
  const irrigationStages = new Set(['germination', 'vegetative', 'flowering']);
  if (ctx.weather === 'dry' && irrigationStages.has(ctx.stage)) {
    return 'dry_irrigation';
  }

  // 6. Stage default — map crop+stage onto the engine's rule
  //    table. We pick from a curated subset that maps cleanly
  //    onto the spec's 8-field output shape.
  const stageRule = `stage_${ctx.stage}`;
  if (TASK_TEMPLATES[stageRule]) return stageRule;

  // 7. Fallback — generic check.
  return 'fallback_check';
}

export const _internal = Object.freeze({
  HEAVY_RAIN_THRESHOLD_MM,
  HEAT_STRESS_THRESHOLD_C,
  COLD_STRESS_THRESHOLD_C,
  _pickRule,
  _normalize,
});

export default generateTodayTask;
