/**
 * buildUnifiedTodayAction — the one top-level decision function.
 *
 * Composes every layer the app already ships into a single,
 * deterministic priority chain. Returns ONE dominant task object for
 * Home to render — never null, never stacked.
 *
 * Priority (spec §2):
 *   1. active camera issue task        (not expired, relevant)
 *   2. blocking land task              (land state prevents progress)
 *   3. urgent crop task                (time/weather-sensitive)
 *   4. normal crop task                (calendar-driven, region-flavoured)
 *   5. off-season planning task
 *   6. fallback task                   (never-blank guarantee)
 *
 * Pure / synchronous. Reads cached context only; renders instantly
 * on low-end devices.
 *
 * Return shape (spec §1):
 *   {
 *     id, source, priority,
 *     title, why, steps, next, cta,
 *     stage, regionBucket,
 *     confidenceLine?, expiresAt?
 *   }
 */

import { buildLocalizedTask } from '../localization/globalContext.js';
import { applyWeatherAdjustments } from '../../engine/applyWeatherAdjustments.js';
import { resolveLandTask } from '../../engine/landAwareRules.js';
import { resolveAdaptiveTitleKey } from '../../engine/adaptiveWording.js';
import { listTemporaryTasks } from '../../services/temporaryTasks.js';

// ─── Helpers ──────────────────────────────────────────────

function isDev() {
  try { if (typeof import.meta !== 'undefined') return !!import.meta.env?.DEV; } catch { /* ignore */ }
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}

function nowMs() { return Date.now(); }

function tOrKey(t, key, vars) {
  if (!key) return '';
  if (typeof t === 'function') {
    const v = t(key, vars);
    return v || '';
  }
  return '';
}

function pipeSplit(t, key) {
  if (!key) return [];
  const v = tOrKey(t, key);
  if (!v) return [];
  return v.split('|').map(s => s.trim()).filter(Boolean);
}

function pickActiveIssueTask(tasks = [], now = nowMs()) {
  // Active = not completed, not expired. Newest wins.
  const active = tasks
    .filter(x => !x.completedAt && (x.expiresAt || 0) > now)
    .sort((a, b) => b.createdAt - a.createdAt);
  return active[0] || null;
}

function adaptiveTitleFor(taskType, cropCode, stage, t) {
  const { key, tier } = resolveAdaptiveTitleKey({ type: taskType, cropCode, stage });
  if (!key) return { title: '', tier: 'base' };
  return { title: tOrKey(t, key), tier };
}

function makeFallback(t) {
  // Never return null — Home always has an action (spec §10).
  return {
    id: 'fallback_tell_us_about_farm',
    source: 'fallback',
    priority: 'low',
    title: tOrKey(t, 'fallback.tellUs.title'),
    why: tOrKey(t, 'fallback.tellUs.why'),
    steps: [],
    next: '',
    cta: tOrKey(t, 'fallback.tellUs.cta'),
    stage: 'off_season',
    regionBucket: 'default',
    isFallback: true,
  };
}

// ─── Layer assemblers ─────────────────────────────────────

/**
 * 1. Active camera / land temporary task as the top override.
 *    Both are stored in the same temporaryTasks ring, so one query
 *    covers source: 'camera' | 'camera_diagnosis' | 'camera_followup'
 *    | 'land_check'. Caller can inject its own list for tests.
 */
function buildIssueTask(issueTask, t) {
  if (!issueTask) return null;
  return {
    id: issueTask.id,
    source: issueTask.source === 'land_check' ? 'land_check' : 'camera',
    priority: issueTask.priority || 'high',
    title: tOrKey(t, issueTask.titleKey),
    why: tOrKey(t, issueTask.whyKey),
    steps: pipeSplit(t, issueTask.stepsKey),
    next: '',
    cta: tOrKey(t, 'home.cta.fixToday'),
    stage: issueTask.stage || 'override',
    regionBucket: issueTask.regionBucket || null,
    expiresAt: issueTask.expiresAt || null,
    confidenceLine: issueTask.source === 'camera' ? tOrKey(t, 'unified.possibleIssue') : null,
    icon: issueTask.icon || null,
    taskType: issueTask.issueType || null,
  };
}

/**
 * 2. Blocking land task — only escalates when the land state would
 *    actively stop correct progress (uncleared / weeds / wet / poor
 *    drainage + rain / dry soil + planting).
 */
function buildLandTask(landProfile, cropStage, weatherNow, t) {
  const land = resolveLandTask({
    land: landProfile,
    cropStage,
    weather: weatherNow ? { rainExpected24h: !!weatherNow.rainExpected24h } : null,
  });
  if (!land) return null;
  return {
    id: `land_${land.type}`,
    source: 'land_check',
    priority: land.priority || 'high',
    title: tOrKey(t, land.titleKey),
    why: tOrKey(t, land.whyKey),
    steps: pipeSplit(t, land.stepsKey),
    next: '',
    cta: tOrKey(t, 'home.cta.fixToday'),
    stage: cropStage || 'prepare',
    regionBucket: null,
    taskType: land.type,
    icon: land.icon,
  };
}

/**
 * 3. Normal crop task — localized by country + calendar, weather-
 *    adjusted, and wording-adapted for multi-day incompletes.
 */
function buildCropTask({
  cropProfile, countryCode, month, weatherNow, baseTask, t, farmerProfile,
}) {
  if (!baseTask) return null;
  const crop = cropProfile?.cropId || cropProfile || null;
  let task = buildLocalizedTask({
    countryCode,
    cropId: crop,
    month,
    baseTask,
  }) || baseTask;

  // Off-season short-circuits render — spec §9 ensures it's a real task.
  if (task.isOffSeason) {
    return {
      id: task.id || 'off_season_planning',
      source: 'off_season',
      priority: 'low',
      title: tOrKey(t, task.titleKey),
      why: tOrKey(t, task.whyKey),
      steps: pipeSplit(t, task.stepsKey),
      next: '',
      cta: tOrKey(t, task.ctaKey || 'offSeason.cta'),
      stage: 'off_season',
      regionBucket: task.regionBucket || null,
      isOffSeason: true,
      icon: task.icon || '\uD83D\uDCC5',
    };
  }

  // Weather adjustments run AFTER localization; land task already
  // short-circuits ahead of this layer when it fires.
  if (weatherNow) task = applyWeatherAdjustments(task, weatherNow);

  // Behaviour-aware wording: promote title to Finish / Complete-now
  // when the task has persisted across multiple calendar days.
  const adapted = adaptiveTitleFor(task.type, crop, task.canonicalStage || task.stage, t);
  const resolvedTitle = adapted.title || tOrKey(t, task.titleKey) || tOrKey(t, 'fallback.tellUs.title');

  const urgency = task.urgency || baseTask.urgency || 'this_week';
  const isUrgent = urgency === 'critical' || urgency === 'today' || !!task.weatherAdjusted;

  return {
    id: task.id || `crop_${task.type}`,
    source: 'crop',
    priority: isUrgent ? 'high' : (task.priority || 'medium'),
    title: resolvedTitle,
    why: tOrKey(t, task.whyKey),
    steps: pipeSplit(t, task.stepsKey),
    next: '',
    cta: tOrKey(t, isUrgent ? 'home.cta.fixToday' : 'home.cta.actNow') || tOrKey(t, 'common.continue'),
    stage: task.canonicalStage || task.stage || 'prepare',
    regionBucket: task.regionBucket || null,
    repetitionTier: adapted.tier,
    taskType: task.type,
    icon: task.icon,
  };
}

// ─── Public API ───────────────────────────────────────────

/**
 * @param {Object} args
 * @param {Object} args.farmerProfile
 * @param {Object} [args.cropProfile]   { cropId, cropStage, ... }
 * @param {Object} [args.landProfile]
 * @param {string} [args.countryCode]
 * @param {number} [args.month]         1–12; defaults to current month
 * @param {Object} [args.weatherNow]    { rainExpected24h, tempHighC, soilDryProxy, fetchedAt }
 * @param {Object} [args.cameraTask]    optional override; if omitted we pull
 *                                      the newest active temporary task
 *                                      (covers camera + land_check sources)
 * @param {Array}  [args.recentEvents]  task events for behaviour-aware wording
 * @param {string} [args.language]      (passed through for consumers)
 * @param {Object} [args.baseTask]      raw crop task produced upstream
 * @param {Function} [args.t]           i18n translator (required for localized output)
 * @returns {Object} unified dominant task
 */
export function buildUnifiedTodayAction({
  farmerProfile,
  cropProfile,
  landProfile,
  countryCode,
  month,
  weatherNow,
  cameraTask,
  recentEvents,          // kept for caller analytics/future
  language,
  baseTask,
  t,
} = {}) {
  // 1. Camera / land temporary override (one store, ring buffer).
  const tempTasks = cameraTask ? [cameraTask] : listTemporaryTasks();
  const issueTask = pickActiveIssueTask(tempTasks);

  if (issueTask && issueTask.source !== 'land_check') {
    // Pure camera override wins the top slot.
    return buildIssueTask(issueTask, t) || makeFallback(t);
  }

  // 2. Blocking land task — only when land state actually blocks
  //    correct progress.
  const stageForLand = cropProfile?.cropStage || baseTask?.stage || 'prepare';
  const landTask = buildLandTask(landProfile, stageForLand, weatherNow, t);
  if (landTask) {
    if (isDev() && issueTask?.source === 'land_check' && issueTask.id !== landTask.id) {
      // Operator already saved a land task — keep it; the fresh rule
      // would duplicate it.
      return buildIssueTask(issueTask, t);
    }
    return landTask;
  }

  // If there is a stored land_check temporary task (saved via the
  // LandCheckPage's "Add to today's tasks"), surface it when no
  // fresh rule fired — mirrors camera behaviour.
  if (issueTask && issueTask.source === 'land_check') {
    return buildIssueTask(issueTask, t) || makeFallback(t);
  }

  // 3 & 4. Crop task (urgent vs normal differentiated by urgency).
  if (cropProfile?.cropId || baseTask) {
    const cropTask = buildCropTask({
      cropProfile, countryCode, month, weatherNow, baseTask, t, farmerProfile,
    });
    if (cropTask) {
      if (isDev() && !cropTask.title) {
        console.warn('[unifiedEngine] crop task missing title — falling back');
      } else {
        return cropTask;
      }
    }
  }

  // 6. Fallback — never blank, always actionable.
  if (isDev()) console.warn('[unifiedEngine] no crop/land/camera signal — returning fallback');
  return makeFallback(t);
}

export const _internal = {
  pickActiveIssueTask, buildIssueTask, buildLandTask, buildCropTask, makeFallback,
};
