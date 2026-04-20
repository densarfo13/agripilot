/**
 * taskDevAssertions.js — §16 dev-only warnings for the task
 * intelligence layer.
 */

const TAG = '[farroway.taskEngine]';

function isDev() {
  if (typeof window === 'undefined') return false;
  const env = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV)
    || 'development';
  return env !== 'production';
}

function warn(reason, details = {}) {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.warn(TAG, reason, { ...details, at: new Date().toISOString() });
}

/** §16: generic static tasks (tooling) shown when farm context exists. */
export function assertNoGenericWhenContextExists(farmHasContext, tasks) {
  if (!isDev()) return;
  if (!farmHasContext) return;
  if (!Array.isArray(tasks)) return;
  const GENERIC = new Set(['scan_crop_issue', 'check_your_land']);
  const leaked = tasks.filter((t) => t && GENERIC.has(t.code));
  if (leaked.length === 0) return;
  warn('static generic tasks shown when farm context exists', {
    codes: leaked.map((t) => t.code),
  });
}

/** §16: more than one isPrimary task. */
export function assertSinglePrimary(tasks) {
  if (!isDev()) return;
  if (!Array.isArray(tasks)) return;
  const count = tasks.filter((t) => t && t.isPrimary).length;
  if (count <= 1) return;
  warn('more than one primary task', { count });
}

/** §16: no primary returned when eligible tasks exist. */
export function assertPrimaryExists(primary, allTasks) {
  if (!isDev()) return;
  if (!Array.isArray(allTasks) || allTasks.length === 0) return;
  const hasIncomplete = allTasks.some((t) => t && !t.completed);
  if (!hasIncomplete) return;
  if (primary && primary.id) return;
  warn('no primary task returned', { total: allTasks.length });
}

/** §16: completed task still flagged primary after recompute. */
export function assertCompletedNotPrimary(primary) {
  if (!isDev()) return;
  if (!primary) return;
  if (!primary.completed) return;
  warn('completed task remains primary after recompute', { id: primary.id });
}

/**
 * §16: task list was not rebuilt after a completion. Consumer
 * passes previousPrimaryId and currentPrimaryId along with a
 * flag indicating a completion just landed.
 */
export function assertRebuildAfterCompletion(hadCompletion, prevPrimaryId, nextPrimaryId) {
  if (!isDev()) return;
  if (!hadCompletion) return;
  if (!prevPrimaryId) return;
  // Consumer should have rebuilt; a stable primary is only OK
  // if the completed task wasn't the primary. We can't tell from
  // here — so warn only when IDs literally match (most common bug).
  if (prevPrimaryId === nextPrimaryId) {
    warn('task list not rebuilt after completion', { primaryId: prevPrimaryId });
  }
}

/** §16: weather card given more visual weight than primary task. */
export function assertWeatherNotDominant(weatherWeight, primaryWeight) {
  if (!isDev()) return;
  if (typeof weatherWeight !== 'number' || typeof primaryWeight !== 'number') return;
  if (weatherWeight <= primaryWeight) return;
  warn('weather card more prominent than primary task', {
    weatherWeight, primaryWeight,
  });
}

/** §16: task engine returned a raw string instead of a payload object. */
export function assertEngineReturnedPayload(value) {
  if (!isDev()) return;
  if (value == null) return;
  if (typeof value === 'object' && value.titleKey) return;
  warn('raw text returned by task engine instead of translation payload', {
    sample: typeof value === 'string' ? value.slice(0, 60) : typeof value,
  });
}

export const _internal = { TAG };
