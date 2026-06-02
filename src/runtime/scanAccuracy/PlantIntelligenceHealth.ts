/**
 * PlantIntelligenceHealth.ts → window.__plantIntelligenceHealth().
 *
 * Top-level Scan V5 composite. Pins the 10 spec readiness flags over
 * the multi-source plant intelligence pipeline.
 *
 *   plantIdReady          ← __plantIdHealth probe presence
 *   plantNetReady         ← __plantNetHealth probe presence
 *   cropLibraryReady      ← __cropMatcherHealth (LocalCropMatcher)
 *   consensusReady        ← PlantConsensusRuntime.plantConsensusReady
 *   contextBoostingReady  ← FarmContextBiasRuntime.farmContextBiasReady
 *   diseaseReady          ← DiseaseAnalysisPipelineRuntime.diseasePipelineReady
 *   taskGenerationReady   ← ScanFollowUpRuntime.followUpTaskReady
 *   followUpReady         ← ScanFollowUpRuntime.followUpTaskReady
 *   escalationReady       ← ScanReviewHealth (community + officer + admin)
 *   outcomeReady          ← ScanOutcomeLoopRuntime.outcomeLoopReady
 */

import { plantConsensusReady } from './PlantConsensusRuntime';
import { farmContextBiasReady } from './FarmContextBiasRuntime';
import { diseasePipelineReady } from './DiseaseAnalysisPipelineRuntime';
import { followUpTaskReady } from './ScanFollowUpRuntime';
import { outcomeLoopReady } from './ScanOutcomeLoopRuntime';
import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

export const PLANT_INTELLIGENCE_VERSION = 'plant-intelligence-v1' as const;

export interface PlantIntelligenceHealthEnvelope {
  initialized: true;
  plantIdReady: boolean;
  plantNetReady: boolean;
  cropLibraryReady: boolean;
  consensusReady: boolean;
  contextBoostingReady: boolean;
  diseaseReady: boolean;
  taskGenerationReady: boolean;
  followUpReady: boolean;
  escalationReady: boolean;
  outcomeReady: boolean;
  noFakeIntelligence: true;
  noFabricatedConfidence: true;
  alwaysExposesLimitations: true;
  composedFrom: ReadonlyArray<string>;
  readyCount: number;
  totalFlags: 10;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function plantIntelligenceHealth()
  : Readonly<PlantIntelligenceHealthEnvelope> {
  return _safe(() => {
    const plantId = !!_probe('__plantIdHealth');
    const plantNet = !!_probe('__plantNetHealth');
    const cropLib = !!_probe('__cropMatcherHealth');
    const consensus = plantConsensusReady();
    const context = farmContextBiasReady();
    const disease = diseasePipelineReady();
    const task = followUpTaskReady();
    const follow = followUpTaskReady();
    const escalation = !!_probe('__scanReviewHealth')
      || !!_probe('__communityScanReviewHealth')
      || !!_probe('__fieldOfficerScanQueueHealth')
      || !!_probe('__adminScanReviewQueueHealth');
    const outcome = outcomeLoopReady();

    const readyCount = [
      plantId, plantNet, cropLib, consensus, context,
      disease, task, follow, escalation, outcome,
    ].filter(Boolean).length;

    return Object.freeze<PlantIntelligenceHealthEnvelope>({
      initialized: true,
      plantIdReady: plantId,
      plantNetReady: plantNet,
      cropLibraryReady: cropLib,
      consensusReady: consensus,
      contextBoostingReady: context,
      diseaseReady: disease,
      taskGenerationReady: task,
      followUpReady: follow,
      escalationReady: escalation,
      outcomeReady: outcome,
      noFakeIntelligence: true as const,
      noFabricatedConfidence: true as const,
      alwaysExposesLimitations: true as const,
      composedFrom: Object.freeze([
        '__plantIdHealth', '__plantNetHealth', '__cropMatcherHealth',
        'PlantConsensusRuntime', 'FarmContextBiasRuntime',
        'DiseaseAnalysisPipelineRuntime', 'ScanFollowUpRuntime',
        '__scanReviewHealth', 'ScanOutcomeLoopRuntime',
      ]) as ReadonlyArray<string>,
      readyCount,
      totalFlags: 10 as const,
      confidence: (readyCount >= 7 ? 'high' : readyCount >= 4 ? 'medium' : 'low') as Confidence,
      explanation:
        'Plant intelligence composite (Scan V5). Multi-source pipeline: Plant.id + PlantNet + ' +
        'crop library + consensus engine + farm-context bias (capped +30%) + disease pipeline + ' +
        'follow-up tasks + outcome capture + escalation to community/officer/admin review. ' +
        'Every result exposes confidence + limitations. No fake intelligence; no fabricated ' +
        'confidence; honest readiness flags only.',
      limitations:
        'Plant.id and PlantNet are deferred when their probes are absent; consensus then runs ' +
        'over crop library + farm context. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<PlantIntelligenceHealthEnvelope>({
    initialized: true,
    plantIdReady: false, plantNetReady: false, cropLibraryReady: false,
    consensusReady: false, contextBoostingReady: false, diseaseReady: false,
    taskGenerationReady: false, followUpReady: false,
    escalationReady: false, outcomeReady: false,
    noFakeIntelligence: true as const,
    noFabricatedConfidence: true as const,
    alwaysExposesLimitations: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    readyCount: 0, totalFlags: 10 as const,
    confidence: 'low' as Confidence,
    explanation: 'Plant intelligence runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installPlantIntelligenceHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__plantIntelligenceHealth !== 'function') {
      w.__plantIntelligenceHealth = function () {
        const out = plantIntelligenceHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Plant Intelligence]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
