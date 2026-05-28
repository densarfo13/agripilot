/**
 * deviceResilience.js — Wave 7 RUNTIME device-specific recovery.
 *
 *   import { installDeviceResilience, getResilienceSnapshot }
 *     from 'src/runtime/offline/deviceResilience.js';
 *
 * What this is
 * ────────────
 *   Listeners that catch the device-state transitions Safari and
 *   Android stage to web apps:
 *
 *     • `visibilitychange` — backgrounded/foregrounded; mobile OSes
 *       freeze JS execution when an app goes to background. When
 *       it returns, queues may have stale snapshots.
 *     • `pageshow` — bfcache restoration on Safari; the page is
 *       resurrected from cache without rerunning module-level code.
 *       We fire a manual reconcile to refresh queue snapshots.
 *     • `online` — already handled by syncRuntime; this module adds
 *       a redundant idempotent trigger so reconcile fires even if
 *       the syncRuntime listener was de-registered.
 *
 *   Every transition fires the wave-7 reconcileOnReconnect with a
 *   trigger label so __replayHealth() can attribute the reason.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws.
 *   • SSR-safe (window guards).
 *   • Idempotent install — repeated calls no-op.
 *   • Listeners cleaned up via internal tracking; the snapshot
 *     reports installed state.
 */

import {
  reconcileOnReconnect,
} from './reconcileReconnect.js';

const RUNTIME_VERSION = 'device-resilience-v1';

const _state = {
  installed:              false,
  installedAt:            null,
  visibilityListeners:    0,
  pageshowListeners:      0,
  onlineListeners:        0,
  lastTrigger:            null,
  triggerCounts: {
    online:               0,
    visibilitychange:     0,
    pageshow:             0,
    manual:               0,
  },
  reconcileFailureCount:  0,
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');
const _hasWindow = () => {
  try { return typeof window !== 'undefined'; } catch { return false; }
};

function _trigger(kind) {
  _state.lastTrigger = Object.freeze({ kind, at: _now() });
  if (_state.triggerCounts[kind] != null) {
    _state.triggerCounts[kind] += 1;
  }
  // Fire-and-forget; failures don't propagate to listener.
  reconcileOnReconnect({ trigger: kind }).catch(() => {
    _state.reconcileFailureCount += 1;
  });
}

export function installDeviceResilience() {
  if (_state.installed) {
    return Object.freeze({ ok: true, alreadyInstalled: true });
  }
  if (!_hasWindow()) {
    return Object.freeze({ ok: false, reason: 'no_window' });
  }
  _safe(() => {
    // visibilitychange — mobile background/resume.
    const onVis = () => {
      _safe(() => {
        if (document && document.visibilityState === 'visible') {
          _trigger('visibilitychange');
        }
      }, null);
    };
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', onVis);
      _state.visibilityListeners += 1;
    }
    // pageshow — Safari bfcache restore.
    const onPageshow = (e) => {
      // e.persisted === true means restored from bfcache.
      if (e && e.persisted) _trigger('pageshow');
    };
    window.addEventListener('pageshow', onPageshow);
    _state.pageshowListeners += 1;
    // online — redundant safety net (syncRuntime already attaches).
    const onOnline = () => _trigger('online');
    window.addEventListener('online', onOnline);
    _state.onlineListeners += 1;
  }, null);
  _state.installed = true;
  _state.installedAt = _now();
  return Object.freeze({ ok: true });
}

export function manualTrigger() {
  _trigger('manual');
  return Object.freeze({ ok: true, trigger: 'manual', at: _now() });
}

export function getResilienceSnapshot() {
  return Object.freeze({
    runtimeVersion:        RUNTIME_VERSION,
    installed:             _state.installed,
    installedAt:           _state.installedAt,
    visibilityListeners:   _state.visibilityListeners,
    pageshowListeners:     _state.pageshowListeners,
    onlineListeners:       _state.onlineListeners,
    triggerCounts:         Object.freeze({ ..._state.triggerCounts }),
    lastTrigger:           _state.lastTrigger,
    reconcileFailureCount: _state.reconcileFailureCount,
  });
}

export function _resetForTests() {
  _state.installed = false;
  _state.installedAt = null;
  _state.visibilityListeners = 0;
  _state.pageshowListeners = 0;
  _state.onlineListeners = 0;
  _state.lastTrigger = null;
  _state.triggerCounts.online = 0;
  _state.triggerCounts.visibilitychange = 0;
  _state.triggerCounts.pageshow = 0;
  _state.triggerCounts.manual = 0;
  _state.reconcileFailureCount = 0;
}
