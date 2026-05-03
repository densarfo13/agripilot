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
  // Final-polish spec §4 — CTA must match the action.
  //
  // Resolution order:
  //   1. Template's own `ctaLabel` map (per-rule override)
  //   2. Default per-rule + per-userType map (DEFAULT_CTA_BY_RULE)
  //   3. Hard-coded universal default "Check now \u2713"
  //
  // Per-userType defaults reflect the spec's own examples:
  //   farmer Log first cost  → "Log cost \u2713"
  //   farmer Inspect crop    → "Inspect now \u2713"
  //   farmer Scout for pests → "Scout now \u2713"
  //   backyard Check soil    → "Check now \u2713"
  //   backyard Scan plant    → "Scan now"
  const ctaLabel = (() => {
    if (tmpl.ctaLabel) {
      const fromTemplate = tmpl.ctaLabel[lang] || tmpl.ctaLabel.en;
      if (fromTemplate) return fromTemplate;
    }
    const defaultMap = DEFAULT_CTA_BY_RULE[ruleId];
    if (defaultMap) {
      const def = defaultMap[safe.userType] || defaultMap.farmer;
      if (def) return (def[lang] || def.en) || 'Check now \u2713';
    }
    return 'Check now \u2713';
  })();

  return {
    todayTaskTitle:   title,
    taskReason:       reason,
    urgency:          tmpl.urgency || 'medium',
    estimatedTime:    tmpl.estimatedTime || '5 min',
    safetyNote,
    ctaLabel,
    localizedText: {
      title,
      reason,
      safetyNote,
      completionPrompt,
      ctaLabel,
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

// Final-polish spec §4 — per-rule + per-userType CTA defaults.
// Every active rule maps to wording that matches the action's
// verb. Wording is short, imperative, ends with the daily-loop
// completion check ("\u2713"). Falls back to English when the
// locale is missing.
const _CTA_CHECK_NOW = {
  en: 'Check now \u2713', fr: 'V\u00e9rifier maintenant \u2713', sw: 'Angalia sasa \u2713',
  ha: 'Duba yanzu \u2713', tw: 'Hwehw\u025b nn\u025b \u2713', hi: '\u0905\u092d\u0940 \u091c\u093e\u0902\u091a\u0947\u0902 \u2713',
};
const _CTA_INSPECT_NOW = {
  en: 'Inspect now \u2713', fr: 'Inspecter \u2713', sw: 'Kagua sasa \u2713',
  ha: 'Bincika yanzu \u2713', tw: 'Hwehw\u025b nn\u025b \u2713', hi: '\u0928\u093f\u0930\u0940\u0915\u094d\u0937\u0923 \u0915\u0930\u0947\u0902 \u2713',
};
const _CTA_SCOUT_NOW = {
  en: 'Scout now \u2713', fr: 'Inspecter \u2713', sw: 'Tembea sasa \u2713',
  ha: 'Yawo yanzu \u2713', tw: 'Tu mmer\u025b\u025b \u2713', hi: '\u091c\u093e\u0902\u091a\u0947\u0902 \u2713',
};
const _CTA_WATER_NOW = {
  en: 'Water now \u2713', fr: 'Arroser \u2713', sw: 'Mwagilia sasa \u2713',
  ha: 'Ba ruwa yanzu \u2713', tw: 'Gu nsuo nn\u025b \u2713', hi: '\u0905\u092d\u0940 \u092a\u093e\u0928\u0940 \u0926\u0947\u0902 \u2713',
};
const _CTA_DONE = {
  en: 'Done \u2713', fr: 'Termin\u00e9 \u2713', sw: 'Imekamilika \u2713',
  ha: 'Kammala \u2713', tw: 'Aw\u00ec \u2713', hi: '\u0939\u094b \u0917\u092f\u093e \u2713',
};
const _CTA_HARVEST = {
  en: 'Start harvest \u2713', fr: 'R\u00e9colter \u2713', sw: 'Anza kuvuna \u2713',
  ha: 'Fara girbi \u2713', tw: 'Hyɛ tw\u025bre\u025b ase \u2713', hi: '\u0915\u091f\u093e\u0908 \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902 \u2713',
};
const _CTA_PICK = {
  en: 'Pick now \u2713', fr: 'Cueillir \u2713', sw: 'Vuna sasa \u2713',
  ha: 'Tsamo yanzu \u2713', tw: 'Tw\u025b nn\u025b \u2713', hi: '\u0905\u092d\u0940 \u0924\u094b\u0921\u093c\u0947\u0902 \u2713',
};

const DEFAULT_CTA_BY_RULE = Object.freeze({
  // Weather rules — same verb both userTypes
  heavy_rain_warning:  { farmer: _CTA_DONE,        backyard: _CTA_DONE        },
  heat_stress_warning: { farmer: _CTA_WATER_NOW,   backyard: _CTA_WATER_NOW   },
  cold_stress_warning: { farmer: _CTA_DONE,        backyard: _CTA_DONE        },
  dry_irrigation:      { farmer: _CTA_WATER_NOW,   backyard: _CTA_WATER_NOW   },

  // Stage defaults — farmer leans on production verbs, backyard
  // stays casual / "check now"
  stage_planning:    { farmer: _CTA_DONE,        backyard: _CTA_DONE        },
  stage_planting:    { farmer: _CTA_DONE,        backyard: _CTA_DONE        },
  stage_germination: { farmer: _CTA_INSPECT_NOW, backyard: _CTA_CHECK_NOW   },
  stage_vegetative:  { farmer: _CTA_SCOUT_NOW,   backyard: _CTA_CHECK_NOW   },
  stage_flowering:   { farmer: _CTA_DONE,        backyard: _CTA_CHECK_NOW   },
  stage_maturity:    { farmer: _CTA_INSPECT_NOW, backyard: _CTA_CHECK_NOW   },
  stage_harvest:     { farmer: _CTA_HARVEST,     backyard: _CTA_PICK        },
  stage_post_harvest:{ farmer: _CTA_DONE,        backyard: _CTA_DONE        },

  // Walk-and-look fallback
  fallback_check:    { farmer: _CTA_INSPECT_NOW, backyard: _CTA_CHECK_NOW   },

  // profile_missing intentionally omitted — its template carries
  // a tailored "Add details \u2713" already; the lookup falls back
  // to the universal "Check now \u2713" which is fine if the
  // template is removed in a future cut.
});

export const _internal = Object.freeze({
  HEAVY_RAIN_THRESHOLD_MM,
  HEAT_STRESS_THRESHOLD_C,
  COLD_STRESS_THRESHOLD_C,
  DEFAULT_CTA_BY_RULE,
  _pickRule,
  _normalize,
});

export default generateTodayTask;
