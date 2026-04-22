/**
 * taskScheduler.js — persistence + daily-refresh wrapper around
 * generateDailyTasks().
 *
 * Storage layout (single key, small JSON blob):
 *   localStorage['farroway.dailyTasks.v1'] = {
 *     byFarm: {
 *       [farmId]: {
 *         date:   'YYYY-MM-DD',
 *         tasks:  Task[],         // status may be 'pending' | 'complete' | 'skipped'
 *         generatedAt: ISO string,
 *       }
 *     }
 *   }
 *
 * Daily refresh:
 *   • getTodayTasks({ farm, weather }) reads the stored plan for the
 *     farm. If the stored date matches today, it returns the
 *     persisted list (preserving completion state). Otherwise it
 *     calls generateDailyTasks() and overwrites the slot.
 *   • That means "regenerate daily" is automatic — any time the page
 *     is opened on a new local date, a fresh plan appears. Nothing
 *     else needs to run on a cron.
 *
 * Completion state:
 *   • markTaskComplete(farmId, taskId) → flips status, logs
 *     taskCompletions for the existing analytics stream.
 *   • skipTask(farmId, taskId) → flips status to 'skipped' without
 *     logging a completion.
 *
 * Pure SSR-safe: every helper short-circuits when window / storage
 * aren't available so the functions can be imported from anywhere.
 */

import { generateDailyTasks } from './taskEngine.js';
import { enqueueAction } from '../sync/offlineQueue.js';
import { getCropTimeline } from '../timeline/cropTimelineEngine.js';

const KEY = 'farroway.dailyTasks.v1';

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readStore() {
  if (!hasStorage()) return { byFarm: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { byFarm: {} };
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && parsed.byFarm) ? parsed : { byFarm: {} };
  } catch {
    return { byFarm: {} };
  }
}

function writeStore(store) {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Quota / privacy-mode / iframe — give up quietly; the in-memory
    // plan still works for the current page view.
  }
}

function ymdLocal(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function keyFor(farm) {
  return (farm && (farm.id || farm._id)) || 'nofarm';
}

/**
 * resolveTimelineStage — compute the current crop stage on every
 * read using the timeline engine. This is how the scheduler
 * auto-advances: `plantingDate` + elapsed days → `currentStage`,
 * and the next call of the day sees the newer stage without the
 * farmer lifting a finger. Manual overrides are preserved because
 * getCropTimeline checks them first.
 */
function resolveTimelineStage(farm, now) {
  try {
    const tl = getCropTimeline({ farm, now });
    return (tl && tl.currentStage) || null;
  } catch { return null; }
}

/**
 * getTodayTasks — the main read entry point. Generates + persists
 * today's plan on first call of the day; returns the stored plan on
 * subsequent calls (so completion state survives re-renders).
 *
 * Auto-advance: the scheduler now stores a `stageSnapshot` alongside
 * each plan. If the timeline engine decides the crop has moved to a
 * new stage (planting date + elapsed days pushed us past the
 * previous stage's durationDays), the plan is regenerated on the
 * same day — so task templates keep up with the crop even when the
 * farmer doesn't reload between sunrise and sunset.
 */
export function getTodayTasks({ farm = null, weather = null, now = null } = {}) {
  const today = ymdLocal(now || Date.now());
  const store = readStore();
  const slotKey = keyFor(farm);
  const existing = store.byFarm[slotKey];
  const timelineStage = resolveTimelineStage(farm, now);

  // Keep the persisted plan ONLY when the date AND the timeline stage
  // both match. A stage drift (auto-advance or a correction to
  // plantingDate / manualStageOverride) forces regeneration so
  // today's tasks reflect reality.
  const sameDate  = existing && existing.date === today;
  const sameStage = existing && existing.stageSnapshot === timelineStage;

  if (sameDate && sameStage && Array.isArray(existing.tasks)) {
    return Object.freeze({
      date: existing.date,
      farmId: farm ? farm.id || farm._id || null : null,
      tasks: Object.freeze(existing.tasks.map((t) => Object.freeze({ ...t }))),
      source: 'persisted',
      stage:  existing.stageSnapshot || null,
    });
  }

  // New day OR stage advanced → regenerate with the timeline stage.
  const generated = generateDailyTasks({
    farm, weather, date: now,
    timelineStage,   // timeline wins over farm.cropStage (spec §5)
  });
  const slot = {
    date:          generated.date,
    tasks:         generated.tasks.map((t) => ({ ...t })),
    generatedAt:   new Date().toISOString(),
    stageSnapshot: timelineStage,
  };
  store.byFarm[slotKey] = slot;
  writeStore(store);

  return Object.freeze({
    date: generated.date,
    farmId: generated.farmId,
    tasks: Object.freeze(slot.tasks.map((t) => Object.freeze({ ...t }))),
    source: 'generated',
    stage:  timelineStage,
  });
}

function updateTaskStatus(farmId, taskId, nextStatus) {
  const store = readStore();
  const slotKey = farmId || 'nofarm';
  const slot = store.byFarm[slotKey];
  if (!slot || !Array.isArray(slot.tasks)) return null;

  let updated = null;
  slot.tasks = slot.tasks.map((t) => {
    if (t.id !== taskId) return t;
    updated = { ...t, status: nextStatus, updatedAt: new Date().toISOString() };
    return updated;
  });
  if (!updated) return null;

  store.byFarm[slotKey] = slot;
  writeStore(store);
  return updated;
}

/**
 * markTaskComplete — flips the task's status and fires the existing
 * taskCompletions analytics stream so downstream engines
 * (farmerSignalEngine, behavioral analytics) see it.
 */
export function markTaskComplete(farmId, taskId) {
  const task = updateTaskStatus(farmId, taskId, 'complete');
  if (task && hasStorage()) {
    try {
      const raw = window.localStorage.getItem('farroway.taskCompletions');
      const arr = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(arr) ? arr : [];
      list.push({
        taskId,
        farmId: farmId || null,
        completed: true,
        timestamp: new Date().toISOString(),
      });
      window.localStorage.setItem('farroway.taskCompletions', JSON.stringify(list));
    } catch {
      // Non-fatal — the daily task store is still authoritative.
    }
  }
  // Queue a server-sync action. Dedup key keeps rapid double-clicks
  // + offline-then-online scenarios from producing duplicate rows.
  enqueueAction({
    type:     'task_complete',
    farmId,
    taskId,
    payload:  { completedAt: new Date().toISOString() },
    dedupKey: `task_complete:${farmId || 'nofarm'}:${taskId}`,
  });
  return task;
}

/**
 * skipTask — farmer explicitly dismissed the item. Doesn't count as
 * a completion.
 */
export function skipTask(farmId, taskId) {
  const task = updateTaskStatus(farmId, taskId, 'skipped');
  if (task) {
    enqueueAction({
      type:     'task_skip',
      farmId,
      taskId,
      payload:  { skippedAt: new Date().toISOString() },
      dedupKey: `task_skip:${farmId || 'nofarm'}:${taskId}`,
    });
  }
  return task;
}

/**
 * resetForFarm — nuke the cached plan for a farm (used by tests and
 * by the "regenerate plan" debug button).
 */
export function resetForFarm(farmId) {
  const store = readStore();
  const slotKey = farmId || 'nofarm';
  if (store.byFarm[slotKey]) {
    delete store.byFarm[slotKey];
    writeStore(store);
  }
}

export const _internal = Object.freeze({
  KEY, readStore, writeStore, ymdLocal, keyFor, updateTaskStatus,
});
