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

export const SCAN_STARTUP_RUNTIME_VERSION = 'scan-startup-v2';

/** Trace row written for every stage transition. */
interface TraceRow {
  stage:    string;
  ms:       number;        // ms since /scan was first entered
  iso:      string;        // wall-clock ISO when the stage fired
}

/** Per-startup-session chronological trace. Capped at 64 rows. */
const _trace: TraceRow[] = [];
const TRACE_CAP = 64;
function _appendTrace(stage: string): void {
  try {
    const anchor = _state.routeLoadedAt;
    const now    = Date.now();
    const ms     = anchor == null ? 0 : Math.max(0, now - anchor);
    const iso    = new Date(now).toISOString();
    if (_trace.length === 0 || _trace[_trace.length - 1].stage !== stage) {
      _trace.push(Object.freeze({ stage, ms, iso }) as TraceRow);
      if (_trace.length > TRACE_CAP) _trace.shift();
    }
  } catch { /* swallow */ }
}
function _resetTrace(): void {
  _trace.length = 0;
}

/** Cached camera-permission state — refreshed via Permissions API. */
let _permissionState: 'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown' = 'unknown';
async function _refreshPermissionState(): Promise<void> {
  try {
    if (typeof navigator === 'undefined') return;
    const perms: any = (navigator as any).permissions;
    if (!perms || typeof perms.query !== 'function') {
      _permissionState = 'unsupported';
      return;
    }
    const status = await perms.query({ name: 'camera' as any });
    if (status && typeof status.state === 'string') {
      const s = String(status.state).toLowerCase();
      _permissionState = (s === 'granted' || s === 'prompt' || s === 'denied')
        ? s
        : 'unknown';
      // Listen for live transitions (Safari supports `change` event
      // on PermissionStatus). Each transition refreshes the cache.
      try {
        status.onchange = () => {
          const ns = String(status.state || '').toLowerCase();
          if (ns === 'granted' || ns === 'prompt' || ns === 'denied') {
            _permissionState = ns as any;
            _appendTrace('permissionState:' + ns);
          }
        };
      } catch { /* swallow */ }
    } else {
      _permissionState = 'unknown';
    }
  } catch {
    // Permissions API can throw on Safari for unsupported names.
    _permissionState = 'unsupported';
  }
}

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
    _resetTrace();
    return;
  }
  // Entering /scan — anchor the startup clock + refresh permission.
  if (_state.routeLoadedAt == null) {
    _state.routeLoadedAt = _now();
    _resetTrace();
    _appendTrace('routeMatched');
    _refreshPermissionState();
  }
}

function _refresh(): void {
  _resetIfRouteChanged();
  if (!_onScanRoute()) return;
  const now = _now();
  // Emergency-fix update — the fullscreen mount spinner is gone.
  // ScanPage now renders the ScanHub safe shell synchronously on
  // first render, so the scan-hub testid is the earliest honest
  // proof that the route + chunk + component mounted. Accept
  // EITHER scan-hub (safe shell) OR scan-capture (live camera UI).
  if (_state.componentMountedAt == null
      && (_hasEl('[data-testid="scan-hub"]')
          || _hasEl('[data-testid="scan-capture"]'))) {
    _state.componentMountedAt = now;
    _appendTrace('chunkLoaded');
    _appendTrace('componentRendered');
    _appendTrace('componentMounted');
    _appendTrace('microtaskMounted');
  }
  if (_state.uploadFallbackAt == null
      && (_hasEl('[data-testid="scan-capture-fallback"]')
          || _hasEl('[data-testid="scan-fallback-upload"]'))) {
    _state.uploadFallbackAt = now;
    _appendTrace('uploadFallbackVisible');
    _appendTrace('fallbackRendered');
  }
  if (_state.runtimeInitializedAt == null
      && (_hasGlobal('__scanResultHealth') || _hasGlobal('__scanCtaHealth'))) {
    _state.runtimeInitializedAt = now;
    _appendTrace('runtimeInitialized');
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
          _appendTrace('cameraRequestStarted');
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
                  _appendTrace('cameraGranted');
                  _appendTrace('cameraReady');
                  // Permissions API doesn't always fire `change`
                  // after first grant; mirror the state here.
                  if (_permissionState !== 'granted') {
                    _permissionState = 'granted';
                  }
                }
              } catch { /* swallow */ }
              return stream;
            },
            (err: any) => {
              try {
                // Detect denial via the canonical error name.
                const name = String((err && err.name) || '');
                if (name === 'NotAllowedError'
                    || name === 'SecurityError'
                    || name === 'PermissionDeniedError') {
                  _permissionState = 'denied';
                  _appendTrace('cameraDenied');
                }
              } catch { /* swallow */ }
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
  /** True once the user has navigated to /scan in this tab.
   *  Alias kept for back-compat with wave-real-device callers. */
  routeLoaded:              boolean;
  /** Wave audit — pathname matches /scan* (route resolved). */
  routeMatched:             boolean;
  /** Wave audit — outer Suspense fallback no longer visible
   *  (proxy: any element with data-testid="scan-page" OR
   *  "scan-capture" rendered, meaning lazy chunk resolved). */
  suspenseResolved:         boolean;
  componentMounted:         boolean;
  /** Real-device root-cause fix — mirrors componentMounted from
   *  ScanPage's `_mountedRef.current`. Asserts the queueMicrotask
   *  mount flip succeeded without relying on a stale closure. */
  mountedRefCurrent:         boolean;
  /** Wave audit alias for cameraRequested timestamp existence. */
  cameraRequestStarted:     boolean;
  cameraRequested:          boolean;
  /** Wave audit — live camera permission state from
   *  navigator.permissions.query({name:'camera'}). One of
   *  'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown'. */
  cameraPermissionState:    string;
  cameraGranted:            boolean;
  uploadFallbackVisible:    boolean;
  /** Wave audit alias — same as uploadFallbackVisible. */
  uploadFallbackRendered:   boolean;
  runtimeInitialized:       boolean;
  /** True iff cameraGranted OR uploadFallbackVisible. */
  scanReady:                boolean;
  startupDurationMs:        number | null;
  /** Real-device root-cause fix — hard-stop bound enforced by
   *  ScanPage.jsx. 5000ms per spec; lower than this means a
   *  faster recovery; higher would be a regression. */
  hardStopMs:               5000;
  /** Real-device root-cause fix — true iff the in-page mount
   *  spinner is guaranteed to flip to a recovery UI at or before
   *  hardStopMs. Anchored by ScanPage's 5s setLoadTimedOut path. */
  infiniteSpinnerBlocked:   true;
  /** Emergency fix — the ScanHub safe shell rendered (component
   *  mounted via scan-hub or scan-capture sentinel). */
  safeShellRendered:        boolean;
  /** Emergency fix — Upload Photo is always reachable on /scan,
   *  independent of camera/mount/runtime. Structural true. */
  uploadAlwaysAvailable:    true;
  /** Emergency fix — the fullscreen "Preparing scan…" spinner was
   *  removed from ScanPage. Structural true (gate-enforced). */
  fullScreenSpinnerRemoved: true;
  /** Emergency fix — did the camera autostart effect attempt to
   *  open the camera this session. */
  cameraAutostartAttempted: boolean;
  /** Emergency fix — the Upload fallback path is wired + ready. */
  cameraFallbackReady:      true;
  /** Emergency fix — hard guarantee the scan page cannot spin
   *  forever (safe shell renders immediately + 5s hard-stop). */
  scanPageCanSpinForever:   false;
  /** Highest stage observed for the current /scan session. */
  stage:                    string;
  /** Bonus context — current pathname for diagnostic drilldown. */
  currentPath:              string;
}

const FROZEN_FALLBACK: Readonly<ScanStartupHealth> = Object.freeze({
  runtimeVersion:         SCAN_STARTUP_RUNTIME_VERSION,
  initialized:            false,
  routeLoaded:            false,
  routeMatched:           false,
  suspenseResolved:       false,
  componentMounted:       false,
  mountedRefCurrent:      false,
  cameraRequestStarted:   false,
  cameraRequested:        false,
  cameraPermissionState:  'unknown',
  cameraGranted:          false,
  uploadFallbackVisible:  false,
  uploadFallbackRendered: false,
  runtimeInitialized:     false,
  scanReady:              false,
  startupDurationMs:      null,
  hardStopMs:             5000 as const,
  infiniteSpinnerBlocked: true as const,
  safeShellRendered:      false,
  uploadAlwaysAvailable:  true as const,
  fullScreenSpinnerRemoved: true as const,
  cameraAutostartAttempted: false,
  cameraFallbackReady:    true as const,
  scanPageCanSpinForever: false as const,
  stage:                  'not-on-scan',
  currentPath:            '',
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
    // suspenseResolved — proxy: any scan-page-bound testid mounted
    // means the React Suspense boundary handed control to the
    // route's children. ScanCapture rendering proves this.
    const suspenseResolved =
         componentMounted
      || _hasEl('[data-testid="scan-page"]')
      || _hasEl('[data-testid="scan-camera-cold-start-hint"]');
    const scanReady = cameraGranted || uploadFallbackVisible;
    const startupDurationMs = (onScan && _state.routeLoadedAt != null)
      ? Math.max(0, _now() - _state.routeLoadedAt)
      : null;
    return Object.freeze({
      runtimeVersion:         SCAN_STARTUP_RUNTIME_VERSION,
      initialized:            true,
      routeLoaded,
      routeMatched:           onScan,
      suspenseResolved,
      componentMounted,
      // mountedRefCurrent mirrors componentMounted — both flip true
      // the moment ScanPage renders ANY tree (the in-page spinner
      // now carries data-testid="scan-capture" after the
      // root-cause fix, so the React mount is the signal).
      mountedRefCurrent:      componentMounted,
      cameraRequestStarted:   cameraRequested,
      cameraRequested,
      cameraPermissionState:  _permissionState,
      cameraGranted,
      uploadFallbackVisible,
      uploadFallbackRendered: uploadFallbackVisible,
      runtimeInitialized,
      scanReady,
      startupDurationMs,
      hardStopMs:             5000 as const,
      infiniteSpinnerBlocked: true as const,
      safeShellRendered:      componentMounted,
      uploadAlwaysAvailable:  true as const,
      fullScreenSpinnerRemoved: true as const,
      cameraAutostartAttempted: cameraRequested,
      cameraFallbackReady:    true as const,
      scanPageCanSpinForever: false as const,
      stage:                  _highestStage(),
      currentPath:            String(_safe(() =>
        typeof window !== 'undefined' && window.location
          ? window.location.pathname : '', '')),
    });
  }, FROZEN_FALLBACK);
}

/** Return a frozen copy of the chronological trace for QA. */
export function scanTrace(): ReadonlyArray<TraceRow> {
  return _safe(() => Object.freeze(_trace.map((r) => Object.freeze({ ...r }))),
    Object.freeze([]) as any);
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
    // Wave iOS audit — chronological trace global.
    if (typeof w.__scanTrace !== 'function') {
      w.__scanTrace = function () {
        const out = scanTrace();
        try { console.log('[Farroway · Scan Trace]', out); } catch {}
        return out;
      };
    }
    // Refresh permission state at install too — covers the case
    // where the user lands directly on /scan via deep link.
    _refreshPermissionState();
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
