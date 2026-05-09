/**
 * mlScanAnalyzer.js — Phase 7E: ML scan safe mode.
 *
 * Lightweight image-upload analysis placeholder. Implements the
 * structured category vocabulary WITHOUT:
 *   • heavy ML model loading in browser
 *   • disease diagnosis / certainty claims
 *   • automatic treatment instructions
 *   • background camera analysis
 *   • external AI API dependency
 *
 * The placeholder is always honest about its limitations:
 *   confidence = 'low' | 'medium' | 'high'  (always 'low' here)
 *   category   = one of the five SAFE_CATEGORIES
 *   message    = cautious, non-prescriptive observation text
 *
 * On ANY error the safe fallback is always returned — never throws:
 *   "Photo saved. Review needed."
 *
 * When the real ML backend (/api/scan/analyze) is ready it returns
 * the same shape, so callers need zero changes.
 *
 * Gated by the `mlScan` feature flag — callers should check
 * isFeatureEnabled('mlScan') before calling analyzeImageSafe.
 */

// ─── Safe category vocabulary (Phase 7E spec + Plantix-style upgrade) ──
// Original five categories from Phase 7E:
//   healthy / yellowing / holes_or_pest_damage / spots_or_disease_concern /
//   needs_review
// Added (Plantix-style upgrade): wilting + nutrient_stress.
// All seven are safe — no certainty claims, no diagnosis.
export const ML_CATEGORIES = Object.freeze({
  HEALTHY:          'healthy',
  YELLOWING:        'yellowing',
  HOLES_OR_PEST:    'holes_or_pest_damage',
  SPOTS_OR_DISEASE: 'spots_or_disease_concern',
  WILTING:          'wilting',
  NUTRIENT_STRESS:  'nutrient_stress',
  NEEDS_REVIEW:     'needs_review',
});

/** Human-readable chip labels for each category.
 *  Plantix-style cautious wording: "Possible…", "Looks like…",
 *  "Needs review" — never absolute disease names. */
export const CATEGORY_LABELS = Object.freeze({
  healthy:                  'Looks Healthy',
  yellowing:                'Possible Yellowing',
  holes_or_pest_damage:     'Possible Pest Damage',
  spots_or_disease_concern: 'Possible Leaf Disease Concern',
  wilting:                  'Possible Wilting',
  nutrient_stress:          'Possible Nutrient Stress',
  needs_review:             'Needs Review',
});

/**
 * Safe, cautious message for each category.
 * Rules:
 *   • Never "confirmed disease" / "guaranteed" / exact dosage.
 *   • Always action-framed and deferring to local expertise.
 *   • "needs_review" message is the spec-mandated failure copy.
 */
export const CATEGORY_MESSAGES = Object.freeze({
  healthy:
    'Your plant looks healthy. Keep monitoring for early signs of stress or pest activity.',
  yellowing:
    'Yellowing may be caused by water stress, nutrient issues, or pests. ' +
    'Check soil moisture and inspect under leaves.',
  holes_or_pest_damage:
    'Holes or irregular leaf edges may indicate pest activity. ' +
    'Check under leaves and along stems for insects or eggs.',
  spots_or_disease_concern:
    'Spots may indicate a fungal or bacterial concern. ' +
    'Avoid overhead watering and improve airflow around plants.',
  wilting:
    'Wilting may be caused by under-watering, root issues, or heat stress. ' +
    'Check soil moisture and the root area first.',
  nutrient_stress:
    'Pale, off-colour, or stunted growth may suggest nutrient stress. ' +
    'Check leaf colour patterns and recent feeding history.',
  needs_review:
    'Photo saved. Review needed. Consider sharing with a local agronomist for a closer look.',
});

// ─── Internal safe fallback ────────────────────────────────────
const SAFE_FALLBACK = Object.freeze({
  status:     ML_CATEGORIES.NEEDS_REVIEW,
  category:   ML_CATEGORIES.NEEDS_REVIEW,
  confidence: 'low',
  label:      CATEGORY_LABELS.needs_review,
  message:    CATEGORY_MESSAGES.needs_review,
});

// ─── Public API ────────────────────────────────────────────────

/**
 * analyzeImageSafe(input) → { status, category, confidence, label, message }
 *
 * Placeholder analysis. Accepts the scan input context and returns
 * a structured category result. Because browser-side image analysis
 * without an ML model cannot reliably distinguish categories, this
 * placeholder returns `needs_review` with `low` confidence —
 * honest about its limitations and always safe.
 *
 * The return shape matches what the real /api/scan/analyze endpoint
 * will return, so callers require no changes when the ML backend
 * is wired in and scanApiEnabled flips to true.
 *
 * @param {object}  input
 * @param {string}  [input.cropId]       - crop identifier (context only)
 * @param {string}  [input.plantName]    - plant name (context only)
 * @param {string}  [input.experience]   - 'farm' | 'backyard' | 'generic'
 * @param {string}  [input.imageBase64]  - accepted but not analyzed (no model)
 * @param {string}  [input.imageUrl]     - accepted but not analyzed (no model)
 * @returns {{ status: string, category: string, confidence: string, label: string, message: string }}
 */
export function analyzeImageSafe(input = {}) {
  try {
    // Placeholder: always returns needs_review / low confidence.
    // This is the safe, honest behavior for a client-side analysis
    // that cannot inspect actual image pixels without an ML model.
    // The real ML verdict (from /api/scan/analyze) replaces this
    // once scanApiEnabled is true.
    return SAFE_FALLBACK;
  } catch {
    return SAFE_FALLBACK;
  }
}

/**
 * categoryLabel(category) → human-readable chip text.
 * Safe for unknown/undefined inputs — falls back to "Needs Review".
 */
export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || CATEGORY_LABELS.needs_review;
}

/**
 * categoryMessage(category) → cautious observation text.
 * Safe for unknown/undefined inputs.
 */
export function categoryMessage(category) {
  return CATEGORY_MESSAGES[category] || CATEGORY_MESSAGES.needs_review;
}

/**
 * isValidCategory(value) — type-guard for the five safe categories.
 */
export function isValidCategory(value) {
  return typeof value === 'string' && value in CATEGORY_LABELS;
}

/**
 * Per-category suggested follow-up task title (Phase 7F).
 *
 * Rules (matching CATEGORY_MESSAGES):
 *   • Action-framed, farmer-language, no diagnosis or dosage claims.
 *   • Short enough to scan at a glance on a phone.
 *   • maps 1-to-1 with ML_CATEGORIES keys.
 */
export const TASK_SUGGESTIONS = Object.freeze({
  healthy:                  'Continue daily crop check',
  yellowing:                'Check soil moisture and lower leaves',
  holes_or_pest_damage:     'Inspect under leaves for pests',
  spots_or_disease_concern: 'Monitor affected leaves and avoid overhead watering',
  wilting:                  'Check soil moisture and the root area',
  nutrient_stress:          'Check leaf colour and growth pattern',
  needs_review:             'Take a clearer photo in good light',
});

// ─── Plantix-style result shape (spec §3 / §9) ────────────────────
//
// analyzePlantImage(file, ctx) returns the spec-shaped result:
//   { category, confidence, noticed, checkNext, recommendation, taskTitle }
//
// This is a forward-compatible wrapper on top of analyzeImageSafe so
// the UI can adopt the richer shape today while the underlying image
// pipeline stays a safe placeholder. When /api/scan/analyze ships,
// only the implementation below changes — callers stay the same.
//
// Rules
//   • Never throws — every error path resolves to NEEDS_REVIEW_RESULT.
//   • Never claims confirmed disease / pesticide / dosage.
//   • Validates file type (image/jpeg | image/png | image/webp) and
//     size; oversized or wrong-type files fall through to the safe
//     "needs review" branch with a clear `noticed` message.

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_TYPES = Object.freeze([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
]);

/** Per-category "What to check next" guidance. */
const CHECK_NEXT = Object.freeze({
  healthy:
    'Keep monitoring daily. Note any change in colour, growth, or pests.',
  yellowing:
    'Look under leaves and check if yellowing spreads or stays on lower leaves.',
  holes_or_pest_damage:
    'Check under leaves and along stems for insects, eggs, or sticky residue.',
  spots_or_disease_concern:
    'Look under leaves and check if spots are spreading to nearby plants.',
  wilting:
    'Feel soil 5 cm down. Check root area for rot, dryness, or pests.',
  nutrient_stress:
    'Look at the colour pattern — older or newer leaves first? Check feeding history.',
  needs_review:
    'Check leaves for yellowing, holes, spots, or wilting and retake the photo.',
});

/** Per-category "Recommended action" — what to do, not what to spray. */
const RECOMMENDATIONS = Object.freeze({
  healthy:
    'Continue your current care routine and check the plant again tomorrow.',
  yellowing:
    'Adjust watering if soil is dry or waterlogged. Avoid wetting leaves at night.',
  holes_or_pest_damage:
    'Hand-remove visible insects where safe. Consider local agronomy advice if damage spreads.',
  spots_or_disease_concern:
    'Remove heavily affected leaves and avoid wetting leaves when watering.',
  wilting:
    'Water gently if soil is dry. Improve drainage if soil is waterlogged.',
  nutrient_stress:
    'Add a balanced feed if soil is dry. Avoid over-fertilising.',
  needs_review:
    'Take another clear photo in good light or inspect the plant manually.',
});

/**
 * Confidence-safe disclaimer. Always shown so the user is never
 * misled by a single-photo verdict — matches the May 2026 final
 * scan stabilization brief §11.
 */
export const SCAN_DISCLAIMER =
  'Results are guidance only. Local agronomy advice may help confirm treatment options.';

/** The spec-shape result for any category. */
function _shape(category) {
  const safeCat = (category in CATEGORY_LABELS) ? category : 'needs_review';
  return Object.freeze({
    category:        safeCat,
    confidence:      safeCat === 'healthy' || safeCat === 'needs_review'
      ? 'low' : 'medium',
    noticed:         CATEGORY_MESSAGES[safeCat],
    checkNext:       CHECK_NEXT[safeCat]    || CHECK_NEXT.needs_review,
    // `inspectItems` mirrors checkNext as a single-element array
    // so the spec-shape result card can render a bulleted list
    // without forcing every caller to pre-split.
    inspectItems:    [CHECK_NEXT[safeCat]   || CHECK_NEXT.needs_review],
    recommendation:  RECOMMENDATIONS[safeCat] || RECOMMENDATIONS.needs_review,
    suggestedAction: RECOMMENDATIONS[safeCat] || RECOMMENDATIONS.needs_review,
    taskTitle:       TASK_SUGGESTIONS[safeCat] || TASK_SUGGESTIONS.needs_review,
    followUpTask:    TASK_SUGGESTIONS[safeCat] || TASK_SUGGESTIONS.needs_review,
    label:           CATEGORY_LABELS[safeCat],
    disclaimer:      SCAN_DISCLAIMER,
    source:          'mlScanAnalyzer-v1',
  });
}

/** Spec §9 fallback — exact wording from the task brief. */
const NEEDS_REVIEW_RESULT = Object.freeze({
  category:        'needs_review',
  status:          'Needs review',
  confidence:      'low',
  noticed:         'Photo received, but automatic review was unavailable.',
  checkNext:       'Check leaves for yellowing, holes, spots, or wilting.',
  inspectItems:    ['Check leaves for yellowing, holes, spots, or wilting.'],
  recommendation:  'Take another clear photo or inspect manually.',
  suggestedAction: 'Take another clear photo or inspect manually.',
  taskTitle:       'Inspect plant manually',
  followUpTask:    'Inspect plant manually',
  label:           CATEGORY_LABELS.needs_review,
  disclaimer:      'Results are guidance only.',
  source:          'mlScanAnalyzer-fallback',
});

/**
 * analyzePlantImage(file, ctx) → Promise<Result>
 *
 * Plantix-style entry point used by the new scan flow. The current
 * implementation is a safe placeholder (no pixel inspection) — it
 * validates the file and resolves to a `needs_review` result. The
 * shape is forward-compatible with /api/scan/analyze, so when the
 * real ML backend lands the call site stays unchanged.
 *
 * @param {File|Blob|null} file
 * @param {object} [ctx]                 — optional context (cropId, plantName, experience)
 * @returns {Promise<{
 *   category, confidence, noticed, checkNext, recommendation, taskTitle, label, source
 * }>}
 */
export function analyzePlantImage(file, _ctx = {}) {
  return new Promise((resolve) => {
    try {
      // Missing file → safe fallback (never throws).
      if (!file) {
        resolve(NEEDS_REVIEW_RESULT);
        return;
      }
      // Type check (spec §8) — accept jpeg/png/webp only.
      const type = String(file.type || '').toLowerCase();
      if (type && !ACCEPTED_TYPES.includes(type)) {
        resolve({
          ...NEEDS_REVIEW_RESULT,
          noticed: 'Photo format not supported. Use JPG, PNG, or WEBP.',
        });
        return;
      }
      // Size check (spec §8) — reject oversized images.
      const size = Number(file.size || 0);
      if (Number.isFinite(size) && size > MAX_IMAGE_BYTES) {
        resolve({
          ...NEEDS_REVIEW_RESULT,
          noticed: 'Photo too large. Try a smaller image (under 10 MB).',
        });
        return;
      }
      // Placeholder analysis — the safe path until /api/scan/analyze
      // ships. Returns NEEDS_REVIEW_RESULT with low confidence so we
      // never overclaim. The real ML analyser will replace this branch.
      resolve(NEEDS_REVIEW_RESULT);
    } catch {
      resolve(NEEDS_REVIEW_RESULT);
    }
  });
}

/**
 * resultForCategory(category) → spec-shape result for the given category.
 * Useful for tests, demos, and the offline mock classifier when the
 * user manually picks the issue type from a chooser.
 */
export function resultForCategory(category) {
  return _shape(category);
}

export const _internal = Object.freeze({
  SAFE_FALLBACK,
  CATEGORY_LABELS,
  CATEGORY_MESSAGES,
  TASK_SUGGESTIONS,
  CHECK_NEXT,
  RECOMMENDATIONS,
  NEEDS_REVIEW_RESULT,
  _shape,
});
