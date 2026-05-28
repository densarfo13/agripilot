/**
 * continuityRestoration.js — Wave 7 RUNTIME farm continuity restore.
 *
 *   import {
 *     restoreActiveContext, getRestorationSnapshot,
 *   } from 'src/runtime/continuity/continuityRestoration.js';
 *
 * What this is
 * ────────────
 *   Read-only restoration entry point. On page load + reconnect +
 *   bfcache restore + visibility change, this module re-derives
 *   the "active four" from canonical stores:
 *
 *     • active farm   — src/store/canonicalFarmStore.js
 *     • active crop   — derived from active farm
 *     • active season — derived from current month + farm region
 *     • active task   — from the temporary-task store
 *
 *   It does NOT mutate anything. It returns a frozen restoration
 *   envelope that consumers (UI surfaces, hooks) can use to verify
 *   their local view matches the canonical truth.
 *
 *   The restoration snapshot is recorded in the wave-5 eventRuntime
 *   under EVENT_KIND.FARM_UPDATED so the replay log captures the
 *   continuity touch-point.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Read-only. No side effects on the underlying stores.
 *   • Composition over canonicalFarmStore + temporaryTasks store.
 */

import { useCanonicalFarmStore } from '../../store/canonicalFarmStore.js';
import { listTemporaryTasks, getActiveCameraTask }
  from '../../services/temporaryTasks.js';
import { recordEvent, EVENT_KIND } from '../events/eventRuntime.js';

const RUNTIME_VERSION = 'continuity-restoration-v1';

const _state = {
  restorationsTriggered: 0,
  lastRestoredAt:        null,
  lastRestoredContext:   null,
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

function _readActiveFarm() {
  return _safe(() => {
    if (typeof useCanonicalFarmStore !== 'function') return null;
    const state = useCanonicalFarmStore.getState
      ? useCanonicalFarmStore.getState() : null;
    return (state && state.activeFarm) || null;
  }, null);
}

function _deriveActiveCrop(farm) {
  if (!farm || typeof farm !== 'object') return null;
  return farm.crop || farm.cropCode || null;
}

function _deriveActiveSeason(farm, now) {
  if (!farm) return null;
  return _safe(() => {
    const month = now ? now.getUTCMonth() + 1 : 0;
    // Coarse temperate-zone partition; legacy engines refine.
    let season = 'unknown';
    if (month >= 3  && month <= 5)  season = 'spring';
    else if (month >= 6  && month <= 8)  season = 'summer';
    else if (month >= 9  && month <= 11) season = 'fall';
    else if (month === 12 || month <= 2) season = 'winter';
    return Object.freeze({
      season,
      month,
      region: farm.region || null,
      country: farm.country || null,
    });
  }, null);
}

function _readActiveTask() {
  return _safe(() => {
    const camera = getActiveCameraTask ? getActiveCameraTask() : null;
    if (camera) return camera;
    const all = listTemporaryTasks ? listTemporaryTasks() : null;
    if (Array.isArray(all) && all.length > 0) return all[0];
    return null;
  }, null);
}

/**
 * Re-derive the canonical "active four" and return a frozen
 * restoration envelope. Optional `opts.trigger` is recorded for
 * the snapshot.
 */
export function restoreActiveContext(opts) {
  const trigger = (opts && opts.trigger) || 'manual';
  _state.restorationsTriggered += 1;
  const farm = _readActiveFarm();
  const crop = _deriveActiveCrop(farm);
  const season = _deriveActiveSeason(farm, new Date());
  const task = _readActiveTask();
  const restoredAt = _now();
  const context = Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    trigger,
    restoredAt,
    activeFarm:     farm ? Object.freeze({
      id:   farm.id   || null,
      name: farm.name || null,
      crop: crop,
      region: farm.region || null,
      country: farm.country || null,
    }) : null,
    activeCrop:     crop,
    activeSeason:   season,
    activeTask:     task ? Object.freeze({
      id:        task.id || null,
      kind:      task.kind || task.type || null,
      createdAt: task.createdAt || null,
    }) : null,
  });
  _state.lastRestoredAt = restoredAt;
  _state.lastRestoredContext = context;
  // Mirror the restoration into the wave-5 event log so the
  // replay history shows every restoration touch-point.
  _safe(() => recordEvent(EVENT_KIND.FARM_UPDATED, {
    restoredAt, trigger,
    farmId: farm && farm.id || null,
  }), null);
  return context;
}

export function getRestorationSnapshot() {
  return Object.freeze({
    runtimeVersion:        RUNTIME_VERSION,
    restorationsTriggered: _state.restorationsTriggered,
    lastRestoredAt:        _state.lastRestoredAt,
    lastRestoredContext:   _state.lastRestoredContext,
  });
}

export function _resetForTests() {
  _state.restorationsTriggered = 0;
  _state.lastRestoredAt = null;
  _state.lastRestoredContext = null;
}
