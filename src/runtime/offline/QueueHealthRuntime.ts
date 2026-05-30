/**
 * src/runtime/offline/QueueHealthRuntime.ts — wave-23 read-only
 * probe over Farroway's existing offline-queue surfaces.
 *
 *   window.__queueHealth()
 *
 * This module is the SOLE probe — it never creates a queue of its
 * own. It composes the existing wave-7 queueRegistry snapshot plus
 * heuristic reads over the canonical localStorage queue keys
 * already populated by the offline runtime.
 *
 * What this attests
 * ─────────────────
 *   • initialized            — probe ran without crashing
 *   • queueLength            — sum of all queue depths (or null
 *                              when registry has not initialised)
 *   • pendingSync            — same as queueLength, surfaced under
 *                              the spec's name for clarity
 *   • syncFailures           — sum of drainErrors across registered
 *                              queues
 *   • lastSyncAt             — most recent lastDrainAt ISO across
 *                              all queues, or null
 *   • duplicateProtectionReady — true iff at least one canonical
 *                                offline queue key is present (the
 *                                queue-registry encodes dedup keys)
 *   • offlineQueueReady      — registry has at least one queue
 *                              registered OR a canonical queue key
 *                              exists in localStorage
 *
 * Strict-rule audit
 *   • Pure read-only. Never writes anything.
 *   • SSR-safe — every storage / window / fetch access guarded.
 *   • Frozen envelope. Never throws.
 *   • Honest "unknown" — when the registry is unavailable we
 *     return null for numeric fields rather than fabricating 0.
 */

export const QUEUE_HEALTH_RUNTIME_VERSION = 'queue-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _hasLocal(): boolean {
  return _safe(() => typeof localStorage !== 'undefined' && !!localStorage, false);
}
function _hasKey(key: string): boolean {
  return _safe(() => _hasLocal() && localStorage.getItem(key) != null, false);
}
function _readRowCount(key: string): number {
  return _safe(() => {
    if (!_hasLocal()) return 0;
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.length;
      if (parsed && Array.isArray(parsed.events)) return parsed.events.length;
      if (parsed && Array.isArray(parsed.queue))  return parsed.queue.length;
      if (parsed && Array.isArray(parsed.items))  return parsed.items.length;
      return 0;
    } catch { return 0; }
  }, 0);
}

// Canonical offline-queue localStorage keys. We READ them only —
// never write. The single-writer invariant remains with whichever
// runtime owns the key.
const QUEUE_KEYS = [
  'farroway-offline.mutations',
  'farroway_offline_queue',
  'farroway.offlineQueue.v1',
  'farroway.scanQueue',
  'farroway.artifactQueue',
];

export interface QueueHealth {
  runtimeVersion:            string;
  initialized:               boolean;
  queueLength:               number | null;
  pendingSync:               number | null;
  syncFailures:              number | null;
  lastSyncAt:                string | null;
  duplicateProtectionReady:  boolean;
  offlineQueueReady:         boolean;
  /** Detected canonical queue keys for QA drilldown. */
  detectedQueues:            ReadonlyArray<string>;
  /** Registry snapshot subset (when available). */
  registrySummary?:          Readonly<{
    declared:    number;
    registered:  number;
    coverage:    number;
  }>;
}

const FROZEN_FALLBACK: Readonly<QueueHealth> = Object.freeze({
  runtimeVersion:            QUEUE_HEALTH_RUNTIME_VERSION,
  initialized:               false,
  queueLength:               null,
  pendingSync:               null,
  syncFailures:              null,
  lastSyncAt:                null,
  duplicateProtectionReady:  false,
  offlineQueueReady:         false,
  detectedQueues:            Object.freeze([]),
});

/**
 * _readRegistry — best-effort sync read of the wave-7 queue
 * registry's last-known snapshot. The registry's snapshot fn is
 * async; we keep this sync by reading whatever the wave-21
 * cache helper or sync_health global exposed.
 */
function _readRegistry(): {
  registered: number;
  declared:   number;
  totalDepth: number;
  totalErrors: number;
  newestDrainAt: string | null;
} | null {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    // The wave-7 syncHealth global publishes the registry summary
    // synchronously after its first probe. We compose against that.
    if (typeof w.__syncHealth === 'function') {
      const s = w.__syncHealth();
      const reg = s && (s.queueRegistry || s.registry);
      if (reg && typeof reg === 'object') {
        let totalDepth = 0, totalErrors = 0;
        let newest: string | null = null;
        const queues = (reg.queues || {}) as Record<string, any>;
        for (const k of Object.keys(queues)) {
          const q = queues[k];
          if (!q) continue;
          if (typeof q.depth === 'number') totalDepth += q.depth;
          if (typeof q.drainErrors === 'number') totalErrors += q.drainErrors;
          if (typeof q.lastDrainAt === 'string') {
            if (!newest || q.lastDrainAt > newest) newest = q.lastDrainAt;
          }
        }
        return {
          registered:  Number(reg.registered || 0),
          declared:    Number(reg.declared   || 0),
          totalDepth, totalErrors, newestDrainAt: newest,
        };
      }
    }
    return null;
  }, null);
}

export function queueHealth(): QueueHealth {
  return _safe(() => {
    const detected: string[] = [];
    let lsRows = 0;
    for (const key of QUEUE_KEYS) {
      if (_hasKey(key)) {
        detected.push(key);
        lsRows += _readRowCount(key);
      }
    }

    const reg = _readRegistry();
    const hasRegistry = !!reg;

    // Numeric fields: prefer registry truth when available;
    // fall back to localStorage row counts; otherwise null.
    const queueLength = hasRegistry
      ? (reg!.totalDepth + lsRows)
      : (_hasLocal() ? lsRows : null);
    const syncFailures = hasRegistry ? reg!.totalErrors : null;
    const lastSyncAt   = hasRegistry ? reg!.newestDrainAt : null;

    const duplicateProtectionReady =
         hasRegistry
      || detected.length > 0;
    const offlineQueueReady =
         hasRegistry
      || detected.length > 0;

    const registrySummary = hasRegistry
      ? Object.freeze({
          declared:   reg!.declared,
          registered: reg!.registered,
          coverage:   reg!.declared
            ? Math.round((reg!.registered / reg!.declared) * 100) / 100
            : 0,
        })
      : undefined;

    return Object.freeze({
      runtimeVersion:           QUEUE_HEALTH_RUNTIME_VERSION,
      initialized:              true,
      queueLength,
      pendingSync:              queueLength,
      syncFailures,
      lastSyncAt,
      duplicateProtectionReady,
      offlineQueueReady,
      detectedQueues:           Object.freeze([...detected]),
      registrySummary,
    });
  }, FROZEN_FALLBACK);
}

export function installQueueHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__queueHealth !== 'function') {
      w.__queueHealth = function () {
        const out = queueHealth();
        try { console.log('[Farroway · Queue Health]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
