/**
 * src/runtime/launch/NgoMetricsHealth.ts — NGO KPI tile honesty
 * runtime. Tracks the health of /api/v2/ngo/overview calls so the
 * dashboard can render an honest empty / error state instead of
 * presenting a row of placeholder zeros as a "success" metric.
 *
 *   window.__ngoMetricsHealth()
 *
 * What this file owns
 * ───────────────────
 *   A bounded in-memory ring (max 50 entries) of recent NGO
 *   overview-API outcomes plus a caller-supplied last-refresh
 *   stamp. The diagnostic global returns a frozen envelope
 *   summarising reachability, real-data presence, and staleness.
 *
 * Strict-rule audit
 *   • Pure runtime: no React, no fetch, no localStorage writes.
 *   • SSR-safe: every window touch wrapped in typeof checks.
 *   • Engines never throw — every fallible path goes through _safe.
 *   • Envelopes are frozen.
 *   • HONEST verdicts:
 *       apiReachable      → true only if ≥1 recorded success
 *       realDataPresent   → true only if the latest successful
 *                           payload has a non-zero KPI field
 *       staleDataDetected → false by default; caller passes a
 *                           current ISO via isPayloadStale()
 *       fallbackIsHonest  → contract pin (true)
 *       organizationScoped→ contract pin (true — NGO_SCOPE auth
 *                           on /api/v2/ngo/* enforces this)
 */

export const NGO_METRICS_HEALTH_VERSION = 'farroway-ngo-metrics-health-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr = <T = any>(v: unknown): T[] =>
  (Array.isArray(v) ? (v as T[]) : []);
const _str = (v: unknown): string =>
  (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const MAX_CALLS = 50;
const STALE_AFTER_MS = 15 * 60 * 1000; // 15 minutes

interface CallEntry {
  ok: boolean;
  ts: string;          // ISO timestamp of recording
  payload: any;        // last payload sample (truncated read-only)
}

// Module-scoped state (in-memory only).
const _state: {
  calls: CallEntry[];
  lastRefresh: string | null;
} = {
  calls: [],
  lastRefresh: null,
};

function _nowIso(): string {
  return _safe(() => new Date().toISOString(), '');
}

/**
 * recordApiCall — append a single outcome to the ring buffer.
 *   ok       — did the API return a usable envelope?
 *   payload  — optional sample of the response data (object form).
 */
export function recordApiCall(ok: boolean, payload?: unknown): void {
  _safe(() => {
    const entry: CallEntry = {
      ok: !!ok,
      ts: _nowIso(),
      payload: _isObj(payload) ? payload : null,
    };
    _state.calls.push(entry);
    if (_state.calls.length > MAX_CALLS) {
      _state.calls.splice(0, _state.calls.length - MAX_CALLS);
    }
  }, undefined);
}

/**
 * recordLastRefresh — caller stamps the time of the last
 * successful UI refresh (ISO string). Used by isPayloadStale().
 */
export function recordLastRefresh(iso: string): void {
  _safe(() => {
    const s = _str(iso);
    if (s) _state.lastRefresh = s;
  }, undefined);
}

/**
 * isPayloadStale — caller-supplied current ISO timestamp; returns
 * true when more than 15 minutes have elapsed since the last
 * recorded refresh. No last refresh → not stale (no claim yet).
 */
export function isPayloadStale(nowIso: string): boolean {
  return _safe(() => {
    const last = _state.lastRefresh;
    if (!last) return false;
    const nowMs = Date.parse(_str(nowIso));
    const lastMs = Date.parse(last);
    if (!Number.isFinite(nowMs) || !Number.isFinite(lastMs)) return false;
    return (nowMs - lastMs) > STALE_AFTER_MS;
  }, false);
}

/**
 * _hasRealData — true only if the supplied payload carries a
 * non-zero KPI field. Defensive coercion via Number() — strings
 * like "0" count as zero.
 */
function _hasRealData(payload: any): boolean {
  return _safe(() => {
    if (!_isObj(payload)) return false;
    const farmers = Number(
      payload.farmersEnrolled
        ?? payload.totalFarmers
        ?? payload.farmers
        ?? 0,
    );
    const programs = Number(
      payload.programsActive
        ?? payload.activePrograms
        ?? payload.programs
        ?? 0,
    );
    const interventions = Number(
      payload.interventionsCompleted
        ?? payload.completedInterventions
        ?? payload.interventions
        ?? 0,
    );
    return (
      (Number.isFinite(farmers) && farmers > 0) ||
      (Number.isFinite(programs) && programs > 0) ||
      (Number.isFinite(interventions) && interventions > 0)
    );
  }, false);
}

export function ngoMetricsHealth() {
  return _safe(() => {
    const calls = _arr<CallEntry>(_state.calls);
    const anySuccess = calls.some((c) => c && c.ok === true);

    // Find the most recent successful call to check realDataPresent.
    let lastOkPayload: any = null;
    for (let i = calls.length - 1; i >= 0; i -= 1) {
      const c = calls[i];
      if (c && c.ok === true) {
        lastOkPayload = c.payload;
        break;
      }
    }

    return Object.freeze({
      runtimeVersion:       NGO_METRICS_HEALTH_VERSION,
      apiReachable:         anySuccess,
      organizationScoped:   true,
      realDataPresent:      anySuccess && _hasRealData(lastOkPayload),
      staleDataDetected:    false,
      fallbackIsHonest:     true,
      lastRefresh:          _state.lastRefresh,
      callsRecorded:        calls.length,
    });
  }, Object.freeze({
    runtimeVersion:       NGO_METRICS_HEALTH_VERSION,
    apiReachable:         false,
    organizationScoped:   true,
    realDataPresent:      false,
    staleDataDetected:    false,
    fallbackIsHonest:     true,
    lastRefresh:          null,
    callsRecorded:        0,
  }));
}

export function installNgoMetricsHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__ngoMetricsHealth !== 'function') {
      w.__ngoMetricsHealth = function () {
        const out = ngoMetricsHealth();
        try { console.log('[Farroway · NGO Metrics]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
