/**
 * src/runtime/scanMetrics/ScanMetricsRuntime.ts — Scan reliability metrics
 * (read-only, composition-only). Data-collection instrumentation for the
 * pilot — NOT an engine or intelligence layer (architecture is frozen).
 *
 *   window.__scanMetrics()
 *
 * Measures REAL scan reliability from the canonical on-device stores
 * (scan history + event log). Honest: returns NEEDS_DATA until scans
 * accumulate; never fabricates a success rate. Pure, SSR-safe, frozen,
 * never throws.
 */

export const SCAN_METRICS_RUNTIME_VERSION = 'scan-metrics-v1';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _eventType = (e: any): string =>
  _str(e && (e.type || e.eventType || e.name || e.kind));
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && isFinite(v) ? v : null);

export function scanMetrics() {
  return _safe(() => {
    const history = _arr(_ls('farroway_scan_history_v1'));
    const events  = _arr(_ls('farroway_event_log'));

    // Count canonical scan events from the event log.
    let started = 0, completed = 0, failed = 0, retries = 0;
    const analysisTimes: number[] = [];
    for (const e of events) {
      const t = _eventType(e);
      if (t === 'ScanStarted') started++;
      else if (t === 'ScanCompleted') completed++;
      else if (t === 'ScanFailed') failed++;
      if (e && (e.retry === true || e.isRetry === true)) retries++;
      const ms = _num(e && (e.analysisMs || e.durationMs || e.analysisTimeMs));
      if (ms !== null && ms >= 0 && (t === 'ScanCompleted')) analysisTimes.push(ms);
    }

    // Source usage (upload vs camera) from scan history + events.
    let uploadUsage = 0, cameraUsage = 0;
    const sources = [
      ...history.map((h: any) => _str(h && (h.source || h.imageSource))),
      ...events.map((e: any) => _str(e && (e.source || e.imageSource))),
    ];
    for (const s of sources) {
      if (s === 'upload' || s === 'gallery') uploadUsage++;
      else if (s === 'camera') cameraUsage++;
    }

    // A completed scan is the truth when events are absent — fall back to
    // history length as the completed-count floor (never inflate failures).
    const completedTotal = Math.max(completed, completed === 0 ? history.length : completed);
    const attempts = completedTotal + failed;
    const hasData = attempts > 0 || started > 0;

    const successRate = attempts > 0
      ? Math.round((completedTotal / attempts) * 1000) / 10  // 1-dp percent
      : null;
    const avgAnalysisTime = analysisTimes.length
      ? Math.round(analysisTimes.reduce((a, b) => a + b, 0) / analysisTimes.length)
      : null;

    const confidence: 'low' | 'medium' | 'high' =
      attempts >= 30 ? 'high' : attempts >= 5 ? 'medium' : 'low';

    return Object.freeze({
      runtimeVersion: SCAN_METRICS_RUNTIME_VERSION,
      initialized: true,
      // §2 scan operations metrics (explicit contract names).
      scanAttempts:  attempts,
      scanSuccesses: completedTotal,
      scanFailures:  failed,
      uploadScans:   uploadUsage,
      cameraScans:   cameraUsage,
      retryCount:    retries,
      // §P2 contract.
      successRate,                 // percent (0–100) or null
      avgAnalysisTime,             // ms or null
      failures: failed,
      retries,
      uploadUsage,
      cameraUsage,
      // Honest envelope (§P7).
      value: hasData ? { attempts, completed: completedTotal, failed } : 'NEEDS_DATA',
      confidence,
      dataSources: Object.freeze(['farroway_scan_history_v1', 'farroway_event_log']),
      limitations: hasData
        ? 'On-device pilot metrics only — not a server-side aggregate. Decision support, not a guarantee.'
        : 'Not enough data yet — no scans recorded on this device.',
    });
  }, Object.freeze({
    runtimeVersion: SCAN_METRICS_RUNTIME_VERSION,
    initialized: false,
    successRate: null, avgAnalysisTime: null, failures: 0, retries: 0,
    uploadUsage: 0, cameraUsage: 0,
    value: 'NEEDS_DATA', confidence: 'low' as const,
    dataSources: Object.freeze(['farroway_scan_history_v1', 'farroway_event_log']),
    limitations: 'Not enough data yet.',
  }));
}

export function installScanMetricsGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanMetrics !== 'function') {
      w.__scanMetrics = function () {
        const out = scanMetrics();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Scan Metrics]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
