/**
 * healthTriageEngine.js — symptom-driven triage for farm health
 * issues. Pure + deterministic. No ML, no black-box AI.
 *
 *   triageFarmHealthIssue({
 *     crop, region, symptoms, affectedPart, extent, duration,
 *     weather?, description?, recentFarmReports?,
 *   }) → {
 *     predictedCategory,        // pest | disease | nutrient_deficiency
 *                              //  | water_stress | physical_damage | unknown
 *     predictedCategoryKey,    // stable i18n key for farmer-facing copy
 *     predictedCategoryFallback, // English fallback ("Likely pest issue")
 *     confidenceLevel,         // low | medium | high
 *     severity,                // low | medium | high | critical
 *     reasoning: [{ rule, detail }],
 *     suggestedNextStepKey,    // safe, conservative
 *     suggestedNextStepFallback,
 *     requiresOfficerReview,   // boolean — true when uncertain OR risky
 *     escalationFlag,          // boolean — true when severity ≥ high
 *   }
 *
 * Safety contract:
 *   • Never claims a specific disease name. Category words only.
 *   • `unknown` is a first-class outcome when signals are weak or
 *     contradictory. We'd rather say "Needs officer review" than
 *     guess.
 *   • Suggested next steps are inspection / containment / observation
 *     only — never "apply pesticide X" or dosage guidance.
 *   • Callers receive stable i18n keys so the UI can render fully
 *     in the farmer's language with safe English fallbacks.
 */

// ─── Category labels (safe wording) ──────────────────────────────
export const CATEGORY_LABELS = Object.freeze({
  pest:                { key: 'health.category.pest',               en: 'Likely pest issue' },
  disease:             { key: 'health.category.disease',            en: 'Possible disease risk' },
  nutrient_deficiency: { key: 'health.category.nutrient_deficiency', en: 'Possible nutrient deficiency' },
  water_stress:        { key: 'health.category.water_stress',       en: 'Possible water stress' },
  physical_damage:     { key: 'health.category.physical_damage',    en: 'Physical damage noted' },
  unknown:             { key: 'health.category.unknown',            en: 'Needs officer review' },
});

// ─── Safe next steps — inspection / containment / observation ────
export const NEXT_STEPS = Object.freeze({
  pest:                { key: 'health.next.pest',
                         en: 'Inspect nearby plants and isolate damaged leaves if possible.' },
  disease:             { key: 'health.next.disease',
                         en: 'Avoid spreading the problem by checking affected plants separately.' },
  nutrient_deficiency: { key: 'health.next.nutrient_deficiency',
                         en: 'Compare affected plants with healthy ones and monitor changes.' },
  water_stress:        { key: 'health.next.water_stress',
                         en: 'Check soil moisture and drainage before watering again.' },
  physical_damage:     { key: 'health.next.physical_damage',
                         en: 'Stake or remove damaged parts. Check if neighbouring plants are affected.' },
  unknown:             { key: 'health.next.unknown',
                         en: 'A field officer should review this report.' },
});

// ─── Symptom taxonomy ────────────────────────────────────────────
// Map each UI symptom to one or more categories + a weight. Higher
// weight = stronger signal for that category.
const SYMPTOM_RULES = Object.freeze({
  insects_visible:  { pest: 4 },
  holes_in_leaves:  { pest: 3 },
  leaf_damage:      { pest: 2 },

  brown_spots:      { disease: 3, nutrient_deficiency: 1 },
  mold_fungus:      { disease: 4 },
  rotting:          { disease: 4 },
  spreading:        { disease: 2 }, // derived from extent, not a direct symptom

  yellow_leaves:    { nutrient_deficiency: 2, disease: 1, water_stress: 1 },
  stunted_growth:   { nutrient_deficiency: 2, water_stress: 1 },

  wilting:          { water_stress: 3, disease: 1 },
  dry_soil:         { water_stress: 3 },
  standing_water:   { water_stress: 2, disease: 2 }, // root-rot signal

  other:            {},
});

const STAPLE_CROPS = new Set([
  'maize', 'cassava', 'rice', 'wheat', 'sorghum', 'yam', 'millet',
]);

const CATEGORIES = ['pest', 'disease', 'nutrient_deficiency', 'water_stress', 'physical_damage', 'unknown'];
const EXTENT_TIERS = { one_plant: 1, few_plants: 2, many_plants: 3, most_of_farm: 4 };
const DURATION_DAYS = { today: 0, two_three_days: 2, within_week: 5, more_than_week: 10 };

function lower(s) { return String(s || '').toLowerCase(); }

function normalizeSymptoms(symptoms) {
  if (!Array.isArray(symptoms)) return [];
  return symptoms.map((s) => lower(s).replace(/\s+/g, '_'))
    .filter((s) => s in SYMPTOM_RULES);
}

// ─── Category scoring ────────────────────────────────────────────

function scoreCategories({ symptoms, affectedPart, extent }) {
  const tally = { pest: 0, disease: 0, nutrient_deficiency: 0,
                  water_stress: 0, physical_damage: 0 };

  for (const sym of symptoms) {
    const rule = SYMPTOM_RULES[sym];
    if (!rule) continue;
    for (const [cat, w] of Object.entries(rule)) {
      tally[cat] = (tally[cat] || 0) + w;
    }
  }

  // Affected part hints — light weight so strong symptom signals win.
  const part = lower(affectedPart);
  if (part === 'root')  tally.water_stress += 1;
  if (part === 'stem')  tally.physical_damage += 1;
  if (part === 'whole_plant' || part === 'whole plant') tally.disease += 1;

  // Spreading pattern — many plants hints at disease + pushes against
  // physical_damage (which is typically localised).
  const extentTier = EXTENT_TIERS[lower(extent)] || 0;
  if (extentTier >= 3) tally.disease += 2;
  if (extentTier <= 1 && symptoms.length <= 1) tally.physical_damage += 1;

  return tally;
}

// ─── Confidence + severity ───────────────────────────────────────

function pickWinner(tally) {
  let winner = null;
  let top = 0;
  let second = 0;
  for (const cat of CATEGORIES) {
    const w = tally[cat] || 0;
    if (w > top) { second = top; top = w; winner = cat; }
    else if (w > second) { second = w; }
  }
  return { winner, top, second };
}

function confidenceFor({ top, second, symptomCount }) {
  if (top === 0) return 'low';
  // Sharp lead + enough signals → high.
  if (top >= 5 && (top - second) >= 3 && symptomCount >= 2) return 'high';
  if (top >= 3 && (top - second) >= 2) return 'medium';
  return 'low';
}

function severityFor({ extent, duration, crop, predictedCategory, recentFarmReports, weather }) {
  const tier = EXTENT_TIERS[lower(extent)] || 0;
  const days = DURATION_DAYS[lower(duration)] || 0;

  let severity = 'low';
  if (tier === 4)      severity = 'critical';   // most of farm
  else if (tier === 3) severity = 'high';       // many plants
  else if (tier === 2) severity = 'medium';     // a few plants

  // Disease-like on a staple crop + wet weather → bump a tier.
  if (predictedCategory === 'disease'
      && STAPLE_CROPS.has(lower(crop))
      && weather && (lower(weather.status) === 'rain_expected'
                  || lower(weather.status) === 'heavy_rain'
                  || lower(weather.status) === 'standing_water')) {
    severity = bumpSeverity(severity, 1);
  }
  // Long duration adds pressure.
  if (days >= 10 && severity !== 'critical') {
    severity = bumpSeverity(severity, 1);
  }
  // Repeated same-farm reports (≥3 in the last week) raise the bar.
  if (Number(recentFarmReports) >= 3 && severity !== 'critical') {
    severity = bumpSeverity(severity, 1);
  }
  return severity;
}

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];
function bumpSeverity(level, steps = 1) {
  const idx = SEVERITY_ORDER.indexOf(level);
  return SEVERITY_ORDER[Math.min(SEVERITY_ORDER.length - 1, idx + steps)];
}

// ─── Main entry ──────────────────────────────────────────────────

/**
 * triageFarmHealthIssue — main entry. Frozen output, i18n-safe
 * labels, never claims a specific disease name.
 */
export function triageFarmHealthIssue({
  crop              = null,
  region            = null,      // eslint-disable-line no-unused-vars
  symptoms          = [],
  affectedPart      = null,
  extent            = null,
  duration          = null,
  weather           = null,
  description       = '',        // eslint-disable-line no-unused-vars
  recentFarmReports = 0,
} = {}) {
  const reasoning = [];
  const cleanSymptoms = normalizeSymptoms(symptoms);

  if (cleanSymptoms.length === 0 && !affectedPart) {
    return makeResult({
      predictedCategory: 'unknown',
      confidenceLevel:   'low',
      severity:          'low',
      reasoning: [{ rule: 'no_signal', detail: 'No symptoms captured' }],
      requiresOfficerReview: true,
      escalationFlag: false,
    });
  }

  const tally = scoreCategories({
    symptoms: cleanSymptoms, affectedPart, extent,
  });
  const { winner, top, second } = pickWinner(tally);

  // Physical-damage special case — highly localised + non-spreading.
  const extentTier = EXTENT_TIERS[lower(extent)] || 0;
  const looksPhysical =
    extentTier <= 1
    && cleanSymptoms.length <= 2
    && !cleanSymptoms.some((s) =>
      ['mold_fungus', 'rotting', 'insects_visible', 'holes_in_leaves', 'brown_spots']
        .includes(s),
    );

  let predictedCategory = winner && top > 0 ? winner : 'unknown';
  if (looksPhysical && top <= 2) predictedCategory = 'physical_damage';

  // Build reasoning trail from the symptoms that contributed.
  for (const sym of cleanSymptoms) {
    const rule = SYMPTOM_RULES[sym] || {};
    const contribution = rule[predictedCategory];
    if (contribution) {
      reasoning.push({
        rule:   `symptom_${sym}`,
        detail: `Symptom "${sym.replace(/_/g, ' ')}" contributed +${contribution} to ${predictedCategory}`,
      });
    }
  }
  if (reasoning.length === 0 && predictedCategory !== 'unknown') {
    reasoning.push({
      rule:   'low_signal_default',
      detail: 'No strong symptom match — defaulting to lowest-risk category',
    });
  }

  const confidenceLevel = confidenceFor({
    top, second, symptomCount: cleanSymptoms.length,
  });

  const severity = severityFor({
    extent, duration, crop, predictedCategory, recentFarmReports, weather,
  });

  // Officer review triggers:
  //   • category unknown
  //   • confidence low AND not clearly physical damage
  //   • severity high/critical
  //   • category disease with extent ≥ many_plants
  const requiresOfficerReview =
    predictedCategory === 'unknown'
    || (confidenceLevel === 'low' && predictedCategory !== 'physical_damage')
    || severity === 'high' || severity === 'critical'
    || (predictedCategory === 'disease' && extentTier >= 3);

  const escalationFlag = severity === 'high' || severity === 'critical';

  if (requiresOfficerReview) {
    reasoning.push({
      rule: 'officer_review_required',
      detail: predictedCategory === 'unknown'
        ? 'Signals are inconclusive — routing for human review'
        : 'Severity or uncertainty requires officer confirmation',
    });
  }

  return makeResult({
    predictedCategory, confidenceLevel, severity,
    reasoning, requiresOfficerReview, escalationFlag,
  });
}

function makeResult({
  predictedCategory, confidenceLevel, severity,
  reasoning, requiresOfficerReview, escalationFlag,
}) {
  const label = CATEGORY_LABELS[predictedCategory] || CATEGORY_LABELS.unknown;
  const next  = NEXT_STEPS[predictedCategory] || NEXT_STEPS.unknown;
  return Object.freeze({
    predictedCategory,
    predictedCategoryKey:        label.key,
    predictedCategoryFallback:   label.en,
    confidenceLevel,
    severity,
    reasoning:                   Object.freeze(reasoning.map(Object.freeze)),
    suggestedNextStepKey:        next.key,
    suggestedNextStepFallback:   next.en,
    requiresOfficerReview:       !!requiresOfficerReview,
    escalationFlag:              !!escalationFlag,
  });
}

export const _internal = Object.freeze({
  SYMPTOM_RULES, STAPLE_CROPS, EXTENT_TIERS, DURATION_DAYS,
  SEVERITY_ORDER, normalizeSymptoms, scoreCategories,
  pickWinner, confidenceFor, severityFor, bumpSeverity,
});
