/**
 * dailyPlanEngine.js — produces the user-visible "Today's Plan"
 * from a normalised growing context.
 *
 *   import { generateDailyPlan } from '../core/dailyPlanEngine.js';
 *   import { buildGrowingContext } from '../core/growingContext.js';
 *
 *   const ctx  = buildGrowingContext({ farm, weather });
 *   const plan = generateDailyPlan(ctx);
 *
 *   // plan = {
 *   //   priority:        string,
 *   //   reason:          string,
 *   //   tasks:           string[]   // 1..3 items, never empty
 *   //   riskAlerts:      string[]   // 0..3 items
 *   //   tomorrowPreview: string,
 *   // }
 *
 * Why this engine exists alongside farrowayIntelligenceEngine
 * ───────────────────────────────────────────────────────────
 * The legacy `farrowayIntelligenceEngine.generateIntelligentPlan`
 * is shaped around a richer object the previous Today card
 * rendered (todaysPriority + secondaryTasks + riskSignals + …).
 * The Final Daily Plan Engine Upgrade spec wants a tighter, less
 * prescriptive contract:
 *
 *     priority + reason + 3 tasks + riskAlerts + tomorrowPreview
 *
 * Keeping the new engine in its own file means we don't have to
 * mutate the existing engine's shape (which other surfaces still
 * depend on — DailyPlanCard's adapter, the admin Daily
 * Intelligence Usage card, etc.). DailyPlanCard now composes
 * BOTH engines: the new one drives the visible plan, the legacy
 * one stays for back-compat slots.
 *
 * Design rules (per spec §6)
 *   • ALWAYS exactly 1 priority + 1 reason + 1 tomorrow preview.
 *   • At most 3 tasks. Never zero — fallback path always
 *     produces a 3-task generic check-in (spec §8).
 *   • Garden uses `setup`; farm uses `size`. Crops add tasks;
 *     weather can OVERRIDE the priority (rain → skip watering)
 *     and ALWAYS adds risks/tasks when fields are present.
 *   • No chemical / dosage / brand-name language. Tasks read as
 *     simple farmer-friendly prompts.
 *
 * Strict-rule audit
 *   • Pure function. No I/O, no side effects.
 *   • Never throws. Every read is wrapped + falls through to
 *     the spec §8 fallback plan.
 *   • Coexists with the legacy engines — DailyPlanCard chooses
 *     which one drives the visible card via composition.
 */

// Spec §6 — task list cap. The card UI is built around at most
// three tasks; anything beyond that crowds the screen and
// dilutes the priority signal.
const MAX_TASKS = 3;

/**
 * Garden setup → priority + reason + 3 base tasks. Spec §3.
 * Each entry is the FULL recipe for that setup; the engine
 * picks one based on context.setup and trims tasks to MAX_TASKS.
 */
const GARDEN_SETUP_RULES = Object.freeze({
  container: {
    priority: 'Check container soil moisture',
    reason:   'Pots dry faster than garden soil.',
    tasks: [
      'Make sure the pot drains well',
      'Water only if top soil feels dry',
      'Scan if you see spots or holes',
    ],
  },
  raised_bed: {
    priority: 'Check spacing and soil moisture',
    reason:   'Raised beds warm and dry faster than open ground.',
    tasks: [
      'Check spacing between plants',
      'Water only if soil feels dry below the surface',
      'Scan if you see spots, holes, or wilting',
    ],
  },
  ground: {
    priority: 'Check soil and nearby weeds',
    reason:   'Garden soil keeps moisture longer, but weeds compete fast.',
    tasks: [
      'Pull any weeds growing near your plants',
      'Press the soil — water only if it feels dry',
      'Scan if you see spots, holes, or insects',
    ],
  },
  indoor_balcony: {
    priority: 'Check light exposure',
    reason:   'Indoor plants need consistent light to stay strong.',
    tasks: [
      'Move pots toward the brightest spot today',
      'Water only if top soil feels dry',
      'Scan if you see yellowing or stretched stems',
    ],
  },
});

/**
 * Farm size → priority + reason + base tasks. Spec §4.
 * Small farms get a single-area inspection prompt; medium /
 * large farms get the multi-area scout prompt.
 */
const FARM_SIZE_RULES = Object.freeze({
  small: {
    priority: 'Check crop leaves today',
    reason:   'A short walk through your plot catches issues early.',
    tasks: [
      'Walk the field once and look at the crop leaves',
      'Note anything that looks different from yesterday',
      'Scan if you see spots, holes, or insects',
    ],
  },
  medium: {
    priority: 'Scout multiple crop areas',
    reason:   'A medium plot needs at least three sample points.',
    tasks: [
      'Pick three areas — corner, middle, and edge',
      'Compare the leaves at each point',
      'Scan if you see spots, holes, or insects',
    ],
  },
  large: {
    priority: 'Scout multiple crop areas',
    reason:   'Larger plots hide problems — sample several spots.',
    tasks: [
      'Walk five areas across the field',
      'Compare the leaves at each point',
      'Scan if you see spots, holes, or insects',
    ],
  },
});

/**
 * Crop-specific add-on tasks. Spec §4 list — pepper, maize,
 * tomato. Each crop appends ONE additional inspection task to
 * the list returned by the size/setup rule. We dedupe before
 * the cap so a crop add-on never displaces the priority's
 * own scan task.
 */
const CROP_ADDON = Object.freeze({
  pepper:  'Inspect under leaves for pests',
  maize:   'Look for streaks, holes, or dry leaf edges',
  tomato:  'Check lower leaves for spots',
});

// Lowercase + alias map so a crop key persisted in any case
// (e.g. "Pepper", "PEPPER", "bell pepper") still resolves to
// the right add-on. Aliases include the common synonyms our
// onboarding tiles plus the crop-aliases module use.
function _normaliseCrop(name) {
  if (!name) return null;
  const n = String(name).toLowerCase().trim();
  if (!n) return null;
  if (n.includes('pepper'))  return 'pepper';
  if (n.includes('maize') || n === 'corn')  return 'maize';
  if (n.includes('tomato'))  return 'tomato';
  return null;
}

/**
 * Read a weather field from any of the engine's tolerated
 * names. Mirrors the readers in farrowayIntelligenceEngine so
 * a weather snapshot built for either engine still works here.
 *
 * @returns {number|null}
 */
function _wNum(weather, ...keys) {
  if (!weather || typeof weather !== 'object') return null;
  for (const k of keys) {
    const v = weather[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * Spec §5 — weather-derived facets. Each may flip on/off
 * independently:
 *
 *   • rainExpected — flips priority to "Skip watering today"
 *   • highHumidity — adds a leaf-spot / mold risk alert
 *   • highTemp     — adds a soil-moisture timing task
 *   • strongWind   — adds a no-spraying-now task
 *
 * Thresholds match the spec text. Wind is in km/h to match the
 * cached weather object's `wind` / `windKmh` field.
 */
function _readWeatherFacets(weather) {
  const rainChance = _wNum(weather, 'rainChance', 'rain', 'precipChance', 'rainProbability');
  const humidity   = _wNum(weather, 'humidity', 'relativeHumidity');
  const temp       = _wNum(weather, 'temp', 'temperatureC', 'temperature');
  const wind       = _wNum(weather, 'wind', 'windKmh', 'windSpeed');

  // "Rain expected" follows the engine convention used elsewhere:
  // a probability ≥ 60 % counts as expected. Empty / missing
  // chance just means "no rain signal" — never override priority.
  const rainExpected = rainChance != null && rainChance >= 60;
  // Spec §5 thresholds.
  const highHumidity = humidity != null && humidity > 70;
  const highTemp     = temp     != null && temp > 30;
  // Strong wind: > 25 km/h covers most "uncomfortable to spray"
  // conditions a farmer would recognise. Below that, sprays
  // still drift but the farmer would normally sense the change.
  const strongWind   = wind     != null && wind > 25;

  return { rainExpected, highHumidity, highTemp, strongWind };
}

/**
 * Build the tomorrow-preview line. Spec §6 — always present, one
 * short sentence the farmer can read at a glance. Driven by:
 *   • rain expected today → "Watering may not be needed tomorrow."
 *   • high humidity        → "Watch for new leaf spots tomorrow."
 *   • high temp           → "Plan watering early or late tomorrow."
 *   • strong wind         → "Wind should ease tomorrow — good time to scout."
 *   • garden + container  → "Re-check pot soil moisture tomorrow."
 *   • garden default      → "Re-check your plants tomorrow."
 *   • farm default        → "Walk the field again tomorrow."
 */
function _tomorrowPreview(ctx, w) {
  if (w.rainExpected)  return 'Watering may not be needed tomorrow.';
  if (w.highHumidity)  return 'Watch for new leaf spots tomorrow.';
  if (w.highTemp)      return 'Plan watering early or late tomorrow.';
  if (w.strongWind)    return 'Wind should ease tomorrow — good time to scout.';
  if (ctx.type === 'garden' && ctx.setup === 'container') {
    return 'Re-check pot soil moisture tomorrow.';
  }
  if (ctx.type === 'garden') return 'Re-check your plants tomorrow.';
  return 'Walk the field again tomorrow.';
}

/**
 * Spec §8 — fallback plan when context is empty / unknown.
 * Garden falls through to the plant-check copy; farm falls
 * through to the crop-check copy. Three generic tasks each.
 */
function _fallbackPlan(type) {
  const isGarden = type === 'garden';
  return {
    priority: isGarden ? 'Check your plant today' : 'Check your crop today',
    reason:   isGarden
      ? 'A short check-in keeps small problems from growing.'
      : 'A short walk through the field catches issues early.',
    tasks: [
      'Water only if soil is dry',
      'Look for spots, holes, or insects',
      'Scan if you see damage',
    ],
    riskAlerts:      [],
    tomorrowPreview: isGarden
      ? 'Re-check your plants tomorrow.'
      : 'Walk the field again tomorrow.',
  };
}

/**
 * Trim + dedupe a task list to MAX_TASKS. Empty / non-string
 * entries drop out. Dedupe is case-insensitive on the trimmed
 * value so "Water only if soil is dry" and the same string
 * with trailing whitespace don't both appear.
 */
function _capTasks(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out  = [];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_TASKS) break;
  }
  return out;
}

/**
 * generateDailyPlan(context) → spec-shaped plan.
 *
 * @param {object} context — output of buildGrowingContext().
 * @returns {{
 *   priority:        string,
 *   reason:          string,
 *   tasks:           string[],   // 1..3 items, never empty
 *   riskAlerts:      string[],   // 0..3 items
 *   tomorrowPreview: string,
 * }}
 *
 * Pure function. Never throws. Output is shape-stable across
 * all branches — the card UI never has to null-check a field.
 */
export function generateDailyPlan(context) {
  // Defensive cast — the spec says `context` is required, but
  // the engine MUST NEVER throw. A null/undefined context
  // collapses to the farm fallback path.
  const ctx = (context && typeof context === 'object') ? context : {};
  const type = (ctx.type === 'garden' || ctx.type === 'farm') ? ctx.type : 'farm';

  // Pick the base recipe by type + setup/size. Garden falls
  // through to the per-setup rule; farm to the per-size rule.
  let base = null;
  if (type === 'garden') {
    base = GARDEN_SETUP_RULES[ctx.setup] || null;
  } else {
    base = FARM_SIZE_RULES[ctx.size] || null;
  }

  // Spec §8 fallback — when the context didn't carry a usable
  // setup / size, return the generic check-in. The garden vs
  // farm split still happens so the priority text matches what
  // the user is actually growing.
  if (!base) {
    const fallback = _fallbackPlan(type);
    // Even on the fallback path, weather facets still apply —
    // a missing setup/size doesn't mean we should ignore rain.
    const wf = _readWeatherFacets(ctx.weather);
    return _applyWeather(fallback, wf, ctx);
  }

  // Compose the base recipe into a fresh plan object so the
  // module-level constants aren't mutated by the weather /
  // crop add-on logic below.
  let plan = {
    priority:        base.priority,
    reason:          base.reason,
    tasks:           Array.isArray(base.tasks) ? base.tasks.slice() : [],
    riskAlerts:      [],
    tomorrowPreview: '',
  };

  // Crop-specific add-on (spec §4). Farm-only — gardens already
  // get a setup-specific scan task that covers the same surface.
  // When the crop matches one of the launch-set add-ons (pepper /
  // maize / tomato), we REPLACE the generic third "Scan if you
  // see spots..." task with the crop-specific inspection. The
  // crop add-on is already a more specific scan prompt, so
  // keeping both would push the list over MAX_TASKS and the cap
  // would silently drop the more useful line.
  if (type === 'farm') {
    const cropKey = _normaliseCrop(ctx.cropOrPlant);
    const addon   = cropKey ? CROP_ADDON[cropKey] : null;
    if (addon) {
      const lastIdx = plan.tasks.length - 1;
      const lastIsScan = lastIdx >= 0 && /^scan if you see/i.test(plan.tasks[lastIdx] || '');
      if (lastIsScan) {
        plan.tasks[lastIdx] = addon;
      } else {
        plan.tasks.push(addon);
      }
    }
  }

  // Apply weather facets — may override priority + reason
  // (rain expected) and add tasks + risk alerts.
  const wf = _readWeatherFacets(ctx.weather);
  plan = _applyWeather(plan, wf, ctx);

  return plan;
}

/**
 * Apply spec §5 weather facets to a partially-built plan.
 *
 * Order matters: rain check FIRST so it can override the
 * priority before we cap tasks (which would otherwise drop the
 * "skip watering" message into an already-full slot). Risks
 * accumulate but are also capped at 3 (matches the existing
 * `riskSignals` cap in farrowayIntelligenceEngine).
 */
function _applyWeather(plan, w, ctx) {
  let priority = plan.priority;
  let reason   = plan.reason;
  let tasks    = plan.tasks.slice();
  const risks  = plan.riskAlerts.slice();

  // Rain expected: hard-override the priority. Spec §5.
  // The original priority's tasks stay (the farmer still
  // benefits from the inspection prompt) — only the headline
  // shifts so the user doesn't water needlessly.
  if (w.rainExpected) {
    priority = 'Skip watering today';
    reason   = 'Rain is expected, so avoid overwatering.';
    // If the original task list mentioned watering, swap that
    // line out for the rain-aware version so the user doesn't
    // see a contradiction (priority says "skip" but task 2
    // says "water if dry").
    tasks = tasks.map((t) => (
      /water only if/i.test(t)
        ? 'Wait for the rain — no watering needed today'
        : t
    ));
  }

  // High humidity: add a leaf-spot / mold risk. Doesn't replace
  // tasks. Worded so the farmer can read it at a glance.
  if (w.highHumidity) {
    risks.push('Watch for leaf spots or mold');
  }

  // High temp: add a watering-timing task. We append rather
  // than override because the user might already be on a
  // setup-specific watering task; the timing nudge is additive.
  if (w.highTemp) {
    tasks.push('Check soil moisture early or late in the day');
  }

  // Strong wind: add a no-spraying task. Same additive logic.
  if (w.strongWind) {
    tasks.push('Avoid spraying during strong wind');
  }

  return {
    priority,
    reason,
    tasks:           _capTasks(tasks),
    riskAlerts:      risks.slice(0, 3),
    tomorrowPreview: _tomorrowPreview(ctx || {}, w),
  };
}

export default generateDailyPlan;
