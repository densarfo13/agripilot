/**
 * runtime/flywheel/buyerTrustEngine.js — Phase 14 buyer trust
 * composer.
 *
 *   import { computeBuyerTrust, BUYER_TRUST_INPUTS }
 *     from 'src/runtime/flywheel/buyerTrustEngine.js';
 *
 * What this is
 * ────────────
 *   Buyer trust score from 4 inputs:
 *     • Purchase history       (count of completed purchases)
 *     • Response time          (median hours to first reply)
 *     • Payment consistency    (paid-on-time ratio)
 *     • Farmer ratings         (avg rating from farmers)
 *
 *   The marketplace is gated OFF for RC1 (wave-8 App Store safety
 *   mode forces marketplace flags off). So in production this
 *   engine returns a "marketplace_gated" null envelope unless a
 *   caller explicitly passes ungatedFlag:true (engineering / QA
 *   only — never wired to UI).
 *
 *   Returns a frozen envelope:
 *     {
 *       ok, overall, band, components, reason, runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Marketplace-gated by default — returns null envelope.
 *   • No persistence writes.
 *   • Composition-only — does not modify any existing trust engine.
 */

export const BUYER_TRUST_VERSION = 'buyer-trust-v1';

export const BUYER_TRUST_INPUTS = Object.freeze({
  PURCHASE_HISTORY:    'purchaseHistory',
  RESPONSE_TIME:       'responseTime',
  PAYMENT_CONSISTENCY: 'paymentConsistency',
  FARMER_RATINGS:      'farmerRatings',
});

export const BUYER_TRUST_WEIGHTS = Object.freeze({
  purchaseHistory:    0.25,
  responseTime:       0.20,
  paymentConsistency: 0.30,
  farmerRatings:      0.25,
});

export const BUYER_TRUST_BANDS = Object.freeze([
  { min: 80, band: 'high' },
  { min: 55, band: 'medium' },
  { min: 30, band: 'low' },
  { min: 0,  band: 'building' },
]);

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _clamp01(n) {
  const x = _num(n);
  if (x == null) return null;
  return Math.max(0, Math.min(1, x));
}

function _purchaseHistoryScore(count) {
  const n = _num(count);
  if (n == null) return null;
  // 10 completed purchases = full credit
  return Math.min(1, n / 10);
}

function _responseTimeScore(medianHours) {
  const h = _num(medianHours);
  if (h == null) return null;
  // <2h = 1.0, 24h = 0.5, >72h = 0
  if (h <= 2)  return 1;
  if (h >= 72) return 0;
  return Math.max(0, 1 - ((h - 2) / 70));
}

function _bandOf(score) {
  for (const b of BUYER_TRUST_BANDS) {
    if (score >= b.min) return b.band;
  }
  return 'building';
}

function _nullEnvelope(reason) {
  return Object.freeze({
    runtimeVersion: BUYER_TRUST_VERSION,
    ok: false, reason,
    overall: 0, band: 'unknown',
    components: Object.freeze({}),
  });
}

export function computeBuyerTrust(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    // Marketplace gating — App Store safety mode (wave-8) forces
    // marketplace flags OFF. Engine refuses to score unless the
    // caller explicitly ungates (engineering / QA only).
    if (!c.ungatedFlag) return _nullEnvelope('marketplace_gated');

    const components = {
      purchaseHistory:    _clamp01(_purchaseHistoryScore(c.purchaseHistoryCount)),
      responseTime:       _clamp01(_responseTimeScore(c.responseMedianHours)),
      paymentConsistency: _clamp01(c.paymentOnTimeRatio),
      farmerRatings:      _clamp01(_num(c.farmerRatingAvg) == null
                            ? null
                            : c.farmerRatingAvg / 5),
    };

    let totalWeight = 0;
    let weightedSum = 0;
    const componentScores = {};
    for (const k of Object.keys(BUYER_TRUST_WEIGHTS)) {
      const v = components[k];
      const w = BUYER_TRUST_WEIGHTS[k];
      if (v == null) {
        componentScores[k] = Object.freeze({ score: null, weight: w });
        continue;
      }
      componentScores[k] = Object.freeze({ score: Math.round(v * 100), weight: w });
      weightedSum += v * w;
      totalWeight += w;
    }
    if (totalWeight === 0) return _nullEnvelope('no_inputs');
    const overall = Math.round((weightedSum / totalWeight) * 100);

    return Object.freeze({
      runtimeVersion: BUYER_TRUST_VERSION,
      ok: true, reason: '',
      overall, band: _bandOf(overall),
      components: Object.freeze(componentScores),
    });
  }, _nullEnvelope('error'));
}
