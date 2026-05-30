/**
 * src/runtime/growth/index.ts — Growth Stage suite barrel.
 *
 *   import { evaluate, growthStageHealth, installGrowthStageGlobal }
 *     from 'src/runtime/growth';
 *
 * Composition-only barrel — no logic.
 */

export {
  evaluate, getLatestStageForPlant,
  growthStageHealth, installGrowthStageGlobal,
  STAGES, type GrowthEvaluateInput,
} from './GrowthStageRuntime';

export {
  evaluatePlantStage, PLANT_STAGE_ENGINE_VERSION,
  type PlantStageInput, type PlantStageOutput,
} from './GrowthStageEngine';

export {
  evaluateCropStage, CROP_STAGE_ENGINE_VERSION,
  type CropStageInput, type CropStageOutput,
} from './CropStageEngine';

export {
  evaluateFlowerStage, FLOWER_STAGE_ENGINE_VERSION,
  type FlowerStageInput, type FlowerStageOutput,
} from './FlowerStageEngine';

export {
  GROWTH_RUNTIME_VERSION,
  PLANT_STAGE, CROP_STAGE, FLOWER_STAGE,
  STAGE_MODEL,
  GROWTH_STORAGE_KEY, GROWTH_HISTORY_CAP,
  type PlantStageValue, type CropStageValue, type FlowerStageValue,
  type StageValue, type StageModelValue,
  type GrowthStageResult, type GrowthStageHealth,
} from './growthContracts';
