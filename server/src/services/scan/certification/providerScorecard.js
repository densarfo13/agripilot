/**
 * providerScorecard.js — PRODUCTION CERTIFICATION scorecard.
 *
 * Per-provider score + overall verdict. Overall is PRODUCTION_CERTIFIED only if
 * EVERY required provider is READY. Optional providers (mushroom, Sentinel Hub)
 * never reduce the overall verdict. Scores come from live certification status —
 * never fabricated.
 */
import { CERT_STATUS, REQUIRED_PROVIDERS } from './providerCertification.js';

// Status → score. READY is full; everything else is honestly below.
const STATUS_SCORE = Object.freeze({
  [CERT_STATUS.READY]: 100,
  [CERT_STATUS.DEGRADED]: 60,
  [CERT_STATUS.FAILED]: 20,
  [CERT_STATUS.NOT_CONFIGURED]: 0,
  [CERT_STATUS.DISABLED]: null,    // excluded from scoring (optional/disabled)
});

export function buildScorecard(certifications = []) {
  const rows = (Array.isArray(certifications) ? certifications : []).map((c) => ({
    provider: c.provider,
    status: c.status,
    required: c.required === true,
    score: STATUS_SCORE[c.status],            // null when DISABLED
    latencyMs: c.latencyMs,
    successRate: c.successRate,
    avgConfidence: c.avgConfidence,
  }));

  const required = rows.filter((r) => r.required);
  const allRequiredReady = required.length > 0 && required.every((r) => r.status === CERT_STATUS.READY);

  // Overall verdict — PRODUCTION_CERTIFIED only when every REQUIRED provider is READY.
  const overall = allRequiredReady ? 'PRODUCTION_CERTIFIED'
    : required.some((r) => r.status === CERT_STATUS.READY) ? 'PARTIALLY_CERTIFIED'
    : 'NOT_CERTIFIED';

  const scored = rows.filter((r) => typeof r.score === 'number');
  const overallScore = scored.length ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : 0;

  return Object.freeze({
    overall,
    overallScore,
    requiredProviders: REQUIRED_PROVIDERS,
    allRequiredReady,
    rows: Object.freeze(rows),
    // Sentinel Hub explicitly noted as optional + non-blocking.
    note: 'Optional providers (mushroom.id, sentinel_hub) never reduce the overall verdict.',
  });
}
