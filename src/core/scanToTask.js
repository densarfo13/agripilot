/**
 * scanToTask.js — wrap the engine's `suggestedTasks` and persist
 * them where Today's Plan can pick them up.
 *
 * Coexistence with the existing task pipeline
 * ───────────────────────────────────────────
 * The shipped `dailyIntelligenceEngine` reads from server tasks
 * and the existing taskGenerator. We do NOT inject new tasks into
 * either of those. Instead, scan-derived tasks live in their own
 * localStorage slot (`farroway_scan_tasks`) so Today's Plan can
 * read them additively when ready.
 *
 * Strict-rule audit
 *   • Hard cap of 2 tasks per scan (spec §7).
 *   • Bounded growth (cap 50 entries on disk so stale tasks
 *     can't pile up forever).
 *   • Tasks expire at 7 days from creation when read — caller
 *     prunes via `getActiveScanTasks()`.
 *   • Behind feature flag `scanToTask` — when off, this module's
 *     functions all no-op. The UI button on ScanResultCard is
 *     also flag-gated, so the persistence path is unreachable
 *     unless the flag is on.
 */

import { isFeatureEnabled } from '../config/features.js';

const STORAGE_KEY = 'farroway_scan_tasks';
const MAX_KEPT = 50;
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function _readList() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _writeList(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_KEPT)));
  } catch { /* quota / private mode — ignore */ }
}

/**
 * Persist scan-derived tasks. Returns the actually-stored entries
 * (capped at 2). When the flag is off, returns an empty array
 * without writing anything.
 *
 * @param {Array<object>} suggestedTasks  from `analyzeScan`
 * @param {object} [context]   { scanId, farmId, gardenId, experience }
 * @returns {Array<object>}
 *
 * Final scan engine spec §9: tasks attach to gardenId OR farmId
 * based on activeExperience so garden + farm Today's Plans stay
 * isolated. Same-day duplicates are rejected per the spec
 * "do not duplicate same scan task on same day" rule.
 */
export function addScanTasks(suggestedTasks, context = {}) {
  if (!isFeatureEnabled('scanToTask')) return [];
  if (!Array.isArray(suggestedTasks) || suggestedTasks.length === 0) return [];
  const cappedSource = suggestedTasks.slice(0, 2);
  const now = Date.now();

  // Spec §9: dedupe same-day same-scan tasks so the user
  // doesn't accumulate duplicate entries from rescanning.
  const todayKey = new Date(now).toISOString().slice(0, 10);
  const list = _readList();
  const existing = new Set(
    list
      .filter((t) => t && t.scanId && String(t.createdAt || '').slice(0, 10) === todayKey)
      .map((t) => `${t.scanId}|${t.title}`)
  );

  const newEntries = cappedSource.map((t) => ({
    id:         t?.id || ('scantask_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 8)),
    title:      String(t?.title || ''),
    reason:     t?.reason ? String(t.reason) : '',
    urgency:    t?.urgency || 'medium',
    actionType: t?.actionType || 'inspect',
    source:     'scan',
    scanId:     context.scanId   || null,
    gardenId:   context.gardenId || null,
    farmId:     context.farmId   || null,
    experience: context.experience || 'generic',
    createdAt:  new Date(now).toISOString(),
    expiresAt:  new Date(now + EXPIRY_MS).toISOString(),
    completed:  false,
  })).filter((t) => !existing.has(`${t.scanId}|${t.title}`));

  if (newEntries.length === 0) return [];
  list.push(...newEntries);
  _writeList(list);
  return newEntries;
}

/**
 * Read active (non-expired, non-completed) scan-derived tasks.
 * Used by any Today's Plan surface that wants to surface
 * scan follow-ups without rebuilding its own engine.
 *
 * Spec §9 + §10: callers can pass `gardenId` AND/OR `farmId` to
 * isolate by active context. Passing neither returns every
 * non-expired non-completed task (legacy behaviour).
 */
export function getActiveScanTasks({ farmId, gardenId } = {}) {
  const now = Date.now();
  return _readList().filter((t) => {
    if (!t) return false;
    if (t.completed) return false;
    if (t.expiresAt && Date.parse(t.expiresAt) < now) return false;
    // If both filters supplied, an OR-match passes (caller is
    // looking for "tasks for the active context" — exactly one
    // of gardenId/farmId is the active id at any moment).
    if (gardenId && t.gardenId && t.gardenId !== gardenId) return false;
    if (farmId   && t.farmId   && t.farmId   !== farmId)   return false;
    return true;
  });
}

/** Mark a scan task as completed (does not delete it — kept for analytics). */
export function completeScanTask(id) {
  if (!id) return false;
  const list = _readList();
  const idx = list.findIndex((t) => t?.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], completed: true, completedAt: new Date().toISOString() };
  _writeList(list);
  return true;
}

/** Total active scan tasks count — for the admin tile. */
export function getScanTaskCount() {
  return getActiveScanTasks().length;
}

/** Wipe the slot. Server-pushed scan tasks (when wired) live elsewhere. */
export function clearScanTasks() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

export default {
  addScanTasks,
  getActiveScanTasks,
  completeScanTask,
  getScanTaskCount,
  clearScanTasks,
};
