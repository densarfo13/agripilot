/**
 * Crop Definitions — canonical, extensible crop model.
 *
 * V2 contract (spec §3 / §10): the engine is crop-agnostic. MAIZE is
 * the first fully production-ready crop; other crops plug in by
 * appending to CROP_DEFINITIONS with the same shape. UI never hardcodes
 * MAIZE — it consults the definition via `getCropDefinition(code)`.
 *
 * Each definition shape:
 *   {
 *     cropId, nameKey, icon,
 *     difficulty, durationDays, waterNeed, costLevel, laborLevel, marketPotential,
 *     stages: [orderedStageIds],
 *     stageTaskMap: { [stageId]: [taskDefs] },
 *     risks: [i18nKeys],
 *     needs: [i18nKeys],
 *     timingRules: [TBD — matched by autopilot rules today],
 *   }
 *
 * Task defs carry step-by-step guidance and farmer tips:
 *   {
 *     type, titleKey,
 *     whyKey, timingKey, riskKey, outcomeKey,
 *     urgency, priority, icon,
 *     stepsKey?, tipsKey?,
 *     finishTitleKey?,   // adaptive repetition (spec §6)
 *     nextTaskType?,
 *   }
 *
 * All human-facing strings go through i18n. No English lives here.
 */

// ─── MAIZE — the V2 reference crop ────────────────────────
// 22 tasks across 7 lifecycle stages, each with steps and tips.
// The stage order is the canonical progression; the engine moves
// through this list as completed tasks accumulate.

const MAIZE = {
  cropId: 'MAIZE',
  nameKey: 'crop.maize',
  icon: '\uD83C\uDF3D',
  status: 'supported',
  difficulty: 'beginner',
  durationDays: 112, // ~16 weeks
  waterNeed: 'moderate',
  costLevel: 'low',
  laborLevel: 'moderate',
  marketPotential: 'good',
  stages: ['land_preparation', 'planting', 'germination', 'vegetative', 'flowering', 'harvest', 'post_harvest'],
  needs: ['seeds', 'fertilizer', 'water', 'labor', 'basic_tools'],
  risks: ['drought', 'pests', 'disease', 'poor_storage', 'low_market_price'],

  stageTaskMap: {
    land_preparation: [
      {
        type: 'clear_field', titleKey: 'cropTask.maize.clearField',
        finishTitleKey: 'cropTask.maize.finishClearField',
        completeNowTitleKey: 'cropTask.maize.completeNowClearField',
        whyKey: 'why.plant.rightTiming', timingKey: 'timing.earlyThisWeek',
        riskKey: 'risk.plant.missWindow', outcomeKey: 'outcome.maize.cleared',
        stepsKey: 'steps.maize.clearField', tipsKey: 'tips.maize.clearField',
        urgency: 'this_week', priority: 'high', icon: '\uD83E\uDE93',
      },
      {
        type: 'loosen_soil', titleKey: 'cropTask.maize.loosenSoil',
        finishTitleKey: 'cropTask.maize.finishLoosenSoil',
        completeNowTitleKey: 'cropTask.maize.completeNowLoosenSoil',
        whyKey: 'why.landPrep.readySoil', timingKey: 'timing.doToday',
        riskKey: 'risk.landPrep.delayedPlanting', outcomeKey: 'outcome.maize.soilLoose',
        stepsKey: 'steps.maize.loosenSoil', tipsKey: 'tips.maize.loosenSoil',
        urgency: 'today', priority: 'high', icon: '\uD83D\uDE9C',
      },
      {
        type: 'mark_rows', titleKey: 'cropTask.maize.markRows',
        finishTitleKey: 'cropTask.maize.finishMarkRows',
        completeNowTitleKey: 'cropTask.maize.completeNowMarkRows',
        whyKey: 'why.plant.rightTiming', timingKey: 'timing.doToday',
        riskKey: 'risk.plant.missWindow', outcomeKey: 'outcome.maize.rowsMarked',
        stepsKey: 'steps.maize.markRows', tipsKey: 'tips.maize.markRows',
        urgency: 'today', priority: 'medium', icon: '\uD83D\uDCCF',
      },
      {
        type: 'gather_inputs', titleKey: 'cropTask.maize.gatherInputs',
        whyKey: 'why.landPrep.readySoil', timingKey: 'timing.earlyThisWeek',
        riskKey: 'risk.landPrep.delayedPlanting', outcomeKey: 'outcome.maize.inputsReady',
        stepsKey: 'steps.maize.gatherInputs', tipsKey: 'tips.maize.gatherInputs',
        urgency: 'this_week', priority: 'medium', icon: '\uD83D\uDED2',
      },
    ],

    planting: [
      {
        type: 'plant_seeds', titleKey: 'cropTask.maize.plantSeeds',
        whyKey: 'why.plant.rightTiming', timingKey: 'timing.doToday',
        riskKey: 'risk.plant.missWindow', outcomeKey: 'outcome.maize.planted',
        stepsKey: 'steps.maize.plantSeeds', tipsKey: 'tips.maize.plantSeeds',
        urgency: 'today', priority: 'high', icon: '\uD83C\uDF31',
      },
      {
        type: 'water_after_planting', titleKey: 'cropTask.maize.waterAfterPlanting',
        whyKey: 'why.water.supportGrowth', timingKey: 'timing.doToday',
        riskKey: 'risk.water.stuntedGrowth', outcomeKey: 'outcome.maize.watered',
        stepsKey: 'steps.maize.waterAfterPlanting', tipsKey: 'tips.maize.waterAfterPlanting',
        urgency: 'today', priority: 'high', icon: '\uD83D\uDCA7',
      },
      {
        type: 'confirm_spacing', titleKey: 'cropTask.maize.confirmSpacing',
        whyKey: 'why.plant.rightTiming', timingKey: 'timing.earlyThisWeek',
        riskKey: 'risk.plant.missWindow', outcomeKey: 'outcome.maize.spacingGood',
        stepsKey: 'steps.maize.confirmSpacing',
        urgency: 'this_week', priority: 'low', icon: '\uD83D\uDCCF',
      },
    ],

    germination: [
      {
        type: 'check_germination', titleKey: 'cropTask.maize.checkGermination',
        whyKey: 'why.water.supportGrowth', timingKey: 'timing.earlyThisWeek',
        riskKey: 'risk.water.stuntedGrowth', outcomeKey: 'outcome.maize.germinated',
        stepsKey: 'steps.maize.checkGermination',
        urgency: 'this_week', priority: 'high', icon: '\uD83C\uDF3F',
      },
      {
        type: 'first_weeding', titleKey: 'cropTask.maize.firstWeeding',
        whyKey: 'why.weed.reduceCompetition', timingKey: 'timing.beforeWeedsGrow',
        riskKey: 'risk.weed.yieldReduction', outcomeKey: 'outcome.maize.weedCleared',
        stepsKey: 'steps.maize.firstWeeding',
        urgency: 'this_week', priority: 'medium', icon: '\uD83C\uDF3E',
      },
      {
        type: 'monitor_water', titleKey: 'cropTask.maize.monitorWater',
        whyKey: 'why.water.supportGrowth', timingKey: 'timing.heatIsHighToday',
        riskKey: 'risk.water.yieldDropIfDry', outcomeKey: 'outcome.maize.moistureOk',
        stepsKey: 'steps.maize.monitorWater',
        urgency: 'today', priority: 'medium', icon: '\uD83D\uDCA7',
      },
    ],

    vegetative: [
      {
        type: 'apply_fertilizer', titleKey: 'cropTask.maize.applyFertilizer',
        whyKey: 'why.fertilize.boostNutrients', timingKey: 'timing.feedDuringGrowth',
        riskKey: 'risk.fertilize.poorGrowth', outcomeKey: 'outcome.maize.fertilized',
        stepsKey: 'steps.maize.applyFertilizer', tipsKey: 'tips.maize.applyFertilizer',
        urgency: 'this_week', priority: 'high', icon: '\uD83E\uDDEA',
      },
      {
        type: 'weed_field', titleKey: 'cropTask.maize.weedField',
        whyKey: 'why.weed.reduceCompetition', timingKey: 'timing.beforeWeedsGrow',
        riskKey: 'risk.weed.yieldReduction', outcomeKey: 'outcome.maize.weedCleared',
        urgency: 'this_week', priority: 'medium', icon: '\uD83C\uDF3E',
      },
      {
        type: 'check_pests', titleKey: 'cropTask.maize.checkPests',
        whyKey: 'why.pest.catchEarly', timingKey: 'timing.regularCheckProtects',
        riskKey: 'risk.pest.spreadFast', outcomeKey: 'outcome.maize.pestOk',
        tipsKey: 'tips.maize.checkPests',
        urgency: 'this_week', priority: 'medium', icon: '\uD83D\uDC1B',
      },
      {
        type: 'monitor_water', titleKey: 'cropTask.maize.monitorWater',
        whyKey: 'why.water.supportGrowth', timingKey: 'timing.heatIsHighToday',
        riskKey: 'risk.water.yieldDropIfDry', outcomeKey: 'outcome.maize.moistureOk',
        urgency: 'today', priority: 'medium', icon: '\uD83D\uDCA7',
      },
    ],

    flowering: [
      {
        type: 'monitor_water', titleKey: 'cropTask.maize.monitorWaterFlower',
        whyKey: 'why.water.reduceCropStress', timingKey: 'timing.heatIsHighToday',
        riskKey: 'risk.water.yieldDropIfDry', outcomeKey: 'outcome.maize.moistureOk',
        urgency: 'today', priority: 'high', icon: '\uD83D\uDCA7',
      },
      {
        type: 'check_pests', titleKey: 'cropTask.maize.checkPests',
        whyKey: 'why.pest.catchEarly', timingKey: 'timing.actNowBeforeSpread',
        riskKey: 'risk.pest.spreadFast', outcomeKey: 'outcome.maize.pestOk',
        urgency: 'today', priority: 'high', icon: '\uD83D\uDC1B',
      },
      {
        type: 'apply_fertilizer', titleKey: 'cropTask.maize.topDress',
        whyKey: 'why.fertilize.boostNutrients', timingKey: 'timing.feedDuringGrowth',
        riskKey: 'risk.fertilize.poorGrowth', outcomeKey: 'outcome.maize.fertilized',
        urgency: 'this_week', priority: 'medium', icon: '\uD83E\uDDEA',
      },
    ],

    harvest: [
      {
        type: 'harvest_crop', titleKey: 'cropTask.maize.harvest',
        whyKey: 'why.harvest.preserveQuality', timingKey: 'timing.harvestWhenReady',
        riskKey: 'risk.harvest.overRipening', outcomeKey: 'outcome.maize.harvested',
        stepsKey: 'steps.maize.harvest', tipsKey: 'tips.maize.harvest',
        urgency: 'today', priority: 'high', icon: '\uD83E\uDDFA',
        nextTaskType: 'sort_harvest',
      },
      {
        type: 'sort_harvest', titleKey: 'cropTask.maize.sortHarvest',
        whyKey: 'why.sort.betterPrice', timingKey: 'timing.soonAfterHarvest',
        riskKey: 'risk.sort.qualityLoss', outcomeKey: 'outcome.maize.sorted',
        urgency: 'this_week', priority: 'medium', icon: '\uD83D\uDCE6',
      },
      {
        type: 'protect_harvest_from_rain', titleKey: 'cropTask.maize.protectFromRain',
        whyKey: 'why.rain.avoidDamage', timingKey: 'timing.beforeRainArrives',
        riskKey: 'risk.rain.uncoveredHarvest', outcomeKey: 'outcome.maize.protected',
        stepsKey: 'steps.maize.protectFromRain',
        urgency: 'critical', priority: 'high', icon: '\u2602\uFE0F',
      },
    ],

    post_harvest: [
      {
        type: 'dry_harvest', titleKey: 'cropTask.maize.dryHarvest',
        whyKey: 'why.drying.preventMold', timingKey: 'timing.whileConditionsDry',
        riskKey: 'risk.drying.spoilageIfDelayed', outcomeKey: 'outcome.maize.dried',
        stepsKey: 'steps.maize.dryHarvest', tipsKey: 'tips.maize.dryHarvest',
        urgency: 'today', priority: 'high', icon: '\u2600\uFE0F',
      },
      {
        type: 'store_harvest', titleKey: 'cropTask.maize.storeHarvest',
        whyKey: 'why.store.preventLoss', timingKey: 'timing.beforeQualityDrops',
        riskKey: 'risk.store.postHarvestLoss', outcomeKey: 'outcome.maize.stored',
        stepsKey: 'steps.maize.storeHarvest',
        urgency: 'this_week', priority: 'high', icon: '\uD83D\uDCE6',
      },
      {
        type: 'log_harvest', titleKey: 'cropTask.maize.logHarvest',
        whyKey: 'why.sort.betterPrice', timingKey: 'timing.soonAfterHarvest',
        riskKey: 'risk.sort.qualityLoss', outcomeKey: 'outcome.maize.logged',
        urgency: 'this_week', priority: 'medium', icon: '\uD83D\uDCDD',
      },
      {
        type: 'prepare_for_sale', titleKey: 'cropTask.maize.prepareForSale',
        whyKey: 'why.sort.betterPrice', timingKey: 'timing.beforeQualityDrops',
        riskKey: 'risk.sort.qualityLoss', outcomeKey: 'outcome.maize.readyForSale',
        urgency: 'optional', priority: 'low', icon: '\uD83D\uDCB0',
      },
    ],
  },
};

// ─── TOMATO — beta crop ────────────────────────────────────
// Smaller task library than MAIZE. status='beta' lights up the
// Testing / Beta badge in the UI and triggers the beta confirm modal.
const TOMATO = {
  cropId: 'TOMATO',
  nameKey: 'crop.tomato',
  icon: '\uD83C\uDF45',
  status: 'beta',
  difficulty: 'moderate',
  durationDays: 90,
  waterNeed: 'high',
  costLevel: 'moderate',
  laborLevel: 'moderate',
  marketPotential: 'good',
  stages: ['land_preparation', 'planting', 'vegetative', 'harvest'],
  needs: ['seedlings', 'fertilizer', 'water', 'labor', 'basic_tools'],
  risks: ['pests', 'disease', 'drought', 'low_market_price'],
  stageTaskMap: {
    land_preparation: [
      {
        type: 'clear_land', titleKey: 'task.tomato.clear_land.title',
        whyKey: 'task.tomato.clear_land.why', timingKey: 'task.tomato.clear_land.timing',
        outcomeKey: 'task.tomato.clear_land.outcome',
        stepsKey: 'task.tomato.clear_land.steps', tipsKey: 'task.tomato.clear_land.tips',
        urgency: 'this_week', priority: 'medium', icon: '\uD83E\uDE93',
      },
      {
        type: 'prepare_soil', titleKey: 'task.tomato.prepare_soil.title',
        whyKey: 'task.tomato.prepare_soil.why', timingKey: 'task.tomato.prepare_soil.timing',
        outcomeKey: 'task.tomato.prepare_soil.outcome',
        stepsKey: 'task.tomato.prepare_soil.steps', tipsKey: 'task.tomato.prepare_soil.tips',
        urgency: 'this_week', priority: 'medium', icon: '\uD83D\uDE9C',
      },
    ],
    planting: [
      {
        type: 'plant_seedlings', titleKey: 'task.tomato.plant_seedlings.title',
        whyKey: 'task.tomato.plant_seedlings.why', timingKey: 'task.tomato.plant_seedlings.timing',
        outcomeKey: 'task.tomato.plant_seedlings.outcome',
        stepsKey: 'task.tomato.plant_seedlings.steps', tipsKey: 'task.tomato.plant_seedlings.tips',
        urgency: 'this_week', priority: 'high', icon: '\uD83C\uDF31',
      },
    ],
    vegetative: [
      {
        type: 'water_plants', titleKey: 'task.tomato.water.title',
        whyKey: 'task.tomato.water.why', timingKey: 'task.tomato.water.timing',
        outcomeKey: 'task.tomato.water.outcome',
        stepsKey: 'task.tomato.water.steps', tipsKey: 'task.tomato.water.tips',
        urgency: 'today', priority: 'high', icon: '\uD83D\uDCA7',
      },
      {
        type: 'check_pests', titleKey: 'task.tomato.pests.title',
        whyKey: 'task.tomato.pests.why', timingKey: 'task.tomato.pests.timing',
        riskKey: 'task.tomato.pests.risk',
        outcomeKey: 'task.tomato.pests.outcome',
        stepsKey: 'task.tomato.pests.steps',
        urgency: 'today', priority: 'medium', icon: '\uD83D\uDC1B',
      },
    ],
    harvest: [
      {
        type: 'harvest', titleKey: 'task.tomato.harvest.title',
        whyKey: 'task.tomato.harvest.why', timingKey: 'task.tomato.harvest.timing',
        outcomeKey: 'task.tomato.harvest.outcome',
        stepsKey: 'task.tomato.harvest.steps', tipsKey: 'task.tomato.harvest.tips',
        urgency: 'this_week', priority: 'medium', icon: '\uD83E\uDDFA',
      },
    ],
  },
};

// ─── PEPPER — beta crop ────────────────────────────────────
const PEPPER = {
  cropId: 'PEPPER',
  nameKey: 'crop.pepper',
  icon: '\uD83C\uDF36\uFE0F',
  status: 'beta',
  difficulty: 'moderate',
  durationDays: 90,
  waterNeed: 'moderate',
  costLevel: 'moderate',
  laborLevel: 'moderate',
  marketPotential: 'good',
  stages: ['land_preparation', 'planting', 'vegetative', 'harvest'],
  needs: ['seedlings', 'fertilizer', 'water', 'labor', 'basic_tools'],
  risks: ['pests', 'disease', 'drought', 'low_market_price'],
  stageTaskMap: {
    land_preparation: [
      {
        type: 'clear_land', titleKey: 'task.pepper.clear_land.title',
        whyKey: 'task.pepper.clear_land.why', timingKey: 'task.pepper.clear_land.timing',
        outcomeKey: 'task.pepper.clear_land.outcome',
        stepsKey: 'task.pepper.clear_land.steps',
        urgency: 'this_week', priority: 'medium', icon: '\uD83E\uDE93',
      },
    ],
    planting: [
      {
        type: 'plant_seedlings', titleKey: 'task.pepper.plant.title',
        whyKey: 'task.pepper.plant.why', timingKey: 'task.pepper.plant.timing',
        outcomeKey: 'task.pepper.plant.outcome',
        stepsKey: 'task.pepper.plant.steps', tipsKey: 'task.pepper.plant.tips',
        urgency: 'this_week', priority: 'high', icon: '\uD83C\uDF31',
      },
    ],
    vegetative: [
      {
        type: 'water', titleKey: 'task.pepper.water.title',
        whyKey: 'task.pepper.water.why', timingKey: 'task.pepper.water.timing',
        outcomeKey: 'task.pepper.water.outcome',
        stepsKey: 'task.pepper.water.steps',
        urgency: 'today', priority: 'high', icon: '\uD83D\uDCA7',
      },
      {
        type: 'weed', titleKey: 'task.pepper.weed.title',
        whyKey: 'task.pepper.weed.why', timingKey: 'task.pepper.weed.timing',
        outcomeKey: 'task.pepper.weed.outcome',
        stepsKey: 'task.pepper.weed.steps',
        urgency: 'today', priority: 'medium', icon: '\uD83C\uDF3E',
      },
    ],
    harvest: [
      {
        type: 'harvest', titleKey: 'task.pepper.harvest.title',
        whyKey: 'task.pepper.harvest.why', timingKey: 'task.pepper.harvest.timing',
        outcomeKey: 'task.pepper.harvest.outcome',
        stepsKey: 'task.pepper.harvest.steps',
        urgency: 'this_week', priority: 'medium', icon: '\uD83E\uDDFA',
      },
    ],
  },
};

// ─── ONION — beta crop ─────────────────────────────────────
const ONION = {
  cropId: 'ONION',
  nameKey: 'crop.onion',
  icon: '\uD83E\uDDC5',
  status: 'beta',
  difficulty: 'moderate',
  durationDays: 120,
  waterNeed: 'moderate',
  costLevel: 'low',
  laborLevel: 'moderate',
  marketPotential: 'good',
  stages: ['land_preparation', 'planting', 'vegetative', 'harvest', 'post_harvest'],
  needs: ['seeds', 'water', 'labor', 'basic_tools'],
  risks: ['pests', 'disease', 'poor_storage', 'low_market_price'],
  stageTaskMap: {
    land_preparation: [
      {
        type: 'prepare_soil', titleKey: 'task.onion.prepare_soil.title',
        whyKey: 'task.onion.prepare_soil.why', timingKey: 'task.onion.prepare_soil.timing',
        outcomeKey: 'task.onion.prepare_soil.outcome',
        stepsKey: 'task.onion.prepare_soil.steps', tipsKey: 'task.onion.prepare_soil.tips',
        urgency: 'this_week', priority: 'medium', icon: '\uD83D\uDE9C',
      },
    ],
    planting: [
      {
        type: 'plant', titleKey: 'task.onion.plant.title',
        whyKey: 'task.onion.plant.why', timingKey: 'task.onion.plant.timing',
        outcomeKey: 'task.onion.plant.outcome',
        stepsKey: 'task.onion.plant.steps', tipsKey: 'task.onion.plant.tips',
        urgency: 'this_week', priority: 'high', icon: '\uD83C\uDF31',
      },
    ],
    vegetative: [
      {
        type: 'water', titleKey: 'task.onion.water.title',
        whyKey: 'task.onion.water.why', timingKey: 'task.onion.water.timing',
        outcomeKey: 'task.onion.water.outcome',
        stepsKey: 'task.onion.water.steps',
        urgency: 'today', priority: 'medium', icon: '\uD83D\uDCA7',
      },
      {
        type: 'weed', titleKey: 'task.onion.weed.title',
        whyKey: 'task.onion.weed.why', timingKey: 'task.onion.weed.timing',
        outcomeKey: 'task.onion.weed.outcome',
        stepsKey: 'task.onion.weed.steps',
        urgency: 'this_week', priority: 'medium', icon: '\uD83C\uDF3E',
      },
    ],
    harvest: [
      {
        type: 'harvest', titleKey: 'task.onion.harvest.title',
        whyKey: 'task.onion.harvest.why', timingKey: 'task.onion.harvest.timing',
        outcomeKey: 'task.onion.harvest.outcome',
        stepsKey: 'task.onion.harvest.steps',
        urgency: 'this_week', priority: 'medium', icon: '\uD83E\uDDFA',
      },
    ],
    post_harvest: [
      {
        type: 'dry', titleKey: 'task.onion.dry.title',
        whyKey: 'task.onion.dry.why', timingKey: 'task.onion.dry.timing',
        outcomeKey: 'task.onion.dry.outcome',
        stepsKey: 'task.onion.dry.steps', tipsKey: 'task.onion.dry.tips',
        urgency: 'today', priority: 'medium', icon: '\u2600\uFE0F',
      },
    ],
  },
};

// ─── Registry ──────────────────────────────────────────────
// Add new crops by pushing into this map. The engine never
// branches on `cropId` — it just reads whichever definition
// resolves. Every crop must carry the same shape.

const CROP_DEFINITIONS = {
  MAIZE,
  TOMATO,
  PEPPER,
  ONION,
};

export function getCropDefinition(cropCode) {
  if (!cropCode) return null;
  const code = String(cropCode).toUpperCase();
  return CROP_DEFINITIONS[code] || null;
}

/**
 * Returns true when the crop is flagged status:'beta'. Callers
 * use this to branch on UI labels and the beta warning flow —
 * engine behaviour is identical for supported and beta crops.
 */
export function isBetaCrop(cropCode) {
  const def = getCropDefinition(cropCode);
  return !!def && def.status === 'beta';
}

/**
 * Flat view of the registry keyed by lowercase crop id, matching
 * the `taskLibrary` export shape the product spec calls out.
 */
export const taskLibrary = {
  maize: MAIZE.stageTaskMap,
  tomato: TOMATO.stageTaskMap,
  pepper: PEPPER.stageTaskMap,
  onion: ONION.stageTaskMap,
};

export function listCropDefinitions() {
  return Object.values(CROP_DEFINITIONS);
}

/**
 * Return the next stage after `currentStage` in a crop's lifecycle,
 * or null if already at the final stage. Used by the progression
 * engine after all tasks in a stage are complete.
 */
export function getNextStage(cropCode, currentStage) {
  const def = getCropDefinition(cropCode);
  if (!def) return null;
  const idx = def.stages.indexOf(currentStage);
  if (idx < 0 || idx === def.stages.length - 1) return null;
  return def.stages[idx + 1];
}

/**
 * Return the task list for a crop + stage as defined in the canonical
 * definition. Falls back to null so callers can layer the generic
 * STAGE_TASKS from cropTaskMap.js.
 */
export function getDefinedTasks(cropCode, stage) {
  const def = getCropDefinition(cropCode);
  if (!def) return null;
  return def.stageTaskMap[stage] ? [...def.stageTaskMap[stage]] : null;
}

export default CROP_DEFINITIONS;
