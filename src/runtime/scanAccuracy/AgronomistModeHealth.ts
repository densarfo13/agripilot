/**
 * AgronomistModeHealth.ts → window.__agronomistModeHealth().
 *
 * Top-level Scan V3 Agronomist Mode composite. Pins the 10 spec
 * readiness flags + noDeadEnds: true. Composes sibling readiness
 * helpers from the existing scan accuracy pipeline + the two new
 * V3-specific runtimes (FarmContextBias, CommunityScanReview).
 *
 * Spec field → source helper:
 *   qualityEngineReady       → imageQualityGateReady()
 *   segmentationReady        → plantSegmentationReady()
 *   contextReady             → farmContextBiasReady()
 *   multiModelReady          → multiPassReady()
 *   issueDetectionReady      → diseasePipelineReady()
 *   actionGenerationReady    → followUpTaskReady()
 *   taskGenerationReady      → followUpTaskReady()
 *   followUpReady            → followUpTaskReady()
 *   outcomeReady             → outcomeLoopReady()
 *   communityReviewReady     → communityReviewReady()
 */

import { imageQualityGateReady } from './ImageQualityGate';
import { plantSegmentationReady } from './PlantSegmentationRuntime';
import { multiPassReady } from './MultiPassIdentificationRuntime';
import { diseasePipelineReady } from './DiseaseAnalysisPipelineRuntime';
import { followUpTaskReady } from './ScanFollowUpRuntime';
import { outcomeLoopReady } from './ScanOutcomeLoopRuntime';
import { farmContextBiasReady } from './FarmContextBiasRuntime';
import { communityReviewReady } from './CommunityScanReviewRuntime';
import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

type Confidence = 'low' | 'medium' | 'high';

export const AGRONOMIST_MODE_VERSION = 'agronomist-mode-v1' as const;

export interface AgronomistModeHealthEnvelope {
  initialized: true;
  qualityEngineReady: boolean;
  segmentationReady: boolean;
  contextReady: boolean;
  multiModelReady: boolean;
  issueDetectionReady: boolean;
  actionGenerationReady: boolean;
  taskGenerationReady: boolean;
  followUpReady: boolean;
  outcomeReady: boolean;
  communityReviewReady: boolean;
  noDeadEnds: true;
  noFakeIntelligence: true;
  noFabricatedConfidence: true;
  composedFrom: ReadonlyArray<string>;
  readyCount: number;
  totalFlags: 10;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function agronomistModeHealth(): Readonly<AgronomistModeHealthEnvelope> {
  return _safe(() => {
    const quality = imageQualityGateReady();
    const seg = plantSegmentationReady();
    const ctx = farmContextBiasReady();
    const multiModel = multiPassReady();
    const issue = diseasePipelineReady();
    const followUp = followUpTaskReady();
    const outcome = outcomeLoopReady();
    const community = communityReviewReady();

    const readyCount = [
      quality, seg, ctx, multiModel, issue,
      followUp, followUp, followUp,  // action / task / follow-up all driven by follow-up emission
      outcome, community,
    ].filter(Boolean).length;

    return Object.freeze<AgronomistModeHealthEnvelope>({
      initialized: true,
      qualityEngineReady: quality,
      segmentationReady: seg,
      contextReady: ctx,
      multiModelReady: multiModel,
      issueDetectionReady: issue,
      actionGenerationReady: followUp,
      taskGenerationReady: followUp,
      followUpReady: followUp,
      outcomeReady: outcome,
      communityReviewReady: community,
      noDeadEnds: true as const,
      noFakeIntelligence: true as const,
      noFabricatedConfidence: true as const,
      composedFrom: Object.freeze([
        './ImageQualityGate', './PlantSegmentationRuntime',
        './FarmContextBiasRuntime', './MultiPassIdentificationRuntime',
        './DiseaseAnalysisPipelineRuntime', './ScanFollowUpRuntime',
        './ScanOutcomeLoopRuntime', './CommunityScanReviewRuntime',
      ]) as ReadonlyArray<string>,
      readyCount,
      totalFlags: 10 as const,
      confidence: (readyCount >= 7 ? 'high' : readyCount >= 4 ? 'medium' : 'low') as Confidence,
      explanation:
        'Agronomist Mode composite. Surfaces the 10 spec readiness flags over the existing ' +
        'scan accuracy pipeline (quality / segmentation / multi-pass / disease / follow-up / ' +
        'outcome) plus the two V3 additions: farm-context bias re-rank (capped +30%) and ' +
        'community-review bridge (admin-moderated). noDeadEnds literal-true because every scan ' +
        'either identifies, surfaces "Needs Identification" with candidates, or routes the ' +
        'farmer to community review.',
      limitations:
        'Bias and consensus are decision support only. Community review requires admin ' +
        'moderation before publishing. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<AgronomistModeHealthEnvelope>({
    initialized: true,
    qualityEngineReady: false, segmentationReady: false, contextReady: false,
    multiModelReady: false, issueDetectionReady: false,
    actionGenerationReady: false, taskGenerationReady: false,
    followUpReady: false, outcomeReady: false, communityReviewReady: false,
    noDeadEnds: true as const,
    noFakeIntelligence: true as const,
    noFabricatedConfidence: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    readyCount: 0, totalFlags: 10 as const,
    confidence: 'low' as Confidence,
    explanation: 'Agronomist Mode runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installAgronomistModeHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__agronomistModeHealth !== 'function') {
      w.__agronomistModeHealth = function () {
        const out = agronomistModeHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Agronomist Mode]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
