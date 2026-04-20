/**
 * taskEngine.js — deterministic, offline-first task generator.
 *
 * Turns real farming context (crop, stage, weather, location) into
 * a small ordered task list:
 *
 *   generateTasks({
 *     farm,          // optional { id, country, stateCode, cropStage, ... }
 *     crop,          // e.g. 'cassava' | 'maize' | 'rice'
 *     stage,         // 'land_prep' | 'planting' | 'early_growth' | 'maintain' | 'harvest' | 'post_harvest'
 *     weather,       // optional summary: { rainSoon, heavyRain, dry, severe, source? }
 *     location,      // optional { country, stateCode, lat, lng }
 *     completions,   // optional [{ taskId, completed, timestamp }]
 *   }) → {
 *     primaryTask,   // { id, key, titleKey, whyKey, priority, stage, reasons[] }
 *     secondaryTasks,// up to 3
 *     why,           // { key, severity } — top-level context line, may be null
 *   }
 *
 * Contract:
 *   • 100% pure — no IO, no network, no time drift
 *   • stable i18n keys only (UI localises)
 *   • never empty: if every task in the stage is complete, primaryTask
 *     is the bridge action "prepare for the next stage" / "check tomorrow's task"
 *   • safe on missing weather / location / crop
 *
 * Intentionally simple: templates per stage, one layer of crop overrides,
 * one layer of weather modifiers. No ML, no heuristics beyond those
 * stated in the spec.
 */

// ─── Stage templates (spec §2) ────────────────────────────────────
// Every template has a stable `id` (used for completion dedup), a
// titleKey + whyKey for i18n, and a starting priority that crop /
// weather layers can bump.
const STAGE_TEMPLATES = Object.freeze({
  land_prep: [
    { id: 'land_prep.clear_land',        titleKey: 'tasks.land_prep.clear_land',        whyKey: 'tasks.why.clear_land',        priority: 'high'   },
    { id: 'land_prep.prepare_ridges',    titleKey: 'tasks.land_prep.prepare_ridges',    whyKey: 'tasks.why.prepare_ridges',    priority: 'normal' },
    { id: 'land_prep.check_drainage',    titleKey: 'tasks.land_prep.check_drainage',    whyKey: 'tasks.why.check_drainage',    priority: 'normal', needs: 'rainSoon' },
  ],
  planting: [
    { id: 'planting.plant_crop',         titleKey: 'tasks.planting.plant_crop',         whyKey: 'tasks.why.plant_crop',         priority: 'high'   },
    { id: 'planting.confirm_spacing',    titleKey: 'tasks.planting.confirm_spacing',    whyKey: 'tasks.why.confirm_spacing',    priority: 'normal' },
    { id: 'planting.avoid_heavy_rain',   titleKey: 'tasks.planting.avoid_heavy_rain',   whyKey: 'tasks.why.avoid_heavy_rain',   priority: 'normal', needs: 'heavyRain' },
  ],
  early_growth: [
    { id: 'early_growth.inspect_growth', titleKey: 'tasks.early_growth.inspect_growth', whyKey: 'tasks.why.inspect_growth', priority: 'high'   },
    { id: 'early_growth.remove_weeds',   titleKey: 'tasks.early_growth.remove_weeds',   whyKey: 'tasks.why.remove_weeds',   priority: 'normal' },
    { id: 'early_growth.pest_check',     titleKey: 'tasks.early_growth.pest_check',     whyKey: 'tasks.why.pest_check',     priority: 'normal' },
  ],
  maintain: [
    { id: 'maintain.monitor_moisture',   titleKey: 'tasks.maintain.monitor_moisture',   whyKey: 'tasks.why.monitor_moisture',   priority: 'normal' },
    { id: 'maintain.weed_control',       titleKey: 'tasks.maintain.weed_control',       whyKey: 'tasks.why.weed_control',       priority: 'normal' },
    { id: 'maintain.pest_check',         titleKey: 'tasks.maintain.pest_check',         whyKey: 'tasks.why.pest_check',         priority: 'normal' },
  ],
  harvest: [
    { id: 'harvest.prepare_harvest',     titleKey: 'tasks.harvest.prepare_harvest',     whyKey: 'tasks.why.prepare_harvest',     priority: 'high'   },
    { id: 'harvest.protect_from_rain',   titleKey: 'tasks.harvest.protect_from_rain',   whyKey: 'tasks.why.protect_from_rain',   priority: 'normal', needs: 'rainSoon' },
  ],
  post_harvest: [
    { id: 'post_harvest.store_safely',   titleKey: 'tasks.post_harvest.store_safely',   whyKey: 'tasks.why.store_safely',   priority: 'high'   },
    { id: 'post_harvest.prepare_next',   titleKey: 'tasks.post_harvest.prepare_next',   whyKey: 'tasks.why.prepare_next',   priority: 'normal' },
  ],
});

// ─── Crop-specific overrides (spec §3) ────────────────────────────
// Each entry maps { stage → { taskId → { priority? , whyKey? } } }.
// Only lists cases the spec calls out — everything else falls through
// to the stage defaults.
const CROP_OVERRIDES = Object.freeze({
  cassava: {
    land_prep: {
      'land_prep.prepare_ridges': { priority: 'high' },
      'land_prep.check_drainage': { priority: 'high' },
    },
    early_growth: {
      'early_growth.remove_weeds': { priority: 'high' },
    },
  },
  maize: {
    planting: {
      'planting.plant_crop':       { priority: 'high' },
      'planting.confirm_spacing':  { priority: 'high' },
      'planting.avoid_heavy_rain': { priority: 'high' },
    },
  },
  rice: {
    planting: {
      'planting.plant_crop':       { priority: 'high' },
    },
    maintain: {
      'maintain.monitor_moisture': { priority: 'high',
                                     whyKey: 'tasks.why.water_management_rice' },
    },
  },
});

// Symbolic priority rank — lower is higher priority.
const PRIORITY_RANK = Object.freeze({ high: 0, normal: 1, low: 2 });

function normalizePriority(p) {
  const s = String(p || '').toLowerCase();
  if (s === 'high' || s === '1' || s === 'primary') return 'high';
  if (s === 'low'  || s === '3')                    return 'low';
  return 'normal';
}

function cloneTask(tpl) {
  return {
    id:         tpl.id,
    key:        tpl.id,       // stable key for UI-side lookup
    titleKey:   tpl.titleKey,
    whyKey:     tpl.whyKey,
    priority:   tpl.priority || 'normal',
    stage:      tpl.stage || null,
    reasons:    [],           // filled by weather/crop layer
    needs:      tpl.needs || null,
  };
}

function applyCropOverrides(tasks, cropCode, stage) {
  const code = String(cropCode || '').toLowerCase();
  const overrides = CROP_OVERRIDES[code] && CROP_OVERRIDES[code][stage];
  if (!overrides) return tasks;
  return tasks.map((task) => {
    const ov = overrides[task.id];
    if (!ov) return task;
    return {
      ...task,
      priority: normalizePriority(ov.priority || task.priority),
      whyKey:   ov.whyKey  || task.whyKey,
      reasons:  [...task.reasons, 'crop_override'],
    };
  });
}

/**
 * applyWeatherModifiers — spec §4.
 *
 *   rainSoon   → push drainage/prep tasks to HIGH priority
 *   heavyRain  → promote "avoid planting in heavy rain" + mark warning
 *   dry        → push moisture/water tasks to HIGH priority
 *   severe     → sets top-level `why` to a severe warning code
 *
 * Also drops templates whose `needs` precondition isn't met
 * (e.g. "check drainage" only appears if rainSoon is true).
 */
function applyWeatherModifiers(tasks, weather) {
  const w = weather || {};
  const active = [];
  for (const task of tasks) {
    // Skip weather-gated templates when the trigger isn't active.
    if (task.needs === 'rainSoon'  && !w.rainSoon)  continue;
    if (task.needs === 'heavyRain' && !w.heavyRain) continue;
    active.push(task);
  }
  return active.map((task) => {
    let priority = task.priority;
    const reasons = [...task.reasons];
    if (w.rainSoon && /drainage|ridges|prepare_harvest|protect_from_rain/.test(task.id)) {
      priority = 'high'; reasons.push('weather_rain_soon');
    }
    if (w.heavyRain && task.id === 'planting.avoid_heavy_rain') {
      priority = 'high'; reasons.push('weather_heavy_rain');
    }
    if (w.dry && /monitor_moisture|water/.test(task.id)) {
      priority = 'high'; reasons.push('weather_dry');
    }
    return { ...task, priority, reasons };
  });
}

function pickTopLevelWhy(weather) {
  const w = weather || {};
  if (w.severe)    return { key: 'tasks.why.weather_severe',    severity: 'high'   };
  if (w.heavyRain) return { key: 'tasks.why.weather_heavy_rain', severity: 'high'   };
  if (w.rainSoon)  return { key: 'tasks.why.weather_rain_soon',  severity: 'medium' };
  if (w.dry)       return { key: 'tasks.why.weather_dry',        severity: 'medium' };
  return null;
}

function completedIds(completions) {
  const s = new Set();
  for (const c of (completions || [])) {
    if (!c || !c.taskId) continue;
    if (c.completed === false) continue;
    s.add(String(c.taskId));
  }
  return s;
}

function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    const ra = PRIORITY_RANK[a.priority] ?? 1;
    const rb = PRIORITY_RANK[b.priority] ?? 1;
    return ra - rb;
  });
}

/**
 * bridgeTask — never-empty fallback used when every task for the
 * current stage is already complete. Uses the same i18n keys the
 * Progress Engine uses for its own bridge actions.
 */
function bridgeTask({ stageCompletionPercent = 100 } = {}) {
  const bridgeKey = stageCompletionPercent >= 80
    ? 'progress.prepare_next_stage'
    : 'progress.check_tomorrow';
  return Object.freeze({
    id:       bridgeKey,
    key:      bridgeKey,
    titleKey: bridgeKey,
    whyKey:   null,
    priority: 'normal',
    stage:    null,
    reasons:  ['bridge'],
    kind:     'bridge',
  });
}

// ─── Main export ──────────────────────────────────────────────────
export function generateTasks({
  farm = null,
  crop = null,
  stage = null,
  weather = null,
  location = null,            // reserved — currently informational only
  completions = [],
} = {}) {
  // Resolve stage + crop defensively from farm when omitted.
  const resolvedStage = stage
    || (farm && (farm.cropStage || farm.stage))
    || null;
  const resolvedCrop = (crop || (farm && (farm.cropType || farm.crop)) || '')
    .toString().toLowerCase() || null;

  const base = STAGE_TEMPLATES[resolvedStage] || [];
  // Clone + tag with stage so downstream callers know context.
  const stageTagged = base.map((tpl) => cloneTask({ ...tpl, stage: resolvedStage }));

  // Layer 1 — weather filter + priority bumps.
  const weathered = applyWeatherModifiers(stageTagged, weather);
  // Layer 2 — crop-specific overrides.
  const cropped = applyCropOverrides(weathered, resolvedCrop, resolvedStage);
  // Remove already-completed tasks.
  const done = completedIds(completions);
  const remaining = cropped.filter((t) => !done.has(String(t.id)));

  const why = pickTopLevelWhy(weather);

  if (remaining.length === 0) {
    // Never empty — surface a bridge action as the primary.
    const stageCompletionPercent = cropped.length > 0
      ? Math.round(((cropped.length - remaining.length) / cropped.length) * 100)
      : 100;
    const bridge = bridgeTask({ stageCompletionPercent });
    return Object.freeze({
      primaryTask:    bridge,
      secondaryTasks: Object.freeze([]),
      why,
    });
  }

  const sorted = sortByPriority(remaining);
  const [primary, ...rest] = sorted;
  const secondaries = rest.slice(0, 3);

  return Object.freeze({
    primaryTask:    Object.freeze({ ...primary, kind: 'task' }),
    secondaryTasks: Object.freeze(secondaries.map((t) => Object.freeze({ ...t, kind: 'task' }))),
    why,
                                    // Location is not used for ranking today
                                    // but is plumbed so later rules (regional
                                    // pest pressure, state rainfall norms)
                                    // can slot in without changing callers.
    _location: location,
  });
}

// Small helper: does this farm have weather suggesting a severe event?
export function weatherIsSevere(weather) {
  const w = weather || {};
  return !!(w.severe || w.heavyRain);
}

export const _internal = Object.freeze({
  STAGE_TEMPLATES,
  CROP_OVERRIDES,
  PRIORITY_RANK,
  applyWeatherModifiers,
  applyCropOverrides,
  sortByPriority,
});

export default generateTasks;
