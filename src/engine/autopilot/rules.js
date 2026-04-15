/**
 * Autopilot Rules — deterministic, explainable task intelligence.
 *
 * Each rule matches a task + farm context and returns:
 *   whyKey, riskKey, nextTaskType, severity, confidence
 *
 * Rules are evaluated top-down. First match wins.
 * All text uses translation keys — no raw English.
 */

// ─── Rule Definitions ──────────────────────────────────────────
// Each rule: { id, match(ctx), result }
// ctx = { taskType, actionType, titleLower, cropStage, weather, recentActivity, daysSinceUpdate }

export const AUTOPILOT_RULES = [
  // ════════════════════════════════════════════════════════
  // A. POST-HARVEST: drying
  // ════════════════════════════════════════════════════════
  {
    id: 'post_harvest_drying',
    match: (ctx) =>
      ctx.cropStage === 'post_harvest' &&
      matchesType(ctx, ['dry', 'drying']) &&
      !ctx.weather?.rainingNow,
    result: {
      whyKey: 'why.drying.preventMold',
      riskKey: 'risk.drying.spoilageIfDelayed',
      nextTaskType: 'sort_clean',
      severity: 'caution',
      confidence: 'high',
    },
  },

  // ════════════════════════════════════════════════════════
  // B. RAIN THREAT: protect harvest
  // ════════════════════════════════════════════════════════
  {
    id: 'rain_protect_harvest',
    match: (ctx) =>
      (ctx.weather?.rainingNow || ctx.weather?.rainTodayLikely) &&
      ['harvest', 'post_harvest'].includes(ctx.cropStage) &&
      matchesType(ctx, ['protect', 'cover', 'store', 'harvest']),
    result: {
      whyKey: 'why.rain.avoidDamage',
      riskKey: 'risk.rain.uncoveredHarvest',
      nextTaskType: 'dry_when_safe',
      severity: 'urgent',
      confidence: 'high',
      weatherReason: 'rain_expected',
    },
  },

  // Rain + any drying task → don't dry in rain
  {
    id: 'rain_blocks_drying',
    match: (ctx) =>
      ctx.weather?.rainingNow &&
      matchesType(ctx, ['dry', 'drying']),
    result: {
      whyKey: 'why.rain.protectBeforeDry',
      riskKey: 'risk.rain.dampHarvest',
      nextTaskType: 'dry_when_safe',
      severity: 'urgent',
      confidence: 'high',
      weatherReason: 'rain_now',
    },
  },

  // ════════════════════════════════════════════════════════
  // C. DRY STRESS: watering needed
  // ════════════════════════════════════════════════════════
  {
    id: 'dry_stress_watering',
    match: (ctx) =>
      matchesType(ctx, ['water', 'irrigat']) &&
      (ctx.weather?.isDryHot || ctx.weather?.isDrySpell) &&
      ['vegetative', 'flowering', 'fruiting', 'germination'].includes(ctx.cropStage),
    result: {
      whyKey: 'why.water.reduceCropStress',
      riskKey: 'risk.water.yieldDropIfDry',
      nextTaskType: 'check_crop',
      severity: 'caution',
      confidence: 'high',
      weatherReason: 'dry_hot',
    },
  },

  // General watering
  {
    id: 'watering_general',
    match: (ctx) =>
      matchesType(ctx, ['water', 'irrigat']),
    result: {
      whyKey: 'why.water.supportGrowth',
      riskKey: 'risk.water.stuntedGrowth',
      nextTaskType: 'check_crop',
      severity: 'normal',
      confidence: 'medium',
    },
  },

  // ════════════════════════════════════════════════════════
  // D. PEST CHECK
  // ════════════════════════════════════════════════════════
  {
    id: 'pest_check_urgent',
    match: (ctx) =>
      matchesType(ctx, ['pest', 'insect', 'disease', 'blight', 'worm', 'bug']) &&
      ctx.priority === 'high',
    result: {
      whyKey: 'why.pest.catchEarly',
      riskKey: 'risk.pest.spreadFast',
      nextTaskType: 'update_pest_status',
      severity: 'urgent',
      confidence: 'high',
    },
  },
  {
    id: 'pest_check_routine',
    match: (ctx) =>
      matchesType(ctx, ['pest', 'insect', 'disease', 'scout', 'check field', 'inspect']),
    result: {
      whyKey: 'why.pest.catchEarly',
      riskKey: 'risk.pest.spreadFast',
      nextTaskType: 'update_pest_status',
      severity: 'normal',
      confidence: 'medium',
    },
  },

  // ════════════════════════════════════════════════════════
  // E. SPRAYING (pesticide / fungicide)
  // ════════════════════════════════════════════════════════
  {
    id: 'spraying_windy',
    match: (ctx) =>
      matchesType(ctx, ['spray', 'fungicid', 'pesticid', 'herbicid']) &&
      ctx.weather?.isWindy,
    result: {
      whyKey: 'why.spray.protectCrop',
      riskKey: 'risk.spray.driftInWind',
      nextTaskType: 'check_crop',
      severity: 'caution',
      confidence: 'high',
      weatherReason: 'windy',
    },
  },
  {
    id: 'spraying_general',
    match: (ctx) =>
      matchesType(ctx, ['spray', 'fungicid', 'pesticid', 'herbicid', 'apply']),
    result: {
      whyKey: 'why.spray.protectCrop',
      riskKey: 'risk.spray.damageSpread',
      nextTaskType: 'check_crop',
      severity: 'normal',
      confidence: 'medium',
    },
  },

  // ════════════════════════════════════════════════════════
  // F. WEEDING
  // ════════════════════════════════════════════════════════
  {
    id: 'weeding',
    match: (ctx) =>
      matchesType(ctx, ['weed', 'clear', 'mulch']),
    result: {
      whyKey: 'why.weed.reduceCompetition',
      riskKey: 'risk.weed.yieldReduction',
      nextTaskType: 'check_crop',
      severity: 'normal',
      confidence: 'medium',
    },
  },

  // ════════════════════════════════════════════════════════
  // G. FERTILIZING
  // ════════════════════════════════════════════════════════
  {
    id: 'fertilizing',
    match: (ctx) =>
      matchesType(ctx, ['fertil', 'manure', 'nutrient', 'compost', 'top dress']),
    result: {
      whyKey: 'why.fertilize.boostNutrients',
      riskKey: 'risk.fertilize.poorGrowth',
      nextTaskType: 'check_crop',
      severity: 'normal',
      confidence: 'medium',
    },
  },

  // ════════════════════════════════════════════════════════
  // H. HARVEST
  // ════════════════════════════════════════════════════════
  {
    id: 'harvest_rain_coming',
    match: (ctx) =>
      matchesType(ctx, ['harvest', 'pick', 'reap']) &&
      (ctx.weather?.rainTodayLikely || ctx.weather?.rainingNow),
    result: {
      whyKey: 'why.harvest.beforeRain',
      riskKey: 'risk.harvest.rainDamage',
      nextTaskType: 'dry_harvest',
      severity: 'urgent',
      confidence: 'high',
      weatherReason: 'rain_expected',
    },
  },
  {
    id: 'harvest_general',
    match: (ctx) =>
      matchesType(ctx, ['harvest', 'pick', 'reap']),
    result: {
      whyKey: 'why.harvest.preserveQuality',
      riskKey: 'risk.harvest.overRipening',
      nextTaskType: 'dry_harvest',
      severity: 'normal',
      confidence: 'medium',
    },
  },

  // ════════════════════════════════════════════════════════
  // I. PLANTING / SOWING
  // ════════════════════════════════════════════════════════
  {
    id: 'planting',
    match: (ctx) =>
      matchesType(ctx, ['plant', 'sow', 'seed', 'transplant']) &&
      ['planning', 'land_preparation', 'planting'].includes(ctx.cropStage),
    result: {
      whyKey: 'why.plant.rightTiming',
      riskKey: 'risk.plant.missWindow',
      nextTaskType: 'water_crop',
      severity: 'normal',
      confidence: 'medium',
    },
  },

  // ════════════════════════════════════════════════════════
  // J. LAND PREPARATION
  // ════════════════════════════════════════════════════════
  {
    id: 'land_prep',
    match: (ctx) =>
      matchesType(ctx, ['till', 'plough', 'plow', 'prepare land', 'land prep', 'clear land']),
    result: {
      whyKey: 'why.landPrep.readySoil',
      riskKey: 'risk.landPrep.delayedPlanting',
      nextTaskType: 'plant_crop',
      severity: 'normal',
      confidence: 'medium',
    },
  },

  // ════════════════════════════════════════════════════════
  // K. SORTING / POST-HARVEST PROCESSING
  // ════════════════════════════════════════════════════════
  {
    id: 'sort_clean',
    match: (ctx) =>
      matchesType(ctx, ['sort', 'clean', 'grade', 'thresh', 'shell', 'process']),
    result: {
      whyKey: 'why.sort.betterPrice',
      riskKey: 'risk.sort.qualityLoss',
      nextTaskType: 'store_harvest',
      severity: 'normal',
      confidence: 'medium',
    },
  },

  // ════════════════════════════════════════════════════════
  // L. STORAGE
  // ════════════════════════════════════════════════════════
  {
    id: 'storage',
    match: (ctx) =>
      matchesType(ctx, ['store', 'storage', 'bag', 'silo', 'warehouse']),
    result: {
      whyKey: 'why.store.preventLoss',
      riskKey: 'risk.store.postHarvestLoss',
      nextTaskType: null,
      severity: 'normal',
      confidence: 'medium',
    },
  },
];

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Check if task type/title matches any of the keywords.
 */
function matchesType(ctx, keywords) {
  const haystack = `${ctx.taskType || ''} ${ctx.actionType || ''} ${ctx.titleLower || ''}`;
  return keywords.some((kw) => haystack.includes(kw));
}

/**
 * Build context object from raw inputs for rule matching.
 */
export function buildRuleContext({ task, cropStage, weather, priority }) {
  const titleLower = (task?.title || '').toLowerCase();
  const actionType = (task?.actionType || '').toLowerCase();
  const taskType = (task?.id || '').toLowerCase();

  // Derive weather flags for simpler rule matching
  const wxFlags = {};
  if (weather) {
    const currentPrecip = weather.current?.precipitation ?? 0;
    const wmoCode = weather.current?.weatherCode ?? weather.current?.weather_code ?? 0;
    const todayPrecip = weather.daily?.precipitation_sum?.[0] ?? 0;
    const wind = weather.current?.windSpeed ?? weather.current?.wind_speed_10m ?? 0;
    const temp = weather.current?.temperature ?? weather.current?.temperature_2m ?? 0;
    const humidity = weather.current?.humidity ?? weather.current?.relative_humidity_2m ?? 50;

    wxFlags.rainingNow = currentPrecip >= 0.5 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(wmoCode);
    wxFlags.rainTodayLikely = !wxFlags.rainingNow && todayPrecip >= 2;
    wxFlags.isDryHot = temp >= 32 && humidity <= 45;
    wxFlags.isDrySpell = temp >= 28 && todayPrecip < 0.5 && humidity <= 50;
    wxFlags.isWindy = wind >= 20;
  }

  return {
    taskType,
    actionType,
    titleLower,
    cropStage: cropStage || '',
    weather: wxFlags,
    priority: priority || task?.priority || 'medium',
  };
}
