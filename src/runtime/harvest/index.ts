/**
 * src/runtime/harvest/index.ts — Harvest Readiness suite barrel.
 *
 *   import {
 *     evaluate, isSupportedPlant,
 *     listEvaluationsForPlant, getLatestForPlant,
 *     getByIdempotencyKey,
 *     harvestReadinessHealth, installHarvestReadinessGlobal,
 *     HARVEST_RUNTIME_VERSION,
 *   } from 'src/runtime/harvest';
 *
 *   installHarvestReadinessGlobal();   // pins window.__harvestReadinessHealth
 *
 * Strict-rule audit
 *   • Pure composition barrel — no logic here.
 *   • Re-exports the contracts + facade + engines as needed.
 *   • SSR-safe. Never throws.
 */

export {
  evaluate, isSupportedPlant,
  listEvaluationsForPlant, getLatestForPlant,
  getByIdempotencyKey,
  harvestReadinessHealth, installHarvestReadinessGlobal,
  type EvaluateInput,
} from './HarvestReadinessRuntime';

export {
  evaluateRipeness, RIPENESS_ENGINE_VERSION,
  type RipenessInput, type RipenessOutput,
} from './RipenessEngine';

export {
  estimateHarvestWindow, HARVEST_STAGE_ENGINE_VERSION,
  type StageInput,
} from './HarvestStageEngine';

export {
  generateHarvestTasks, HARVEST_TASK_ENGINE_VERSION,
  type TaskInput,
} from './HarvestTaskEngine';

export {
  // Contracts re-exported as the canonical import surface.
  HARVEST_RUNTIME_VERSION,
  RIPENESS_STATUS, BLOOM_STAGE,
  HARVEST_CATEGORY, PLANT_CATEGORY,
  SUPPORTED_FRUITS, SUPPORTED_VEGETABLES, SUPPORTED_CROPS,
  SUPPORTED_FLOWERS, SUPPORTED_PLANTS,
  HARVEST_STORAGE_KEY, HARVEST_HISTORY_CAP,
  idemEvaluate, idemTask, idemArtifact,
  BANNED_WORDING, SAFE_VERBS,
  type RipenessStatusValue, type BloomStageValue,
  type HarvestCategoryValue,
  type HarvestRecommendedTask, type HarvestVisualSignals,
  type HarvestReadinessResult, type HarvestReadinessHealth,
  type PlantContext,
} from './harvestContracts';
