/**
 * providerHealthMonitor.js — PRODUCTION CERTIFICATION rolling health.
 *
 * Keeps a small in-process rolling window (latency, success, confidence) per
 * provider so the scorecard reflects RECENT live behaviour, not a single call.
 * Best-effort; never throws.
 */
const WINDOW = 50;
const _hist = new Map();   // provider → [{ ok, latencyMs, confidence, at }]

function _arr(p) { if (!_hist.has(p)) _hist.set(p, []); return _hist.get(p); }

/** Record one live call outcome for a provider. */
export function recordProviderCall(provider, { ok, latencyMs, confidence } = {}) {
  try {
    const a = _arr(provider);
    a.push({ ok: ok === true, latencyMs: typeof latencyMs === 'number' ? latencyMs : null,
      confidence: typeof confidence === 'number' ? confidence : null, at: new Date().toISOString() });
    if (a.length > WINDOW) a.splice(0, a.length - WINDOW);
  } catch { /* never throw */ }
}

/** Rolling stats for a provider (over its recent calls). */
export function providerHealthStats(provider) {
  try {
    const a = _arr(provider);
    if (a.length === 0) return { calls: 0, successRate: 0, avgLatencyMs: null, avgConfidence: 0, lastSuccessfulCall: null };
    const oks = a.filter((x) => x.ok);
    const lat = a.map((x) => x.latencyMs).filter((n) => typeof n === 'number');
    const conf = oks.map((x) => x.confidence).filter((n) => typeof n === 'number');
    return {
      calls: a.length,
      successRate: Math.round((oks.length / a.length) * 100),
      avgLatencyMs: lat.length ? Math.round(lat.reduce((s, n) => s + n, 0) / lat.length) : null,
      avgConfidence: conf.length ? Math.round(conf.reduce((s, n) => s + n, 0) / conf.length) : 0,
      lastSuccessfulCall: oks.length ? oks[oks.length - 1].at : null,
    };
  } catch {
    return { calls: 0, successRate: 0, avgLatencyMs: null, avgConfidence: 0, lastSuccessfulCall: null };
  }
}

export function _resetHealthMonitor() { _hist.clear(); }
