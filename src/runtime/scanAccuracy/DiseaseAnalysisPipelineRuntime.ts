/**
 * DiseaseAnalysisPipelineRuntime.ts — §PHASE 5.
 *
 * Orchestrates the spec pipeline:
 *   Plant → Leaf Detection → Disease Detection → Severity → Action.
 *
 * HARD RULE (spec): "Only run after plant identified." The function
 * REFUSES to analyze disease when no plant has been confidently
 * identified. The gate (check-scan-accuracy) enforces the same rule
 * statically — the contract is locked both at runtime and at build.
 *
 * Reads existing __plantHealthEngineHealth / __diseaseDetectionHealth
 * probes when present. NEEDS_CONFIGURATION when no engine returns
 * data; never fabricates a problem or confidence.
 */

import type { DiseaseAnalysis, IdentificationCandidate } from './ScanAccuracyContracts';
import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

const PLANT_REQUIRED: Readonly<DiseaseAnalysis> = Object.freeze({
  problem: 'Plant must be identified first',
  confidencePct: 0,
  severity: 'unknown' as const,
  whatToCheck: 'Confirm the crop first — disease analysis cannot run on Unknown plants.',
  whatToDoNext: 'Choose a candidate from "Needs Identification" or retake the photo.',
  plantIdentifiedFirst: false,
  source: 'pipeline-guard',
  limitations:
    'Disease analysis pipeline requires a confidently identified plant. ' + GUIDANCE_TAIL,
});

const NOT_CONFIGURED: Readonly<DiseaseAnalysis> = Object.freeze({
  problem: 'No symptoms detected yet',
  confidencePct: 0,
  severity: 'unknown' as const,
  whatToCheck: 'Check leaves for spots, holes, or color changes.',
  whatToDoNext: 'Retake a sharp daylight photo if symptoms appear.',
  plantIdentifiedFirst: true,
  source: 'pipeline-pass-through',
  limitations:
    'No disease detection engine returned data. Treat as no-finding rather than no-problem. '
    + GUIDANCE_TAIL,
});

/** Public API — analyze disease for an identified plant. Returns
 *  PLANT_REQUIRED when bestPlant is missing/empty. */
export function analyzeDiseaseForPlant(
  bestPlant: IdentificationCandidate | null,
): Readonly<DiseaseAnalysis> {
  return _safe(() => {
    // Hard guard — disease pipeline MUST NOT run without a plant.
    if (!bestPlant || !bestPlant.key || bestPlant.confidencePct < 50) {
      return PLANT_REQUIRED;
    }
    const disease = _probe('__diseaseDetectionHealth') || _probe('__plantHealthEngineHealth');
    if (!disease) return NOT_CONFIGURED;

    const v: any = (disease as any).value || disease;
    const problem = typeof v.lastDisease === 'string' ? v.lastDisease
      : typeof v.problem === 'string' ? v.problem
      : typeof v.diagnosis === 'string' ? v.diagnosis : null;
    if (!problem) return NOT_CONFIGURED;

    const confRaw = typeof v.confidencePct === 'number' ? v.confidencePct
      : typeof v.confidence === 'number'
        ? (v.confidence <= 1 ? v.confidence * 100 : v.confidence)
        : null;
    const conf = (typeof confRaw === 'number' && isFinite(confRaw))
      ? Math.max(0, Math.min(100, confRaw)) : 0;

    const sevRaw: string = typeof v.severity === 'string' ? v.severity : '';
    const severity: 'low' | 'medium' | 'high' | 'unknown' =
      sevRaw === 'low' || sevRaw === 'medium' || sevRaw === 'high'
        ? (sevRaw as 'low' | 'medium' | 'high') : 'unknown';

    const whatToCheck = typeof v.whatToCheck === 'string' ? v.whatToCheck
      : 'Inspect the affected leaves closely.';
    const whatToDoNext = typeof v.whatToDoNext === 'string' ? v.whatToDoNext
      : typeof v.action === 'string' ? v.action
      : 'Re-scan in 3 days to track change.';

    return Object.freeze<DiseaseAnalysis>({
      problem, confidencePct: conf, severity,
      whatToCheck, whatToDoNext,
      plantIdentifiedFirst: true,
      source: '__diseaseDetectionHealth',
      limitations:
        'Disease detection is best-effort image analysis; field verification recommended. '
        + GUIDANCE_TAIL,
    });
  }, NOT_CONFIGURED);
}

export function diseasePipelineReady(): boolean {
  return _safe(() => {
    const d = _probe('__diseaseDetectionHealth') || _probe('__plantHealthEngineHealth');
    return !!d;
  }, false);
}
