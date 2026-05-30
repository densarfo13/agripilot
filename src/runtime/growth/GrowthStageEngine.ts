/**
 * src/runtime/growth/GrowthStageEngine.ts — generic plant-stage
 * classifier (Seedling / Young / Mature / Unknown).
 *
 * Pure deterministic. Never throws. SSR-safe via _safe.
 */

import {
  PLANT_STAGE, STAGE_MODEL,
  type PlantStageValue, type StageModelValue,
} from './growthContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().trim() : '';
}

export interface PlantStageInput {
  plantId:         string;
  lifecycleStage?: string;
  size?:           string;
  ageWeeks?:       number;
}

export interface PlantStageOutput {
  model:                    StageModelValue;
  stage:                    PlantStageValue;
  confidence:               number;
  nextExpectedStage?:       PlantStageValue;
  estimatedDaysToNextStage?: number;
  needsReview:              boolean;
}

const _NEXT: Readonly<Record<PlantStageValue, PlantStageValue | undefined>> =
  Object.freeze({
    [PLANT_STAGE.SEEDLING]: PLANT_STAGE.YOUNG,
    [PLANT_STAGE.YOUNG]:    PLANT_STAGE.MATURE,
    [PLANT_STAGE.MATURE]:   undefined,
    [PLANT_STAGE.UNKNOWN]:  undefined,
  });

const _DAYS_TO_NEXT: Readonly<Record<PlantStageValue, number | undefined>> =
  Object.freeze({
    [PLANT_STAGE.SEEDLING]: 28,
    [PLANT_STAGE.YOUNG]:    56,
    [PLANT_STAGE.MATURE]:   undefined,
    [PLANT_STAGE.UNKNOWN]:  undefined,
  });

export function evaluatePlantStage(input: PlantStageInput): PlantStageOutput {
  return _safe(() => {
    const stageStr = _lower(input.lifecycleStage);
    const size = _lower(input.size);
    const age  = typeof input.ageWeeks === 'number' ? input.ageWeeks : null;

    let stage: PlantStageValue = PLANT_STAGE.UNKNOWN;
    let conf = 35;

    if (stageStr.includes('seedling') || stageStr.includes('sprout')
        || stageStr.includes('emerg')) {
      stage = PLANT_STAGE.SEEDLING; conf = 75;
    } else if (stageStr.includes('young') || stageStr.includes('juvenile')
               || stageStr.includes('vegetative')) {
      stage = PLANT_STAGE.YOUNG; conf = 70;
    } else if (stageStr.includes('mature') || stageStr.includes('adult')
               || stageStr.includes('established')) {
      stage = PLANT_STAGE.MATURE; conf = 75;
    } else if (age !== null) {
      // Fallback to age-based heuristic.
      if (age < 4)       { stage = PLANT_STAGE.SEEDLING; conf = 60; }
      else if (age < 12) { stage = PLANT_STAGE.YOUNG;    conf = 55; }
      else               { stage = PLANT_STAGE.MATURE;   conf = 60; }
    } else if (size.includes('small') || size.includes('tiny')) {
      stage = PLANT_STAGE.SEEDLING; conf = 50;
    } else if (size.includes('large')) {
      stage = PLANT_STAGE.MATURE; conf = 50;
    }

    return Object.freeze({
      model: STAGE_MODEL.PLANT,
      stage,
      confidence: Math.max(0, Math.min(100, conf)),
      nextExpectedStage: _NEXT[stage],
      estimatedDaysToNextStage: _DAYS_TO_NEXT[stage],
      needsReview: stage === PLANT_STAGE.UNKNOWN,
    });
    void input.plantId; // reserved for plant-specific overrides
  }, Object.freeze({
    model: STAGE_MODEL.PLANT,
    stage: PLANT_STAGE.UNKNOWN,
    confidence: 0,
    needsReview: true,
  }));
}

export const PLANT_STAGE_ENGINE_VERSION = 'plant-stage-engine-v1';
