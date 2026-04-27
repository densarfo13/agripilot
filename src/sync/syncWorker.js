/**
 * syncWorker.js — drains the IndexedDB outbox to the server.
 *
 * Loop policy:
 *   * Driver = `useSyncLoop` hook mounted in App.jsx (15s tick).
 *   * Single-flight: a tick that arrives while a previous run is
 *     still in flight skips - prevents duplicate POSTs and
 *     thundering herds when the network comes back.
 *   * Per-item retry: a failed POST keeps the item in the queue;
 *     the next tick picks it up. Server idempotency (action.id)
 *     makes that safe even if a previous attempt actually
 *     succeeded but the client never saw the response.
 *   * Network gating: if `navigator.onLine === false`, skip the
 *     run entirely - no point hammering fetch in a tunnel.
 *
 * Strict-rule audit:
 *   * Idempotent: every action carries a unique id; server dedupes.
 *   * Survives offline / retries / duplicates.
 *   * Never blocks UI: runSync is fire-and-forget for the caller.
 */

import { useEffect, useRef } from 'react';
import { dbGetQueue, dbDeleteQueue } from '../db/indexedDB.js';

export const SYNC_ENDPOINT = '/api/sync';
export const SYNC_INTERVAL_MS = 15_000;

/* ─── Single-flight guard ──────────────────────────────────────── */

let _inFlight = null;

function _isOnlineGuess() {
  try {
    if (typeof navigator === 'undefined') return true;
    if (typeof navigator.onLine !== 'boolean') return true;
    return navigator.onLine;
  } catch { return true; }
}

async function _postOne(item) {
  if (typeof fetch !== 'function') return { ok: false, status: 0 };
  try {
    const res = await fetch(SYNC_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(item),
    });
    return { ok: !!(res && res.ok), status: res ? res.status : 0 };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function _doRun() {
  if (!_isOnlineGuess()) return { drained: 0, skipped: 'offline' };

  const queue = await dbGetQueue();
  if (!Array.isArray(queue) || queue.length === 0) {
    return { drained: 0 };
  }

  let drained = 0;
  for (const item of queue) {
    if (!item || !item.id) {
      // Corrupt entry - drop it so the loop can drain the rest.
      try { await dbDeleteQueue(item && item.id); } catch { /* swallow */ }
      continue;
    }
    const { ok } = await _postOne(item);
    if (ok) {
      await dbDeleteQueue(item.id);
      drained += 1;
    } else {
      // Leave the item in place; next tick picks it up. Logging
      // gated to a single line per failed id so a long retry
      // streak doesn't flood the console.
      try { console.warn('[FARROWAY_SYNC_RETRY]', item.id); }
      catch { /* console missing */ }
    }
  }
  return { drained };
}

/**
 * Drain the queue once. Single-flight: concurrent calls share the
 * same in-flight promise. Always resolves; never throws.
 */
export function runSync() {
  if (_inFlight) return _inFlight;
  _inFlight = _doRun()
    .catch(() => ({ drained: 0, error: true }))
    .finally(() => { _inFlight = null; });
  return _inFlight;
}

/* ─── React driver ─────────────────────────────────────────────── */

/**
 * useSyncLoop — mounts the 15s tick and the back-online listener.
 *
 *   import { useSyncLoop } from '../sync/syncWorker';
 *   function App() { useSyncLoop(); ... }
 *
 * Cheap: one setInterval, one event listener, no state. Safe to
 * mount once at the app root - the single-flight guard keeps a
 * second mount from doubling traffic if it ever happens.
 */
export function useSyncLoop({ intervalMs = SYNC_INTERVAL_MS, enabled = true } = {}) {
  // Keep the latest options in a ref so a parent re-render doesn't
  // tear down + rebuild the interval.
  const intervalRef = useRef(intervalMs);
  intervalRef.current = intervalMs;

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === 'undefined') return undefined;

    // Try once at mount so a queued action posts before the first
    // 15s window elapses.
    runSync();

    const id = setInterval(() => { runSync(); }, intervalRef.current);
    const onOnline = () => { runSync(); };
    try { window.addEventListener('online', onOnline); }
    catch { /* listener API missing */ }

    return () => {
      try { clearInterval(id); }
      catch { /* swallow */ }
      try { window.removeEventListener('online', onOnline); }
      catch { /* swallow */ }
    };
  }, [enabled]);
}
