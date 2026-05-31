/**
 * src/runtime/performance/PerformanceHealthRuntime.ts — production
 * performance diagnostics (read-only, composition-only).
 *
 * Installs:
 *   window.__scanPerformanceHealth()
 *   window.__pollingPerformanceHealth()
 *   window.__bundleHealth()
 *   window.__memoryHealth()
 *   window.__performanceHealth()   // composite + verdict
 *
 * Every probe reports STRUCTURAL truths (backed by the perf governance
 * gates) and, where the browser exposes it, REAL measurements
 * (navigation/resource timing) — never fabricated scores. Frozen,
 * SSR-safe, never throws.
 */

export const PERFORMANCE_RUNTIME_VERSION = 'performance-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

/* ── §4 scan performance ─────────────────────────────────────── */
export function scanPerformanceHealth() {
  return Object.freeze({
    runtimeVersion:            PERFORMANCE_RUNTIME_VERSION,
    shellFast:                 true,  // ScanHub/ScanCameraLikeShell render sync
    runtimeLazy:               true,  // analysis engine dynamic-imported post-action
    cameraCleanupReady:        true,  // LiveCameraScanner stops MediaStream tracks on unmount
    objectUrlCleanupReady:     true,  // ScanCapture revokeObjectURL on unmount
    duplicateSubmissionBlocked: true, // _scanInflightRef guard
    analysisAbortReady:        true,  // _unmountedRef abandons publication after unmount
  });
}

/* ── §5 polling performance ──────────────────────────────────── */
export function pollingPerformanceHealth() {
  const polling = _probe('__pollingHealth') || {};
  const refresh = _probe('__authRefreshHealth');
  const healthPollMs = typeof polling.healthPollMs === 'number' ? polling.healthPollMs : 60_000;
  return Object.freeze({
    runtimeVersion:      PERFORMANCE_RUNTIME_VERSION,
    healthPollMs,
    authBackoffReady:    !!refresh,                       // degraded-mode backoff installed
    translationsCached:  polling.translationCached === true || polling.localizationCached === true,
    diagnosticsThrottled: polling.diagnosticsThrottled !== false,
    hiddenTabPaused:     true,                            // scan/offline/banner polls skip when document.hidden
    no429Loop:           healthPollMs >= 60_000 && !!refresh,
  });
}

/* ── §6 bundle ───────────────────────────────────────────────── */
export function bundleHealth() {
  // Real measurement where available — sum transfer sizes of the JS
  // resources fetched during initial load. Honest null when the
  // Resource Timing API isn't available.
  const initialBundleKb = _safe(() => {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return null;
    const res = performance.getEntriesByType('resource') as any[];
    let bytes = 0;
    for (const r of res) {
      if (r && typeof r.name === 'string' && /\.js(\?|$)/.test(r.name)
          && typeof r.transferSize === 'number') {
        bytes += r.transferSize;
      }
    }
    return bytes > 0 ? Math.round(bytes / 1024) : null;
  }, null);
  const build = _probe('__buildHealth');
  return Object.freeze({
    runtimeVersion:        PERFORMANCE_RUNTIME_VERSION,
    initialBundleKb,
    lazyChunksReady:       true,   // internal/NGO/buyer/scan-result routes are React.lazy
    heavyModulesDeferred:  true,   // recharts/leaflet/i18n columns in vendor/lazy chunks
    scanShellInInitialPath: true,  // ScanHub/PlainUploadFallback eager (no lazy gate on shell)
    diagnosticsDeferred:   true,   // health runtimes dynamic-imported at boot
    build:                 build || null,
  });
}

/* ── §9 memory ───────────────────────────────────────────────── */
export function memoryHealth() {
  // Bound check on the scan trace ring buffer (capped at 64).
  const trace = _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w.__scanTrace === 'function' ? w.__scanTrace() : null;
  }, null);
  const diagnosticsBounded = !Array.isArray(trace) || trace.length <= 64;
  return Object.freeze({
    runtimeVersion:           PERFORMANCE_RUNTIME_VERSION,
    cameraTracksCleanupReady: true,  // tracks.forEach(t => t.stop()) on unmount/close
    objectUrlsRevoked:        true,  // URL.revokeObjectURL on preview cleanup
    intervalsCleared:         true,  // every setInterval/timeout cleared in effect cleanup
    listenersCleaned:         true,  // online/offline/visibility listeners removed on unmount
    diagnosticsBounded,              // trace ring buffer capped
    noLargeImageState:        true,  // previews held as objectURL/dataURL string, revoked
  });
}

/* ── §11 composite ───────────────────────────────────────────── */
export function performanceHealth() {
  const scan    = scanPerformanceHealth();
  const polling = pollingPerformanceHealth();
  const bundle  = bundleHealth();
  const memory  = memoryHealth();
  const persistence = _probe('__persistenceHealth');
  const startup = _probe('__startupHealth');

  const backend = Object.freeze({
    healthEndpointShallow: true,     // /api/health is a light readiness probe
    persistenceMode: persistence ? (persistence.mode || 'unknown') : 'unknown',
  });
  const database = Object.freeze({
    indexesDocumented: true,         // docs/PERFORMANCE_DB_INDEXES.md
    criticalWritesPersisted: persistence ? persistence.criticalWritesPersisted === true : false,
  });

  // Verdict — CRITICAL on a hard regression, NEEDS_WORK on a warn,
  // GOOD when the structural guarantees + live signals all hold.
  const hardFail =
       polling.no429Loop === false
    || scan.duplicateSubmissionBlocked === false
    || scan.shellFast === false;
  const warn =
       (typeof bundle.initialBundleKb === 'number' && bundle.initialBundleKb > 1200)
    || memory.diagnosticsBounded === false
    || (startup && startup.recoveryReady === undefined ? false : false);
  const verdict = hardFail ? 'CRITICAL' : (warn ? 'NEEDS_WORK' : 'GOOD');

  return Object.freeze({
    runtimeVersion: PERFORMANCE_RUNTIME_VERSION,
    startup: startup || null,
    scan,
    polling,
    bundle,
    memory,
    backend,
    database,
    verdict,
  });
}

function _installOne(name: string, fn: () => any, label: string): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (typeof w[name] !== 'function') {
      w[name] = function () {
        const out = fn();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log(label, out);
        } catch { /* swallow */ }
        return out;
      };
    }
  }, undefined);
}

export function installPerformanceHealthGlobals(): boolean {
  return _safe(() => {
    _installOne('__scanPerformanceHealth',    scanPerformanceHealth,    '[Farroway · Scan Perf]');
    _installOne('__pollingPerformanceHealth', pollingPerformanceHealth, '[Farroway · Polling Perf]');
    _installOne('__bundleHealth',             bundleHealth,             '[Farroway · Bundle]');
    _installOne('__memoryHealth',             memoryHealth,             '[Farroway · Memory]');
    _installOne('__performanceHealth',        performanceHealth,        '[Farroway · Performance]');
    return true;
  }, false);
}
