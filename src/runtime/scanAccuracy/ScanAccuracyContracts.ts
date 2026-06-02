/**
 * ScanAccuracyContracts.ts — types + thresholds for the scan accuracy
 * production upgrade. Pure type module: no logic, no probes, no globals.
 */

export type Confidence = 'low' | 'medium' | 'high';
export type ImageQualityVerdict = 'good' | 'poor' | 'unknown';
export type ScanCategory = 'crop' | 'flower' | 'tree' | 'vegetable' | 'fruit' | 'unknown';

export const GUIDANCE_TAIL = 'Decision support, not a guarantee.';
export const SCAN_ACCURACY_VERSION = 'scan-accuracy-v1' as const;

/** Per-spec quality thresholds — all derived from canvas pixel analysis,
 *  never from ML. Values tuned for mobile-camera daylight scenarios. */
export const IMAGE_QUALITY_THRESHOLDS = Object.freeze({
  /** Laplacian variance below this = blurry image. */
  blurVarianceMin: 60,
  /** Mean luminance must be in this band (0..255). */
  brightnessMin: 60,
  brightnessMax: 215,
  /** Dark-pixel ratio above this = heavy shadows. */
  shadowRatioMax: 0.35,
  /** Estimated leaf coverage (green-dominant pixel ratio) below this
   *  = subject too small in frame. */
  leafCoverageMin: 0.18,
  /** Edge density (focus proxy) — Sobel-style — below this = soft. */
  focusEdgeDensityMin: 0.02,
});

export interface ImageQualityMetrics {
  blurVariance: number | null;       // higher = sharper
  brightnessMean: number | null;     // 0..255
  shadowRatio: number | null;        // 0..1
  leafCoverageRatio: number | null;  // 0..1
  focusEdgeDensity: number | null;   // 0..1
}

export interface ImageQualityReport {
  verdict: ImageQualityVerdict;
  reasons: ReadonlyArray<string>;
  tips: ReadonlyArray<string>;
  metrics: Readonly<ImageQualityMetrics>;
  confidence: Confidence;
  limitations: string;
}

export interface SegmentationResult {
  segmented: boolean;
  status: 'OK' | 'NEEDS_CONFIGURATION' | 'FAILED';
  /** When NEEDS_CONFIGURATION the runtime returns the original image
   *  ref unchanged — caller still gets a usable scan, just with the
   *  honest signal that segmentation is not yet a real ML model. */
  croppedImageUrl: string | null;
  reason: string;
  limitations: string;
}

export interface IdentificationCandidate {
  key: string;            // canonical key, e.g. 'onion'
  label: string;          // human label
  confidencePct: number;  // 0..100
  source: string;         // which engine produced it
}

export interface MultiPassResult {
  candidates: ReadonlyArray<IdentificationCandidate>;
  bestKey: string | null;
  bestConfidencePct: number;
  /** Were the underlying engines actually configured? */
  enginesConfigured: number;     // 0..3
  totalEngines: 3;
  status: 'OK' | 'NEEDS_CONFIGURATION' | 'FAILED';
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export interface UserAssistReRankInput {
  scanCategory: ScanCategory;
  candidates: ReadonlyArray<IdentificationCandidate>;
}

export interface DiseaseAnalysis {
  problem: string;
  confidencePct: number;
  severity: 'low' | 'medium' | 'high' | 'unknown';
  whatToCheck: string;
  whatToDoNext: string;
  /** Disease runtime requires the plant to be identified first. */
  plantIdentifiedFirst: boolean;
  source: string;
  limitations: string;
}

export interface FollowUpTask {
  id: string;
  title: string;
  why: string;
  whenLabel: string;
  estimatedTime: string;
  /** Honest: when scan returns Unknown / NEEDS_CONFIGURATION the follow-up
   *  task is "Retake photo" or "Save for review" rather than fabricated. */
  category: 'inspect' | 'moisture' | 'photo' | 'review';
  limitations: string;
}

export interface UnknownHandling {
  showAsUnknown: boolean;
  displayLabel: string;  // 'Needs Identification' instead of 'Unknown Plant'
  candidatesShown: ReadonlyArray<IdentificationCandidate>;
  userOptions: ReadonlyArray<'choose' | 'save_for_review' | 'retake_photo'>;
  limitations: string;
}

export interface ScanAccuracyHealthEnvelope {
  initialized: true;
  // Legacy field names (kept for backward compat with prior gates).
  imageQualityGateReady: boolean;
  segmentationReady: boolean;
  multiPassReady: boolean;
  diseasePipelineReady: boolean;
  candidateRankingReady: boolean;
  unknownHandlingReady: boolean;
  followUpTaskReady: boolean;
  // §SPEC plant-intelligence-pipeline §PHASE 14 canonical names. Same
  // underlying probes, surfaced under the spec's mandated field names
  // so pages can consume either style.
  qualityGateReady: boolean;
  consensusReady: boolean;
  memoryReady: boolean;
  issueDetectionReady: boolean;
  actionEngineReady: boolean;
  taskCreationReady: boolean;
  followUpReady: boolean;
  outcomeCaptureReady: boolean;
  noDeadEnds: true;
  noFakeAccuracyClaims: true;
  noFabricatedCandidates: true;
  noFakeDiseaseConfidence: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}
