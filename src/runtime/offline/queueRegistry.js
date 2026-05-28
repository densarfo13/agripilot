/**
 * queueRegistry.js — Wave 7 RUNTIME queue governance.
 *
 *   import {
 *     registerQueue, getQueue, getRegistrySnapshot, QUEUE_KIND,
 *   } from 'src/runtime/offline/queueRegistry.js';
 *
 * What this is
 * ────────────
 *   A single map of offline queue adapters. Each adapter exposes a
 *   common shape so the reconcile layer can drain them in
 *   deterministic order without knowing transport details.
 *
 *   Adapter shape:
 *     {
 *       depth():       Promise<number> | number,
 *       drain(processor?): Promise<{ ok, drained, errors? }>,
 *       inspect():     Promise<Array> | Array,
 *       kind:          QUEUE_KIND value,
 *     }
 *
 *   Wave 7 covers the five queues from spec:
 *     scan, task, journal, notification, recommendation_ack
 *
 * Strict-rule audit
 *   • Pure registry. No transport logic here.
 *   • Module-level state; SSR-safe.
 *   • No PII; the registry only holds adapter functions + kind keys.
 */

const RUNTIME_VERSION = 'queue-registry-v1';

export const QUEUE_KIND = Object.freeze({
  SCAN:                'scan',
  TASK:                'task',
  JOURNAL:             'journal',
  NOTIFICATION:        'notification',
  RECOMMENDATION_ACK:  'recommendation_ack',
});

const _registry = new Map();
const _registeredAt = new Map();
const _telemetry = {
  registrations:    0,
  drainAttempts:    new Map(),
  drainOks:         new Map(),
  drainErrors:      new Map(),
  lastDrainOutcome: new Map(),
  lastDrainAt:      new Map(),
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _safeAsync = async (fn, fb) => { try { return await fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

/**
 * Register an adapter for a queue kind. Idempotent — repeated
 * registration with the SAME adapter ID no-ops; with a different
 * ID returns a duplicate-writer record (visible in the snapshot).
 *
 *   @param {string} kind     — one of QUEUE_KIND values
 *   @param {{
 *     adapterId: string,
 *     depth: function,
 *     drain?: function,
 *     inspect?: function,
 *   }} adapter
 */
export function registerQueue(kind, adapter) {
  if (typeof kind !== 'string' || !kind) {
    return Object.freeze({ ok: false, reason: 'invalid_kind' });
  }
  if (!adapter || typeof adapter !== 'object'
      || typeof adapter.adapterId !== 'string'
      || typeof adapter.depth !== 'function') {
    return Object.freeze({ ok: false, reason: 'invalid_adapter' });
  }
  const existing = _registry.get(kind);
  if (existing && existing.adapterId !== adapter.adapterId) {
    return Object.freeze({
      ok: false, reason: 'duplicate_adapter',
      existingAdapterId: existing.adapterId,
    });
  }
  if (!existing) {
    _registry.set(kind, Object.freeze({
      kind,
      adapterId: adapter.adapterId,
      depth:     adapter.depth,
      drain:     typeof adapter.drain === 'function' ? adapter.drain : null,
      inspect:   typeof adapter.inspect === 'function' ? adapter.inspect : null,
    }));
    _registeredAt.set(kind, _now());
    _telemetry.registrations += 1;
  }
  return Object.freeze({ ok: true });
}

export function getQueue(kind) {
  return _registry.get(kind) || null;
}

export function listRegisteredQueues() {
  return Object.freeze(Array.from(_registry.keys()));
}

export async function getQueueDepth(kind) {
  const q = _registry.get(kind);
  if (!q) return null;
  try {
    const d = q.depth();
    return typeof d === 'object' && typeof d.then === 'function'
      ? await d : d;
  } catch { return null; }
}

/**
 * Drain a single queue with optional processor.
 */
export async function drainQueue(kind, processor) {
  const q = _registry.get(kind);
  if (!q || !q.drain) {
    return Object.freeze({ ok: false, reason: 'no_drain_for_queue', kind });
  }
  _telemetry.drainAttempts.set(kind,
    (_telemetry.drainAttempts.get(kind) || 0) + 1);
  const res = await _safeAsync(() => q.drain(processor), null);
  const ok = !!(res && res.ok !== false);
  if (ok) {
    _telemetry.drainOks.set(kind,
      (_telemetry.drainOks.get(kind) || 0) + 1);
    _telemetry.lastDrainOutcome.set(kind, 'ok');
  } else {
    _telemetry.drainErrors.set(kind,
      (_telemetry.drainErrors.get(kind) || 0) + 1);
    _telemetry.lastDrainOutcome.set(kind, 'failed');
  }
  _telemetry.lastDrainAt.set(kind, _now());
  return res || Object.freeze({ ok: false, reason: 'drain_threw' });
}

export async function getRegistrySnapshot() {
  const queues = {};
  for (const [kind, q] of _registry.entries()) {
    const depth = await getQueueDepth(kind);
    queues[kind] = Object.freeze({
      kind,
      adapterId:        q.adapterId,
      registeredAt:     _registeredAt.get(kind) || null,
      depth,
      drainAttempts:    _telemetry.drainAttempts.get(kind) || 0,
      drainOks:         _telemetry.drainOks.get(kind) || 0,
      drainErrors:      _telemetry.drainErrors.get(kind) || 0,
      lastDrainOutcome: _telemetry.lastDrainOutcome.get(kind) || null,
      lastDrainAt:      _telemetry.lastDrainAt.get(kind) || null,
      canDrain:         !!q.drain,
      canInspect:       !!q.inspect,
    });
  }
  const declared = Object.values(QUEUE_KIND).length;
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    declared,
    registered:     _registry.size,
    coverage:       declared ? _registry.size / declared : 0,
    queues:         Object.freeze(queues),
  });
}

export function _resetForTests() {
  _registry.clear();
  _registeredAt.clear();
  _telemetry.registrations = 0;
  _telemetry.drainAttempts.clear();
  _telemetry.drainOks.clear();
  _telemetry.drainErrors.clear();
  _telemetry.lastDrainOutcome.clear();
  _telemetry.lastDrainAt.clear();
}
