/**
 * cropTaskTemplates.js — per-crop, per-stage overlays the today
 * engine uses as stage-relevance tie-breakers. Every title follows
 * the verb-first Verb+crop+action+timing pattern via the wording
 * helpers so wording stays consistent when new crops are added.
 */

import {
  buildPlantingTask, buildPestInspectionTask, buildFertilizerTask,
  buildHarvestTask, buildWateringTask, buildWeedControlTask,
} from './taskWordingHelpers.js';

/** Compose a stage entry from a helper output + an explicit priorityBoost. */
function stage(helperOutput, priorityBoost) {
  return {
    title: helperOutput.title,
    detail: helperOutput.detail,
    priorityBoost,
  };
}

export const CROP_TASK_TEMPLATES = Object.freeze({
  tomato: {
    planned: stage({
      title: 'Warm the soil before transplanting tomatoes',
      detail: 'Wait until soil is consistently above 60°F before you set out transplants.',
    }, 4),
    planting: stage(buildPlantingTask({ crop: 'tomato', stage: 'transplants', timing: 'this week' }), 8),
    growing: stage({
      title: 'Pinch suckers on tomatoes this week',
      detail: 'Remove side shoots in the leaf forks — channel energy to fruit, not new stems.',
    }, 5),
    flowering: stage({
      title: 'Ease nitrogen on tomatoes this week',
      detail: 'Too much nitrogen at flowering drops fruit. Keep water steady instead.',
    }, 6),
    harvest_ready: stage(
      buildHarvestTask({ crop: 'tomato', timing: 'today', cue: 'fruit is colored but still firm' }),
      9,
    ),
  },
  lettuce: {
    planned: stage({
      title: 'Prep a shaded bed for lettuce',
      detail: 'Lettuce bolts in heat — pick a spot that gets afternoon shade.',
    }, 3),
    planting: stage(buildPlantingTask({ crop: 'lettuce', stage: 'seeds', timing: 'this week' }), 7),
    growing: stage(buildWateringTask({ crop: 'lettuce', timing: 'today' }), 5),
    harvest_ready: stage(
      buildHarvestTask({ crop: 'lettuce', timing: 'today', cue: 'outer leaves are full-size' }),
      8,
    ),
  },
  peanut: {
    planned: stage({
      title: 'Till deep where you will plant peanuts',
      detail: 'Peanuts peg into loose soil — till at least 6 inches before planting.',
    }, 4),
    planting: stage(buildPlantingTask({ crop: 'peanut', stage: 'seeds', timing: 'this week' }), 8),
    growing: stage(buildWeedControlTask({ crop: 'peanut', timing: 'this week' }), 6),
    flowering: stage(buildWateringTask({ crop: 'peanut', timing: 'today', depth: 'deep' }), 7),
    harvest_ready: stage(
      buildHarvestTask({ crop: 'peanut', timing: 'this week', cue: 'shell veins darken' }),
      8,
    ),
  },
  sorghum: {
    planned: stage({
      title: 'Wait for 60°F soil before sowing sorghum',
      detail: 'Cold soil rots sorghum seed — hold off until soil warms up.',
    }, 3),
    planting: stage(buildPlantingTask({ crop: 'sorghum', stage: 'seeds', timing: 'this week' }), 7),
    growing: stage(buildPestInspectionTask({ crop: 'sorghum', timing: 'today', focus: 'rows' }), 5),
    flowering: stage(buildWateringTask({ crop: 'sorghum', timing: 'this week', depth: 'deep' }), 6),
    harvest_ready: stage(
      buildHarvestTask({ crop: 'sorghum', timing: 'this week', cue: 'grain shatters when pressed hard' }),
      8,
    ),
  },
  sweet_potato: {
    planned: stage({
      title: 'Mound the bed for sweet potato slips',
      detail: 'Plant slips into 8–10 inch mounds so the soil stays loose and warm.',
    }, 4),
    planting: stage(buildPlantingTask({ crop: 'sweet_potato', stage: 'slips', timing: 'this week' }), 8),
    growing: stage(buildWateringTask({ crop: 'sweet_potato', timing: 'this week', depth: 'deep' }), 5),
    harvest_ready: stage(
      buildHarvestTask({ crop: 'sweet_potato', timing: 'this week', cue: 'frost is coming — dig carefully and cure 10 days' }),
      8,
    ),
  },
});

export function getCropStageOverlay({ cropKey, stage }) {
  const byStage = CROP_TASK_TEMPLATES[cropKey];
  if (!byStage) return null;
  return byStage[stage] || null;
}

export const SUPPORTED_CROP_KEYS = Object.freeze(Object.keys(CROP_TASK_TEMPLATES));
