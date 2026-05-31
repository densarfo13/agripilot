/**
 * src/runtime/scanStartup/ScanStartupHealthRuntime.ts — real-device
 * scan-startup observability runtime.
 *
 *   window.__scanStartupHealth()
 *
 * Returns the EXACT startup stage the scan-route reached and the
 * elapsed milliseconds since the user navigated to /scan. Used by
 * the visible ScanStartupBanner to show 3s/5s diagnostics instead
 * of leaving the user on an indefinite spinner.
 *
 * Observation model — composition only, no scan-internal changes
 * ───────────────────────────────────────────────────────────────
 *   routeLoaded         — location.pathname enters /scan (set by
 *                         installer's interval-poll on first hit)
 *   componentMounted    — [data-testid="scan-capture"] appears in
 *                         the DOM (ScanCapture's wrap div renders
 *                         it unconditionally on mount)
 *   cameraRequested     — getUserMedia called at least once
 *                         (transparent wrap around
 *                         navigator.mediaDevices.getUserMedia)
 *   cameraGranted       — that promise resolved with a MediaStream
 *   uploadFallbackVisible — [data-testid="scan-capture-fallback"]
 *                         appears (ScanCapture's fallback panel)
 *   runtimeInitialized  — __scanResultHealth or __scanCtaHealth
 *                         already pinned on window
 *   scanReady           — true once EITHER cameraGranted OR
 *                         uploadFallbackVisible is true (the user
 *                         has a working path forward)
 *
 * Strict-rule audit
 *   • Pure observability. SSR-safe. Never throws.
 *   • Does NOT modify any scan / camera / OODA / runtime code.
 *   • getUserMedia wrap is idempotent + delegates 100% of the
 *     call to the original implementation.
 *   • Stage timestamps stored in module-level state; reset when
 *     the user navigates AWAY from /scan and back.
 */

export const SCAN_STARTUP_RUNTIME_VERSION = 'scan-startup-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/** Per-startup-session stage tracker. */
interface StageState {
  routeLoadedAt:           number | null;
  componentMountedAt:      number | null;
  cameraRequestedAt:       number | null;
  cameraGrantedAt:         number | null;
  uploadFallbackAt:        number | null;
  runtimeInitializedAt:    number | null;
  lastPath:                string;
}

const _state: StageState = {
  routeLoadedAt:        null,
  componentMountedAt:   null,
  cameraRequestedAt:    null,
  cameraGrantedAt:      null,
  uploadFallbackAt:     null,
  runtimeInitializedAt: null,
  lastPath:             '',
};

function _now(): number {
  return _safe(() => Date.now(), 0);
}

function _onScanRoute(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.location) return false;
    return /^\/scan(\/|$|\?)/.test(String(window.location.pathname || ''));
  }, false);
}

function _hasEl(selector: string): boolean {
  return _safe(() => {
    if (typeof document === 'undefined') return false;
    return !!document.querySelector(selector);
  }, false);
}

function _hasGlobal(name: string): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    return typeof (window as any)[name] === 'function';
  }, false);
}

/* ═════════════════════════════════════════════════════════════
   STAGE TRACKING
   ═════════════════════════════════════════════════════════════ */

function _resetIfRouteChanged(): void {
  const path = _safe(() => {
    if (typeof window === 'undefined' || !window.location) return '';
    return String(window.location.pathname || '');
  }, '');
  if (path === _state.lastPath) return;
  // Path changed.
  _state.lastPath = path;
  if (!_onScanRoute()) {
    // Leaving /scan — clear so the next entry starts a fresh session.
    _state.routeLoadedAt        = null;
    _state.componentMountedAt   = null;
    _state.cameraRequestedAt    = null;
    _state.cameraGrantedAt      = null;
    _state.uploadFallbackAt     = null;
    _state.runtimeInitializedAt = null;
    return;
  }
  // Entering /scan — anchor the startup clock.
  if (_state.routeLoadedAt == null) _state.routeLoadedAt = _now();
}

function _refresh(): void {
  _resetIfRouteChanged();
  if (!_onScanRoute()) return;
  const now = _now();
  if (_state.componentMountedAt == null && _hasEl('[data-testid="scan-capture"]')) {
    _state.componentMountedAt = now;
  }
  if (_state.uploadFallbackAt == null
      && _hasEl('[data-testid="scan-capture-fallback"]')) {
    _state.uploadFallbackAt = now;
  }
  if (_state.runtimeInitializedAt == null
      && (_hasGlobal('__scanResultHealth') || _hasGlobal('__scanCtaHealth'))) {
    _state.runtimeInitializedAt = now;
  }
}

/* ═════════════════════════════════════════════════════════════
   getUserMedia WRAP (idempotent, transparent)
   ═════════════════════════════════════════════════════════════ */

let _patched = false;
function _patchGetUserMedia(): void {
  if (_patched) return;
  _safe(() => {
    if (typeof navigator === 'undefined') return;
    const md: any = (navigator as any).mediaDevices;
    if (!md || typeof md.getUserMedia !== 'function') return;
    const original = md.getUserMedia.bind(md);
    md.getUserMedia = function (...args: any[]) {
      try {
        if (_onScanRoute() && _state.cameraRequestedAt == null) {
          _state.cameraRequestedAt = _now();
        }
      } catch { /* swallow */ }
      const p = original(...args);
      // We rely on the returned promise. Tap success without
      // interfering with downstream consumers.
      try {
        if (p && typeof p.then === 'function') {
          p.then(
            (stream: any) => {
              try {
                if (_onScanRoute() && _state.cameraGrantedAt == null) {
                  _state.cameraGrantedAt = _now();
                }
              } catch { /* swallow */ }
              return stream;
            },
            (err: any) => {
              // Forward the rejection unchanged.
              return Promise.reject(err);
            },
          );
        }
      } catch { /* swallow */ }
      return p;
    };
    _patched = true;
  }, undefined);
}

/* ═════════════════════════════════════════════════════════════
   PUBLIC HEALTH ENVELOPE
   ═════════════════════════════════════════════════════════════ */

export interface ScanStartupHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  /** True once the user has navigated to /scan in this tab. */
  routeLoaded:              boolean;
  componentMounted:         boolean;
  cameraRequested:          boolean;
  cameraGranted:            boolean;
  uploadFallbackVisible:    boolean;
  runtimeInitialized:       boolean;
  /** True iff cameraGranted OR uploadFallbackVisible. */
  scanReady:                boolean;
  startupDurationMs:        number | null;
  /** Highest stage observed for the current /scan session. */
  stage:                    string;
  /** Bonus context — current pathname for diagnostic drilldown. */
  currentPath:              string;
}

const FROZEN_FALLBACK: Readonly<ScanStartupHealth> = Object.freeze({
  runtimeVersion:        SCAN_STARTUP_RUNTIME_VERSION,
  initialized:           false,
  routeLoaded:           false,
  componentMounted:      false,
  cameraRequested:       false,
  cameraGranted:         false,
  uploadFallbackVisible: false,
  runtimeInitialized:    false,
  scanReady:             false,
  startupDurationMs:     null,
  stage:                 'not-on-scan',
  currentPath:           '',
});

function _highestStage(): string {
  if (_state.cameraGrantedAt    != null) return 'cameraGranted';
  if (_state.uploadFallbackAt   != null) return 'uploadFallbackVisible';
  if (_state.cameraRequestedAt  != null) return 'cameraRequested';
  if (_state.componentMountedAt != null) return 'componentMounted';
  if (_state.runtimeInitializedAt != null) return 'runtimeInitialized';
  if (_state.routeLoadedAt      != null) return 'routeLoaded';
  return 'not-on-scan';
}

export function scanStartupHealth(): ScanStartupHealth {
  return _safe(() => {
    _refresh();
    const onScan = _onScanRoute();
    const routeLoaded           = _state.routeLoadedAt != null;
    const componentMounted      = _state.componentMountedAt != null;
    const cameraRequested       = _state.cameraRequestedAt != null;
    const cameraGranted         = _state.cameraGrantedAt != null;
    const uploadFallbackVisible = _state.uploadFallbackAt != null;
    const runtimeInitialized    = _state.runtimeInitializedAt != null;
    const scanReady = cameraGranted || uploadFallbackVisible;
    const startupDurationMs = (onScan && _state.routeLoadedAt != null)
      ? Math.max(0, _now() - _state.routeLoadedAt)
      : null;
    return Object.freeze({
      runtimeVersion:        SCAN_STARTUP_RUNTIME_VERSION,
      initialized:           true,
      routeLoaded,
      componentMounted,
      cameraRequested,
      cameraGranted,
      uploadFallbackVisible,
      runtimeInitialized,
      scanReady,
      startupDurationMs,
      stage:                 _highestStage(),
      currentPath:           String(_safe(() =>
        typeof window !== 'undefined' && window.location
          ? window.location.pathname : '', '')),
    });
  }, FROZEN_FALLBACK);
}

/* ═════════════════════════════════════════════════════════════
   INSTALLER — pins the global + patches getUserMedia + starts a
   tiny polling loop that updates stage flags by DOM observation.
   ═════════════════════════════════════════════════════════════ */

let _pollHandle: any = null;

export function installScanStartupHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    _patchGetUserMedia();
    if (typeof w.__scanStartupHealth !== 'function') {
      w.__scanStartupHealth = function () {
        const out = scanStartupHealth();
        try { console.log('[Farroway · Scan Startup]', out); } catch {}
        return out;
      };
    }
    // Poll every 250ms while on /scan to refresh DOM-derived flags.
    // The poll self-disables when not on /scan to avoid waste.
    if (_pollHandle == null) {
      _pollHandle = setInterval(() => {
        try { _refresh(); } catch { /* swallow */ }
      }, 250);
    }
    return true;
  }, false);
}
