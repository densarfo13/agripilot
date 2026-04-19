/**
 * farmerContinuity.js — persistence + state detection for the
 * farmer's day-to-day continuity. This is what prevents the app
 * from showing the same task title two days in a row and what
 * lets us recognize a user coming back after a gap.
 *
 * Persisted fields (localStorage):
 *   lastTaskId         — the taskId shown on the most recent open
 *   lastTaskTitle      — cached title so "reminder variant" can
 *                         detect an identical-title repeat
 *   lastStateType      — farmerState.stateType on last open
 *   lastSeenAt         — timestamp of last home-screen render
 *   lastCompletedAt    — timestamp of last task_completed event
 *   lastHarvestShownAt — so harvest_complete shows ONCE then rolls
 *
 * All operations are pure from the caller's perspective — the
 * helpers read from / write to localStorage but never mutate the
 * input state, and they degrade to safe defaults when localStorage
 * is unavailable (Node tests, SSR).
 */

const STORAGE_KEY = 'farroway.continuity.v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const RETURNING_INACTIVE_DAYS = 3;

function hasStorage() {
  try { return typeof window !== 'undefined' && !!window.localStorage; }
  catch { return false; }
}

export function defaultContinuity() {
  return {
    lastTaskId: null,
    lastTaskTitle: null,
    lastStateType: null,
    lastSeenAt: null,
    lastCompletedAt: null,
    lastHarvestShownAt: null,
  };
}

export function getContinuityState() {
  if (!hasStorage()) return defaultContinuity();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultContinuity();
    const parsed = JSON.parse(raw);
    return { ...defaultContinuity(), ...parsed };
  } catch {
    return defaultContinuity();
  }
}

export function updateContinuityState(patch = {}) {
  if (!hasStorage()) return defaultContinuity();
  const next = { ...getContinuityState(), ...(patch || {}) };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* noop — graceful degradation */ }
  return next;
}

export function clearContinuityState() {
  if (!hasStorage()) return;
  try { window.localStorage.removeItem(STORAGE_KEY); }
  catch { /* noop */ }
}

/**
 * getMissedDays — whole days between lastSeenAt and now, rounded
 * down. Returns 0 when no previous visit is recorded OR when
 * the user visited today.
 */
export function getMissedDays(continuity = null, now = Date.now()) {
  const c = continuity || getContinuityState();
  if (!c.lastSeenAt) return 0;
  const diff = Math.max(0, Number(now) - Number(c.lastSeenAt));
  return Math.floor(diff / DAY_MS);
}

/**
 * isReturningInactive — threshold check used by the farmer
 * state engine's candidate classifier.
 */
export function isReturningInactive(continuity = null, now = Date.now(), thresholdDays = RETURNING_INACTIVE_DAYS) {
  return getMissedDays(continuity, now) >= thresholdDays;
}

/**
 * isReminderVariant — detects "we showed this task yesterday and
 * it wasn't completed; today it's still the primary." In that
 * case the caller should render a softened reminder copy rather
 * than the same imperative title.
 *
 *   currentTaskId + identical to lastTaskId
 *   AND lastCompletedAt < lastSeenAt (or null)
 *   AND lastSeenAt is from a previous day
 */
export function isReminderVariant(currentTaskId, continuity = null, now = Date.now()) {
  const c = continuity || getContinuityState();
  if (!currentTaskId || !c.lastTaskId) return false;
  if (c.lastTaskId !== currentTaskId) return false;

  // Completed since we last saw it? Then it's NOT a repeat.
  const completedSinceLastSeen = c.lastCompletedAt
    && c.lastSeenAt
    && c.lastCompletedAt >= c.lastSeenAt;
  if (completedSinceLastSeen) return false;

  // Only a "reminder" when more than a day has actually passed.
  // 24h rolling window keeps the answer stable across midnight —
  // a 2-hour-old "last seen" never becomes a "reminder" just
  // because we crossed UTC midnight.
  if (!c.lastSeenAt) return false;
  const diffMs = Number(now) - Number(c.lastSeenAt);
  return diffMs >= DAY_MS;
}

/**
 * shouldShowHarvestComplete — the spec: "if just completed
 * harvest → show harvest_complete once, then transition next
 * day". This helper returns true only when a harvest was
 * recorded since the last open AND we haven't shown the
 * harvest-complete screen yet.
 */
export function shouldShowHarvestComplete(continuity = null, { harvestedAt = null, now = Date.now() } = {}) {
  const c = continuity || getContinuityState();
  if (!harvestedAt) return false;
  // Already shown for THIS harvest?
  if (c.lastHarvestShownAt && c.lastHarvestShownAt >= harvestedAt) return false;
  // Has a day already rolled over since the harvest? If yes, the
  // state transitions — we don't re-show it.
  const daysSinceHarvest = Math.floor((now - Number(harvestedAt)) / DAY_MS);
  if (daysSinceHarvest >= 1) return false;
  return true;
}

/**
 * markTaskSeen — updates lastTaskId + lastTaskTitle + lastSeenAt
 * in one atomic patch. Call from the Home screen on render of
 * the primary task.
 */
export function markTaskSeen(task, now = Date.now()) {
  if (!task) return updateContinuityState({ lastSeenAt: now });
  return updateContinuityState({
    lastTaskId:    task.id || task.taskId || null,
    lastTaskTitle: task.title || null,
    lastSeenAt:    now,
  });
}

/** markTaskCompleted — stamps lastCompletedAt. */
export function markTaskCompleted(_task, now = Date.now()) {
  return updateContinuityState({ lastCompletedAt: now });
}

/** markStateShown — records the current stateType so we can
 *  detect repeat state dead-ends. */
export function markStateShown(stateType, now = Date.now()) {
  return updateContinuityState({
    lastStateType: stateType || null,
    lastSeenAt: now,
  });
}

/** markHarvestShown — called when harvest_complete renders; lets
 *  shouldShowHarvestComplete stop firing after the first view. */
export function markHarvestShown(now = Date.now()) {
  return updateContinuityState({ lastHarvestShownAt: now });
}

/**
 * shouldAvoidIdenticalTitle — returns true when rendering the
 * same title verbatim as yesterday would be a bad UX (user
 * feels like the app hasn't moved). The state layer can use
 * this to flip into a reminder variant key.
 */
export function shouldAvoidIdenticalTitle(currentTitle, continuity = null, now = Date.now()) {
  const c = continuity || getContinuityState();
  if (!currentTitle || !c.lastTaskTitle) return false;
  if (String(currentTitle) !== String(c.lastTaskTitle)) return false;
  if (!c.lastSeenAt) return false;
  const diffMs = Number(now) - Number(c.lastSeenAt);
  return diffMs >= DAY_MS;
}

function isSameUTCDay(a, b) {
  const da = new Date(Number(a));
  const db = new Date(Number(b));
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.getUTCFullYear() === db.getUTCFullYear()
      && da.getUTCMonth()    === db.getUTCMonth()
      && da.getUTCDate()     === db.getUTCDate();
}

export const _internal = {
  STORAGE_KEY, DAY_MS, RETURNING_INACTIVE_DAYS, isSameUTCDay,
};
