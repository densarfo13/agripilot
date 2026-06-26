/**
 * productionValidation.js — the Production Validation Report builder.
 *
 * Pure synthesis: given the REAL reliability scorecard (aggregated from
 * ScanProviderMetric rows) + optional credits snapshot, produce a GO / NO_GO /
 * INSUFFICIENT_EVIDENCE verdict with per-provider status, latency, confidence,
 * failure classification, and targeted recommendations.
 *
 * HONESTY (item 8 — never promote without evidence):
 *   • No rows at all → INSUFFICIENT_EVIDENCE → NO-GO. Never fabricate a pass.
 *   • A provider is "READY" here ONLY if it has ≥1 real successful call. A key being
 *     present, or zero traffic, never reads READY.
 *
 * Pure, total, never throws. No I/O — the runner supplies the data.
 */
import { FAILURE_CATEGORY, recommendationFor } from './providerFailure.js';

export const CRITICAL_PROVIDERS = Object.freeze(['plant.id', 'crop.health', 'insect.id']);

const _num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Map a scorecard provider's aggregated error counts → the dominant failure bucket. */
function dominantFailure(p) {
  const pairs = [
    [FAILURE_CATEGORY.AUTH, _num(p.count401) + _num(p.count403)],
    [FAILURE_CATEGORY.RATE_LIMIT, _num(p.count429)],
    [FAILURE_CATEGORY.TIMEOUT, _num(p.timeoutCount)],
    [FAILURE_CATEGORY.NETWORK, _num(p.count500)],
  ];
  let best = null, bestN = 0;
  for (const [cat, n] of pairs) if (n > bestN) { best = cat; bestN = n; }
  return best || FAILURE_CATEGORY.UNKNOWN;   // failures exist but none of the named counts → unknown/invalid
}

/**
 * @param {object} opts
 * @param {object} opts.scorecard   getReliabilityScorecard() output (real rows).
 * @param {object} [opts.credits]   optional { providers: [{provider, remaining, daysRemaining}] }.
 * @param {string[]} [opts.criticalProviders]
 */
export function buildProductionValidationReport({ scorecard, credits, criticalProviders } = {}) {
  const critical = Array.isArray(criticalProviders) && criticalProviders.length ? criticalProviders : CRITICAL_PROVIDERS;
  const rows = (scorecard && Array.isArray(scorecard.providers)) ? scorecard.providers : [];
  const byName = new Map(rows.map((p) => [p.provider, p]));
  const creditByName = new Map(((credits && credits.providers) || []).map((c) => [c.provider, c]));

  const totalRequests = rows.reduce((s, p) => s + _num(p.requestCount), 0);
  const hasEvidence = !!(scorecard && scorecard.hasData) && totalRequests > 0;

  const successful = [];
  const failed = [];
  const recommendations = [];
  const providers = [];

  for (const name of dedupe([...critical, ...rows.map((r) => r.provider)])) {
    const p = byName.get(name);
    const reqs = _num(p && p.requestCount);
    const successRate = _num(p && p.successRate);
    const cred = creditByName.get(name);
    const creditsExhausted = !!cred && (_num(cred.remaining) <= 0 || _num(cred.daysRemaining) <= 0);

    let status, failureCategory = null;
    if (!p || reqs === 0) {
      status = 'NO_EVIDENCE';                                  // never seen a real call → cannot promote
    } else if (creditsExhausted) {
      status = 'FAILED'; failureCategory = FAILURE_CATEGORY.CREDITS;
    } else if (successRate > 0 && p.healthStatus !== 'CRITICAL') {
      status = 'READY';                                        // real successful evidence
    } else {
      status = 'FAILED'; failureCategory = dominantFailure(p);
    }

    const entry = Object.freeze({
      provider: name,
      isCritical: critical.includes(name),
      status,
      requestCount: reqs,
      successRate,
      latencyP50: p ? p.latencyP50 : null,
      latencyP95: p ? p.latencyP95 : null,
      latencyP99: p ? p.latencyP99 : null,
      avgConfidence: p ? p.avgConfidence : null,
      healthStatus: p ? p.healthStatus : null,
      failureCategory,
    });
    providers.push(entry);
    if (status === 'READY') successful.push(name);
    else if (status === 'FAILED') {
      failed.push(name);
      recommendations.push({ provider: name, category: failureCategory, recommendation: recommendationFor(failureCategory) });
    }
  }

  // Verdict — GO only with real evidence AND every critical provider READY.
  let verdict, readiness;
  const criticalReady = critical.every((n) => providers.find((e) => e.provider === n)?.status === 'READY');
  const criticalFailed = providers.filter((e) => e.isCritical && e.status === 'FAILED').map((e) => e.provider);
  const criticalNoEvidence = providers.filter((e) => e.isCritical && e.status === 'NO_EVIDENCE').map((e) => e.provider);

  if (!hasEvidence || criticalNoEvidence.length === critical.length) {
    verdict = 'INSUFFICIENT_EVIDENCE';
    readiness = 'NO-GO — run a real production scan first; no provider evidence has been recorded yet.';
  } else if (criticalReady) {
    verdict = 'GO';
    readiness = 'GO — all critical providers proved READY on real production traffic.';
  } else {
    verdict = 'NO_GO';
    const bits = [];
    if (criticalFailed.length) bits.push('failing: ' + criticalFailed.join(', '));
    if (criticalNoEvidence.length) bits.push('no evidence yet: ' + criticalNoEvidence.join(', '));
    readiness = 'NO-GO — ' + bits.join('; ') + '. See recommendations.';
  }

  const markdown = _toMarkdown({ verdict, readiness, providers, successful, failed, recommendations, scorecard, totalRequests });
  return Object.freeze({ verdict, readiness, hasEvidence, successful, failed, recommendations, providers, totalRequests, markdown });
}

function dedupe(arr) { const seen = new Set(); const out = []; for (const x of arr) if (x && !seen.has(x)) { seen.add(x); out.push(x); } return out; }
const _ms = (v) => (v == null ? '—' : v + 'ms');
const _pctOf = (v) => (v == null ? '—' : v + '%');

function _toMarkdown({ verdict, readiness, providers, successful, failed, recommendations, scorecard, totalRequests }) {
  const win = (scorecard && scorecard.windowHours) || 24;
  const L = [];
  L.push('# PRODUCTION VALIDATION REPORT');
  L.push('');
  L.push(`**Verdict: ${verdict}**`);
  L.push('');
  L.push(readiness);
  L.push('');
  L.push(`Window: last ${win}h · provider calls recorded: ${totalRequests}`);
  L.push('');
  L.push('## Providers');
  L.push('');
  L.push('| Provider | Critical | Status | Calls | Success | p50 | p95 | p99 | Conf | Failure |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const p of providers) {
    L.push(`| ${p.provider} | ${p.isCritical ? 'yes' : 'no'} | ${p.status} | ${p.requestCount} | ${_pctOf(p.successRate)} | ${_ms(p.latencyP50)} | ${_ms(p.latencyP95)} | ${_ms(p.latencyP99)} | ${p.avgConfidence == null ? '—' : p.avgConfidence + '%'} | ${p.failureCategory || '—'} |`);
  }
  L.push('');
  L.push(`## Successful providers (${successful.length})`);
  L.push(successful.length ? successful.map((s) => '- ' + s).join('\n') : '_none yet_');
  L.push('');
  L.push(`## Failed providers (${failed.length})`);
  L.push(failed.length ? failed.map((s) => '- ' + s).join('\n') : '_none_');
  L.push('');
  L.push('## Recommendations');
  if (recommendations.length) for (const r of recommendations) L.push(`- **${r.provider}** (${r.category}): ${r.recommendation}`);
  else L.push('_none — providers are healthy or awaiting evidence._');
  L.push('');
  return L.join('\n');
}
