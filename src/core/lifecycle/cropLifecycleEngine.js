/**
 * cropLifecycleEngine.js — composes crop stage, harvest-window
 * estimate, weather signal, scan history, and mode into one
 * structured "where are we in this crop's life?" view.
 *
 *   import { computeLifecycleSnapshot, LIFECYCLE_STAGE }
 *     from 'src/core/lifecycle/cropLifecycleEngine.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure composition layer over `cropStageEstimator` (existing)
 *   + `cropDurationRegistry` (new) + `weatherOperationalInterpreter`
 *   (existing) + recent scan history. It does NOT duplicate any
 *   engine. It does NOT hardcode timelines globally — every output
 *   is honest about being an estimate.
 *
 *   The 9 stages are an UI vocabulary; internally we map the
 *   underlying estimator's stage names (planning / land_preparation
 *   / planting / germination / vegetative / flowering / fruiting /
 *   harvest / post_harvest) to it.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. Honest wording — no guaranteed
 *     yield, no exact diagnoses. Every user-visible string is a
 *     { key, fallback, params } envelope.
 */

import { estimateCropStage } from '../cropStageEstimator.js';
import { estimateHarvestWindow, getDurationDays } from './cropDurationRegistry.js';

export const LIFECYCLE_STAGE = Object.freeze({
  PLANNING:           'planning',
  PLANTING:           'planting',
  GERMINATION:        'germination',
  SEEDLING:           'seedling',
  // EARLY_GROWTH is kept as an alias for legacy callers — newer
  // surfaces should use GERMINATION / SEEDLING explicitly.
  EARLY_GROWTH:       'early_growth',
  VEGETATIVE_GROWTH:  'vegetative_growth',
  FLOWERING:          'flowering',
  FRUITING:           'fruiting',
  HARVEST_READY:      'harvest_ready',
  HARVEST:            'harvest',
  POST_HARVEST:       'post_harvest',
});

// Map cropStageEstimator's vocabulary → the spec's stages.
const _STAGE_REMAP = Object.freeze({
  planning:          LIFECYCLE_STAGE.PLANNING,
  land_preparation:  LIFECYCLE_STAGE.PLANNING,
  planting:          LIFECYCLE_STAGE.PLANTING,
  germination:       LIFECYCLE_STAGE.GERMINATION,
  seedling:          LIFECYCLE_STAGE.SEEDLING,
  early_growth:      LIFECYCLE_STAGE.SEEDLING,
  vegetative:        LIFECYCLE_STAGE.VEGETATIVE_GROWTH,
  vegetative_growth: LIFECYCLE_STAGE.VEGETATIVE_GROWTH,
  flowering:         LIFECYCLE_STAGE.FLOWERING,
  fruiting:          LIFECYCLE_STAGE.FRUITING,
  harvest_ready:     LIFECYCLE_STAGE.HARVEST_READY,
  harvest:           LIFECYCLE_STAGE.HARVEST,
  post_harvest:      LIFECYCLE_STAGE.POST_HARVEST,
});

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const _num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

function _msg(template, params) {
  const p = (params && typeof params === 'object') ? params : {};
  return { key: template.key, fallback: template.fallback, params: { ...p } };
}

// ── Stage tasks ─────────────────────────────────────────────
// Each stage has 1–3 task envelopes the task generator can
// consume. `actionType` mirrors the existing task taxonomy.
const STAGE_TASKS = Object.freeze({
  planning: [
    { key: 'lifecycle.task.prepare_soil',    fallback: 'Prepare soil and plan spacing for {crop}.',           actionType: 'plan' },
    { key: 'lifecycle.task.choose_variety',  fallback: 'Choose a {crop} variety that suits your region.',     actionType: 'plan' },
  ],
  planting: [
    { key: 'lifecycle.task.water_after_plant',fallback:'Water {crop} gently after planting.',                  actionType: 'water' },
    { key: 'lifecycle.task.protect_seedling',fallback: 'Protect young {crop} from strong sun and wind.',      actionType: 'inspect' },
  ],
  germination: [
    { key: 'lifecycle.task.keep_moist',      fallback: 'Keep the soil moist — but not soaked — while {crop} germinates.', actionType: 'water' },
    { key: 'lifecycle.task.shade_seeds',     fallback: 'Shade or cover {crop} seeds during very hot afternoons.',        actionType: 'inspect' },
  ],
  seedling: [
    { key: 'lifecycle.task.watch_seedlings', fallback: 'Watch {crop} seedlings daily for signs of stress.',   actionType: 'inspect' },
    { key: 'lifecycle.task.gentle_watering', fallback: 'Keep watering steady — {crop} roots are still small.',actionType: 'water' },
  ],
  // Legacy alias — kept so older callers using EARLY_GROWTH still
  // see tasks.
  early_growth: [
    { key: 'lifecycle.task.watch_seedlings', fallback: 'Watch {crop} seedlings daily for signs of stress.',   actionType: 'inspect' },
    { key: 'lifecycle.task.gentle_watering', fallback: 'Keep watering steady — {crop} roots are still small.',actionType: 'water' },
  ],
  vegetative_growth: [
    { key: 'lifecycle.task.feed_lightly',    fallback: 'Feed {crop} lightly; do not over-fertilise.',         actionType: 'feed' },
    { key: 'lifecycle.task.check_pests',     fallback: 'Check {crop} leaves for pests and spots.',            actionType: 'inspect' },
    { key: 'lifecycle.task.prune_if_needed', fallback: 'Prune {crop} if growth is crowded.',                  actionType: 'prune' },
  ],
  flowering: [
    { key: 'lifecycle.task.check_pollination',fallback:'Watch {crop} flowers — gentle pollination helps.',    actionType: 'inspect' },
    { key: 'lifecycle.task.steady_water',    fallback: 'Keep water steady; flower drop is often water stress.',actionType: 'water' },
  ],
  fruiting: [
    { key: 'lifecycle.task.support_fruit',   fallback: 'Support heavy {crop} fruit where needed.',            actionType: 'inspect' },
    { key: 'lifecycle.task.watch_for_rot',   fallback: 'Watch fruit for spots or rot signs.',                 actionType: 'inspect' },
  ],
  harvest_ready: [
    { key: 'lifecycle.task.check_readiness', fallback: '{crop} may be close to harvest — check colour and firmness.', actionType: 'inspect' },
    { key: 'lifecycle.task.plan_storage',    fallback: 'Plan storage and transport before harvest.',          actionType: 'plan' },
  ],
  harvest: [
    { key: 'lifecycle.task.harvest_cool',    fallback: 'Harvest {crop} in the cool morning if possible.',     actionType: 'harvest' },
    { key: 'lifecycle.task.handle_gently',   fallback: 'Handle harvested {crop} gently to avoid bruising.',   actionType: 'harvest' },
  ],
  post_harvest: [
    { key: 'lifecycle.task.dry_or_store',    fallback: 'Dry or store {crop} in a cool, dry place.',           actionType: 'store' },
    { key: 'lifecycle.task.record_yield',    fallback: 'Record what you harvested — it improves next season.',actionType: 'log' },
    { key: 'lifecycle.task.consider_listing',fallback: 'Consider listing extra {crop} on the marketplace.',   actionType: 'sell' },
  ],
});

const NEXT_HINT = Object.freeze({
  planning:           { key: 'lifecycle.hint.planting',           fallback: 'Next: planting day — prepare soil and seeds.' },
  planting:           { key: 'lifecycle.hint.germination',        fallback: 'Next: germination — keep soil moist, shade from heat.' },
  germination:        { key: 'lifecycle.hint.seedling',           fallback: 'Next: seedling — watch seedlings closely.' },
  seedling:           { key: 'lifecycle.hint.vegetative',         fallback: 'Next: vegetative growth — feed lightly, prune.' },
  early_growth:       { key: 'lifecycle.hint.vegetative',         fallback: 'Next: vegetative growth — feed lightly, prune.' },
  vegetative_growth:  { key: 'lifecycle.hint.flowering',          fallback: 'Next: flowering — keep water steady.' },
  flowering:          { key: 'lifecycle.hint.fruiting',           fallback: 'Next: fruiting — support heavy fruit.' },
  fruiting:           { key: 'lifecycle.hint.harvest_ready',      fallback: 'Next: harvest readiness — check colour and firmness.' },
  harvest_ready:      { key: 'lifecycle.hint.harvest',            fallback: 'Next: harvest — pick in the cool morning.' },
  harvest:            { key: 'lifecycle.hint.post_harvest',       fallback: 'Next: storage and yield record.' },
  post_harvest:       { key: 'lifecycle.hint.next_season',        fallback: 'Plan next season; use this season\'s notes.' },
});

const WEATHER_ADJUST = Object.freeze({
  cool_wet:  { key: 'lifecycle.weather.cool_wet',  fallback: 'Cool, wet conditions may slow {crop} growth this week.' },
  hot_dry:   { key: 'lifecycle.weather.hot_dry',   fallback: 'Hot, dry days ahead — water {crop} early; expect faster growth.' },
  rainy:     { key: 'lifecycle.weather.rainy',     fallback: 'Rain expected — you may delay watering {crop}.' },
  steady:    { key: 'lifecycle.weather.steady',    fallback: 'Weather looks steady for {crop} this week.' },
});

const SCAN_ADJUST = Object.freeze({
  recent_stress: { key: 'lifecycle.scan.recent_stress', fallback: 'A recent scan flagged stress on {crop} — check the affected leaves.' },
  recent_fungal: { key: 'lifecycle.scan.recent_fungal', fallback: 'A recent scan suggested fungal-like signs — water at the base, not on leaves.' },
  recent_pest:   { key: 'lifecycle.scan.recent_pest',   fallback: 'A recent scan suggested pest damage — inspect undersides of leaves.' },
  clear:         null,
});

// ── Mode-aware crop label ───────────────────────────────────
function _cropLabel(crop, mode) {
  const c = String(crop || '').trim();
  if (c) return c;
  return _str(mode) === 'farmer' ? 'the crop' : 'your plants';
}

// ── Weather classification — minimal, honest ────────────────
function _classifyWeather(weather) {
  if (!weather || typeof weather !== 'object') return 'steady';
  const t = _num(weather.temperatureC);
  const h = _num(weather.humidityPct);
  const p = _num(weather.rainProbability24hPct);
  const r = _num(weather.rainfallTodayMm);
  if ((p != null && p >= 70) || (r != null && r >= 5)) return 'rainy';
  if (t != null && t >= 30 && (h == null || h < 50)) return 'hot_dry';
  if (t != null && t <= 22 && h != null && h >= 80)  return 'cool_wet';
  return 'steady';
}

// ── Scan history → adjustment key ───────────────────────────
function _classifyScans(scanHistory) {
  try {
    const list = Array.isArray(scanHistory) ? scanHistory : [];
    if (list.length === 0) return 'clear';
    // Use the most recent entry's category.
    const recent = list[list.length - 1];
    const cat = _str(recent && (recent.issueCategory || recent.category));
    if (cat === 'fungal_risk' || cat === 'leaf_spot' || cat === 'fruit_rot') return 'recent_fungal';
    if (cat === 'pest_damage') return 'recent_pest';
    if (cat && cat !== 'unknown_needs_clearer_photo' && cat !== 'healthy') return 'recent_stress';
    return 'clear';
  } catch {
    return 'clear';
  }
}

/**
 * Compute the lifecycle snapshot for a crop / plant.
 *
 * @param {object} input
 * @param {string} input.crop
 * @param {string} [input.cropId]       alias for crop (matches cropStageEstimator)
 * @param {string|number|Date} [input.plantingDate]
 * @param {object} [input.weather]      { temperatureC, humidityPct, rainProbability24hPct, rainfallTodayMm }
 * @param {Array}  [input.scanHistory]  e.g. [{ issueCategory, at }]
 * @param {string} [input.mode]         'farmer' | 'gardener'
 * @param {string} [input.climate]      for the duration registry
 * @param {string} [input.setting]      'field' | 'container' | 'pot' | 'indoor' | …
 * @param {number} [input.nowMs]
 * @returns {object}
 */
export function computeLifecycleSnapshot(input) {
  try {
    const i = (input && typeof input === 'object') ? input : {};
    const cropOrId = i.crop || i.cropId || '';
    const mode = _str(i.mode) === 'farmer' ? 'farmer' : 'gardener';
    const cropLabel = _cropLabel(cropOrId, mode);
    const cropParams = { crop: cropLabel };
    const nowMs = Number.isFinite(i.nowMs) ? i.nowMs : Date.now();

    // 1. Stage from the existing estimator (or PLANNING when no
    //    planting date — never assume a date).
    const est = estimateCropStage({ cropId: cropOrId, plantingDate: i.plantingDate, now: nowMs });
    const remapped = _STAGE_REMAP[_str(est && est.stage)] || LIFECYCLE_STAGE.PLANNING;
    const currentStage = (est && est.needsPlantingDate) ? LIFECYCLE_STAGE.PLANNING : remapped;
    const daysSincePlanting = (est && Number.isFinite(est.daysSincePlanting))
      ? est.daysSincePlanting : null;

    // 2. Harvest window — honest estimate or `null` when unknown.
    let harvestWindow = null;
    if (i.plantingDate) {
      const w = estimateHarvestWindow(cropOrId, i.plantingDate, {
        climate: i.climate, setting: i.setting, nowMs,
      });
      if (w && w.ok) harvestWindow = w;
    }
    // When we don't know the planting date but the crop is known,
    // we still expose the duration range so Home can say
    // "tomato usually takes 60–90 days".
    let durationDays = null;
    const dur = getDurationDays(cropOrId, { climate: i.climate, setting: i.setting });
    if (dur) durationDays = { min: dur.min, max: dur.max };

    // 3. Weather adjustment — single envelope (or null).
    const weatherKey = _classifyWeather(i.weather);
    const weatherAdjustment = WEATHER_ADJUST[weatherKey]
      ? _msg(WEATHER_ADJUST[weatherKey], cropParams)
      : null;

    // 4. Scan-history adjustment.
    const scanKey = _classifyScans(i.scanHistory);
    const scanAdjustment = SCAN_ADJUST[scanKey]
      ? _msg(SCAN_ADJUST[scanKey], cropParams)
      : null;

    // 5. Stage tasks — localizable envelopes.
    const taskTemplates = STAGE_TASKS[currentStage] || [];
    const stageTasks = taskTemplates.map((t) => ({
      titleKey:      t.key,
      titleFallback: t.fallback.replace('{crop}', cropLabel),
      actionType:    t.actionType,
      params:        { crop: cropLabel },
    }));

    // 6. Next-stage hint.
    const nextHint = NEXT_HINT[currentStage]
      ? _msg(NEXT_HINT[currentStage], cropParams)
      : null;

    return {
      crop:           cropOrId || null,
      cropLabel,
      mode,
      currentStage,
      daysSincePlanting,
      needsPlantingDate: !!(est && est.needsPlantingDate),
      harvestWindow,                       // null OR { earliest, latest, ... }
      durationDays,                        // null OR { min, max }
      weatherAdjustment,                   // envelope or null
      scanAdjustment,                      // envelope or null
      stageTasks,                          // [{ titleKey, titleFallback, actionType, params }]
      nextStageHint: nextHint,             // envelope or null
      disclaimer:    'Lifecycle estimates are guidance — local conditions vary, dates are not guaranteed.',
    };
  } catch {
    return _safeFallback(input);
  }
}

function _safeFallback(input) {
  const i = (input && typeof input === 'object') ? input : {};
  const mode = _str(i.mode) === 'farmer' ? 'farmer' : 'gardener';
  const cropLabel = _cropLabel(i.crop || i.cropId, mode);
  return {
    crop:              i.crop || null,
    cropLabel,
    mode,
    currentStage:      LIFECYCLE_STAGE.PLANNING,
    daysSincePlanting: null,
    needsPlantingDate: true,
    harvestWindow:     null,
    durationDays:      null,
    weatherAdjustment: null,
    scanAdjustment:    null,
    stageTasks:        [],
    nextStageHint:     null,
    disclaimer:        'Lifecycle estimates are guidance — local conditions vary, dates are not guaranteed.',
  };
}

const _module = {
  LIFECYCLE_STAGE,
  computeLifecycleSnapshot,
};
export default _module;
