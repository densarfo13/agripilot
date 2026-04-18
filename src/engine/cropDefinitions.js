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
        whyKey: 'why.plant.rightTiming', timingKey: 'timing.earlyThisWeek',
        riskKey: 'risk.plant.missWindow', outcomeKey: 'outcome.maize.cleared',
        stepsKey: 'steps.maize.clearField', tipsKey: 'tips.maize.clearField',
        urgency: 'this_week', priority: 'high', icon: '\uD83E\uDE93',
      },
      {
        type: 'loosen_soil', titleKey: 'cropTask.maize.loosenSoil',
        finishTitleKey: 'cropTask.maize.finishLoosenSoil',
        whyKey: 'why.landPrep.readySoil', timingKey: 'timing.doToday',
        riskKey: 'risk.landPrep.delayedPlanting', outcomeKey: 'outcome.maize.soilLoose',
        stepsKey: 'steps.maize.loosenSoil', tipsKey: 'tips.maize.loosenSoil',
        urgency: 'today', priority: 'high', icon: '\uD83D\uDE9C',
      },
      {
        type: 'mark_rows', titleKey: 'cropTask.maize.markRows',
        finishTitleKey: 'cropTask.maize.finishMarkRows',
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

// ─── Registry ──────────────────────────────────────────────
// Add new crops by pushing into this map. The engine never
// branches on `cropId` — it just reads whichever definition
// resolves. Every crop must carry the same shape.

const CROP_DEFINITIONS = {
  MAIZE,
};

export function getCropDefinition(cropCode) {
  if (!cropCode) return null;
  const code = String(cropCode).toUpperCase();
  return CROP_DEFINITIONS[code] || null;
}

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
