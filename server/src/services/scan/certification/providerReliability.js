/**
 * providerReliability.js — PROVIDER RELIABILITY CERTIFICATION.
 *
 * Records one metric per provider CALL and computes the 24h reliability scorecard
 * (uptime, latency p50/p95/p99, error breakdown, cache hit, avg confidence,
 * FarmBrain acceptance, health score + status) from the REAL rows — never
 * fabricated. Best-effort + total: recording must not break a scan; with no rows
 * the scorecard is honestly empty.
 */
import { recordProviderCall } from './providerHealthMonitor.js';

export const RELIABILITY_PROVIDERS = Object.freeze([
  'plant.id', 'crop.health', 'insect.id', 'mushroom.id', 'soil', 'weather',
]);

/** Record one call. Writes a durable row (best-effort) + the in-memory window. */
export async function recordProviderMetric(prisma, m = {}) {
  try {
    recordProviderCall(m.provider, { ok: m.status === 'READY' || m.httpStatus === 200,
      latencyMs: m.latency, confidence: m.confidence });
  } catch { /* */ }
  try {
    if (prisma && prisma.scanProviderMetric && m.provider) {
      await prisma.scanProviderMetric.create({ data: {
        provider: String(m.provider), status: String(m.status || 'NOT_RUN'),
        latency: _int(m.latency), confidence: _int(m.confidence),
        farmbrainAccepted: m.farmbrainAccepted === true, retryCount: _int(m.retryCount) || 0,
        failureReason: m.failureReason || null, httpStatus: _int(m.httpStatus),
        cacheHit: m.cacheHit === true,
      } }).catch(() => {});
    }
  } catch { /* persistence is best-effort */ }
  return true;
}
function _int(v) { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? Math.round(n) : null; }

function _pct(num, den) { return den > 0 ? Math.round((num / den) * 1000) / 10 : 0; }
function _percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

/** Health score = 100 − penalties for the failure classes that matter. */
export function computeHealthScore(a) {
  const reqs = a.requestCount || 0;
  if (reqs === 0) return null;            // no data → honest null, not a fake 100
  const per = (n) => Math.round((n / reqs) * 100);
  let score = 100;
  score -= per(a.timeoutCount) * 1.0;     // timeouts
  score -= per(a.count401 + a.count403) * 1.5;  // auth failures (worse)
  score -= per(a.count429) * 0.5;         // rate limits
  score -= per(a.schemaInvalidCount) * 1.0;     // schema failures
  score -= per(a.farmbrainRejectCount) * 1.0;   // FarmBrain rejects
  score -= per(a.count500) * 1.0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function healthStatus(score) {
  if (score == null) return 'NO_DATA';
  if (score >= 90) return 'HEALTHY';
  if (score >= 75) return 'HEALTHY_WITH_WARNINGS';
  if (score >= 50) return 'DEGRADED';
  return 'CRITICAL';
}

/** The 24h scorecard, per provider, computed from rows. */
export async function getReliabilityScorecard(prisma, opts = {}) {
  const hours = _int(opts.sinceHours) || 24;
  const since = new Date(Date.now() - hours * 3600 * 1000);
  let rows = [];
  try {
    if (prisma && prisma.scanProviderMetric) {
      rows = await prisma.scanProviderMetric.findMany({ where: { createdAt: { gte: since } }, take: 50000 });
    }
  } catch { rows = []; }

  const byProvider = {};
  for (const p of RELIABILITY_PROVIDERS) byProvider[p] = [];
  for (const r of rows) { if (byProvider[r.provider]) byProvider[r.provider].push(r); }

  const providers = RELIABILITY_PROVIDERS.map((provider) => {
    const rs = byProvider[provider];
    const requestCount = rs.length;
    const ok = rs.filter((r) => r.status === 'READY' || r.httpStatus === 200);
    const lat = rs.map((r) => r.latency).filter((n) => typeof n === 'number').sort((x, y) => x - y);
    const conf = ok.map((r) => r.confidence).filter((n) => typeof n === 'number');
    const a = {
      requestCount,
      timeoutCount: rs.filter((r) => /timeout/i.test(r.status) || /timeout/i.test(r.failureReason || '')).length,
      count401: rs.filter((r) => r.httpStatus === 401).length,
      count403: rs.filter((r) => r.httpStatus === 403).length,
      count429: rs.filter((r) => r.httpStatus === 429).length,
      count500: rs.filter((r) => typeof r.httpStatus === 'number' && r.httpStatus >= 500).length,
      schemaInvalidCount: rs.filter((r) => /schema/i.test(r.status)).length,
      farmbrainRejectCount: rs.filter((r) => /farmbrain_rejected/i.test(r.status)).length,
    };
    const score = computeHealthScore(a);
    return Object.freeze({
      provider,
      requestCount,
      successRate: _pct(ok.length, requestCount),
      failureRate: _pct(requestCount - ok.length, requestCount),
      latencyP50: _percentile(lat, 50),
      latencyP95: _percentile(lat, 95),
      latencyP99: _percentile(lat, 99),
      timeoutCount: a.timeoutCount, count429: a.count429, count401: a.count401,
      count403: a.count403, count500: a.count500,
      retryCount: rs.reduce((s, r) => s + (r.retryCount || 0), 0),
      cacheHitRate: _pct(rs.filter((r) => r.cacheHit).length, requestCount),
      avgConfidence: conf.length ? Math.round(conf.reduce((s, n) => s + n, 0) / conf.length) : 0,
      farmBrainAcceptance: _pct(rs.filter((r) => r.farmbrainAccepted).length, requestCount),
      uptime: _pct(ok.length, requestCount),        // availability proxy over the window
      healthScore: score,
      healthStatus: healthStatus(score),
    });
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(), windowHours: hours,
    providers: Object.freeze(providers),
    hasData: rows.length > 0,
  });
}
