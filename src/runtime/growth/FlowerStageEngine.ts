/**
 * src/runtime/growth/FlowerStageEngine.ts — four-phase flower
 * stage classifier (Bud → Blooming → Peak Bloom → Declining Bloom).
 *
 * Pure deterministic. Never throws.
 */

import {
  FLOWER_STAGE, STAGE_MODEL,
  type FlowerStageValue, type StageModelValue,
} from './growthContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().trim() : '';
}

function _hasAny(arr: ReadonlyArray<string> | undefined, needles: string[]): boolean {
  if (!Array.isArray(arr)) return false;
  for (const a of arr) {
    const al = _lower(a);
    for (const n of needles) if (al.includes(n)) return true;
  }
  return false;
}

export interface FlowerStageInput {
  plantId:         string;
  lifecycleStage?: string;
  color?:          string;
  defects?:        ReadonlyArray<string>;
}

export interface FlowerStageOutput {
  model:                    StageModelValue;
  stage:                    FlowerStageValue;
  confidence:               number;
  nextExpectedStage?:       FlowerStageValue;
  estimatedDaysToNextStage?: number;
  needsReview:              boolean;
}

const _NEXT: Readonly<Record<FlowerStageValue, FlowerStageValue | undefined>> =
  Object.freeze({
    [FLOWER_STAGE.BUD]:              FLOWER_STAGE.BLOOMING,
    [FLOWER_STAGE.BLOOMING]:         FLOWER_STAGE.PEAK_BLOOM,
    [FLOWER_STAGE.PEAK_BLOOM]:       FLOWER_STAGE.DECLINING_BLOOM,
    [FLOWER_STAGE.DECLINING_BLOOM]:  undefined,
    [FLOWER_STAGE.UNKNOWN]:          undefined,
  });

const _DAYS_TO_NEXT: Readonly<Record<FlowerStageValue, number | undefined>> =
  Object.freeze({
    [FLOWER_STAGE.BUD]:              5,
    [FLOWER_STAGE.BLOOMING]:         3,
    [FLOWER_STAGE.PEAK_BLOOM]:       3,
    [FLOWER_STAGE.DECLINING_BLOOM]:  undefined,
    [FLOWER_STAGE.UNKNOWN]:          undefined,
  });

export function evaluateFlowerStage(input: FlowerStageInput): FlowerStageOutput {
  return _safe(() => {
    const stageStr = _lower(input.lifecycleStage);
    const col = _lower(input.color);

    let stage: FlowerStageValue = FLOWER_STAGE.UNKNOWN;
    let conf = 35;

    if (stageStr.includes('bud') || col.includes('green bud')) {
      stage = FLOWER_STAGE.BUD; conf = 70;
    } else if (stageStr.includes('peak') || stageStr.includes('full bloom')) {
      stage = FLOWER_STAGE.PEAK_BLOOM; conf = 75;
    } else if (stageStr.includes('blooming') || stageStr.includes('open')) {
      stage = FLOWER_STAGE.BLOOMING; conf = 70;
    } else if (stageStr.includes('declining') || stageStr.includes('wilt')
               || stageStr.includes('past')
               || _hasAny(input.defects, ['petal drop', 'wilt'])) {
      stage = FLOWER_STAGE.DECLINING_BLOOM; conf = 60;
    }

    return Object.freeze({
      model: STAGE_MODEL.FLOWER,
      stage,
      confidence: Math.max(0, Math.min(100, conf)),
      nextExpectedStage: _NEXT[stage],
      estimatedDaysToNextStage: _DAYS_TO_NEXT[stage],
      needsReview: stage === FLOWER_STAGE.UNKNOWN,
    });
    void input.plantId; // reserved
  }, Object.freeze({
    model: STAGE_MODEL.FLOWER,
    stage: FLOWER_STAGE.UNKNOWN,
    confidence: 0,
    needsReview: true,
  }));
}

export const FLOWER_STAGE_ENGINE_VERSION = 'flower-stage-engine-v1';
