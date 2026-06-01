/**
 * DailyAssistantContracts.ts — pure types + constants for the daily-assistant
 * task chain. NO window global. NO install function. Zero imports.
 *
 * Source of truth for stage / status / task shape used by the unlock rules,
 * chain runtime, and top-level composite. Frozen exports.
 *
 * > Decision support, not a guarantee.
 */

export const DAILY_ASSISTANT_CONTRACTS_VERSION = 'daily-assistant-contracts-v1' as const;
export const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export type TaskStage =
  | 'setup' | 'planning' | 'land_prep' | 'planting' | 'early_growth'
  | 'monitoring' | 'care' | 'scan_followup' | 'harvest' | 'post_harvest' | 'sell';

export const TASK_STAGES: ReadonlyArray<TaskStage> = Object.freeze([
  'setup', 'planning', 'land_prep', 'planting', 'early_growth',
  'monitoring', 'care', 'scan_followup', 'harvest', 'post_harvest', 'sell',
]);

export type TaskStatus = 'locked' | 'active' | 'upcoming' | 'completed' | 'skipped';

export interface AssistantTask {
  id: string;
  titleKey: string;
  titleDefault: string;
  stage: TaskStage;
  status: TaskStatus;
  estimatedTime: string;
  why: string;
  requiresData?: ReadonlyArray<string>;
  scanRelevant?: boolean;
  dueAt?: number | null;
  idempotencyKey: string;
}

/** Default beginner chain. Frozen at module load. */
export const DEFAULT_BEGINNER_CHAIN: ReadonlyArray<AssistantTask> = Object.freeze([
  Object.freeze({
    id: 'assist_pick_crop',
    titleKey: 'simple.assistant.pickCrop',
    titleDefault: 'Pick a crop',
    stage: 'setup' as const,
    status: 'active' as const,
    estimatedTime: '2 min',
    why: 'Pick a crop so we can build your daily plan.',
    requiresData: Object.freeze(['crop']) as ReadonlyArray<string>,
    scanRelevant: false,
    dueAt: null,
    idempotencyKey: 'assist:pick_crop',
  }),
  Object.freeze({
    id: 'assist_add_planting_date',
    titleKey: 'simple.assistant.addPlantingDate',
    titleDefault: 'Add planting date',
    stage: 'planning' as const,
    status: 'locked' as const,
    estimatedTime: '1 min',
    why: 'A planting date unlocks accurate timing for every step.',
    requiresData: Object.freeze(['planting_date']) as ReadonlyArray<string>,
    scanRelevant: false,
    dueAt: null,
    idempotencyKey: 'assist:add_planting_date',
  }),
  Object.freeze({
    id: 'assist_prepare_ground',
    titleKey: 'simple.assistant.prepareGround',
    titleDefault: 'Prepare ground',
    stage: 'land_prep' as const,
    status: 'locked' as const,
    estimatedTime: '30 min',
    why: 'Clean, loose soil helps seeds germinate well.',
    requiresData: undefined,
    scanRelevant: false,
    dueAt: null,
    idempotencyKey: 'assist:prepare_ground',
  }),
  Object.freeze({
    id: 'assist_plant_crop',
    titleKey: 'simple.assistant.plantCrop',
    titleDefault: 'Plant crop',
    stage: 'planting' as const,
    status: 'locked' as const,
    estimatedTime: '20 min',
    why: 'Plant on the right day so the season tracks correctly.',
    requiresData: undefined,
    scanRelevant: false,
    dueAt: null,
    idempotencyKey: 'assist:plant_crop',
  }),
  Object.freeze({
    id: 'assist_water_crop',
    titleKey: 'simple.assistant.waterCrop',
    titleDefault: 'Water crop',
    stage: 'early_growth' as const,
    status: 'locked' as const,
    estimatedTime: '5 min',
    why: 'Steady water in the first weeks builds strong roots.',
    requiresData: undefined,
    scanRelevant: false,
    dueAt: null,
    idempotencyKey: 'assist:water_crop',
  }),
  Object.freeze({
    id: 'assist_monitor_growth',
    titleKey: 'simple.assistant.monitorGrowth',
    titleDefault: 'Monitor growth',
    stage: 'monitoring' as const,
    status: 'locked' as const,
    estimatedTime: '5 min',
    why: 'Catch problems early — a quick look saves a season.',
    requiresData: undefined,
    scanRelevant: true,
    dueAt: null,
    idempotencyKey: 'assist:monitor_growth',
  }),
  Object.freeze({
    id: 'assist_scan_leaves',
    titleKey: 'simple.assistant.scanLeaves',
    titleDefault: 'Scan leaves',
    stage: 'scan_followup' as const,
    status: 'locked' as const,
    estimatedTime: '3 min',
    why: 'A scan picks up disease and pests early.',
    requiresData: undefined,
    scanRelevant: true,
    dueAt: null,
    idempotencyKey: 'assist:scan_leaves',
  }),
  Object.freeze({
    id: 'assist_harvest',
    titleKey: 'simple.assistant.harvest',
    titleDefault: 'Harvest',
    stage: 'harvest' as const,
    status: 'locked' as const,
    estimatedTime: '60 min',
    why: 'Harvest at the right time for the best produce.',
    requiresData: undefined,
    scanRelevant: false,
    dueAt: null,
    idempotencyKey: 'assist:harvest',
  }),
  Object.freeze({
    id: 'assist_post_harvest',
    titleKey: 'simple.assistant.postHarvest',
    titleDefault: 'Post-harvest check',
    stage: 'post_harvest' as const,
    status: 'locked' as const,
    estimatedTime: '15 min',
    why: 'Sort and store carefully to keep produce fresh.',
    requiresData: undefined,
    scanRelevant: false,
    dueAt: null,
    idempotencyKey: 'assist:post_harvest',
  }),
  Object.freeze({
    id: 'assist_sell_produce',
    titleKey: 'simple.assistant.sellProduce',
    titleDefault: 'Sell produce',
    stage: 'sell' as const,
    status: 'locked' as const,
    estimatedTime: '10 min',
    why: 'List your produce when it is ready and buyers nearby can see it.',
    requiresData: undefined,
    scanRelevant: false,
    dueAt: null,
    idempotencyKey: 'assist:sell_produce',
  }),
]);

export const OUTCOME_STATUSES: ReadonlyArray<string> =
  Object.freeze(['improved', 'unchanged', 'worsened', 'unknown']);

/** Stable 4-kind artifact list the UI layer writes through ArtifactRuntime. */
export const DAILY_ASSISTANT_ARTIFACT_KINDS: ReadonlyArray<string> = Object.freeze([
  'DailyAssistantTaskShown',
  'DailyAssistantTaskCompleted',
  'DailyAssistantTaskSkipped',
  'DailyAssistantNextTaskUnlocked',
]);
