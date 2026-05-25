/**
 * cropHealthResult.js — Phase 2 data model.
 *
 * STATUS: STUB. Pure type/shape module. No logic, no UI, no
 * network calls. Single source of truth for the shape of a
 * crop-health analysis result, consumed by:
 *   - scanIntelligence.js (today, via createEmptyCropHealthResult)
 *   - future scan UI components (when they need to render results)
 *   - server-side mappers (when the inference API result lands)
 *
 * The shape is freezable + serialisable so it can be:
 *   - persisted in scan history
 *   - sent across the wire (no functions, no class instances)
 *   - rendered by any UI without coupling
 *
 * Every text-bearing field uses *Key suffix so the UI translates
 * via the existing t() / tSafe() pipeline. No raw user-facing
 * text in the data layer.
 *
 * @typedef {object} CropHealthResult
 * @property {string|null}                cropDetected      canonical crop key, e.g. 'maize'
 * @property {number}                     confidence         0..1
 * @property {string|null}                issueDetected      canonical issue key, e.g. 'maize.streak_virus'
 * @property {'low'|'medium'|'high'|null} severity
 * @property {string|null}                recommendationKey  i18n key for the action
 * @property {string|null}                organicOptionKey   i18n key for the organic-treatment alt
 * @property {string|null}                safetyWarningKey   i18n key for any safety/waiting-period text
 * @property {string|null}                nextStepKey        i18n key for the immediate next step CTA
 * @property {string|null}                providerLabel      'stub' | 'plant-id' | 'plantnet' | 'openai' | …
 * @property {string|null}                providerVersion
 * @property {string|null}                timestamp          ISO 8601 of when the result was produced
 */

/**
 * Build an empty, frozen-once-populated result so consumers always
 * have every key present (forms / table renderers can iterate
 * Object.keys without optional-chaining).
 *
 * @returns {CropHealthResult}
 */
export function createEmptyCropHealthResult() {
  return {
    cropDetected:    null,
    confidence:      0,
    issueDetected:   null,
    severity:        null,
    recommendationKey: null,
    organicOptionKey:  null,
    safetyWarningKey:  null,
    nextStepKey:       null,
    providerLabel:   null,
    providerVersion: null,
    timestamp:       null,
  };
}

/**
 * Validate that an arbitrary object matches the contract. Returns
 * null on success, error string on failure. Cheap enough to run
 * on every inference response.
 */
export function validateCropHealthResult(obj) {
  if (!obj || typeof obj !== 'object') return 'not an object';
  const required = ['cropDetected', 'confidence', 'issueDetected', 'severity',
    'recommendationKey', 'organicOptionKey', 'safetyWarningKey', 'nextStepKey',
    'providerLabel', 'providerVersion', 'timestamp'];
  for (const k of required) if (!(k in obj)) return 'missing field: ' + k;
  if (typeof obj.confidence !== 'number') return 'confidence must be a number';
  if (obj.severity !== null && !['low', 'medium', 'high'].includes(obj.severity))
    return 'severity must be low|medium|high|null';
  return null;
}

export const CROP_HEALTH_RESULT_VERSION = '0.1.0-stub';
