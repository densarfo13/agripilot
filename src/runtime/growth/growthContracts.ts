/**
 * src/runtime/growth/growthContracts.ts — Wave-29 Scan
 * Intelligence V2. Frozen types + stage enums for the Growth
 * Stage suite.
 *
 * Strict-rule audit
 *   • Pure data declarations.
 *   • Frozen everything exposed.
 *   • No PII.
 *   • Never throws.
 */

export const GROWTH_RUNTIME_VERSION = 'growth-stage-v1';

/** Generic plant stages (default model). */
export const PLANT_STAGE = Object.freeze({
  SEEDLING: 'seedling',
  YOUNG:    'young',
  MATURE:   'mature',
  UNKNOWN:  'unknown',
} as const);

/** Field-crop stages — six explicit lifecycle phases. */
export const CROP_STAGE = Object.freeze({
  EMERGENCE:      'emergence',
  VEGETATIVE:     'vegetative',
  FLOWERING:      'flowering',
  FRUITING:       'fruiting',
  GRAIN_FILL:     'grain_fill',
  HARVEST_READY:  'harvest_ready',
  UNKNOWN:        'unknown',
} as const);

/** Flower-specific stages. */
export const FLOWER_STAGE = Object.freeze({
  BUD:              'bud',
  BLOOMING:         'blooming',
  PEAK_BLOOM:       'peak_bloom',
  DECLINING_BLOOM:  'declining_bloom',
  UNKNOWN:          'unknown',
} as const);

export type PlantStageValue =
  typeof PLANT_STAGE[keyof typeof PLANT_STAGE];
export type CropStageValue =
  typeof CROP_STAGE[keyof typeof CROP_STAGE];
export type FlowerStageValue =
  typeof FLOWER_STAGE[keyof typeof FLOWER_STAGE];

export type StageValue = PlantStageValue | CropStageValue | FlowerStageValue;

/** Which model produced the stage classification. */
export const STAGE_MODEL = Object.freeze({
  PLANT:  'plant',
  CROP:   'crop',
  FLOWER: 'flower',
} as const);

export type StageModelValue =
  typeof STAGE_MODEL[keyof typeof STAGE_MODEL];

/** Result envelope. */
export interface GrowthStageResult {
  plantId:                  string;
  scanId:                   string;
  model:                    StageModelValue;
  stage:                    StageValue;
  confidence:               number; // 0-100
  nextExpectedStage?:       StageValue;
  estimatedDaysToNextStage?: number;
  needsReview:              boolean;
  timestamp:                string;
}

export interface GrowthStageHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  growthStageReady:         boolean;
  plantStagesReady:         boolean;
  cropStagesReady:          boolean;
  flowerStagesReady:        boolean;
}

export const GROWTH_STORAGE_KEY = 'farroway.growth.history';
export const GROWTH_HISTORY_CAP = 200;
