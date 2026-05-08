/**
 * safeOnlineSync.js — safe, bounded task-action sync on reconnect.
 *
 * PURPOSE
 * ───────
 * Drains the task action queue (farroway_offline_task_actions_v1) when
 * the device comes back online. Designed to be the ONLY sync that fires
 * for the FEATURE_OFFLINE_SAFE layer — no background polling, no
 * setInterval, no cascading retries.
 *
 * GUARDRAILS
 * ──────────
 *   • _flushing guard     — prevents concurrent runs (online event
 *     fires once, but a slow response can race with a second event)
 *   • Max 1 retry         — each action entry tracks `attempts`. On
 *     first failure (non-400) the entry stays in the queue with
 *     attempts=1. On the NEXT sync attempt, if it fails again, the
 *     entry is dropped. No infinite loop possible.
 *   • 400 drop            — a 400 from the server means the payload is
 *     permanently bad. Drop immediately; never retry.
 *   • No /api/events      — this module only handles 'task_complete'
 *     and 'task_skip'. Event-type entries are never queued here.
 *   • No blocking render  — entirely async; no React state writes.
 *   • Online check first  — if navigator.onLine is false, bail silently.
 *
 * PUBLIC API
 * ──────────
 *   runSafeSync({ taskSender })
 *     — One-shot async flush. `taskSender(action) → Promise<any>`.
 *       Throws on non-400/network failure so the caller can react.
 *
 *   installSafeOnlineSync({ taskSender })
 *     — Wire window.addEventListener('online', …) once. Returns a
 *       cleanup function. Idempotent guard prevents double-install.
 *       Call once at app boot.
 */

import {
  getTaskActions,
  removeTaskAction,
  markTaskActionAttempt,
} from './taskActionQueue.js';

// ─── Single-flight guard ──────────────────────────────────────────
let _flushing = false;

// ─── Double-install guard ─────────────────────────────────────────
let _syncInstalled = false;

/**
 * Flush all pending task actions through `taskSender`.
 *
 * @param {{ taskSender: (action: object) => Promise<any> }} opts
 * @returns {Promise<{ flushed: number, dropped: number, deferred: number }>}
 */
export async function runSafeSync({ taskSender } = {}) {
  const report = { flushed: 0, dropped: 0, deferred: 0 };

  // Online gate — bail immediately if browser says we're offline.
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return report;
    }
  } catch { /* ignore SSR */ }

  // Single-flight guard — prevents a second concurrent flush.
  if (_flushing) return report;
  _flushing = true;

  try {
    const actions = getTaskActions();
    if (!actions.length) return report;

    for (const action of actions) {
      if (!action || !action.id) continue;

      // Max-retry guard: if this entry has already been attempted once,
      // drop it rather than retrying forever.
      if ((action.attempts || 0) >= 1) {
        removeTaskAction(action.id);
        report.dropped += 1;
        continue;
      }

      if (typeof taskSender !== 'function') {
        // No sender wired — leave the action for when one is available.
        report.deferred += 1;
        continue;
      }

      try {
        await taskSender(action);
        removeTaskAction(action.id);
        report.flushed += 1;
      } catch (err) {
        const status = err && err.response && err.response.status;
        if (status === 400) {
          // Bad payload — permanent failure; drop, never retry.
          removeTaskAction(action.id);
          report.dropped += 1;
        } else {
          // Transient failure (network, 5xx, etc.) — bump attempts so
          // the next sync knows this has been tried once.
          markTaskActionAttempt(action.id);
          report.deferred += 1;
        }
      }
    }
    return report;
  } finally {
    _flushing = false;
  }
}

/**
 * Install a capture-safe window 'online' listener that triggers
 * runSafeSync once per reconnect event.
 *
 * Also flushes once immediately if we're already online and have
 * pending actions from a previous offline session.
 *
 * @param {{ taskSender: (action: object) => Promise<any> }} opts
 * @returns {() => void} cleanup / unsubscribe function
 */
export function installSafeOnlineSync({ taskSender } = {}) {
  if (typeof window === 'undefined') return () => {};

  // Idempotent — calling this twice is a no-op.
  if (_syncInstalled) return () => {};
  _syncInstalled = true;

  const handler = () => {
    // Fire-and-forget — do not await; do not let errors propagate to
    // the window event system.
    runSafeSync({ taskSender }).catch(() => { /* swallow — never propagate */ });
  };

  window.addEventListener('online', handler);

  // Boot flush: if the app opens while online with queued actions from
  // a previous offline session, drain them immediately (don't wait for
  // the next `online` event which may never fire this session).
  try {
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (isOnline) {
      // Small delay so the app finishes initial render before network traffic starts.
      setTimeout(() => {
        handler();
      }, 2000);
    }
  } catch { /* ignore */ }

  return () => {
    window.removeEventListener('online', handler);
    _syncInstalled = false;
  };
}
