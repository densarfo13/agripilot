/**
 * featureGate — runtime helper that validates a feature against
 * the 8 governance questions before it surfaces.
 *
 *   import { gateFeature } from 'src/governance/featureGate.js';
 *
 *   const decision = gateFeature({
 *     id:           'plant-streak-badges',
 *     reducesUncertainty: false,
 *     deepensContinuity:   true,
 *     improvesTiming:      false,
 *     preservesCalmness:   false,    // badges are noise
 *     strengthensRealism:  false,
 *     fitsEmotionalTone:   false,
 *     avoidsClutter:       false,
 *     avoidsDashboardDensity: true,
 *   });
 *   if (!decision.allowed) {
 *     console.log('blocked:', decision.failedQuestions);
 *     return null;  // do not surface
 *   }
 *
 * Strict-rule audit
 *   • Pure / no I/O / no React. Frozen exports.
 *   • Decision is deterministic — same input → same output.
 *   • Conservative: a missing answer is treated as `false`. The
 *     caller must explicitly assert each property to opt in.
 *
 * @typedef {object} FeatureGateInput
 * @property {string}  [id]
 * @property {boolean} [reducesUncertainty]
 * @property {boolean} [deepensContinuity]
 * @property {boolean} [improvesTiming]
 * @property {boolean} [preservesCalmness]
 * @property {boolean} [strengthensRealism]
 * @property {boolean} [fitsEmotionalTone]
 * @property {boolean} [avoidsClutter]
 * @property {boolean} [avoidsDashboardDensity]
 *
 * @typedef {object} FeatureGateDecision
 * @property {boolean}        allowed
 * @property {string[]}       failedQuestions
 * @property {number}         passed         0..8
 * @property {number}         minRequired    threshold for allow
 * @property {string|null}    id
 */

// All 8 questions are mandatory — every one must answer true.
// Less than 8 == surface stays hidden / delayed / removed.
export const GATE_QUESTIONS = Object.freeze([
  'reducesUncertainty',
  'deepensContinuity',
  'improvesTiming',
  'preservesCalmness',
  'strengthensRealism',
  'fitsEmotionalTone',
  'avoidsClutter',
  'avoidsDashboardDensity',
]);

const MIN_REQUIRED = GATE_QUESTIONS.length; // all 8

/**
 * Validate a candidate feature against the gate.
 *
 * @param {FeatureGateInput} input
 * @returns {FeatureGateDecision}
 */
export function gateFeature(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const failed = [];
  let passed = 0;
  for (const q of GATE_QUESTIONS) {
    if (safe[q] === true) passed += 1;
    else failed.push(q);
  }
  return Object.freeze({
    allowed:         failed.length === 0,
    failedQuestions: Object.freeze(failed),
    passed,
    minRequired:     MIN_REQUIRED,
    id:              typeof safe.id === 'string' && safe.id ? safe.id : null,
  });
}

/**
 * Lightweight assertion form. Throws a descriptive Error when the
 * gate denies the feature. Useful in tests + during code review
 * when the dev wants a hard fail rather than a boolean to branch on.
 */
export function assertFeatureGate(input) {
  const d = gateFeature(input);
  if (!d.allowed) {
    const why = d.failedQuestions.join(', ');
    const id  = d.id ? ` "${d.id}"` : '';
    throw new Error(
      `Feature${id} blocked by experience gate. Failed: ${why}. `
      + `(${d.passed}/${d.minRequired} questions passed.)`
    );
  }
  return d;
}

export default Object.freeze({
  GATE_QUESTIONS,
  gateFeature,
  assertFeatureGate,
});
