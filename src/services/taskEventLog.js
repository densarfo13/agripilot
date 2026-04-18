/**
 * taskEventLog — farmer-behavior feedback loop (spec §3).
 *
 * Captures a bounded stream of task events locally so we can:
 *   - detect confusing tasks (high undo / reopen rate)
 *   - detect bad timing (high skipped / flagged rate)
 *   - sync to the server later when online
 *
 * Event shape:
 *   { type, taskId, ts, reason?, source?, metadata? }
 * where type ∈ 'completed' | 'undo' | 'reopened' | 'flagged' | 'skipped'
 *
 * The store is local-first. A sync hook is exported so callers (server
 * bridge, offline queue) can ship events in batches — no analytics UI
 * is needed at the moment.
 */

import { safeTrackEvent } from '../lib/analytics.js';

const KEY = 'farroway:task_events';
const MAX = 500;  // enough to reconstruct a week of behaviour on a typical device

export const TASK_EVENT_TYPE = Object.freeze({
  COMPLETED: 'completed',
  UNDO: 'undo',
  REOPENED: 'reopened',
  FLAGGED: 'flagged',
  SKIPPED: 'skipped',
});

// ─── Storage ───────────────────────────────────────────────

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeAll(events) {
  try {
    localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX)));
  } catch { /* quota */ }
}

// ─── Public API ────────────────────────────────────────────

/**
 * Record a task event. Returns the persisted record.
 *
 * @param {Object} args
 * @param {string} args.type     one of TASK_EVENT_TYPE values
 * @param {string} args.taskId
 * @param {string} [args.reason] attached on 'flagged' / 'skipped'
 * @param {string} [args.source] 'normal' | 'camera' | 'notification'
 * @param {Object} [args.metadata]
 */
export function recordTaskEvent({ type, taskId, reason, source, metadata } = {}) {
  if (!type || !taskId) return null;
  const record = {
    id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    type, taskId, ts: Date.now(),
    reason: reason || null,
    source: source || 'normal',
    metadata: metadata || null,
    synced: false,
  };
  const all = readAll();
  all.push(record);
  writeAll(all);

  // Fire-and-forget analytics — safe on failure, never blocks the store.
  safeTrackEvent(`taskEvent.${type}`, { taskId, reason: reason || null, source: source || 'normal' });
  return record;
}

/** Recent events — newest first. */
export function listTaskEvents({ limit = 100, type } = {}) {
  const all = readAll();
  const filtered = type ? all.filter(e => e.type === type) : all;
  return [...filtered].sort((a, b) => b.ts - a.ts).slice(0, limit);
}

/** Unsynced events — the shape a future sync job needs. */
export function getUnsyncedTaskEvents(limit = 100) {
  return readAll().filter(e => !e.synced).slice(0, limit);
}

/**
 * Mark a batch of events as synced. Caller passes the ids returned
 * by getUnsyncedTaskEvents so we don't lose any records if the sync
 * partially succeeded.
 */
export function markTaskEventsSynced(ids = []) {
  if (!ids.length) return;
  const set = new Set(ids);
  const all = readAll().map(e => (set.has(e.id) ? { ...e, synced: true, syncedAt: Date.now() } : e));
  writeAll(all);
}

/**
 * Aggregate signal summaries for dev tooling / admin review.
 * Pure — reads the local store once.
 */
export function summarizeTaskEvents({ since } = {}) {
  const cutoff = Number.isFinite(since) ? since : 0;
  const events = readAll().filter(e => e.ts >= cutoff);
  const counts = { completed: 0, undo: 0, reopened: 0, flagged: 0, skipped: 0 };
  const byTask = {};

  for (const e of events) {
    if (Object.prototype.hasOwnProperty.call(counts, e.type)) counts[e.type]++;
    if (!byTask[e.taskId]) byTask[e.taskId] = { completed: 0, undo: 0, reopened: 0, flagged: 0, skipped: 0 };
    if (Object.prototype.hasOwnProperty.call(byTask[e.taskId], e.type)) byTask[e.taskId][e.type]++;
  }

  // Surface the 5 noisiest tasks — future pass can use this to flag
  // weak wording / bad timing automatically.
  const hotTasks = Object.entries(byTask)
    .map(([taskId, c]) => ({ taskId, ...c, noise: c.undo + c.reopened + c.flagged + c.skipped }))
    .sort((a, b) => b.noise - a.noise)
    .slice(0, 5);

  return { total: events.length, counts, hotTasks };
}

export function clearTaskEvents() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
