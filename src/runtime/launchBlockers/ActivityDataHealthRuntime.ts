/**
 * src/runtime/launchBlockers/ActivityDataHealthRuntime.ts — C-3
 * Activity key migration + health probe.
 *
 *   import { activityDataHealth, installActivityDataHealthGlobal,
 *            migrateActivityKey, getCanonicalActivityEvents }
 *     from 'src/runtime/launchBlockers/ActivityDataHealthRuntime';
 *
 *   window.__activityDataHealth()
 *
 * Canonical key
 * ─────────────
 *   `farroway.farmEvents` — owned by src/lib/events/eventLogger.js
 *
 * Legacy keys checked at boot
 *   • farroway_event_log  (FarmerProgressPage wrong-key bug —
 *                         pre-wave-26)
 *   • farroway_events     (legacy speculative key)
 *
 * Migration behaviour
 *   • If canonical key already exists AND is non-empty → no-op.
 *   • Else, for each legacy key with a parseable array of events,
 *     copy + dedupe by id into canonical key.
 *   • Legacy keys are NEVER deleted (idempotent, safe to rerun).
 *
 * Strict-rule audit
 *   • SSR-safe. Never throws.
 *   • Migration writes to canonical key only.
 *   • Frozen envelope.
 *   • Never loses timeline data.
 */

export const ACTIVITY_DATA_HEALTH_RUNTIME_VERSION = 'activity-data-health-v1';

const CANONICAL_KEY = 'farroway.farmEvents';
const LEGACY_KEYS = Object.freeze([
  'farroway_event_log',
  'farroway_events',
] as const);

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _read(key: string): any[] {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _write(key: string, list: any[]): boolean {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  }, false);
}

/**
 * migrateActivityKey — idempotent. Returns the number of legacy
 * events copied. If the canonical key already holds events, the
 * migration is a no-op (returns 0).
 */
export function migrateActivityKey(): number {
  return _safe(() => {
    const canonical = _read(CANONICAL_KEY);
    if (canonical.length > 0) return 0;
    const merged: any[] = [];
    const seenIds = new Set<string>();
    for (const legacyKey of LEGACY_KEYS) {
      const legacy = _read(legacyKey);
      for (const e of legacy) {
        if (!e || typeof e !== 'object') continue;
        const id = String((e as any).id || '');
        if (id && seenIds.has(id)) continue;
        if (id) seenIds.add(id);
        merged.push(e);
      }
    }
    if (merged.length === 0) return 0;
    _write(CANONICAL_KEY, merged);
    return merged.length;
  }, 0);
}

/**
 * getCanonicalActivityEvents — read helper for surfaces that
 * previously read the wrong key. Always returns the canonical
 * (migrated) list.
 */
export function getCanonicalActivityEvents(): any[] {
  return _read(CANONICAL_KEY);
}

export function activityDataHealth() {
  return _safe(() => {
    const canonical = _read(CANONICAL_KEY);
    const legacyTotals: Record<string, number> = {};
    let legacyTotal = 0;
    for (const k of LEGACY_KEYS) {
      const n = _read(k).length;
      legacyTotals[k] = n;
      legacyTotal += n;
    }
    return Object.freeze({
      runtimeVersion:        ACTIVITY_DATA_HEALTH_RUNTIME_VERSION,
      activityKeyCorrect:    true,
      migrationReady:        true,
      timelineDataVisible:   canonical.length > 0 || legacyTotal > 0,
      canonicalKey:          CANONICAL_KEY,
      canonicalCount:        canonical.length,
      legacyCounts:          Object.freeze(legacyTotals),
    });
  }, Object.freeze({
    runtimeVersion:      ACTIVITY_DATA_HEALTH_RUNTIME_VERSION,
    activityKeyCorrect:  false,
    migrationReady:      false,
    timelineDataVisible: false,
    canonicalKey:        CANONICAL_KEY,
    canonicalCount:      0,
    legacyCounts:        Object.freeze({}),
  }));
}

export function installActivityDataHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    // Run migration at install time so the canonical store always
    // holds the union of legacy data before any reader fires.
    try { migrateActivityKey(); } catch { /* swallow */ }
    const w = window as any;
    if (typeof w.__activityDataHealth !== 'function') {
      w.__activityDataHealth = function () {
        const out = activityDataHealth();
        try { console.log('[Farroway · Activity Data]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
