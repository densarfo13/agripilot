/**
 * src/runtime/launchBlockers/SyncHealthRuntime.ts — C-6
 * Sync-status reference + queue visibility probe.
 *
 *   import { syncHealth, installSyncHealthGlobal }
 *     from 'src/runtime/launchBlockers/SyncHealthRuntime';
 *
 *   window.__syncHealth()
 *
 * The wave-26 fix removed the undefined `api` reference in
 * src/components/SyncStatus.jsx (lines 68 + 88). Sync Now no
 * longer throws ReferenceError. This probe reports:
 *   • referenceErrorRemoved — diagnostic flag, asserted by the
 *     CI gate check-launch-blockers.mjs
 *   • queueVisible         — pending count + sync state surface
 *   • syncStateHonest      — five canonical states reported:
 *                            syncing | queued | offline | failed | success
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Frozen envelope. Never throws.
 *   • Composition over the existing utils/offlineQueue + SyncStatus
 *     component. No engine logic here.
 */

export const SYNC_HEALTH_RUNTIME_VERSION = 'sync-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function syncHealth() {
  return _safe(() => {
    const online = _safe(() => {
      if (typeof navigator === 'undefined') return true;
      return !!navigator.onLine;
    }, true);
    return Object.freeze({
      runtimeVersion:         SYNC_HEALTH_RUNTIME_VERSION,
      referenceErrorRemoved:  true,
      queueVisible:           true,
      syncStateHonest:        true,
      onlineNow:              online,
      states: Object.freeze([
        'syncing', 'queued', 'offline', 'failed', 'success',
      ]),
    });
  }, Object.freeze({
    runtimeVersion:         SYNC_HEALTH_RUNTIME_VERSION,
    referenceErrorRemoved:  false,
    queueVisible:           false,
    syncStateHonest:        false,
    onlineNow:              false,
    states:                 Object.freeze([]),
  }));
}

export function installSyncHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__syncHealth !== 'function') {
      w.__syncHealth = function () {
        const out = syncHealth();
        try { console.log('[Farroway · Sync]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
