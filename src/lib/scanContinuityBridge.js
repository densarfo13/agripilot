/**
 * scanContinuityBridge.js — wires scan completions into the
 * canonical farm store + fires the cross-screen events Home /
 * Tasks / Progress / Journal subscribe to (§3).
 *
 *   import { installScanContinuityBridge }
 *     from 'src/lib/scanContinuityBridge.js';
 *
 *   installScanContinuityBridge();  // once at app mount
 *
 * What this is
 * ────────────
 *   A small idempotent connector that:
 *     • Subscribes to FarmEvents.SCAN_COMPLETED on the existing
 *       farmEventBus.
 *     • On each scan, merges the structured signal into the
 *       canonical activeFarm via updateFarm({ scanHistory: [...] }).
 *     • Then re-emits CROP_UPDATED and FARM_UPDATED so every
 *       subscribed surface re-renders without a route change.
 *
 *   Composes — does NOT replace — the existing scan pipeline.
 *   The pipeline keeps publishing SCAN_COMPLETED; this bridge is
 *   the bookkeeper that keeps the Zustand store fresh.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Idempotent — guards a module-scope `_installed` flag.
 *   • Never blocks the scan pipeline; every callback wrapped in safe.
 */

import { FarmEvents, subscribe, publish } from './farmEventBus.js';
import { useCanonicalFarmStore } from '../store/canonicalFarmStore.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _isObj = (v) => v != null && typeof v === 'object';

let _installed = false;
let _unsubscribe = null;

const MAX_HISTORY = 50;

function _appendScan(payload) {
  return _safe(() => {
    if (!_isObj(payload)) return false;
    const state = useCanonicalFarmStore.getState();
    if (!state || !state.activeFarm) return false;

    const prev = Array.isArray(state.activeFarm.scanHistory)
      ? state.activeFarm.scanHistory : [];

    // Build a structural row — never store raw image bytes.
    const row = Object.freeze({
      id:        typeof payload.scanId === 'string' ? payload.scanId
               : typeof payload.id === 'string' ? payload.id
               : 'scan_' + Date.now(),
      createdAt: typeof payload.createdAt === 'number' ? payload.createdAt : Date.now(),
      severity:  typeof payload.severity === 'string' ? payload.severity : null,
      crop:      typeof payload.crop === 'string' ? payload.crop : null,
      issue:     typeof payload.issue === 'string' ? payload.issue : null,
      confidence:typeof payload.confidence === 'string' ? payload.confidence : null,
    });

    const next = [row, ...prev].slice(0, MAX_HISTORY);

    // If the scan brought a new crop string AND the active farm has
    // no crop yet, promote it (lets a scan-first onboarding hydrate
    // the canonical store).
    const updates = { scanHistory: next, updatedAt: Date.now() };
    if (row.crop && !state.activeFarm.crop) {
      updates.crop = row.crop;
    }

    state.updateFarm(updates);

    // Re-emit cross-screen events for subscribers.
    _safe(() => publish(FarmEvents.FARM_UPDATED, {
      reason:  'scan_completed',
      scanId:  row.id,
      farmId:  state.activeFarm.id,
      at:      new Date().toISOString(),
    }), null);

    if (updates.crop) {
      _safe(() => publish(FarmEvents.CROP_UPDATED, {
        reason: 'scan_promoted_crop',
        cropId: updates.crop,
        scanId: row.id,
      }), null);
    }
    return true;
  }, false);
}

/**
 * Install the bridge. Idempotent + SSR-safe.
 */
export function installScanContinuityBridge() {
  return _safe(() => {
    if (_installed) return true;
    if (typeof window === 'undefined') return false;
    _unsubscribe = subscribe(FarmEvents.SCAN_COMPLETED, _appendScan);
    _installed = true;
    return true;
  }, false);
}

/** Test-only reset. */
export function _resetScanContinuityBridge() {
  if (typeof _unsubscribe === 'function') {
    _safe(() => _unsubscribe(), null);
  }
  _unsubscribe = null;
  _installed = false;
}

export const _internal = Object.freeze({ _appendScan, MAX_HISTORY });

const _module = {
  installScanContinuityBridge, _resetScanContinuityBridge, _internal,
};
export default _module;
