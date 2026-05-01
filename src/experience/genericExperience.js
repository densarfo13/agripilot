/**
 * genericExperience.js — globally-safe daily plan for unsupported
 * or planned regions.
 *
 * Why this exists
 * ───────────────
 * The Region UX Engine (`src/core/regionUXEngine.js`) returns
 * `experience: 'generic'` whenever:
 *   • the country is unknown / not in REGION_CONFIG, or
 *   • the country is in REGION_CONFIG with status `planned` (we
 *     have catalog data but haven't switched it on for the UI).
 *
 * `dailyIntelligenceEngine.js` already routes between the
 * backyard- and farm-specific generators. This file adds the
 * third lane — a deliberately conservative, region-neutral plan
 * that nudges the farmer toward simple, low-risk actions until
 * we ship local guidance.
 *
 * Strict-rule audit
 *   • Pure (no I/O / no React / no global state).
 *   • Returns the SAME shape as `getBackyardDailyPlan` /
 *     `getFarmDailyPlan` so the caller can dispatch by
 *     experience type without branching on shape.
 *   • Never throws; the `_context` arg is accepted but
 *     intentionally unused — generic guidance is the same
 *     regardless of context.
 *   • Confidence is always `'low'` so any UI surface that
 *     keys on confidence (e.g. the timeline chip) renders
 *     a subdued / "Estimated" affordance.
 */

const ACTIONS = Object.freeze([
  Object.freeze({
    id:         'generic.inspect',
    title:      'Check your plants',
    reason:     'Look for dry soil, pests, yellow leaves, or visible damage.',
    urgency:    'medium',
    actionType: 'inspect',
  }),
  Object.freeze({
    id:         'generic.water',
    title:      'Water only if soil is dry',
    reason:     'This helps avoid overwatering while keeping plants healthy.',
    urgency:    'medium',
    actionType: 'water',
  }),
  Object.freeze({
    id:         'generic.scan',
    title:      'Take a photo if unsure',
    reason:     'Farroway can help you understand possible plant issues.',
    urgency:    'low',
    actionType: 'scan_crop',
  }),
]);

/**
 * @param {object} [_context]  unused; accepted for caller-shape parity
 * @returns {{
 *   summary: string,
 *   actions: ReadonlyArray<{id:string, title:string, reason:string, urgency:string, actionType:string}>,
 *   alerts: ReadonlyArray<object>,
 *   confidence: 'low'
 * }}
 */
export function getGenericDailyPlan(_context = {}) {
  return Object.freeze({
    summary:    'Here is what to check today.',
    actions:    ACTIONS,
    alerts:     Object.freeze([]),
    confidence: 'low',
  });
}

export default { getGenericDailyPlan };
