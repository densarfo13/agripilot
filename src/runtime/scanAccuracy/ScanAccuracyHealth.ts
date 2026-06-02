/**
 * ScanAccuracyHealth.ts → window.__scanAccuracyHealth().
 *
 * Composite over the 7 accuracy-upgrade runtimes. Reports the 7 spec
 * readiness flags + literal-true safety constants. Never duplicates
 * state; never fabricates accuracy claims.
 */

import { imageQualityGateReady } from './ImageQualityGate';
import { plantSegmentationReady } from './PlantSegmentationRuntime';
import { multiPassReady } from './MultiPassIdentificationRuntime';
import { candidateRankingReady } from './UserAssistedIdentificationRuntime';
import { diseasePipelineReady } from './DiseaseAnalysisPipelineRuntime';
import { followUpTaskReady } from './ScanFollowUpRuntime';
import { unknownHandlingReady } from './UnknownHandlingRuntime';
import type { ScanAccuracyHealthEnvelope, Confidence } from './ScanAccuracyContracts';
import { GUIDANCE_TAIL, SCAN_ACCURACY_VERSION } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export function scanAccuracyHealth(): Readonly<ScanAccuracyHealthEnvelope> {
  return _safe(() => {
    const flags = {
      imageQualityGateReady: imageQualityGateReady(),
      segmentationReady: plantSegmentationReady(),
      multiPassReady: multiPassReady(),
      diseasePipelineReady: diseasePipelineReady(),
      candidateRankingReady: candidateRankingReady(),
      unknownHandlingReady: unknownHandlingReady(),
      followUpTaskReady: followUpTaskReady(),
    };
    const ready = Object.values(flags).filter(Boolean).length;
    return Object.freeze<ScanAccuracyHealthEnvelope>({
      initialized: true,
      ...flags,
      noFakeAccuracyClaims: true as const,
      noFabricatedCandidates: true as const,
      noFakeDiseaseConfidence: true as const,
      confidence: (ready >= 5 ? 'high' : ready >= 3 ? 'medium' : 'low') as Confidence,
      explanation:
        'Scan accuracy composite over the 7 upgrade runtimes: image quality gate (real ' +
        'canvas-based pixel analysis), segmentation (honest NEEDS_CONFIGURATION until ML ' +
        'wired), multi-pass identification (composes existing engines), user-assist re-rank, ' +
        'disease pipeline (refuses to run before plant identified), follow-up task generator ' +
        '(every scan generates one), and Unknown→"Needs Identification" handling. No fake ' +
        'accuracy claims, no fabricated candidates.',
      limitations:
        'Accuracy reflects upstream engine availability — composite never fabricates a result. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<ScanAccuracyHealthEnvelope>({
    initialized: true,
    imageQualityGateReady: false, segmentationReady: false,
    multiPassReady: false, diseasePipelineReady: false,
    candidateRankingReady: false, unknownHandlingReady: false,
    followUpTaskReady: false,
    noFakeAccuracyClaims: true as const,
    noFabricatedCandidates: true as const,
    noFakeDiseaseConfidence: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Scan accuracy runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installScanAccuracyHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanAccuracyHealth !== 'function') {
      w.__scanAccuracyHealth = function () {
        const out = scanAccuracyHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Scan Accuracy]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export { SCAN_ACCURACY_VERSION };
