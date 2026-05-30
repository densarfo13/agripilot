/**
 * src/runtime/growth/CropStageEngine.ts — six-phase crop stage
 * classifier (Emergence → Vegetative → Flowering → Fruiting →
 * Grain Fill → Harvest Ready).
 *
 * Pure deterministic. Never throws.
 */

import {
  CROP_STAGE, STAGE_MODEL,
  type CropStageValue, type StageModelValue,
} from './growthContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().trim() : '';
}

export interface CropStageInput {
  plantId:         string;
  lifecycleStage?: string;
  weeksSincePlanting?: number;
  scanCategory?:   string;
  color?:          string;
}

export interface CropStageOutput {
  model:                    StageModelValue;
  stage:                    CropStageValue;
  confidence:               number;
  nextExpectedStage?:       CropStageValue;
  estimatedDaysToNextStage?: number;
  needsReview:              boolean;
}

const _NEXT: Readonly<Record<CropStageValue, CropStageValue | undefined>> =
  Object.freeze({
    [CROP_STAGE.EMERGENCE]:     CROP_STAGE.VEGETATIVE,
    [CROP_STAGE.VEGETATIVE]:    CROP_STAGE.FLOWERING,
    [CROP_STAGE.FLOWERING]:     CROP_STAGE.FRUITING,
    [CROP_STAGE.FRUITING]:      CROP_STAGE.GRAIN_FILL,
    [CROP_STAGE.GRAIN_FILL]:    CROP_STAGE.HARVEST_READY,
    [CROP_STAGE.HARVEST_READY]: undefined,
    [CROP_STAGE.UNKNOWN]:       undefined,
  });

const _DAYS_TO_NEXT: Readonly<Record<CropStageValue, number | undefined>> =
  Object.freeze({
    [CROP_STAGE.EMERGENCE]:     14,
    [CROP_STAGE.VEGETATIVE]:    28,
    [CROP_STAGE.FLOWERING]:     14,
    [CROP_STAGE.FRUITING]:      21,
    [CROP_STAGE.GRAIN_FILL]:    14,
    [CROP_STAGE.HARVEST_READY]: undefined,
    [CROP_STAGE.UNKNOWN]:       undefined,
  });

/**
 * Per-crop expected stage by weeks since planting. Pure
 * approximation — confidence is dampened when the runtime falls
 * back to this table without a lifecycleStage signal.
 */
function _expectedStageByWeeks(plantId: string, weeks: number): CropStageValue {
  const pid = plantId;
  // Maize: ~12-14 weeks total
  if (pid === 'maize' || pid === 'corn') {
    if (weeks < 2)  return CROP_STAGE.EMERGENCE;
    if (weeks < 6)  return CROP_STAGE.VEGETATIVE;
    if (weeks < 9)  return CROP_STAGE.FLOWERING;
    if (weeks < 11) return CROP_STAGE.GRAIN_FILL;
    return CROP_STAGE.HARVEST_READY;
  }
  // Rice: ~16-20 weeks
  if (pid === 'rice') {
    if (weeks < 2)  return CROP_STAGE.EMERGENCE;
    if (weeks < 8)  return CROP_STAGE.VEGETATIVE;
    if (weeks < 12) return CROP_STAGE.FLOWERING;
    if (weeks < 17) return CROP_STAGE.GRAIN_FILL;
    return CROP_STAGE.HARVEST_READY;
  }
  // Tomato / pepper: ~14-16 weeks
  if (pid === 'tomato' || pid === 'pepper') {
    if (weeks < 2)  return CROP_STAGE.EMERGENCE;
    if (weeks < 6)  return CROP_STAGE.VEGETATIVE;
    if (weeks < 9)  return CROP_STAGE.FLOWERING;
    if (weeks < 14) return CROP_STAGE.FRUITING;
    return CROP_STAGE.HARVEST_READY;
  }
  // Generic fallback for fruiting crops.
  if (weeks < 2)  return CROP_STAGE.EMERGENCE;
  if (weeks < 6)  return CROP_STAGE.VEGETATIVE;
  if (weeks < 10) return CROP_STAGE.FLOWERING;
  if (weeks < 14) return CROP_STAGE.FRUITING;
  return CROP_STAGE.HARVEST_READY;
}

export function evaluateCropStage(input: CropStageInput): CropStageOutput {
  return _safe(() => {
    const pid = _lower(input.plantId);
    const stageStr = _lower(input.lifecycleStage);
    const cat = _lower(input.scanCategory);
    const col = _lower(input.color);
    const weeks = typeof input.weeksSincePlanting === 'number'
                ? input.weeksSincePlanting : null;

    let stage: CropStageValue = CROP_STAGE.UNKNOWN;
    let conf = 35;

    // Direct stage keywords from the scan/profile signals.
    if (stageStr.includes('emerg')) {
      stage = CROP_STAGE.EMERGENCE; conf = 75;
    } else if (stageStr.includes('vegetative') || stageStr.includes('leaf')) {
      stage = CROP_STAGE.VEGETATIVE; conf = 75;
    } else if (stageStr.includes('flower') || stageStr.includes('tassel')
               || stageStr.includes('bloom')) {
      stage = CROP_STAGE.FLOWERING; conf = 75;
    } else if (stageStr.includes('fruit') || stageStr.includes('pod')) {
      stage = CROP_STAGE.FRUITING; conf = 75;
    } else if (stageStr.includes('grain') || stageStr.includes('milk')
               || stageStr.includes('dough')) {
      stage = CROP_STAGE.GRAIN_FILL; conf = 75;
    } else if (stageStr.includes('harvest') || stageStr.includes('mature')
               || col.includes('brown silk') || col.includes('gold')) {
      stage = CROP_STAGE.HARVEST_READY; conf = 75;
    } else if (cat === 'yellowing'
               && (pid === 'soybean' || pid === 'groundnut')) {
      // Leaf yellowing on legumes is a maturity signal.
      stage = CROP_STAGE.HARVEST_READY; conf = 55;
    } else if (weeks !== null) {
      stage = _expectedStageByWeeks(pid, weeks);
      conf = 50;            // dampened — no direct visual signal
    }

    return Object.freeze({
      model: STAGE_MODEL.CROP,
      stage,
      confidence: Math.max(0, Math.min(100, conf)),
      nextExpectedStage: _NEXT[stage],
      estimatedDaysToNextStage: _DAYS_TO_NEXT[stage],
      needsReview: stage === CROP_STAGE.UNKNOWN,
    });
  }, Object.freeze({
    model: STAGE_MODEL.CROP,
    stage: CROP_STAGE.UNKNOWN,
    confidence: 0,
    needsReview: true,
  }));
}

export const CROP_STAGE_ENGINE_VERSION = 'crop-stage-engine-v1';
