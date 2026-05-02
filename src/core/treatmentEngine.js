/**
 * treatmentEngine.js — safe treatment recommendation engine.
 *
 *   import { recommendTreatment } from '../core/treatmentEngine.js';
 *   const guidance = recommendTreatment({
 *     possibleIssue, confidence,
 *     cropName, plantName,
 *     activeExperience, country, region,
 *     weather, scaleType, repeatedIssue,
 *   });
 *
 * Spec rules (NEVER violated)
 *   1. Never give exact chemical dosage.
 *   2. Never say "guaranteed cure".
 *   3. Always show non-chemical actions FIRST (immediateActions).
 *   4. Chemical guidance is class-only ("locally approved
 *      fungicide", "follow label directions").
 *   5. Always include the disclaimer.
 *
 * Output shape
 *   {
 *     treatmentType:        'fungal' | 'pest' | 'nutrient' | 'water' | 'heat' | 'inspection' | 'unknown',
 *     immediateActions:     string[]       (always 2-4)
 *     safeChemicalGuidance: string | null  (null for water/heat/inspection per §4)
 *     preventionTips:       string[]
 *     warning:              string | null  (per §6 triggers)
 *     disclaimer:           string         (always present)
 *     contextType:          'garden' | 'farm' | 'generic'
 *   }
 *
 * Strict-rule audit
 *   * Pure function. No I/O. Never throws.
 *   * Coexists with scanSafetyFilter.js (the last-mile sanitiser
 *     applied on the API response). The two layers reinforce
 *     each other — this engine NEVER emits unsafe text in the
 *     first place; the filter would catch it if it did.
 *   * Garden vs farm wording diverges per spec §5.
 *   * Disclaimer text matches the existing fleet-wide one in
 *     scanSafetyFilter.js so the user sees the same voice.
 */

// ── Issue → category map (spec §2) ────────────────────────────
const ISSUE_TO_CATEGORY = Object.freeze({
  'Possible fungal stress':        'fungal',
  'Possible pest damage':          'pest',
  'Possible nutrient deficiency':  'nutrient',
  'Possible water stress':         'water',
  'Possible heat stress':          'heat',
  'Possible transplant shock':     'inspection',
  'Needs closer inspection':       'inspection',
  'Looks healthy':                 'inspection',
  'Unknown issue':                 'unknown',
});

// ── Treatment categories ──────────────────────────────────────
const CATEGORY = Object.freeze({
  FUNGAL:     'fungal',
  PEST:       'pest',
  NUTRIENT:   'nutrient',
  WATER:      'water',
  HEAT:       'heat',
  INSPECTION: 'inspection',
  UNKNOWN:    'unknown',
});

// ── Disclaimer (spec §7) ──────────────────────────────────────
const DISCLAIMER =
  'Farroway provides guidance based on available information. '
  + 'Results are not guaranteed. Always follow local regulations '
  + 'and product labels before using any treatment.';

// ── Warning (spec §6) ─────────────────────────────────────────
const WARNING =
  'If damage is spreading quickly or affecting many plants, '
  + 'contact a local agricultural expert.';

// ── Immediate actions per category (spec §3) ──────────────────
//
// Two action banks per category (garden vs farm) so the
// wording matches the user's surface (spec §5). Each bank
// returns 2-4 non-chemical actions. Never empty.
const IMMEDIATE = Object.freeze({
  garden: {
    [CATEGORY.FUNGAL]: [
      'Remove affected leaves if safe to do so.',
      'Avoid wetting the leaves when watering.',
      'Improve airflow \u2014 space plants apart, prune crowded growth.',
      'Monitor whether the issue spreads to other plants.',
    ],
    [CATEGORY.PEST]: [
      'Check under the leaves and along stems for insects.',
      'Remove any heavily damaged leaves.',
      'Isolate the affected plant from healthy ones if possible.',
      'Monitor whether the damage spreads.',
    ],
    [CATEGORY.NUTRIENT]: [
      'Check the leaf colour pattern (yellow on old leaves vs new).',
      'Review what (if anything) you fed the plant in the last 2 weeks.',
      'Avoid over-fertilising \u2014 less is safer than more.',
      'Watch the new growth for improvement over the next week.',
    ],
    [CATEGORY.WATER]: [
      'Check the soil moisture before watering.',
      'Water only if the top 2 cm of soil feels dry.',
      'Improve drainage if the pot or bed holds water.',
      'Avoid overwatering \u2014 most plants prefer slightly dry to wet.',
    ],
    [CATEGORY.HEAT]: [
      'Move container plants to partial shade for the next few days.',
      'Water in the early morning, not midday.',
      'Mulch the soil surface to keep roots cooler.',
      'Watch for further wilting; healthy plants recover overnight.',
    ],
    [CATEGORY.INSPECTION]: [
      'Retake the photo in better light, focused on the affected area.',
      'Check under the leaves for insects or webbing.',
      'Check the soil moisture.',
      'Monitor whether the issue spreads.',
    ],
    [CATEGORY.UNKNOWN]: [
      'Retake the photo in better light if possible.',
      'Check under leaves and around the soil for clues.',
      'Monitor the plant for the next 2 days.',
    ],
  },
  farm: {
    [CATEGORY.FUNGAL]: [
      'Scout 5\u201310 nearby rows for the same symptoms.',
      'Avoid spraying or wetting the canopy during high humidity.',
      'Improve airflow where possible (thin crowded blocks).',
      'Record the affected field area in your log.',
    ],
    [CATEGORY.PEST]: [
      'Scout nearby rows and check under leaves for insects.',
      'Remove heavily damaged leaves where practical.',
      'Record the affected field area + how many plants are hit.',
      'Monitor spread over the next 2 days.',
    ],
    [CATEGORY.NUTRIENT]: [
      'Pull a soil sample from the affected zone for testing.',
      'Compare with a healthy area as a control.',
      'Review your fertiliser schedule and last application.',
      'Hold any new applications until the cause is clear.',
    ],
    [CATEGORY.WATER]: [
      'Check irrigation coverage in the affected block.',
      'Note recent rainfall; adjust the schedule accordingly.',
      'Scout the surrounding area to see how widespread it is.',
      'Avoid additional watering until soil moisture is checked.',
    ],
    [CATEGORY.HEAT]: [
      'Avoid spraying or fertilising during peak heat.',
      'Plan irrigation for early morning to limit evaporation.',
      'Check the rest of the field for similar wilting.',
      'Record the affected area for follow-up.',
    ],
    [CATEGORY.INSPECTION]: [
      'Scout nearby rows for similar signs.',
      'Retake the photo in better light, focused on the affected leaf.',
      'Record the affected area for follow-up.',
      'Check the field again tomorrow morning.',
    ],
    [CATEGORY.UNKNOWN]: [
      'Scout nearby rows for similar signs.',
      'Retake the photo in better light if possible.',
      'Check the field again tomorrow morning.',
    ],
  },
});

// ── Safe chemical guidance (spec §4) ──────────────────────────
//
// Class-only language. Never names a product, never lists a
// dosage. Water + heat + inspection categories deliberately
// return null — environmental actions only.
function _safeChemicalGuidance(category, isFarm) {
  if (category === CATEGORY.FUNGAL) {
    return isFarm
      ? 'If the issue spreads, consider a locally approved fungicide labelled for this crop. Follow the product label and your local extension service\u2019s guidance.'
      : 'If the issue spreads, consider a locally approved fungicide labelled for this plant type. Follow the product label and consult your local nursery if unsure.';
  }
  if (category === CATEGORY.PEST) {
    return isFarm
      ? 'If pests are visible or damage spreads, consider locally approved pest-control options labelled for this crop. Follow label directions and local guidance.'
      : 'If pests are visible, consider home-safe options first (mild soap spray, neem oil) and only use products labelled for plants of this type. Follow the label.';
  }
  if (category === CATEGORY.NUTRIENT) {
    return isFarm
      ? 'Consider a soil test before applying nutrients. Use fertiliser rates recommended for this crop in your region; follow the product label.'
      : 'Consider a balanced houseplant or vegetable feed at half the labelled strength before guessing what is missing. A simple soil test kit also helps.';
  }
  // water / heat / inspection / unknown — no chemical guidance.
  return null;
}

// ── Prevention tips per category ──────────────────────────────
function _preventionTips(category, isFarm) {
  if (category === CATEGORY.FUNGAL) {
    return isFarm
      ? [
          'Plant disease-resistant varieties when available.',
          'Rotate crops between seasons to break the disease cycle.',
          'Keep canopy spacing wide enough for air to move through.',
        ]
      : [
          'Water at the base of the plant, not the leaves.',
          'Space plants apart to let air circulate.',
          'Clean tools between plants to avoid spreading spores.',
        ];
  }
  if (category === CATEGORY.PEST) {
    return isFarm
      ? [
          'Scout regularly, especially after rain or heat events.',
          'Keep beneficial insect habitat (flowering borders) where possible.',
          'Remove crop debris between cycles to reduce overwintering pests.',
        ]
      : [
          'Inspect new plants before bringing them home.',
          'Encourage ladybirds + lacewings \u2014 they eat aphids.',
          'Wipe leaves with a damp cloth occasionally.',
        ];
  }
  if (category === CATEGORY.NUTRIENT) {
    return isFarm
      ? [
          'Soil-test annually so you fertilise to need, not by habit.',
          'Apply organic matter (compost) to build soil over time.',
          'Match fertiliser timing to crop growth stages.',
        ]
      : [
          'Top up the pot with fresh compost once a year.',
          'Feed lightly during the growing season; rest in winter.',
          'Match fertiliser to the plant type (leafy vs flowering vs fruiting).',
        ];
  }
  if (category === CATEGORY.WATER) {
    return isFarm
      ? [
          'Mulch to slow evaporation in dry seasons.',
          'Schedule irrigation around weather, not the calendar.',
          'Improve drainage in low-lying parts of the field.',
        ]
      : [
          'Use a finger-test before watering \u2014 dry top 2 cm = water.',
          'Match pot size to plant size; oversized pots stay wet too long.',
          'Empty saucers under pots so roots don\u2019t sit in water.',
        ];
  }
  if (category === CATEGORY.HEAT) {
    return isFarm
      ? [
          'Plan high-heat sensitive crops for cooler windows of the season.',
          'Use shade cloth on nursery / transplant blocks.',
          'Mulch to insulate roots from heat spikes.',
        ]
      : [
          'Move sensitive plants away from south- or west-facing glass in summer.',
          'Group plants \u2014 they raise local humidity for each other.',
          'Use a sheer curtain to soften midday sun.',
        ];
  }
  // inspection / unknown — generic prevention guidance.
  return isFarm
    ? [
        'Walk the field on a regular schedule so you spot changes early.',
        'Keep a simple log of what you\u2019ve done and when.',
      ]
    : [
        'Check your plants weekly so you spot changes early.',
        'Keep a simple note of what you\u2019ve done and when.',
      ];
}

// ── Warning trigger (spec §6) ─────────────────────────────────
function _shouldWarn({ category, confidence, scaleType, repeatedIssue }) {
  // Spreading + farm-scale crop → always warn.
  const isFarmScale = scaleType === 'large' || scaleType === 'commercial';
  if (isFarmScale && (category === CATEGORY.FUNGAL || category === CATEGORY.PEST)) return true;
  // High confidence on a fungal/pest call → warn.
  if (confidence === 'high' && (category === CATEGORY.FUNGAL || category === CATEGORY.PEST)) return true;
  // Repeated identical scan over the lookback window → warn.
  if (repeatedIssue) return true;
  return false;
}

// ── Public entry (spec §1) ────────────────────────────────────
/**
 * recommendTreatment(input) → guidance bundle.
 */
export function recommendTreatment(input = {}) {
  const safe = (input && typeof input === 'object') ? input : {};
  const exp = String(safe.activeExperience || '').toLowerCase();
  const isGarden = exp === 'garden' || exp === 'backyard';
  const contextType = isGarden ? 'garden' : (exp === 'farm' ? 'farm' : 'generic');
  const bank = isGarden ? IMMEDIATE.garden : IMMEDIATE.farm;

  const category = ISSUE_TO_CATEGORY[String(safe.possibleIssue || '').trim()]
                || CATEGORY.UNKNOWN;

  const immediateActions = (bank[category] || bank[CATEGORY.UNKNOWN]).slice();
  const safeChemicalGuidance = _safeChemicalGuidance(category, !isGarden);
  const preventionTips = _preventionTips(category, !isGarden);

  const warn = _shouldWarn({
    category,
    confidence:    String(safe.confidence || '').toLowerCase(),
    scaleType:     String(safe.scaleType  || '').toLowerCase(),
    repeatedIssue: !!safe.repeatedIssue,
  });

  return {
    treatmentType:        category,
    immediateActions,
    safeChemicalGuidance,
    preventionTips,
    warning:              warn ? WARNING : null,
    disclaimer:           DISCLAIMER,
    contextType,
  };
}

export const TREATMENT_CATEGORIES = CATEGORY;
export const _internal = Object.freeze({
  ISSUE_TO_CATEGORY, IMMEDIATE, DISCLAIMER, WARNING,
  _safeChemicalGuidance, _preventionTips, _shouldWarn,
});

export default recommendTreatment;
