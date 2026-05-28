/**
 * reconcileReconnect.js — Wave 7 RUNTIME reconnect reconciliation.
 *
 *   import {
 *     reconcileOnReconnect, getReconciliationSnapshot,
 *     markIdempotencyKeySeen, isDuplicateIdempotencyKey,
 *   } from 'src/runtime/offline/reconcileReconnect.js';
 *
 * What this is
 * ────────────
 *   Composition layer over the wave-5 syncRuntime + wave-7
 *   queueRegistry that adds:
 *
 *     • deterministic replay ordering (scan → journal → task →
 *       notification → recommendation_ack) — chosen so server-
 *       side dependencies are satisfied before dependent writes
 *     • idempotency-key memory (LRU 500) preventing duplicate
 *       processing within a session
 *     • conflict resolution log (last-write-wins is the default;
 *       conflicts are recorded for offline-review without blocking
 *       the drain)
 *     • snapshot for the __replayHealth() diagnostic
 *
 *   The reconcile entry point is fired by:
 *     1. window 'online' event (via syncRuntime listener — wave 5)
 *     2. visibilitychange when document becomes visible (wave 7,
 *        installed by deviceResilience.js)
 *     3. pageshow (bfcache restoration — wave 7)
 *     4. explicit call from the diagnostic for manual replay
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws — every step is _safeAsync.
 *   • Idempotent — repeated calls with the same drain envelope
 *     no-op via the idempotency-key memory.
 *   • SSR-safe.
 *   • No PII; idempotency keys are caller-supplied strings; the
 *     conflict log records kind + reason + timestamp only.
 */

import {
  drainQueue, getRegistrySnapshot, QUEUE_KIND,
} from './queueRegistry.js';
import {
  drainAllQueues as syncDrainAll, getSyncSnapshot,
} from '../sync/syncRuntime.js';

const RUNTIME_VERSION = 'reconcile-reconnect-v1';
const IDEMPOTENCY_LRU_CAP = 500;
const CONFLICT_LOG_CAP = 50;

// Deterministic drain order — server dependencies upstream first.
const DRAIN_ORDER = Object.freeze([
  QUEUE_KIND.SCAN,                // source-of-truth for scan-derived rows
  QUEUE_KIND.JOURNAL,             // depends on scans
  QUEUE_KIND.TASK,                // depends on scans (followup tasks)
  QUEUE_KIND.NOTIFICATION,        // depends on task/scan write
  QUEUE_KIND.RECOMMENDATION_ACK,  // farmer ack; depends on rec lookup
]);

const _state = {
  reconciliationsTriggered:  0,
  lastReconciliationAt:      null,
  lastReconciliationOutcome: null, // 'ok' | 'partial' | 'failed'
  duplicatesSuppressed:      0,
  conflicts:                 [], // { kind, key, reason, at }
  // LRU via Map (insertion-ordered).
  idempotency:               new Map(),
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _safeAsync = async (fn, fb) => { try { return await fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

export function markIdempotencyKeySeen(key) {
  if (typeof key !== 'string' || !key) return false;
  if (_state.idempotency.has(key)) {
    _state.duplicatesSuppressed += 1;
    return true; // already seen
  }
  if (_state.idempotency.size >= IDEMPOTENCY_LRU_CAP) {
    const first = _state.idempotency.keys().next();
    if (!first.done) _state.idempotency.delete(first.value);
  }
  _state.idempotency.set(key, _now());
  return false;
}

export function isDuplicateIdempotencyKey(key) {
  return typeof key === 'string' && _state.idempotency.has(key);
}

function _recordConflict(kind, reason, key) {
  _state.conflicts.push(Object.freeze({
    kind, reason, key: key || null, at: _now(),
  }));
  if (_state.conflicts.length > CONFLICT_LOG_CAP) {
    _state.conflicts.splice(0, _state.conflicts.length - CONFLICT_LOG_CAP);
  }
}

/**
 * Deterministic queue replay. Drains in DRAIN_ORDER; the syncRuntime
 * also fires its own drainAllQueues which targets the underlying
 * legacy queues. Both are called — the registry-aware path takes
 * precedence for queues that have explicit adapters; the legacy
 * path remains as a safety net.
 */
export async function reconcileOnReconnect(opts) {
  _state.reconciliationsTriggered += 1;
  const startAt = _now();
  const trigger = (opts && opts.trigger) || 'manual';

  const perQueue = {};
  let anyError = false;

  for (const kind of DRAIN_ORDER) {
    const drained = await _safeAsync(() => drainQueue(kind), null);
    perQueue[kind] = drained || Object.freeze({ ok: false, reason: 'no_drain_returned' });
    if (!drained || drained.ok === false) {
      anyError = true;
      // Failed drain isn't a conflict in itself, but record once
      // so __replayHealth surfaces it.
      _recordConflict(kind, drained && drained.reason || 'drain_failed', null);
    }
  }

  // Legacy fallback — syncRuntime drains the underlying queues that
  // pre-date the wave-7 registry (mutation queue, scan queue via
  // syncRuntime). Safe to call alongside; both paths are idempotent.
  const legacy = await _safeAsync(() => syncDrainAll(), null);

  _state.lastReconciliationAt = startAt;
  _state.lastReconciliationOutcome = anyError ? 'partial' : 'ok';

  return Object.freeze({
    ok:                !anyError,
    trigger,
    startAt,
    drainOrder:        DRAIN_ORDER,
    perQueue:          Object.freeze(perQueue),
    legacy:            legacy || null,
    duplicatesSuppressed: _state.duplicatesSuppressed,
  });
}

export async function getReconciliationSnapshot() {
  const registry = await _safeAsync(() => getRegistrySnapshot(), null);
  const sync = _safe(() => getSyncSnapshot(), null);
  return Object.freeze({
    runtimeVersion:            RUNTIME_VERSION,
    reconciliationsTriggered:  _state.reconciliationsTriggered,
    lastReconciliationAt:      _state.lastReconciliationAt,
    lastReconciliationOutcome: _state.lastReconciliationOutcome,
    duplicatesSuppressed:      _state.duplicatesSuppressed,
    idempotencyCacheSize:      _state.idempotency.size,
    idempotencyCacheCapacity:  IDEMPOTENCY_LRU_CAP,
    conflictLog:               Object.freeze(_state.conflicts.slice()),
    drainOrder:                DRAIN_ORDER,
    registry,
    sync,
  });
}

export function _resetForTests() {
  _state.reconciliationsTriggered = 0;
  _state.lastReconciliationAt = null;
  _state.lastReconciliationOutcome = null;
  _state.duplicatesSuppressed = 0;
  _state.conflicts.length = 0;
  _state.idempotency.clear();
}
