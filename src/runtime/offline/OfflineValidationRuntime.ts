/**
 * src/runtime/offline/OfflineValidationRuntime.ts — read-only
 * probe over the existing offline queue stores. Reports which
 * offline flows are wired + whether duplicate-prevention exists.
 *
 *   import { offlineValidationHealth, installOfflineValidationGlobal }
 *     from 'src/runtime/offline/OfflineValidationRuntime';
 *
 *   window.__offlineValidationHealth()
 *
 * Strict-rule audit
 *   • Pure read-only probe. Never writes anything.
 *   • Composes existing offline-queue surfaces.
 *   • SSR-safe.
 *   • Never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export const OFFLINE_VALIDATION_RUNTIME_VERSION = 'offline-validation-v1';

export interface OfflineValidationHealth {
  runtimeVersion:               string;
  initialized:                  boolean;
  offlineAddPlantReady:         boolean;
  offlineAddFarmerReady:        boolean;
  offlineTaskCompleteReady:     boolean;
  /**
   * Wave-39 — true iff the artifact-creation offline path is wired
   * (probed via the artifact queue key OR the artifact runtime
   * health global).
   */
  offlineArtifactReady:         boolean;
  reconnectSyncReady:           boolean;
  duplicatePreventionReady:     boolean;
  queueHealthAvailable:         boolean;
  detectedQueues:               ReadonlyArray<string>;
}

function _hasLocal(): boolean {
  return _safe(() => typeof localStorage !== 'undefined'
                     && !!localStorage, false);
}

function _hasKey(key: string): boolean {
  return _safe(() => {
    if (!_hasLocal()) return false;
    return localStorage.getItem(key) != null;
  }, false);
}

function _hasGlobal(name: string): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    return typeof (window as any)[name] === 'function';
  }, false);
}

export function offlineValidationHealth(): OfflineValidationHealth {
  return _safe(() => {
    // Detect which of the offline queue stores are present.
    const detected: string[] = [];
    if (_hasKey('farroway-offline.mutations')) detected.push('farroway-offline.mutations');
    if (_hasKey('farroway_offline_queue'))     detected.push('farroway_offline_queue');
    if (_hasKey('farroway.offlineQueue.v1'))   detected.push('farroway.offlineQueue.v1');
    if (_hasKey('farroway.scanQueue'))         detected.push('farroway.scanQueue');

    // Probe existing diagnostic globals.
    const syncHealthOk = _hasGlobal('__syncHealth');
    const goLiveOk     = _hasGlobal('__goLiveHealth');

    // Heuristic readiness flags — based on the presence of the
    // canonical writer surfaces. We do NOT trigger a real offline
    // write here; this is a metadata probe only.
    const offlineAddPlantReady     = _hasGlobal('__scanResultHealth')
                                     || _hasKey('farroway_managed_plants');
    const offlineAddFarmerReady    = _hasGlobal('__bulkOnboardingHealth')
                                     || _hasGlobal('__persistenceHealth');
    const offlineTaskCompleteReady = _hasGlobal('__taskStoreHealth')
                                     || syncHealthOk;
    // Wave-39 — artifact-offline path: the ArtifactRuntime is the
    // single owner of evidence artifacts and writes through the
    // canonical offline-queue keys. We probe its health surface
    // first, then fall back to queue-key presence.
    const offlineArtifactReady     = _hasGlobal('__artifactRuntimeHealth')
                                     || _hasKey('farroway.artifactQueue')
                                     || _hasKey('farroway-offline.mutations');
    const reconnectSyncReady       = syncHealthOk;
    const duplicatePreventionReady = detected.length > 0;
    const queueHealthAvailable     = syncHealthOk;

    return Object.freeze({
      runtimeVersion:           OFFLINE_VALIDATION_RUNTIME_VERSION,
      initialized:              true,
      offlineAddPlantReady,
      offlineAddFarmerReady,
      offlineTaskCompleteReady,
      offlineArtifactReady,
      reconnectSyncReady,
      duplicatePreventionReady,
      queueHealthAvailable,
      detectedQueues:           Object.freeze([...detected]),
    });
    void goLiveOk; // reserved for future cross-check
  }, Object.freeze({
    runtimeVersion:           OFFLINE_VALIDATION_RUNTIME_VERSION,
    initialized:              false,
    offlineAddPlantReady:     false,
    offlineAddFarmerReady:    false,
    offlineTaskCompleteReady: false,
    offlineArtifactReady:     false,
    reconnectSyncReady:       false,
    duplicatePreventionReady: false,
    queueHealthAvailable:     false,
    detectedQueues:           Object.freeze([]),
  }));
}

export function installOfflineValidationGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__offlineValidationHealth !== 'function') {
      w.__offlineValidationHealth = function () {
        const out = offlineValidationHealth();
        try { console.log('[Farroway · Offline Validation]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
