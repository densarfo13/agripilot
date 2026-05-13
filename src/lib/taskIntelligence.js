/**
 * taskIntelligence.js — Invisible Intelligence Task Engine v1.
 *
 *   import { generateSmartTask } from './lib/taskIntelligence.js';
 *
 *   const task = generateSmartTask({
 *     userType:  'backyard',
 *     crop:      'tomato',
 *     cropStage: 'flowering',
 *     region:    'Ashanti',
 *     weather:   { condition: 'rainy', temp: 27, rainChance: 75 },
 *   });
 *
 * Spec rules
 *   • Realistic daily crop-care tasks driven by weather, region,
 *     crop, crop stage, and user type — never the legacy
 *     "Start logging farm costs to track profitability" /
 *     "Keep logging harvest…" copy.
 *   • Pure function — same input always produces the same output.
 *   • Never throws. Bad input falls through to the soil-moisture
 *     fallback so Home always renders a usable action.
 *   • Output shape:
 *       { title, reason, urgency, time, cta, category,
 *         region, generatedAt, source }
 */

export function generateSmartTask(opts) {
  // Normalise input — JS default-param destructuring fires for
  // `undefined` only, NOT `null`. Caller-passed null / non-object
  // values fall through to the empty-input defaults instead of
  // throwing.
  const o = (opts && typeof opts === 'object') ? opts : {};
  const userType  = (o.userType === 'farmer' || o.userType === 'backyard')
    ? o.userType : 'backyard';
  const crop      = (o.crop      != null) ? o.crop      : 'crop';
  const cropStage = (o.cropStage != null) ? o.cropStage : 'unknown';
  const region    = (o.region    != null) ? o.region    : 'your area';
  // Weather may be passed as null, a string, or an object. Only
  // a plain object is queryable; anything else collapses to {}.
  const weather   = (o.weather && typeof o.weather === 'object' && !Array.isArray(o.weather))
    ? o.weather : {};

  const condition  = String(weather.condition || '').toLowerCase();
  const temp       = Number(weather.temp ?? 0);
  const rainChance = Number(weather.rainChance ?? 0);
  const windSpeed  = Number(weather.windSpeed ?? 0);

  const cropName = typeof crop === 'string'
    ? (crop || 'crop')
    : (crop && crop.name) || 'crop';

  // Soil-moisture default. Every branch below replaces this when
  // its conditions match.
  let task = {
    title:    'Walk your field and check crop health',
    reason:   'Look for dry soil, weak leaves, pests, or unusual spots.',
    urgency:  'medium',
    time:     '5 mins',
    cta:      'Mark as done',
    category: 'crop-care',
  };

  // ─── WEATHER INTELLIGENCE ──────────────────────────────────

  if (rainChance >= 60 || condition.includes('rain')) {
    task = {
      title:    `Check drainage around your ${cropName}`,
      reason:   'Rain is expected, so make sure water does not sit around the roots.',
      urgency:  'medium',
      time:     '5 mins',
      cta:      'Mark as done',
      category: 'weather',
    };
  }

  if (condition.includes('dry') || rainChance <= 20) {
    task = {
      title:    `Check soil moisture around your ${cropName}`,
      reason:   'Dry weather can stress plants. Water only if the soil feels dry.',
      urgency:  'medium',
      time:     '5 mins',
      cta:      'Mark as done',
      category: 'watering',
    };
  }

  if (temp >= 32) {
    task = {
      title:    `Water your ${cropName} early or late`,
      reason:   'Hot weather can dry soil quickly. Avoid watering in the hottest part of the day.',
      urgency:  'high',
      time:     '7 mins',
      cta:      'Mark as done',
      category: 'heat',
    };
  }

  if (windSpeed >= 25 || condition.includes('wind')) {
    task = {
      title:    `Check if your ${cropName} needs support`,
      reason:   'Strong wind can bend young plants. Stake or support weak stems.',
      urgency:  'medium',
      time:     '5 mins',
      cta:      'Mark as done',
      category: 'wind',
    };
  }

  // ─── CROP-STAGE INTELLIGENCE ───────────────────────────────

  const stage = String(cropStage || '').toLowerCase();

  if (stage.includes('seed') || stage.includes('germination')) {
    task = {
      title:    `Keep ${cropName} seed area lightly moist`,
      reason:   'Seeds need gentle moisture to sprout. Do not flood the soil.',
      urgency:  'medium',
      time:     '4 mins',
      cta:      'Mark as done',
      category: 'germination',
    };
  }

  if (stage.includes('vegetative') || stage.includes('growth')) {
    task = {
      title:    `Remove weeds around your ${cropName}`,
      reason:   'Weeds compete with your crop for water and nutrients.',
      urgency:  'medium',
      time:     '10 mins',
      cta:      'Mark as done',
      category: 'weeding',
    };
  }

  if (stage.includes('flower')) {
    task = {
      title:    `Inspect ${cropName} flowers and leaves`,
      reason:   'Flowering is sensitive. Check for pests, yellow leaves, or water stress.',
      urgency:  'high',
      time:     '6 mins',
      cta:      'Mark as done',
      category: 'flowering',
    };
  }

  if (stage.includes('fruit') || stage.includes('harvest')) {
    task = {
      title:    `Check ${cropName} harvest readiness`,
      reason:   'Harvest timing affects quality. Look for mature color, size, and firmness.',
      urgency:  'high',
      time:     '8 mins',
      cta:      'Mark as done',
      category: 'harvest',
    };
  }

  // ─── CROP-SPECIFIC INTELLIGENCE ────────────────────────────

  const c = cropName.toLowerCase();

  if (c.includes('tomato')) {
    task = {
      ...task,
      title:    'Inspect tomato leaves for yellow spots or pests',
      reason:   'Tomatoes can develop leaf disease quickly. Check under leaves and near the stem.',
      category: 'pest-check',
    };
  }

  if (c.includes('maize') || c.includes('corn')) {
    task = {
      ...task,
      title:    'Check maize soil moisture near the roots',
      reason:   'Maize needs steady moisture during growth. Water only if soil is dry.',
      category: 'watering',
    };
  }

  if (c.includes('okra')) {
    task = {
      ...task,
      title:    'Check okra leaves for holes or insects',
      reason:   'Young okra leaves can attract pests. Early checks prevent damage.',
      category: 'pest-check',
    };
  }

  if (c.includes('pepper')) {
    task = {
      ...task,
      title:    'Check pepper plants for leaf curl or yellowing',
      reason:   'Leaf curl can signal heat stress, pests, or watering problems.',
      category: 'plant-health',
    };
  }

  if (c.includes('rice')) {
    task = {
      ...task,
      title:    'Check rice field water level',
      reason:   'Rice needs careful water control. Avoid letting the field dry out too long.',
      urgency:  'high',
      category: 'water-level',
    };
  }

  // ─── USER-TYPE LANGUAGE ───────────────────────────────────
  // Use regex replace (works in every Node + browser) instead of
  // String.prototype.replaceAll (Node 15+ / ES2021), so the
  // engine runs cleanly under older test runtimes too.
  if (userType === 'backyard') {
    task.reason = String(task.reason || '')
      .replace(/crop/g, 'plant')
      .replace(/field/g, 'garden');

    if (typeof task.title === 'string' && task.title.includes('harvest readiness')) {
      task.cta = 'Check plant';
    }
  }

  return {
    ...task,
    region,
    generatedAt: new Date().toISOString(),
    source: 'weather-region-stage-v1',
  };
}

export default generateSmartTask;
