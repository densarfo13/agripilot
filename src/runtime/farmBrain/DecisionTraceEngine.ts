/**
 * DecisionTraceEngine.ts — sprint #209, spec "Decision Trace".
 *
 * Turns a recommendation into an explainable trace: the signed
 * contributors that produced it, the supporting evidence, and the
 * open risks. COMPOSITION ONLY over signals the Farm Brain already
 * holds (crop, stage, weather note, scan memory, overdue follow-up).
 * It never invents a contributor and never inflates confidence —
 * `confidence` is echoed from the recommendation, not recomputed.
 *
 * "No recommendation without reason" — buildDecisionTrace ALWAYS
 * returns at least one contributor when a recommendation is present.
 *
 * Pure. SSR-safe. Never throws. Frozen returns.
 */

export const DECISION_TRACE_ENGINE_VERSION = 'decision-trace-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);

export interface TraceContributor {
  sign: '+' | '-';
  label: string;
}

export interface DecisionTrace {
  runtimeVersion: string;
  recommendation: string;
  confidence:     number | null;   // echoed, never recomputed
  evidence:       ReadonlyArray<string>;
  risks:          ReadonlyArray<string>;
  contributors:   ReadonlyArray<Readonly<TraceContributor>>;
  hasReason:      boolean;          // success-criterion flag
}

/**
 * Build the trace. Inputs are the already-composed Farm Brain signals;
 * none are fetched or invented here.
 */
export function buildDecisionTrace(input: {
  recommendation?: string;
  confidence?: number | null;
  crop?: string;
  cropStage?: string;
  weatherNote?: string;
  previousScanIssue?: string;
  followUpOverdue?: boolean;
  risks?: ReadonlyArray<string>;
  extraContributors?: ReadonlyArray<string>;
} = {}): Readonly<DecisionTrace> {
  return _safe(() => {
    const recommendation = _str(input.recommendation);
    const contributors: TraceContributor[] = [];
    const evidence: string[] = [];

    const crop = _str(input.crop);
    if (crop) {
      contributors.push({ sign: '+', label: crop + ' selected' });
    }
    const stage = _str(input.cropStage);
    if (stage && stage !== 'unknown') {
      contributors.push({ sign: '+', label: stage.replace(/_/g, ' ') + ' stage' });
    }
    const weather = _str(input.weatherNote);
    if (weather) {
      contributors.push({ sign: '+', label: weather });
      evidence.push(weather);
    }
    const prevIssue = _str(input.previousScanIssue);
    if (prevIssue && prevIssue.toLowerCase() !== 'no_visible_issue') {
      contributors.push({ sign: '+', label: 'Previous scan detected ' + prevIssue.replace(/_/g, ' ') });
      evidence.push('A prior scan on this farm flagged ' + prevIssue.replace(/_/g, ' ') + '.');
    }
    if (input.followUpOverdue) {
      contributors.push({ sign: '+', label: 'Follow-up task overdue' });
    }
    for (const c of (Array.isArray(input.extraContributors) ? input.extraContributors : [])) {
      const s = _str(c);
      if (s) contributors.push({ sign: '+', label: s });
    }

    const risks = (Array.isArray(input.risks) ? input.risks : [])
      .map(_str).filter(Boolean);

    // "No recommendation without reason" — guarantee one contributor.
    if (recommendation && contributors.length === 0) {
      contributors.push({ sign: '+', label: 'Based on your current farm setup' });
    }

    return Object.freeze({
      runtimeVersion: DECISION_TRACE_ENGINE_VERSION,
      recommendation,
      confidence: _num(input.confidence),
      evidence: Object.freeze(evidence),
      risks: Object.freeze(risks),
      contributors: Object.freeze(contributors.map((c) => Object.freeze(c))),
      hasReason: contributors.length > 0,
    });
  }, Object.freeze({
    runtimeVersion: DECISION_TRACE_ENGINE_VERSION,
    recommendation: '',
    confidence: null,
    evidence: Object.freeze([]),
    risks: Object.freeze([]),
    contributors: Object.freeze([]),
    hasReason: false,
  }));
}

export const _internal = Object.freeze({ buildDecisionTrace });
export default buildDecisionTrace;
