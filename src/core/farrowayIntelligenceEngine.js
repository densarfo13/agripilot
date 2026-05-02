/**
 * farrowayIntelligenceEngine.js \u2014 the invisible-intelligence
 * orchestrator behind Today's Plan.
 *
 *   import { generateIntelligentPlan }
 *     from '../core/farrowayIntelligenceEngine.js';
 *
 *   const plan = generateIntelligentPlan({
 *     activeExperience: 'garden',
 *     cropName:         'tomato',
 *     plantName:        null,
 *     country:          'US',
 *     region:           'CA',
 *     plantedAt:        '2026-04-01',
 *     growingSetup:     'container',
 *     sizeSqFt:         null,
 *     displayUnit:      'sqft',
 *     weather:          { rainChance: 70, humidity: 75, temp: 32, wind: 30 },
 *   });
 *
 * Output shape:
 *   {
 *     todaysPriority: { type, text, detail },
 *     secondaryTasks: Array<{ type, text, detail }>,        // 0\u20132 items (cap)
 *     riskSignals:    Array<{ severity, text, detail }>,    // 0\u20133
 *     explanation:    string,                                // why this matters
 *     confidence:     'low'|'medium'|'high',
 *     followUpTask:   { type, text, detail },                // tomorrow's check
 *   }
 *
 * Total user-visible tasks: todaysPriority + secondaryTasks <= 3.
 *
 * Coexists with
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * \u2022 dailyIntelligenceEngine.generateDailyPlan \u2014 the existing
 *   /home daily-plan generator. That engine reads from server
 *   tasks + the canonical taskGenerator + Land Intelligence.
 *   THIS engine is a slimmer pure orchestrator that runs on
 *   the same inputs but produces the new spec shape (priority +
 *   secondary + risks + explanation + follow-up). Callers can
 *   compose the two.
 * \u2022 firstPlanEngine.generateFirstPlan \u2014 onboarding-review-screen
 *   action list. Same input style; this engine returns more
 *   structure (priority/secondary split + risks + explanation +
 *   confidence + follow-up).
 *
 * Strict-rule audit
 *   \u2022 Pure function. No I/O. Never throws \u2014 every input branch
 *     is wrapped + falls through to safe defaults.
 *   \u2022 No translation lookup. The caller wraps action text in
 *     tStrict if it wants i18n; the engine returns English seeds.
 *   \u2022 NEVER returns an empty plan \u2014 spec \u00a77. The fallback path
 *     (no weather / no location / no crop) returns the canonical
 *     "Check your plant/crop, water if dry, scan if damage"
 *     trio per spec \u00a79.
 */

const DAY_MS = 1000 * 60 * 60 * 24;
const ACRE_SQFT = 43_560;

// Wind threshold for the spray-warning rule. 25 km/h matches
// extension-service guidance for foliar applications; we accept
// both km/h and m/s (m/s values are typically < 50 so we infer
// the unit from magnitude).
const WIND_KMH_THRESHOLD = 25;
const WIND_MS_THRESHOLD  = 6;   // ~22 km/h

// \u2500\u2500 Stage detection \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//
// Spec stages: unknown | germination | early_growth | vegetative
//             | flowering | mature
//
// Days mapping:
//   < 10  germination
//   < 30  early_growth
//   < 60  vegetative
//   < 90  flowering
//   \u2265 90  mature
//
// 'unknown' returned when plantedAt is missing / future / unparseable.
function _detectStage(plantedAt, today = new Date()) {
  if (!plantedAt) return 'unknown';
  let plantedDate = null;
  try {
    plantedDate = new Date(plantedAt);
    if (Number.isNaN(plantedDate.getTime())) return 'unknown';
  } catch { return 'unknown'; }
  const days = Math.floor((today.getTime() - plantedDate.getTime()) / DAY_MS);
  if (days < 0)  return 'unknown';
  if (days < 10) return 'germination';
  if (days < 30) return 'early_growth';
  if (days < 60) return 'vegetative';
  if (days < 90) return 'flowering';
  return 'mature';
}

// \u2500\u2500 Scale detection \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//
// Garden experience always reports 'garden' regardless of size.
// Farm experience tiers off sizeSqFt:
//   < 10 acres  small_farm
//   < 100 acres medium_farm
//   \u2265 100 acres large_farm
function _detectScale(activeExperience, sizeSqFt) {
  const exp = String(activeExperience || '').toLowerCase();
  if (exp === 'garden' || exp === 'backyard') return 'garden';
  const n = Number(sizeSqFt);
  if (!Number.isFinite(n) || n <= 0) return 'small_farm'; // safest default
  if (n < 10  * ACRE_SQFT) return 'small_farm';
  if (n < 100 * ACRE_SQFT) return 'medium_farm';
  return 'large_farm';
}

// \u2500\u2500 Crop rule packs (spec \u00a76) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//
// Simple lookup keyed off lowercased crop / plant name. Each
// pack contributes ONE inspection-flavoured task to the
// secondary set + optionally a humidity-conditional task.
const CROP_PACKS = Object.freeze({
  pepper: {
    inspect: {
      type: 'inspection',
      text: 'Inspect the underside of pepper leaves',
      detail: 'Check for aphids, mites, and small holes hiding under the leaves.',
    },
    humidityRisk: 'Peppers spot easily in humid weather \u2014 watch the leaves.',
  },
  tomato: {
    inspect: {
      type: 'inspection',
      text: 'Check the lower tomato leaves for spots',
      detail: 'Lower leaves are the first place leaf-spot diseases appear.',
    },
    humidityRisk: 'Avoid wetting tomato leaves \u2014 spots spread fast in humidity.',
  },
  maize: {
    inspect: {
      type: 'inspection',
      text: 'Inspect maize leaves for streaks or holes',
      detail: 'Streaks suggest viral pressure; holes suggest stem borers \u2014 check neighbours too.',
    },
    humidityRisk: 'Check neighbouring plants if any maize damage appears.',
  },
  herbs: {
    inspect: {
      type: 'inspection',
      text: 'Avoid overwatering your herbs',
      detail: 'Herbs prefer drying between waterings; check the soil with your finger.',
    },
    humidityRisk: 'Check that herbs still get enough light if humidity is high.',
  },
});

function _cropPackFor(name) {
  const k = String(name || '').toLowerCase();
  if (!k) return null;
  // Stem match against the canonical pack keys.
  if (k.startsWith('pepper') || k.includes('chili') || k.includes('tattasai')) return CROP_PACKS.pepper;
  if (k.startsWith('tomato') || k.includes('nyanya')) return CROP_PACKS.tomato;
  if (k.startsWith('maize')  || k.includes('corn') || k.includes('masara'))  return CROP_PACKS.maize;
  if (k.includes('herb')     || k.includes('basil') || k.includes('mint')
      || k.includes('parsley') || k.includes('cilantro'))                    return CROP_PACKS.herbs;
  return null;
}

// \u2500\u2500 Growing-setup task packs (spec \u00a74) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//
// Mirrors dailyIntelligenceEngine.SETUP_TASKS so the two engines
// stay aligned. Garden-only.
const SETUP_PACKS = Object.freeze({
  container: [
    { type: 'watering', text: 'Check container soil moisture',
      detail: 'Pots dry out fast \u2014 stick a finger in to check before watering.' },
    { type: 'watering', text: 'Make sure the pot drains well',
      detail: 'Standing water rots roots; tip out the saucer if needed.' },
    { type: 'watering', text: 'Water only if the top soil feels dry',
      detail: 'Containers warn faster than ground beds \u2014 dry top \u2192 time to water.' },
  ],
  raised_bed: [
    { type: 'inspection', text: 'Check spacing between plants',
      detail: 'Crowded beds limit airflow and grow disease risk.' },
    { type: 'inspection', text: 'Remove weeds around the bed',
      detail: 'Weeds compete for water and harbour pests.' },
    { type: 'watering',   text: 'Water near the roots',
      detail: 'Aim at the base, not the leaves \u2014 reduces fungal risk.' },
  ],
  ground: [
    { type: 'inspection', text: 'Check soil around the plant',
      detail: 'Look for cracks, dryness, or insect activity at the surface.' },
    { type: 'inspection', text: 'Look for weeds or pests nearby',
      detail: 'Nearby weeds can hide pests that move onto your plants.' },
    { type: 'watering',   text: 'Water only if soil is dry',
      detail: 'Soil holds moisture longer than pots \u2014 don\u2019t over-water.' },
  ],
  indoor_balcony: [
    { type: 'growth',   text: 'Check light exposure',
      detail: 'Indoor plants need 4\u20136h of direct/indirect light per day.' },
    { type: 'growth',   text: 'Rotate plant toward light',
      detail: 'Quarter-turn every few days keeps growth even.' },
    { type: 'watering', text: 'Avoid overwatering',
      detail: 'Indoor pots dry slowly \u2014 only water when top soil feels dry.' },
  ],
  unknown: [], // generic fallback handled by core path
});

// Legacy alias \u2014 saved gardens may still carry 'bed' / 'indoor'
// from before the merge-spec rename.
const SETUP_ALIAS = Object.freeze({ bed: 'raised_bed', indoor: 'indoor_balcony' });

// \u2500\u2500 Stage-driven copy ────────────────────────────────────────
const STAGE_PRIORITY = Object.freeze({
  germination: { type: 'growth',
    text: 'Protect young seedlings today',
    detail: 'Keep soil moist but not soaked; avoid direct hot sun on tender leaves.' },
  early_growth: { type: 'growth',
    text: 'Support early leaf growth',
    detail: 'Steady water + gentle morning light is the recipe right now.' },
  vegetative: { type: 'growth',
    text: 'Encourage strong leaf growth',
    detail: 'Consistent water + early-morning inspection \u2014 leaves are filling out.' },
  flowering: { type: 'growth',
    text: 'Watch flowers and protect early fruit',
    detail: 'Avoid wetting flowers; check for petal blight or insects on buds.' },
  mature: { type: 'growth',
    text: 'Prepare for harvest stage',
    detail: 'Watch for colour change and fruit firmness; pick at peak.' },
});

// \u2500\u2500 Public API ─────────────────────────────────────────────────
/**
 * generateIntelligentPlan(input) \u2192 spec output object.
 *
 * Always returns a usable plan; never throws; never returns an
 * empty plan (spec \u00a77 + \u00a79).
 */
export function generateIntelligentPlan(input = {}) {
  const safe = (input && typeof input === 'object') ? input : {};

  const isGarden = String(safe.activeExperience || '').toLowerCase() === 'garden'
                || String(safe.activeExperience || '').toLowerCase() === 'backyard';
  const noun = isGarden ? 'plant' : 'crop';
  const cropOrPlant = String(safe.cropName || safe.plantName || '');
  const stage = _detectStage(safe.plantedAt);
  const scale = _detectScale(safe.activeExperience, safe.sizeSqFt);
  const setupRaw = String(safe.growingSetup || '').toLowerCase();
  const setup = SETUP_ALIAS[setupRaw] || setupRaw;

  const w = (safe.weather && typeof safe.weather === 'object') ? safe.weather : {};
  const rainExpected = Number(w.rainChance ?? w.rain) > 60;
  const highHumidity = Number(w.humidity ?? w.relativeHumidity) > 70;
  const highTemp     = Number(w.temp ?? w.temperatureC) > 30;
  const windRaw      = Number(w.wind ?? w.windKmh ?? w.windSpeed);
  const highWind     = Number.isFinite(windRaw)
    && (windRaw > WIND_KMH_THRESHOLD
        || (windRaw < 50 && windRaw > WIND_MS_THRESHOLD));

  // \u2500\u2500 Risk signals (don't count toward task cap) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const riskSignals = [];
  if (highHumidity) {
    riskSignals.push({
      severity: 'warning',
      text: 'Watch for leaf spots or mold',
      detail: 'High humidity raises the chance of fungal leaf spots and mildew.',
    });
  }
  if (highTemp) {
    riskSignals.push({
      severity: 'warning',
      text: 'Heat stress risk',
      detail: 'Check soil moisture early or late in the day; avoid midday watering.',
    });
  }
  if (highWind) {
    riskSignals.push({
      severity: 'info',
      text: 'Avoid spraying during strong wind',
      detail: 'Drift wastes product and can damage neighbouring plants.',
    });
  }

  // \u2500\u2500 Today's priority \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Priority precedence:
  //   1. Rain expected \u2192 "Skip watering today" (most actionable today)
  //   2. Stage-driven growth task (if stage known)
  //   3. Setup-driven first task (garden) / scale-driven first task (farm)
  //   4. Generic fallback ("Check your plant/crop today")
  let todaysPriority = null;
  if (rainExpected) {
    todaysPriority = {
      type: 'watering',
      text: 'Skip watering today',
      detail: 'Rain is expected, so avoid overwatering.',
    };
  } else if (stage !== 'unknown' && STAGE_PRIORITY[stage]) {
    todaysPriority = STAGE_PRIORITY[stage];
  } else if (isGarden && SETUP_PACKS[setup] && SETUP_PACKS[setup].length > 0) {
    todaysPriority = SETUP_PACKS[setup][0];
  } else {
    todaysPriority = {
      type: 'inspection',
      text: `Check your ${noun} today`,
      detail: `Look closely at leaves (top and underside) for spots, holes, or insects.`,
    };
  }

  // \u2500\u2500 Secondary tasks (cap to 2 so total stays \u2264 3) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const secondary = [];
  const seen = new Set([todaysPriority.text.toLowerCase()]);
  function add(task) {
    if (!task || !task.text) return;
    const k = task.text.toLowerCase();
    if (seen.has(k)) return;
    if (secondary.length >= 2) return;
    secondary.push(task);
    seen.add(k);
  }

  // Crop-pack inspection (spec \u00a76).
  const pack = _cropPackFor(cropOrPlant);
  if (pack && pack.inspect) add(pack.inspect);

  // Garden setup tasks (spec \u00a74) \u2014 pick the next 2 from the
  // pack, skipping anything already covered by the priority.
  if (isGarden && SETUP_PACKS[setup]) {
    for (const t of SETUP_PACKS[setup]) {
      if (secondary.length >= 2) break;
      add(t);
    }
  }

  // Farm scale tasks (spec \u00a75).
  if (!isGarden) {
    if (scale === 'small_farm') {
      add({ type: 'inspection', text: 'Check crop leaves today',
            detail: 'Walk one row and look closely for new spots, holes, or insects.' });
      add({ type: 'watering',   text: 'Water only if soil is dry',
            detail: 'Check soil moisture before watering.' });
    } else {
      // medium_farm + large_farm
      add({ type: 'inspection', text: 'Scout multiple crop areas',
            detail: 'Walk at least 3 distinct sections to spot any uneven pressure.' });
      add({ type: 'inspection', text: 'Check for spread across rows',
            detail: 'If damage is on more than one row, record the affected field section.' });
    }
  }

  // Always end with a scan CTA so the user can act if they
  // see damage. Cap protects us from going over 3 total.
  add({
    type: 'scan',
    text: `Scan ${noun} if you see damage`,
    detail: 'Take a photo to identify issues early.',
  });

  // \u2500\u2500 Explanation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // One-line "why this matters" tied to the dominant signal.
  let explanation = '';
  if (rainExpected) {
    explanation = 'Rain in the forecast \u2014 today is about NOT overwatering, not adding more.';
  } else if (highHumidity && pack) {
    explanation = pack.humidityRisk;
  } else if (highHumidity) {
    explanation = 'Humid air today \u2014 a quick leaf check now beats a fungal spread later.';
  } else if (highTemp) {
    explanation = 'Hot day ahead \u2014 water timing matters more than water amount.';
  } else if (stage === 'germination') {
    explanation = 'Seedlings are fragile right now \u2014 small daily care, not big interventions.';
  } else if (stage === 'flowering') {
    explanation = 'Flowering and early-fruit are the make-or-break weeks for yield.';
  } else if (isGarden && setup === 'container') {
    explanation = 'Pots dry out faster than ground beds \u2014 that\u2019s the main thing to watch.';
  } else if (isGarden && setup === 'indoor_balcony') {
    explanation = 'Indoor plants are limited by light; water is usually a smaller worry.';
  } else {
    explanation = `Your ${noun} thrives on small, consistent attention \u2014 today\u2019s plan is the simplest version.`;
  }

  // \u2500\u2500 Confidence \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  let signals = 0;
  if (cropOrPlant)            signals += 1;
  if (safe.country)           signals += 1;
  if (safe.plantedAt)         signals += 1;
  if (safe.weather)           signals += 1;
  if (isGarden && setup && setup !== 'unknown') signals += 1;
  const confidence = signals >= 4 ? 'high'
                   : signals >= 2 ? 'medium'
                   : 'low';

  // \u2500\u2500 Follow-up task (tomorrow) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Mirrors hybridScanEngine's follow-up shape so any caller
  // already wired up to Add-to-Plan can persist it directly.
  const followUpTask = {
    type: 'inspection',
    text: cropOrPlant
      ? `Check your ${cropOrPlant} again tomorrow`
      : `Check your ${noun} again tomorrow`,
    detail: 'See if the leaves, soil, or weather signals have changed.',
  };

  return {
    todaysPriority,
    secondaryTasks: secondary.slice(0, 2),
    riskSignals,
    explanation,
    confidence,
    followUpTask,
  };
}

export const _internal = Object.freeze({
  _detectStage,
  _detectScale,
  _cropPackFor,
  CROP_PACKS,
  SETUP_PACKS,
  SETUP_ALIAS,
  STAGE_PRIORITY,
  WIND_KMH_THRESHOLD,
  WIND_MS_THRESHOLD,
});

export default generateIntelligentPlan;
