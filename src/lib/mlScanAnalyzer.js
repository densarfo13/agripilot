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

// ─── Safe category vocabulary (Phase 7E spec) ─────────────────
export const ML_CATEGORIES = Object.freeze({
  HEALTHY:          'healthy',
  YELLOWING:        'yellowing',
  HOLES_OR_PEST:    'holes_or_pest_damage',
  SPOTS_OR_DISEASE: 'spots_or_disease_concern',
  NEEDS_REVIEW:     'needs_review',
});

/** Human-readable chip labels for each category. */
export const CATEGORY_LABELS = Object.freeze({
  healthy:                  'Looks Healthy',
  yellowing:                'Possible Yellowing',
  holes_or_pest_damage:     'Holes / Pest Damage',
  spots_or_disease_concern: 'Spots / Disease Concern',
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
  yellowing:                'Check soil moisture and inspect leaves',
  holes_or_pest_damage:     'Inspect under leaves for pests',
  spots_or_disease_concern: 'Separate affected leaves and monitor',
  needs_review:             'Take a clearer photo or inspect manually',
});

export const _internal = Object.freeze({
  SAFE_FALLBACK,
  CATEGORY_LABELS,
  CATEGORY_MESSAGES,
  TASK_SUGGESTIONS,
});
