/**
 * DecisionQualityEngine.ts — ENTERPRISE CERTIFICATION, Phase 3.
 *
 * Scores a recommendation against the 9 quality criteria and REJECTS weak ones.
 * A recommendation that is generic, unsupported, or missing a required field
 * does not reach the farmer — this is the gate between "we have an idea" and "we
 * tell the farmer to act". Pure, total, never throws.
 */
export const DECISION_QUALITY_VERSION = 'decision-quality-engine-v1';

export interface RecommendationLike {
  action?: string;
  reason?: string;
  evidence?: ReadonlyArray<string>;
  crop?: string | null;
  cropSpecific?: boolean;
  stage?: string | null;
  stageSpecific?: boolean;
  weatherAware?: boolean;
  confidence?: number;
  expectedBenefit?: string;
  timeRequiredMin?: number | null;
  contradicts?: boolean;
}

export interface DecisionQualityResult {
  passes: boolean;
  qualityScore: number;            // 0..100
  failedCriteria: ReadonlyArray<string>;
  criteria: Readonly<Record<string, boolean>>;
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _str = (v: any): string => (typeof v === 'string' ? v.trim() : '');

const GENERIC = [/^check your (crop|plant|farm)\.?$/i, /^monitor\.?$/i, /^do something\.?$/i, /^take care\.?$/i];

/** The 9 criteria. A recommendation must satisfy ALL hard criteria to pass. */
export function assessDecisionQuality(rec: RecommendationLike = {}): DecisionQualityResult {
  return _safe(() => {
    const action = _str(rec.action);
    const reason = _str(rec.reason);
    const ev = Array.isArray(rec.evidence) ? rec.evidence : [];
    const isGeneric = !action || GENERIC.some((re) => re.test(action));

    const criteria: Record<string, boolean> = {
      supportedByEvidence: reason.length > 0 && (ev.length > 0 || reason.length >= 12),
      noContradiction: rec.contradicts !== true,
      cropSpecific: rec.cropSpecific === true || !!_str(rec.crop || ''),
      stageSpecific: rec.stageSpecific === true || !!_str(rec.stage || ''),
      weatherAware: rec.weatherAware === true,
      confidenceAssigned: typeof rec.confidence === 'number' && rec.confidence > 0,
      reasonAssigned: reason.length > 0,
      benefitAssigned: _str(rec.expectedBenefit).length > 0,
      timeAssigned: typeof rec.timeRequiredMin === 'number' && rec.timeRequiredMin >= 0,
      notGeneric: !isGeneric,
    };

    // Hard criteria — failing any one rejects the recommendation.
    const HARD = ['supportedByEvidence', 'noContradiction', 'confidenceAssigned',
      'reasonAssigned', 'benefitAssigned', 'timeAssigned', 'notGeneric'];
    const failedCriteria = Object.keys(criteria).filter((k) => !criteria[k]);
    const hardFailed = HARD.filter((k) => !criteria[k]);
    const passed = Object.values(criteria).filter(Boolean).length;
    const qualityScore = Math.round((passed / Object.keys(criteria).length) * 100);

    return Object.freeze({
      passes: hardFailed.length === 0,
      qualityScore,
      failedCriteria: Object.freeze(failedCriteria),
      criteria: Object.freeze(criteria),
    });
  }, Object.freeze({ passes: false, qualityScore: 0,
    failedCriteria: Object.freeze(['evaluation_error']), criteria: Object.freeze({}) }));
}

/** Filter a list of recommendations to only those that pass quality. */
export function rejectWeakRecommendations<T extends RecommendationLike>(recs: ReadonlyArray<T>): ReadonlyArray<T> {
  return _safe(() => (Array.isArray(recs) ? recs.filter((r) => assessDecisionQuality(r).passes) : []), []);
}

export function decisionQualityHealth() {
  const strong = assessDecisionQuality({
    action: 'Inspect 10 onion plants', reason: 'Recent scan showed mild leaf stress.',
    evidence: ['✓ Onion crop selected'], crop: 'Onion', stage: 'vegetative', weatherAware: true,
    confidence: 88, expectedBenefit: 'Prevents yield loss.', timeRequiredMin: 4,
  });
  const weak = assessDecisionQuality({ action: 'Check your crop' });
  return Object.freeze({
    ok: true, version: DECISION_QUALITY_VERSION,
    criteria: Object.freeze(['supportedByEvidence', 'noContradiction', 'cropSpecific', 'stageSpecific',
      'weatherAware', 'confidenceAssigned', 'reasonAssigned', 'benefitAssigned', 'timeAssigned', 'notGeneric']),
    rejectsWeak: weak.passes === false,
    acceptsStrong: strong.passes === true,
  });
}

export function installDecisionQualityHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__decisionQualityHealth) return;
    Object.defineProperty(window, '__decisionQualityHealth', {
      configurable: true, enumerable: false, writable: false, value: () => decisionQualityHealth(),
    });
  }, undefined);
}
