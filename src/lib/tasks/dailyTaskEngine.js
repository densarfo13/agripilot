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

// ─── Main export ─────────────────────────────────────────────────
export function generateDailyTasks({
  crop = null,
  stage = null,
  plantingStatus = null,
  farmerType = null,
  completions = [],
  limit = DEFAULT_LIMIT,
  // eslint-disable-next-line no-unused-vars
  now = null,
} = {}) {
  const resolvedStage = resolveStage({ stage, plantingStatus });
  const { tasks, cropSource } = pickRuleSet(resolvedStage, crop);
  const done = completedIdSet(completions);

  const sanitized = tasks
    .filter((t) => t && t.id && !done.has(String(t.id)))
    .map((t, i) => ({
      id:       t.id,
      titleKey: t.titleKey,
      whyKey:   t.whyKey,
      priority: t.priority || 'medium',
      dueHint:  t.dueHint  || 'this_week',
      note:     t.note     || null,
      _order:   i,
    }));

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

export { PLANTING_STATUS_TO_STAGE, SUPPORTED_STAGES };
export const _internal = Object.freeze({ resolveStage, pickRuleSet, dueRank });
