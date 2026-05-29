/**
 * trustScore.js — Phase 10 farmer trust profile.
 *
 *   import { computeTrustScore } from
 *     'src/runtime/farmIntelligence/trustScore.js';
 *
 * What this is
 * ────────────
 *   Pure deterministic composite that produces a 0-100 trust score
 *   with a farmer-friendly band. The score is intended for downstream
 *   consumers (NGOs, lenders, buyers) to gauge a farmer's reliability
 *   without surfacing raw signal numbers.
 *
 *   Inputs (each weighted):
 *     - taskCompletionRate        0.25  (last 30 days)
 *     - scanConsistency           0.20  (regular scan cadence)
 *     - photoVerification         0.15  (real photos, not blanks)
 *     - locationConsistency       0.15  (stable geo signal)
 *     - farmActivity              0.15  (login + check-in frequency)
 *     - historyDepth              0.10  (months of recorded activity)
 *
 *   Band thresholds:
 *     verified ≥ 85
 *     established ≥ 65
 *     building ≥ 40
 *     new < 40
 *
 * Strict-rule audit
 *   • Pure function. Never throws. SSR-safe.
 *   • Frozen envelope.
 *   • Score is null when fewer than 30% of weights are covered.
 *   • No PII; consumes already-aggregated counters, never raw rows.
 */

const RUNTIME_VERSION = 'trust-score-v1';

export const TRUST_WEIGHTS = Object.freeze({
  taskCompletionRate:   0.25,
  scanConsistency:      0.20,
  photoVerification:    0.15,
  locationConsistency:  0.15,
  farmActivity:         0.15,
  historyDepth:         0.10,
});

export const TRUST_BANDS = Object.freeze({
  verified:     85,
  established:  65,
  building:     40,
  // < 40 → new
});

const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _clamp01 = (v) => Math.max(0, Math.min(1, _isNum(v) ? v : 0));
const _clamp100 = (v) => Math.max(0, Math.min(100, _isNum(v) ? v : 0));

function _bandFor(score) {
  if (!_isNum(score)) return 'insufficient';
  if (score >= TRUST_BANDS.verified) return 'verified';
  if (score >= TRUST_BANDS.established) return 'established';
  if (score >= TRUST_BANDS.building) return 'building';
  return 'new';
}

const BAND_HEADLINE_KEY = Object.freeze({
  verified:     'farm.trust.headline.verified',
  established:  'farm.trust.headline.established',
  building:     'farm.trust.headline.building',
  new:          'farm.trust.headline.new',
  insufficient: 'farm.trust.headline.insufficient',
});
const BAND_HEADLINE_DEFAULT = Object.freeze({
  verified:     'Verified farmer profile',
  established:  'Established farmer profile',
  building:     'Building farmer profile',
  new:          'New farmer profile',
  insufficient: 'Profile not yet rated',
});

/**
 * @param {{
 *   taskCompletionRate?:  number,  // 0-1
 *   scanConsistency?:     number,  // 0-1
 *   photoVerification?:   number,  // 0-1
 *   locationConsistency?: number,  // 0-1
 *   farmActivity?:        number,  // 0-1
 *   historyDepth?:        number,  // 0-1 (e.g. months/12 capped)
 * }} signals
 * @returns {Object} frozen envelope
 */
export function computeTrustScore(signals) {
  const s = signals && typeof signals === 'object' ? signals : {};
  let weightSum = 0;
  let weighted = 0;
  const contributions = {};
  for (const [key, weight] of Object.entries(TRUST_WEIGHTS)) {
    if (!_isNum(s[key])) {
      contributions[key] = Object.freeze({ weight, score: null, contribution: 0 });
      continue;
    }
    const score = _clamp01(s[key]) * 100;
    const contribution = score * weight;
    contributions[key] = Object.freeze({
      weight, score: Math.round(score),
      contribution: Math.round(contribution * 10) / 10,
    });
    weightSum += weight;
    weighted += contribution;
  }
  const coverage = Math.round(weightSum * 100) / 100;
  const score = weightSum >= 0.30
    ? Math.round(_clamp100(weighted / weightSum))
    : null;
  const band = _bandFor(score);
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    score,
    band,
    coverage,
    contributions: Object.freeze(contributions),
    headlineKey:    BAND_HEADLINE_KEY[band],
    headlineDefault: BAND_HEADLINE_DEFAULT[band],
  });
}

export const _internal = Object.freeze({ _bandFor });
