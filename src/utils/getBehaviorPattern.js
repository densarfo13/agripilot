/**
 * getBehaviorPattern — classify a farmer's recent-action pattern
 * into a small set of labels the Today engine + UI can consume.
 *
 *   classifyPattern({ actions, tasks, now }) →
 *     'on_track' | 'slipping' | 'recovering' | 'inactive' |
 *     'missing_watering' | 'pest_pressure'
 *
 *   getBehaviorPattern(args) →
 *     { pattern, urgencyBoost, whyKey, daysSinceLastAction }
 *
 *   applyBehaviorUrgency(primaryTask, pattern) →
 *     new task with its priorityScore nudged + `adjustedBy` tagged
 *
 *   getBehaviorAwareWhy(primaryTask, pattern, weather?) → i18n key
 *
 * Pure. The Today engine calls these to tweak priority; the page
 * passes the resulting why-key through t() for the copy.
 */

const MS_DAY = 86_400_000;

function asMs(d) {
  if (!d) return null;
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

export function getMissedDays({ actions = [], now = new Date() } = {}) {
  const nowMs = asMs(now) || Date.now();
  const latest = actions.reduce((best, a) => {
    const t = asMs(a?.occurredAt);
    return t && t > best ? t : best;
  }, 0);
  if (!latest) return null;
  return Math.max(0, Math.floor((nowMs - latest) / MS_DAY));
}

/**
 * classifyPattern — the decision goes:
 *   inactive       (4+ missed days since last action)
 *   missing_watering (task_skipped or no water completion in 3d
 *                     AND outstanding watering task)
 *   pest_pressure  (≥2 pest/disease issues in last 10 actions)
 *   slipping       (skip rate ≥ 0.5 OR streak === 0 with any recent skips)
 *   recovering     (streak ≥ 3 and any skip in the prior window)
 *   on_track       (fallback)
 */
export function classifyPattern({ actions = [], tasks = [], now = new Date() } = {}) {
  const missed = getMissedDays({ actions, now }) ?? 0;
  if (missed >= 4) return 'inactive';

  const recent = [...actions]
    .sort((a, b) => (asMs(b?.occurredAt) || 0) - (asMs(a?.occurredAt) || 0))
    .slice(0, 10);

  const skips = recent.filter((a) => a.actionType === 'task_skipped').length;
  const completed = recent.filter((a) => a.actionType === 'task_completed').length;
  const skipRate = (completed + skips) ? skips / (completed + skips) : 0;

  const recentIssues = recent.filter((a) => a.actionType === 'issue_reported');
  const pestOrDisease = recentIssues.filter((a) =>
    ['pest', 'disease'].includes(String(a?.details?.category || '').toLowerCase()),
  ).length;
  if (pestOrDisease >= 2) return 'pest_pressure';

  const outstandingWatering = (tasks || []).some((t) =>
    t?.status === 'pending' && /water|irrig/i.test(String(t.title || '')),
  );
  const wateringSkipped = recent.some((a) =>
    a.actionType === 'task_skipped'
    && /water|irrig/i.test(String(a?.details?.taskTitle || '')),
  );
  if (outstandingWatering && wateringSkipped) return 'missing_watering';

  // Streak: consecutive trailing task_completed.
  let streak = 0;
  for (const a of recent) {
    if (a.actionType === 'task_completed') streak += 1;
    else break;
  }
  if (streak >= 3 && skips > 0) return 'recovering';
  if (skipRate >= 0.5) return 'slipping';
  return 'on_track';
}

const PATTERN_BOOST = {
  on_track:        0,
  recovering:      0,
  slipping:        8,
  missing_watering: 18,
  pest_pressure:   18,
  inactive:        25,
};

const PATTERN_WHY = {
  on_track:         null,
  recovering:       'today.why.keepGoing',
  slipping:         'today.why.slipping',
  missing_watering: 'today.why.wateringGap',
  pest_pressure:    'today.why.pestPressure',
  inactive:         'today.why.catchUp',
};

export function getBehaviorPattern({ actions = [], tasks = [], now = new Date() } = {}) {
  const pattern = classifyPattern({ actions, tasks, now });
  return {
    pattern,
    urgencyBoost: PATTERN_BOOST[pattern] ?? 0,
    whyKey: PATTERN_WHY[pattern] || null,
    daysSinceLastAction: getMissedDays({ actions, now }),
  };
}

export function applyBehaviorUrgency(primaryTask, patternInfo) {
  if (!primaryTask || !patternInfo?.urgencyBoost) return primaryTask;
  const nextScore = Math.min(
    100,
    Math.max(0, (Number(primaryTask.priorityScore) || 50) + patternInfo.urgencyBoost),
  );
  return {
    ...primaryTask,
    priorityScore: nextScore,
    priority: nextScore >= 70 ? 'high' : primaryTask.priority || 'medium',
    adjustedBy: [...(primaryTask.adjustedBy || []), 'behavior'],
  };
}

/**
 * getBehaviorAwareWhy — the why-line the UI should surface.
 *   - weather alerts win if both present (heat + missed watering)
 *   - otherwise pattern-specific wording
 *   - null → caller keeps the task's own `.detail`
 */
export function getBehaviorAwareWhy(primaryTask, patternInfo, weather = null) {
  const hot = weather && (weather.heatRisk === 'high' || Number(weather.tempHighC) >= 35);
  if (patternInfo?.pattern === 'missing_watering' && hot) {
    return 'today.why.wateringGapWithHeat';
  }
  return patternInfo?.whyKey || null;
}

export const _internal = { PATTERN_BOOST, PATTERN_WHY };
