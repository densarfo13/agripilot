/**
 * dailyTaskEngine.js — v1 rules-based daily task generator.
 *
 * Consumes the live onboarding + planting-guidance signals already
 * captured by the app and produces a small, prioritised list of
 * today's tasks + a "this week" preview.
 *
 *   generateDailyTasks({
 *     crop,              // 'maize' | 'rice' | …  (code, lowercase)
 *     stage?,            // explicit stage; wins over plantingStatus
 *     plantingStatus?,   // 'not_started' | 'planted' | 'growing' | 'near_harvest'
 *     farmerType?,       // 'new' | 'existing' | null
 *     completions?,      // [{ taskId, completed, timestamp }]
 *     limit?,            // max tasks surfaced for "today" (default 3)
 *     now?,              // Date for deterministic tests
 *   }) → {
 *     today:        Task[]            // top priorities (limit <= 3)
 *     thisWeek:     Task[]            // up to 3 upcoming
 *     stage:        resolved stage (or null when unknown)
 *     cropSource:   'crop' | 'generic' | 'none'
 *     farmerType:   'new' | 'existing' | null
 *     supported:    boolean           // true when we have rules + stage
 *   }
 *
 * Pure + deterministic. Every visible string is referenced by i18n
 * key (titleKey / whyKey / dueHint label keys) — the engine never
 * emits hardcoded English.
 */

import {
  RULES, SUPPORTED_STAGES, PRIORITY_RANK, PLANTING_STATUS_TO_STAGE,
} from '../../config/dailyTaskRules.js';

const DEFAULT_LIMIT = 3;

function normStage(stage) {
  if (!stage) return null;
  const s = String(stage).toLowerCase();
  return SUPPORTED_STAGES.includes(s) ? s : null;
}

/**
 * resolveStage — spec §3. Priority:
 *   1. explicit `stage` (when known)
 *   2. plantingStatus mapping
 *   3. safe default: pre_planting
 *
 * Also accepts legacy synonyms from the older taskEngine so callers
 * feeding it `lifecycleStatus` (land_prep / maintain / flowering) get
 * mapped without crashing.
 */
export function resolveStage({ stage, plantingStatus } = {}) {
  const direct = normStage(stage);
  if (direct) return direct;

  // Legacy synonyms mapping (existing taskEngine.js uses land_prep /
  // maintain / flowering / harvest_ready).
  const legacy = String(stage || '').toLowerCase();
  const legacyMap = {
    land_prep:      'pre_planting',
    planting:       'planting',
    early_growth:   'early_growth',
    maintain:       'mid_growth',
    flowering:      'mid_growth',
    harvest_ready:  'harvest',
    harvest:        'harvest',
    post_harvest:   'post_harvest',
  };
  if (legacy && legacyMap[legacy]) return legacyMap[legacy];

  if (plantingStatus && PLANTING_STATUS_TO_STAGE[plantingStatus]) {
    return PLANTING_STATUS_TO_STAGE[plantingStatus];
  }
  return 'pre_planting';
}

function completedIdSet(completions) {
  const s = new Set();
  for (const c of completions || []) {
    if (!c || c.taskId == null) continue;
    if (c.completed === false) continue;
    s.add(String(c.taskId));
  }
  return s;
}

/**
 * pickRuleSet — returns `{ tasks, cropSource }` for (stage, crop).
 * Prefers crop-specific templates, falls back to the generic set.
 */
function pickRuleSet(stage, crop) {
  const bucket = RULES[stage];
  if (!bucket) return { tasks: [], cropSource: 'none' };
  const cropKey = crop ? String(crop).toLowerCase() : null;
  if (cropKey && bucket.crops && bucket.crops[cropKey]
      && bucket.crops[cropKey].length > 0) {
    return { tasks: bucket.crops[cropKey], cropSource: 'crop' };
  }
  if (bucket.generic && bucket.generic.length > 0) {
    return { tasks: bucket.generic, cropSource: 'generic' };
  }
  return { tasks: [], cropSource: 'none' };
}

function dueRank(hint) {
  if (hint === 'today')     return 0;
  if (hint === 'soon')      return 1;
  if (hint === 'this_week') return 2;
  return 3;
}

/**
 * applyWeatherOverrides — promote weather-sensitive tasks to
 * today + high priority when the live forecast calls for it. Pure;
 * returns a new array. No-op when `weather` is falsy so callers
 * without a live signal keep the deterministic calendar behaviour.
 *
 * Rules (v1):
 *   • dry  / low_rain / dry_ahead  → monitor_moisture + manage_water → today/high
 *   • rain_soon                    → check_drainage → today/high
 *   • excessive_heat / extreme_heat→ monitor_moisture + manage_water → today/high
 */
function applyWeatherOverrides(tasks, weather) {
  if (!weather) return tasks;
  const status = weather.status || null;
  const cautions = Array.isArray(weather.cautions) ? weather.cautions : [];

  const dry  = status === 'low_rain' || status === 'dry_ahead'
            || cautions.includes('low_rain') || cautions.includes('dry_ahead');
  const hot  = status === 'excessive_heat'
            || cautions.includes('excessive_heat') || cautions.includes('extreme_heat');
  const rainSoon = status === 'rain_soon' || cautions.includes('rain_soon');

  return tasks.map((t) => {
    const id = t.id || '';
    if ((dry || hot) && /monitor_moisture|manage_water|water/.test(id)) {
      return { ...t, priority: 'high', dueHint: 'today' };
    }
    if (rainSoon && /check_drainage|drainage|prepare_ridges/.test(id)) {
      return { ...t, priority: 'high', dueHint: 'today' };
    }
    return t;
  });
}

// ─── Main export ─────────────────────────────────────────────────
export function generateDailyTasks({
  crop = null,
  stage = null,
  plantingStatus = null,
  farmerType = null,
  completions = [],
  limit = DEFAULT_LIMIT,
  weather = null,        // optional summarizeWeather shape
  // eslint-disable-next-line no-unused-vars
  now = null,
} = {}) {
  const resolvedStage = resolveStage({ stage, plantingStatus });
  const { tasks, cropSource } = pickRuleSet(resolvedStage, crop);
  const done = completedIdSet(completions);

  const sanitized = applyWeatherOverrides(
    tasks
      .filter((t) => t && t.id && !done.has(String(t.id)))
      .map((t, i) => ({
        id:       t.id,
        titleKey: t.titleKey,
        whyKey:   t.whyKey,
        priority: t.priority || 'medium',
        dueHint:  t.dueHint  || 'this_week',
        note:     t.note     || null,
        _order:   i,
      })),
    weather,
  );

  // Sort: dueHint (today > soon > this_week), then priority, then input order.
  sanitized.sort((a, b) =>
    (dueRank(a.dueHint) - dueRank(b.dueHint))
    || ((PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1))
    || (a._order - b._order),
  );

  const today = sanitized.filter((t) => t.dueHint === 'today');
  const later = sanitized.filter((t) => t.dueHint !== 'today');

  const todayList = today.slice(0, Math.max(1, Math.min(3, limit)));
  // Back-fill "today" with the highest-priority upcoming task when the
  // stage has no explicit "today" slot (e.g. mid_growth generic list
  // only has this_week items). Farmers should never see an empty
  // today section when we have rules available.
  const backfill = todayList.length === 0 && later.length > 0
    ? [later[0]]
    : [];
  const thisWeek = later
    .filter((t) => !backfill.some((b) => b.id === t.id))
    .slice(0, 3);

  const out = [...todayList, ...backfill].map((t) => toFrozenTask(t, farmerType));
  const upcoming = thisWeek.map((t) => toFrozenTask(t, farmerType));

  return Object.freeze({
    today:       Object.freeze(out),
    thisWeek:    Object.freeze(upcoming),
    stage:       resolvedStage,
    cropSource,
    farmerType:  farmerType === 'new' || farmerType === 'existing' ? farmerType : null,
    supported:   sanitized.length > 0,
  });
}

function toFrozenTask(t, farmerType) {
  return Object.freeze({
    id:             t.id,
    titleKey:       t.titleKey,
    whyKey:         t.whyKey,
    priority:       t.priority,
    dueHint:        t.dueHint,
    note:           t.note,
    farmerTypeHint: farmerType === 'new' || farmerType === 'existing' ? farmerType : null,
  });
}

/**
 * getTopTask — convenience for callers that only want today's #1.
 * Returns null when the engine can't produce anything.
 */
export function getTopTask(ctx) {
  const r = generateDailyTasks(ctx);
  return r.today[0] || null;
}

// ─── Location-aware facade (spec §3) ─────────────────────────────
// Simpler shape than `generateDailyTasks`, driven by crop + stage +
// weather + regionProfile. Rules are deterministic and always return
// at least one primaryTask so the UI never renders an empty Today
// card. The full engine above is preserved for existing callers.
//
// Rule cascade (first match wins for primary):
//   1. rain coming + harvest stage    → "Harvest early to avoid loss"
//   2. dry + planting stage           → "Irrigate if possible before planting"
//   3. planting stage (any)           → "Prepare land and plant seeds"
//   4. crop-aware stage defaults      → delegates to getTopTask
//   5. safe default                   → "Walk the field and note changes"
const WEATHER_RAIN_CODES = new Set(['rain_expected', 'rain_coming', 'heavy_rain']);
const WEATHER_DRY_CODES  = new Set(['dry', 'dry_ahead', 'low_rain', 'drought']);

function weatherIsRainy(weather) {
  if (!weather) return false;
  if (weather.rainExpected === true) return true;
  if (weather.status && WEATHER_RAIN_CODES.has(String(weather.status))) return true;
  if (Array.isArray(weather.cautions) && weather.cautions.some((c) => WEATHER_RAIN_CODES.has(c))) return true;
  return false;
}
function weatherIsDry(weather) {
  if (!weather) return false;
  if (weather.status && WEATHER_DRY_CODES.has(String(weather.status))) return true;
  if (Array.isArray(weather.cautions) && weather.cautions.some((c) => WEATHER_DRY_CODES.has(c))) return true;
  return false;
}
function weatherIsHot(weather) {
  if (!weather) return false;
  if (weather.status === 'excessive_heat') return true;
  if (Array.isArray(weather.cautions)
      && (weather.cautions.includes('extreme_heat')
          || weather.cautions.includes('excessive_heat'))) return true;
  return false;
}

/**
 * getDailyTask — location-aware single-task facade. Never returns
 * null primaryTask — the safe-default rule guarantees a value.
 */
export function getDailyTask({ crop, stage, weather, regionProfile } = {}) {
  const s = String(stage || '').toLowerCase();
  const rainy = weatherIsRainy(weather);
  const dry   = weatherIsDry(weather);
  const hot   = weatherIsHot(weather);
  const wetSeason = regionProfile && regionProfile.season === 'wet';
  const drySeason = regionProfile && regionProfile.season === 'dry';

  // Rule 1
  if (rainy && (s === 'harvest' || s === 'post_harvest')) {
    return Object.freeze({
      primaryTask: Object.freeze({
        id: 'loc.harvest_early',
        titleKey: 'tasks.harvest_early',
        title: 'Harvest early to avoid rain loss',
        priority: 'high', dueHint: 'today', reason: 'rain_expected',
      }),
      secondaryTask: null,
    });
  }

  // Rule 2
  if ((dry || drySeason) && (s === 'planting' || s === 'land_prep')) {
    return Object.freeze({
      primaryTask: Object.freeze({
        id: 'loc.irrigate_before_planting',
        titleKey: 'tasks.irrigate_before_planting',
        title: 'Irrigate if possible before planting',
        priority: 'high', dueHint: 'today', reason: 'dry_conditions',
      }),
      secondaryTask: hot ? Object.freeze({
        id: 'loc.shade_seedlings',
        titleKey: 'tasks.shade_seedlings',
        title: 'Shade young seedlings during the hottest hours',
        priority: 'medium', dueHint: 'today', reason: 'excessive_heat',
      }) : null,
    });
  }

  // Rule 3
  if (s === 'planting' || s === 'land_prep') {
    return Object.freeze({
      primaryTask: Object.freeze({
        id: 'loc.prepare_and_plant',
        titleKey: 'tasks.prepare_and_plant',
        title: 'Prepare the land and plant your seeds',
        priority: 'high', dueHint: 'today', reason: 'planting_season',
      }),
      secondaryTask: wetSeason ? Object.freeze({
        id: 'loc.check_drainage',
        titleKey: 'tasks.check_drainage',
        title: 'Check drainage channels before heavy rain',
        priority: 'medium', dueHint: 'this_week', reason: 'wet_season',
      }) : null,
    });
  }

  // Rule 4 — delegate to the existing engine for stage-specific tasks.
  const top = getTopTask({ crop, stage });
  if (top) {
    return Object.freeze({
      primaryTask: Object.freeze({
        id: top.id,
        titleKey: `tasks.${top.id}`,
        title: top.note || String(top.id).replace(/_/g, ' '),
        priority: top.priority || 'medium',
        dueHint:  top.dueHint  || 'today',
        reason:   top.reason   || 'stage_default',
      }),
      secondaryTask: null,
    });
  }

  // Rule 5 — always return something.
  return Object.freeze({
    primaryTask: Object.freeze({
      id: 'loc.walk_the_field',
      titleKey: 'tasks.walk_the_field',
      title: 'Walk the field and note anything new',
      priority: 'medium', dueHint: 'today', reason: 'safe_default',
    }),
    secondaryTask: null,
  });
}

export { PLANTING_STATUS_TO_STAGE, SUPPORTED_STAGES };
export const _internal = Object.freeze({
  resolveStage, pickRuleSet, dueRank, applyWeatherOverrides,
  weatherIsRainy, weatherIsDry, weatherIsHot,
});
