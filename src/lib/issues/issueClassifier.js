/**
 * issueClassifier.js — deterministic rule-based classification of a
 * farmer-reported issue from its free-text description.
 *
 *   classifyIssue({ description, issueType }) → {
 *     issueType:    'pest' | 'disease' | 'water' | 'nutrient' |
 *                   'weather_damage' | 'unknown',
 *     confidence:   'high' | 'medium' | 'low',
 *     matchedRules: Array<{ rule, keyword, category }>,
 *   }
 *
 * The farmer's form-picked `issueType` is an INPUT, not an override —
 * the classifier cross-checks it against the description. When the
 * description strongly matches a different category, the classifier
 * returns THAT category; when both agree, confidence is raised. Low
 * confidence + unknown → escalate to admin (see automationRules).
 *
 * Pure. Deterministic. No ML.
 */

// Each rule is a { category, keyword, weight } triple. Weight feeds
// the confidence tier: 3+ strong, 2 medium, 1 weak.
const RULES = Object.freeze([
  // ─── pest ─────────────────────────────────────────────────────
  { category: 'pest',   keyword: 'worms',          weight: 3 },
  { category: 'pest',   keyword: 'armyworm',       weight: 3 },
  { category: 'pest',   keyword: 'caterpillar',    weight: 3 },
  { category: 'pest',   keyword: 'insect',         weight: 3 },
  { category: 'pest',   keyword: 'insects',        weight: 3 },
  { category: 'pest',   keyword: 'aphid',          weight: 3 },
  { category: 'pest',   keyword: 'eating leaves',  weight: 3 },
  { category: 'pest',   keyword: 'eaten',          weight: 2 },
  { category: 'pest',   keyword: 'holes in leaves', weight: 2 },
  { category: 'pest',   keyword: 'chewed',         weight: 2 },
  { category: 'pest',   keyword: 'pest',           weight: 3 },

  // ─── disease ──────────────────────────────────────────────────
  { category: 'disease', keyword: 'blight',         weight: 3 },
  { category: 'disease', keyword: 'mildew',         weight: 3 },
  { category: 'disease', keyword: 'rust',           weight: 3 },
  { category: 'disease', keyword: 'rot',            weight: 3 },
  { category: 'disease', keyword: 'fungus',         weight: 3 },
  { category: 'disease', keyword: 'fungal',         weight: 3 },
  { category: 'disease', keyword: 'mosaic',         weight: 3 },
  { category: 'disease', keyword: 'virus',          weight: 3 },
  { category: 'disease', keyword: 'brown spots',    weight: 2 },
  { category: 'disease', keyword: 'black spots',    weight: 2 },
  { category: 'disease', keyword: 'leaf spots',     weight: 2 },
  { category: 'disease', keyword: 'disease',        weight: 3 },

  // ─── water (flooding or drought — both disambiguated below) ──
  { category: 'water',   keyword: 'flood',          weight: 3 },
  { category: 'water',   keyword: 'flooded',        weight: 3 },
  { category: 'water',   keyword: 'flooding',       weight: 3 },
  { category: 'water',   keyword: 'standing water', weight: 3 },
  { category: 'water',   keyword: 'waterlogged',    weight: 3 },
  { category: 'water',   keyword: 'waterlogging',   weight: 3 },
  { category: 'water',   keyword: 'no rain',        weight: 3 },
  { category: 'water',   keyword: 'drought',        weight: 3 },
  { category: 'water',   keyword: 'dry',            weight: 2 },
  { category: 'water',   keyword: 'drying',         weight: 2 },
  { category: 'water',   keyword: 'wilting',        weight: 3 },
  { category: 'water',   keyword: 'wilted',         weight: 3 },
  { category: 'water',   keyword: 'irrigation',     weight: 2 },

  // ─── nutrient ────────────────────────────────────────────────
  { category: 'nutrient', keyword: 'nutrient',      weight: 3 },
  { category: 'nutrient', keyword: 'fertilizer',    weight: 2 },
  { category: 'nutrient', keyword: 'fertiliser',    weight: 2 },
  { category: 'nutrient', keyword: 'nitrogen',      weight: 3 },
  { category: 'nutrient', keyword: 'yellowing',     weight: 2 },
  { category: 'nutrient', keyword: 'pale leaves',   weight: 2 },
  { category: 'nutrient', keyword: 'stunted',       weight: 2 },

  // ─── weather_damage ──────────────────────────────────────────
  { category: 'weather_damage', keyword: 'hail',        weight: 3 },
  { category: 'weather_damage', keyword: 'hailstorm',   weight: 3 },
  { category: 'weather_damage', keyword: 'storm',       weight: 3 },
  { category: 'weather_damage', keyword: 'heavy wind',  weight: 3 },
  { category: 'weather_damage', keyword: 'high wind',   weight: 3 },
  { category: 'weather_damage', keyword: 'wind damage', weight: 3 },
  { category: 'weather_damage', keyword: 'broken stem', weight: 2 },
  { category: 'weather_damage', keyword: 'bent stem',   weight: 2 },
  { category: 'weather_damage', keyword: 'uprooted',    weight: 3 },

  // Ambiguous cues — "yellow leaves" could be nutrient OR disease,
  // so each only grants a small weight and the final verdict comes
  // from the winning total.
  { category: 'nutrient', keyword: 'yellow leaves',   weight: 1 },
  { category: 'disease',  keyword: 'yellow leaves',   weight: 1 },
]);

/**
 * Form-picked issueType → internal category. Keeps the classifier
 * independent of the form's labeling (so we can extend UI options
 * without breaking the rules).
 */
const FORM_TYPE_TO_CATEGORY = Object.freeze({
  pest:           'pest',
  disease:        'disease',
  weather_damage: 'weather_damage',
  soil:           'nutrient',
  irrigation:     'water',
  input_shortage: 'nutrient',
  access:         'unknown',
  other:          'unknown',
});

function normalize(s) {
  return String(s || '').toLowerCase();
}

/**
 * classifyIssue — scan description, tally category weights, compare
 * with the form-picked type, and emit a verdict + confidence.
 */
export function classifyIssue({ description = '', issueType = '' } = {}) {
  const desc = normalize(description);
  const formCategory = FORM_TYPE_TO_CATEGORY[normalize(issueType)] || 'unknown';

  // Tally per-category weight + collect the rules that matched.
  const tally = { pest: 0, disease: 0, water: 0, nutrient: 0, weather_damage: 0 };
  const matched = [];
  for (const rule of RULES) {
    if (desc.includes(rule.keyword)) {
      tally[rule.category] = (tally[rule.category] || 0) + rule.weight;
      matched.push(Object.freeze({
        rule: `${rule.category}:${rule.keyword}`,
        keyword: rule.keyword,
        category: rule.category,
        weight: rule.weight,
      }));
    }
  }

  // Pick the winner; tie-break by preferring the form-picked
  // category if it's involved in the tie.
  let topCategory = null;
  let topWeight = 0;
  for (const [cat, w] of Object.entries(tally)) {
    if (w > topWeight) { topCategory = cat; topWeight = w; }
    else if (w === topWeight && w > 0 && cat === formCategory) topCategory = cat;
  }

  // Confidence tiers. Form-picked agreement is a separate +1.
  let confidence = 'low';
  if (topWeight >= 5) confidence = 'high';
  else if (topWeight >= 3) confidence = 'medium';
  if (topCategory && topCategory === formCategory && topWeight >= 2) {
    confidence = confidence === 'low' ? 'medium' : 'high';
  }

  // No keyword hits → fall back to the form-picked category with
  // low confidence. If even the form is 'unknown', we emit 'unknown'
  // so the escalation rule fires in automationRules.
  if (topWeight === 0) {
    return Object.freeze({
      issueType:    formCategory,
      confidence:   'low',
      matchedRules: Object.freeze(matched),
      tally:        Object.freeze({ ...tally }),
    });
  }

  return Object.freeze({
    issueType:    topCategory,
    confidence,
    matchedRules: Object.freeze(matched),
    tally:        Object.freeze({ ...tally }),
  });
}

export const _internal = Object.freeze({ RULES, FORM_TYPE_TO_CATEGORY });
