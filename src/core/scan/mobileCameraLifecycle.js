/**
 * mobileCameraLifecycle.js — iPhone Safari camera-lifecycle
 * recovery layer.
 *
 *   import {
 *     installMobileCameraLifecycle,
 *     uninstallMobileCameraLifecycle,
 *     subscribeMobileCameraLifecycle,
 *     forceRehydrateCamera,
 *     getMobileCameraLifecycleSnapshot,
 *   } from 'src/core/scan/mobileCameraLifecycle.js';
 *
 *   // From the Scan surface mount:
 *   const handle = installMobileCameraLifecycle({
 *     videoElRef:      () => videoEl,
 *     restartCamera:   () => startCamera(...),
 *     stopCamera,
 *     onStaleStream:   () => onStaleHandler(),
 *     onFreeze:        () => onFreezeHandler(),
 *   });
 *
 *   // On unmount:
 *   handle.uninstall();
 *
 * Why this exists
 * ───────────────
 *   `src/services/cameraSession.js` already handles single-stream
 *   enforcement + `visibilitychange` pause/resume. It does NOT
 *   handle the failure modes iPhone Safari produces in real-world
 *   use, all of which the production scan reports flag:
 *
 *     1. Safari bfcache eviction — Safari freezes the page when
 *        the user switches apps. On return, `visibilitychange`
 *        may not fire (bfcache restore uses pageshow). The active
 *        MediaStream's tracks are killed by iOS but the
 *        srcObject reference looks "live" until the next frame
 *        request — which never comes, because Safari is rendering
 *        the cached snapshot.
 *
 *     2. Track-ended-without-event — `track.readyState === 'ended'`
 *        after foregrounding, but the 'ended' event never fired
 *        in the background. The video element shows the last
 *        decoded frame indefinitely.
 *
 *     3. Frozen stream — track is "live" but no new frames decode.
 *        Detectable only by polling `videoEl.currentTime` over
 *        time. iPhone Safari does this when permission is mid-
 *        renew, when the OS Camera app opens in the background,
 *        or when the user takes a screenshot.
 *
 *     4. Stale srcObject — Safari nulls `videoEl.srcObject`
 *        during the hide window. The cameraSession visibility
 *        handler re-attaches, but the stream may already be
 *        dead at that point.
 *
 *   This module owns recovery for all four:
 *     • `pagehide` + `pageshow` listeners alongside the existing
 *       `visibilitychange` handler — covers Safari bfcache
 *     • Stream watchdog — polls `videoEl.currentTime` and the
 *       active track's `readyState` every 2 s; flags stalled or
 *       ended tracks
 *     • Heartbeat dispatcher — fires `farroway:cameraHeartbeat`
 *       events so subscribers can react to health changes
 *     • Forced rehydrate — `forceRehydrateCamera()` runs the full
 *       teardown + restart sequence; preserves the active scan
 *       session id so an in-flight scan doesn't fail
 *
 *   The module composes WITH cameraSession.js — it doesn't
 *   replace it. cameraSession owns the singleton; this owns the
 *   recovery loop.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Idempotent install + clean uninstall.
 *   • No external imports beyond scanTelemetry (best-effort).
 *   • All event handlers self-clean on uninstall.
 */

import {
  emitScanEvent, SCAN_EVENTS,
} from './scanTelemetry.js';

// ─── Constants ──────────────────────────────────────────────

const WATCHDOG_INTERVAL_MS = 2000;
// Two consecutive frozen samples (~4s) before we call it dead.
const FREEZE_THRESHOLD_SAMPLES = 2;
// Don't watchdog while in the background.
const HEARTBEAT_EVENT = 'farroway:cameraHeartbeat';

const LIFECYCLE_STATES = Object.freeze({
  IDLE:        'idle',
  ACTIVE:      'active',
  HIDDEN:      'hidden',         // visibility hidden or pagehide fired
  REHYDRATING: 'rehydrating',
  STALE:       'stale',           // detected stale stream awaiting recovery
});

// ─── Module-level state ─────────────────────────────────────

const _state = {
  installed:        false,
  current:          LIFECYCLE_STATES.IDLE,
  videoElRef:       null,          // () => HTMLVideoElement
  restartCamera:    null,          // async () => result
  stopCamera:       null,          // () => void
  onStaleStream:    null,          // () => void
  onFreeze:         null,          // () => void
  // Watchdog tracking
  watchdogTimer:    null,
  lastCurrentTime:  null,
  frozenSamples:    0,
  // Listeners (kept so we can detach on uninstall)
  visibilityH:      null,
  pagehideH:        null,
  pageshowH:        null,
  // Subscribers
  subscribers:      new Set(),
  // Counters for the snapshot
  rehydrateCount:   0,
  freezeCount:      0,
  staleStreamCount: 0,
  hideEvents:       0,
  pageshowEvents:   0,
  lastHeartbeatAt:  null,
};

function _safe(fn) {
  try { return fn(); } catch { return undefined; }
}

function _setLifecycleState(next, why) {
  if (_state.current === next) return;
  _state.current = next;
  _emitHeartbeat({ event: 'state_change', state: next, why: why || '' });
}

function _emitHeartbeat(payload) {
  const enriched = Object.freeze({
    ...payload,
    timestamp: Date.now(),
    state:     _state.current,
  });
  _state.lastHeartbeatAt = enriched.timestamp;
  // Notify in-process subscribers (e.g. dev overlay, recovery hook).
  for (const fn of _state.subscribers) {
    _safe(() => fn(enriched));
  }
  // Dispatch a DOM event so unrelated surfaces (e.g. an analytics
  // bridge) can subscribe without a direct import.
  _safe(() => {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(HEARTBEAT_EVENT, { detail: enriched }));
    }
  });
}

// ─── Watchdog ───────────────────────────────────────────────

function _runWatchdogTick() {
  try {
    const video = _state.videoElRef ? _state.videoElRef() : null;
    if (!video) return; // surface unmounted between ticks — fine.
    if (_state.current === LIFECYCLE_STATES.HIDDEN) return; // don't poll while hidden.

    // Frozen-stream detection — currentTime should advance every tick
    // while the video is playing. If it sits at the same value across
    // FREEZE_THRESHOLD_SAMPLES consecutive ticks, the stream is frozen.
    const t = Number(video.currentTime || 0);
    if (_state.lastCurrentTime != null && Math.abs(t - _state.lastCurrentTime) < 0.001
        && !video.paused) {
      _state.frozenSamples += 1;
      if (_state.frozenSamples >= FREEZE_THRESHOLD_SAMPLES
          && _state.current !== LIFECYCLE_STATES.STALE) {
        _state.freezeCount += 1;
        _setLifecycleState(LIFECYCLE_STATES.STALE, 'frozen_stream');
        _emitHeartbeat({ event: 'freeze_detected', currentTime: t });
        _safe(() => emitScanEvent(SCAN_EVENTS.SESSION_RECOVERED, {
          source: 'camera_freeze_detected',
        }));
        _safe(() => _state.onFreeze && _state.onFreeze());
      }
    } else {
      _state.frozenSamples = 0;
    }
    _state.lastCurrentTime = t;

    // Track-ended detection — sometimes Safari kills the track in
    // the background without firing 'ended'. Probe readyState.
    const stream = video.srcObject;
    if (stream && typeof stream.getVideoTracks === 'function') {
      const tracks = stream.getVideoTracks();
      const live = tracks.some((track) => track.readyState === 'live');
      if (!live && _state.current !== LIFECYCLE_STATES.STALE) {
        _state.staleStreamCount += 1;
        _setLifecycleState(LIFECYCLE_STATES.STALE, 'tracks_ended');
        _emitHeartbeat({ event: 'tracks_ended_detected' });
        _safe(() => emitScanEvent(SCAN_EVENTS.SESSION_RECOVERED, {
          source: 'camera_tracks_ended',
        }));
        _safe(() => _state.onStaleStream && _state.onStaleStream());
      }
    }
  } catch {
    // Watchdog must never propagate — a broken tick just retries
    // on the next interval.
  }
}

function _startWatchdog() {
  if (_state.watchdogTimer) return;
  try {
    _state.watchdogTimer = setInterval(_runWatchdogTick, WATCHDOG_INTERVAL_MS);
  } catch { _state.watchdogTimer = null; }
}

function _stopWatchdog() {
  if (!_state.watchdogTimer) return;
  try { clearInterval(_state.watchdogTimer); } catch { /* swallow */ }
  _state.watchdogTimer = null;
  _state.lastCurrentTime = null;
  _state.frozenSamples = 0;
}

// ─── Force rehydrate ────────────────────────────────────────

/**
 * Public API — tear down the current stream and request a fresh
 * one without losing the active scan session. Idempotent: calling
 * while already rehydrating returns the in-flight promise.
 *
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
let _rehydratePromise = null;

export function forceRehydrateCamera() {
  if (_rehydratePromise) return _rehydratePromise;
  _rehydratePromise = (async () => {
    try {
      if (!_state.installed || !_state.restartCamera) {
        return { ok: false, reason: 'not_installed' };
      }
      _setLifecycleState(LIFECYCLE_STATES.REHYDRATING, 'manual_or_watchdog');
      _state.rehydrateCount += 1;
      // Stop first so the next start gets a clean slate.
      _safe(() => _state.stopCamera && _state.stopCamera());
      // Small breath so Safari finishes track cleanup before we
      // request a new stream — repeating fast getUserMedia calls
      // on iOS leaves the second one in a permanent 'busy' state.
      await new Promise((r) => setTimeout(r, 200));
      const result = await _state.restartCamera();
      const ok = !!(result && (result.ok === true || result === true));
      _setLifecycleState(ok ? LIFECYCLE_STATES.ACTIVE : LIFECYCLE_STATES.STALE,
        ok ? 'rehydrate_ok' : 'rehydrate_failed');
      _emitHeartbeat({ event: ok ? 'rehydrate_ok' : 'rehydrate_failed' });
      _state.lastCurrentTime = null;
      _state.frozenSamples = 0;
      return ok ? { ok: true } : { ok: false, reason: (result && result.reason) || 'restart_failed' };
    } catch (err) {
      _setLifecycleState(LIFECYCLE_STATES.STALE, 'rehydrate_exception');
      return { ok: false, reason: (err && err.message) || 'exception' };
    } finally {
      _rehydratePromise = null;
    }
  })();
  return _rehydratePromise;
}

// ─── Event handlers ─────────────────────────────────────────

function _onVisibilityChange() {
  try {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      _state.hideEvents += 1;
      _setLifecycleState(LIFECYCLE_STATES.HIDDEN, 'visibility_hidden');
      _emitHeartbeat({ event: 'page_hidden' });
    } else {
      // Page back to visible — if state had drifted to STALE we
      // trigger rehydrate. Otherwise probe the stream once and
      // restart only if needed.
      if (_state.current === LIFECYCLE_STATES.STALE) {
        forceRehydrateCamera();
      } else {
        _setLifecycleState(LIFECYCLE_STATES.ACTIVE, 'visibility_visible');
        _emitHeartbeat({ event: 'page_visible' });
        // Reset watchdog baseline so the first post-resume sample
        // doesn't count as a frozen tick.
        _state.lastCurrentTime = null;
        _state.frozenSamples = 0;
      }
    }
  } catch { /* swallow */ }
}

function _onPageHide() {
  try {
    _state.hideEvents += 1;
    _setLifecycleState(LIFECYCLE_STATES.HIDDEN, 'pagehide');
    _emitHeartbeat({ event: 'page_hide' });
  } catch { /* swallow */ }
}

function _onPageShow(ev) {
  try {
    _state.pageshowEvents += 1;
    const persisted = !!(ev && ev.persisted);
    // Safari bfcache restore — `persisted` is true. The stream
    // is GUARANTEED dead in this case (iOS terminates all
    // MediaStream tracks before bfcache eviction).
    if (persisted) {
      _emitHeartbeat({ event: 'pageshow_bfcache' });
      forceRehydrateCamera();
    } else {
      // Normal reload — visibilitychange will follow.
      _emitHeartbeat({ event: 'pageshow' });
    }
  } catch { /* swallow */ }
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Install the lifecycle layer. Returns an uninstall handle.
 *
 * @param {object} opts
 * @param {() => HTMLVideoElement | null} opts.videoElRef  — getter for the
 *   live video element. Read on every watchdog tick so a re-mount
 *   doesn't strand the lifecycle.
 * @param {() => Promise<{ok:boolean,reason?:string}>} opts.restartCamera
 *   — caller's restart implementation. Called from forceRehydrate.
 * @param {() => void} opts.stopCamera — caller's teardown.
 * @param {() => void} [opts.onStaleStream]
 * @param {() => void} [opts.onFreeze]
 */
export function installMobileCameraLifecycle(opts) {
  return _safe(() => {
    const o = (opts && typeof opts === 'object') ? opts : {};
    if (_state.installed) {
      // Idempotent — replace the callbacks on a re-install (e.g.
      // surface remount) so the new component instance receives
      // recovery callbacks.
      _state.videoElRef    = typeof o.videoElRef    === 'function' ? o.videoElRef    : _state.videoElRef;
      _state.restartCamera = typeof o.restartCamera === 'function' ? o.restartCamera : _state.restartCamera;
      _state.stopCamera    = typeof o.stopCamera    === 'function' ? o.stopCamera    : _state.stopCamera;
      _state.onStaleStream = typeof o.onStaleStream === 'function' ? o.onStaleStream : _state.onStaleStream;
      _state.onFreeze      = typeof o.onFreeze      === 'function' ? o.onFreeze      : _state.onFreeze;
      return { uninstall: uninstallMobileCameraLifecycle };
    }
    _state.videoElRef    = typeof o.videoElRef    === 'function' ? o.videoElRef    : null;
    _state.restartCamera = typeof o.restartCamera === 'function' ? o.restartCamera : null;
    _state.stopCamera    = typeof o.stopCamera    === 'function' ? o.stopCamera    : null;
    _state.onStaleStream = typeof o.onStaleStream === 'function' ? o.onStaleStream : null;
    _state.onFreeze      = typeof o.onFreeze      === 'function' ? o.onFreeze      : null;
    if (typeof document !== 'undefined') {
      _state.visibilityH = _onVisibilityChange;
      _safe(() => document.addEventListener('visibilitychange', _state.visibilityH));
    }
    if (typeof window !== 'undefined') {
      _state.pagehideH = _onPageHide;
      _state.pageshowH = _onPageShow;
      _safe(() => window.addEventListener('pagehide', _state.pagehideH));
      _safe(() => window.addEventListener('pageshow', _state.pageshowH));
    }
    _startWatchdog();
    _state.installed = true;
    _setLifecycleState(LIFECYCLE_STATES.ACTIVE, 'install');
    _emitHeartbeat({ event: 'installed' });
    return { uninstall: uninstallMobileCameraLifecycle };
  }) || { uninstall: () => {} };
}

/**
 * Detach all listeners + stop the watchdog. Idempotent.
 */
export function uninstallMobileCameraLifecycle() {
  return _safe(() => {
    if (!_state.installed) return;
    _stopWatchdog();
    if (typeof document !== 'undefined' && _state.visibilityH) {
      _safe(() => document.removeEventListener('visibilitychange', _state.visibilityH));
    }
    if (typeof window !== 'undefined') {
      if (_state.pagehideH) _safe(() => window.removeEventListener('pagehide', _state.pagehideH));
      if (_state.pageshowH) _safe(() => window.removeEventListener('pageshow', _state.pageshowH));
    }
    _state.visibilityH = null;
    _state.pagehideH   = null;
    _state.pageshowH   = null;
    _state.videoElRef  = null;
    _state.restartCamera = null;
    _state.stopCamera  = null;
    _state.onStaleStream = null;
    _state.onFreeze    = null;
    _state.installed   = false;
    _setLifecycleState(LIFECYCLE_STATES.IDLE, 'uninstall');
  });
}

/**
 * Subscribe to lifecycle heartbeat events. Returns an unsubscribe.
 *
 * @param {(payload: { event: string, state: string, timestamp: number, ...}) => void} fn
 */
export function subscribeMobileCameraLifecycle(fn) {
  if (typeof fn !== 'function') return () => {};
  _state.subscribers.add(fn);
  return () => _state.subscribers.delete(fn);
}

/**
 * Read-only snapshot of the lifecycle state. Surfaces use this
 * to render a debug panel or for tests.
 */
export function getMobileCameraLifecycleSnapshot() {
  return Object.freeze({
    installed:        _state.installed,
    state:            _state.current,
    rehydrateCount:   _state.rehydrateCount,
    freezeCount:      _state.freezeCount,
    staleStreamCount: _state.staleStreamCount,
    hideEvents:       _state.hideEvents,
    pageshowEvents:   _state.pageshowEvents,
    frozenSamples:    _state.frozenSamples,
    lastHeartbeatAt:  _state.lastHeartbeatAt,
    watchdogActive:   !!_state.watchdogTimer,
  });
}

/** Test-only — exposes the constants + a reset path. */
export const _internal = Object.freeze({
  LIFECYCLE_STATES,
  WATCHDOG_INTERVAL_MS,
  FREEZE_THRESHOLD_SAMPLES,
  HEARTBEAT_EVENT,
  _resetForTests() {
    _stopWatchdog();
    if (typeof document !== 'undefined' && _state.visibilityH) {
      _safe(() => document.removeEventListener('visibilitychange', _state.visibilityH));
    }
    if (typeof window !== 'undefined') {
      if (_state.pagehideH) _safe(() => window.removeEventListener('pagehide', _state.pagehideH));
      if (_state.pageshowH) _safe(() => window.removeEventListener('pageshow', _state.pageshowH));
    }
    _state.installed = false;
    _state.current   = LIFECYCLE_STATES.IDLE;
    _state.videoElRef    = null;
    _state.restartCamera = null;
    _state.stopCamera    = null;
    _state.onStaleStream = null;
    _state.onFreeze      = null;
    _state.watchdogTimer = null;
    _state.lastCurrentTime = null;
    _state.frozenSamples = 0;
    _state.visibilityH = null;
    _state.pagehideH   = null;
    _state.pageshowH   = null;
    _state.subscribers.clear();
    _state.rehydrateCount   = 0;
    _state.freezeCount      = 0;
    _state.staleStreamCount = 0;
    _state.hideEvents       = 0;
    _state.pageshowEvents   = 0;
    _state.lastHeartbeatAt  = null;
    _rehydratePromise = null;
  },
});

const _module = {
  installMobileCameraLifecycle,
  uninstallMobileCameraLifecycle,
  subscribeMobileCameraLifecycle,
  forceRehydrateCamera,
  getMobileCameraLifecycleSnapshot,
  _internal,
};
export default _module;
