/**
 * scanResultEnrichment.js — operational tie-in lines for the
 * scan result card (spec §7).
 *
 *   import { enrichScanResult } from 'src/core/scan/scanResultEnrichment.js';
 *
 *   const ops = enrichScanResult({ classifierResult, snapshot });
 *   // ops.weather   → { key, fallback, params } | null
 *   // ops.lifecycle → { key, fallback, params } | null
 *   // ops.watering  → { key, fallback, params } | null
 *   // ops.harvest   → { key, fallback, params } | null
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small composition layer that turns a scan result + the
 *   intelligence snapshot into ONE operational line per area
 *   (weather, lifecycle, watering, harvest). The result card
 *   renders at most one or two of these — the spec asked for
 *   "Humidity this week may increase leaf stress risk" alongside
 *   the result, not a wall of context.
 *
 *   It does NOT generate any new state, doesn't call any engine
 *   that isn't already shipped, and doesn't make any forecast.
 *   It composes the existing snapshot + classifier output into
 *   localised envelopes.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Every visible string is { key, fallback, params }.
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const _num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

function _msg(template, params) {
  const p = (params && typeof params === 'object') ? params : {};
  return { key: template.key, fallback: template.fallback, params: { ...p } };
}

const WEATHER_LINE = Object.freeze({
  humid_fungal: { key: 'scan.ops.weather.humid_fungal', fallback: 'Humidity this week may increase leaf stress risk on {crop}.' },
  hot_water:    { key: 'scan.ops.weather.hot_water',    fallback: 'Heat ahead — water {crop} early to ease stress.' },
  rain_skip:    { key: 'scan.ops.weather.rain_skip',    fallback: 'Rain expected — you may delay watering {crop}.' },
  cold_slow:    { key: 'scan.ops.weather.cold_slow',    fallback: 'Cool, wet conditions may slow {crop} growth.' },
});

const LIFECYCLE_LINE = Object.freeze({
  planting:           { key: 'scan.ops.lifecycle.planting',     fallback: 'Early in {crop}\'s season — protect young seedlings.' },
  germination:        { key: 'scan.ops.lifecycle.germination',  fallback: 'Keep {crop} seedbed steady and moist.' },
  seedling:           { key: 'scan.ops.lifecycle.seedling',     fallback: '{crop} is still tender — watch daily.' },
  vegetative_growth:  { key: 'scan.ops.lifecycle.vegetative',   fallback: '{crop} is in active growth — feed lightly.' },
  flowering:          { key: 'scan.ops.lifecycle.flowering',    fallback: 'Flowering stage — keep water steady.' },
  fruiting:           { key: 'scan.ops.lifecycle.fruiting',     fallback: 'Fruit forming — watch for rot signs.' },
  harvest_ready:      { key: 'scan.ops.lifecycle.harvest_ready',fallback: '{crop} may be near harvest — check colour and firmness.' },
  harvest:            { key: 'scan.ops.lifecycle.harvest',      fallback: 'Harvest in the cool morning if possible.' },
  post_harvest:       { key: 'scan.ops.lifecycle.post_harvest', fallback: 'Post-harvest: store {crop} in a cool, dry place.' },
  planning:           null,
});

const WATERING_LINE = Object.freeze({
  water_today: { key: 'scan.ops.watering.today',  fallback: 'Soil signals suggest watering {crop} today.' },
  skip_today:  { key: 'scan.ops.watering.skip',   fallback: 'You may skip watering today.' },
  base_only:   { key: 'scan.ops.watering.base',   fallback: 'Water at the base of {crop}, not on the leaves.' },
});

const HARVEST_LINE = Object.freeze({
  approaching: { key: 'scan.ops.harvest.approaching', fallback: 'Harvest window opens soon — start planning storage.' },
  active:      { key: 'scan.ops.harvest.active',      fallback: 'Pick {crop} when colour and firmness say it\'s ready.' },
});

/**
 * Build the four enrichment lines. Each returns null when no
 * tie-in is justified — the surface renders only the truthy
 * ones, never empty placeholders.
 *
 * @param {object} args
 * @param {object} [args.classifierResult]  from fastIssueClassifier.classifyScan()
 * @param {object} [args.snapshot]          from getIntelligenceSnapshot()
 * @returns {{ weather, lifecycle, watering, harvest }}
 */
export function enrichScanResult(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const result = (a.classifierResult && typeof a.classifierResult === 'object') ? a.classifierResult : {};
    const snap = (a.snapshot && typeof a.snapshot === 'object') ? a.snapshot : {};
    const crop = a.crop || snap.crop || 'the plant';
    const issue = _str(result.issueCategory);
    const params = { crop };

    // Weather: pick at most one tie-in. Order: fungal+humid > heat
    // > rain > cool/wet. Drop when no signal supports a tie-in.
    let weather = null;
    const w = (snap.weather && typeof snap.weather === 'object') ? snap.weather : {};
    const humidity = _num(w.humidityPct);
    const temp = _num(w.temperatureC);
    const rainProb = _num(w.rainProbability24hPct);
    const rainToday = _num(w.rainfallTodayMm);
    if ((issue === 'fungal_risk' || issue === 'leaf_spot' || issue === 'fruit_rot')
        && humidity != null && humidity >= 80) {
      weather = _msg(WEATHER_LINE.humid_fungal, params);
    } else if (temp != null && temp >= 32 && (issue === 'water_stress' || issue === 'sunburn' || issue === 'wilting')) {
      weather = _msg(WEATHER_LINE.hot_water, params);
    } else if ((rainProb != null && rainProb >= 70) || (rainToday != null && rainToday >= 5)) {
      weather = _msg(WEATHER_LINE.rain_skip, params);
    } else if (humidity != null && humidity >= 85 && temp != null && temp <= 22) {
      weather = _msg(WEATHER_LINE.cold_slow, params);
    }

    // Lifecycle: tie to current stage if known.
    let lifecycle = null;
    const stage = _str(snap.cropStage || snap.currentStage);
    if (stage && LIFECYCLE_LINE[stage]) {
      lifecycle = _msg(LIFECYCLE_LINE[stage], params);
    }

    // Watering: chosen by issue + recent watering.
    let watering = null;
    if (issue === 'fungal_risk' || issue === 'leaf_spot' || issue === 'fruit_rot') {
      watering = _msg(WATERING_LINE.base_only, params);
    } else if (issue === 'water_stress' || issue === 'wilting') {
      watering = _msg(WATERING_LINE.water_today, params);
    } else if (issue === 'overwatering' || (rainToday != null && rainToday >= 5)) {
      watering = _msg(WATERING_LINE.skip_today, params);
    }

    // Harvest: only when stage is near or in harvest.
    let harvest = null;
    if (stage === 'harvest_ready') harvest = _msg(HARVEST_LINE.approaching, params);
    else if (stage === 'harvest')  harvest = _msg(HARVEST_LINE.active, params);

    return { weather, lifecycle, watering, harvest };
  } catch {
    return { weather: null, lifecycle: null, watering: null, harvest: null };
  }
}

const _module = { enrichScanResult };
export default _module;
