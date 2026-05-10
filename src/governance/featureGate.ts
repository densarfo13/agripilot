/**
 * featureGate — runtime helper that validates a feature against
 * the 8 governance questions before it surfaces.
 *
 *   import { gateFeature } from 'src/governance/featureGate';
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
 */

export interface FeatureGateInput {
  readonly id?: string;
  readonly reducesUncertainty?: boolean;
  readonly deepensContinuity?: boolean;
  readonly improvesTiming?: boolean;
  readonly preservesCalmness?: boolean;
  readonly strengthensRealism?: boolean;
  readonly fitsEmotionalTone?: boolean;
  readonly avoidsClutter?: boolean;
  readonly avoidsDashboardDensity?: boolean;
}

export interface FeatureGateDecision {
  readonly allowed: boolean;
  readonly failedQuestions: ReadonlyArray<string>;
  /** 0..8 */
  readonly passed: number;
  /** Threshold for `allowed === true`. */
  readonly minRequired: number;
  readonly id: string | null;
}

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
] as const);

export type GateQuestion = typeof GATE_QUESTIONS[number];

const MIN_REQUIRED = GATE_QUESTIONS.length; // all 8

/**
 * Validate a candidate feature against the gate.
 */
export function gateFeature(input: FeatureGateInput | null | undefined): FeatureGateDecision {
  const safe: FeatureGateInput = (input && typeof input === 'object') ? input : {};
  const failed: string[] = [];
  let passed = 0;
  for (const q of GATE_QUESTIONS) {
    if ((safe as Record<string, unknown>)[q] === true) passed += 1;
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
export function assertFeatureGate(input: FeatureGateInput): FeatureGateDecision {
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
