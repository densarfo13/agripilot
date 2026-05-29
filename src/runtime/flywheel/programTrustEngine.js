/**
 * runtime/flywheel/programTrustEngine.js — Phase 14 NGO/program
 * trust composer.
 *
 *   import { computeProgramTrust, PROGRAM_TRUST_INPUTS }
 *     from 'src/runtime/flywheel/programTrustEngine.js';
 *
 * What this is
 * ────────────
 *   Program trust score from 4 inputs:
 *     • Farmer engagement       (active farmers / enrolled)
 *     • Program participation   (events recorded by enrolled farmers)
 *     • Outcome delivery        (% with positive verdict)
 *     • Evidence completeness   (% with evidence attached)
 *
 *   The NGO dashboard is gated OFF for RC1 (NgoDashboardV1 exists
 *   behind a flag). So in production this engine returns a
 *   "ngo_dashboard_gated" null envelope unless the caller passes
 *   ungatedFlag:true (engineering / QA only).
 *
 *   Returns a frozen envelope:
 *     {
 *       ok, overall, band, components, reason, runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • NGO-dashboard-gated by default.
 *   • No persistence writes.
 *   • Composition-only — does not modify any existing trust engine.
 */

export const PROGRAM_TRUST_VERSION = 'program-trust-v1';

export const PROGRAM_TRUST_INPUTS = Object.freeze({
  FARMER_ENGAGEMENT:     'farmerEngagement',
  PROGRAM_PARTICIPATION: 'programParticipation',
  OUTCOME_DELIVERY:      'outcomeDelivery',
  EVIDENCE_COMPLETENESS: 'evidenceCompleteness',
});

export const PROGRAM_TRUST_WEIGHTS = Object.freeze({
  farmerEngagement:     0.25,
  programParticipation: 0.25,
  outcomeDelivery:      0.30,
  evidenceCompleteness: 0.20,
});

export const PROGRAM_TRUST_BANDS = Object.freeze([
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

function _bandOf(score) {
  for (const b of PROGRAM_TRUST_BANDS) {
    if (score >= b.min) return b.band;
  }
  return 'building';
}

function _nullEnvelope(reason) {
  return Object.freeze({
    runtimeVersion: PROGRAM_TRUST_VERSION,
    ok: false, reason,
    overall: 0, band: 'unknown',
    components: Object.freeze({}),
  });
}

export function computeProgramTrust(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    if (!c.ungatedFlag) return _nullEnvelope('ngo_dashboard_gated');

    const components = {
      farmerEngagement:     _clamp01(c.farmerEngagementRatio),
      programParticipation: _clamp01(c.participationRatio),
      outcomeDelivery:      _clamp01(c.outcomePositiveRatio),
      evidenceCompleteness: _clamp01(c.evidenceCompleteRatio),
    };

    let totalWeight = 0;
    let weightedSum = 0;
    const componentScores = {};
    for (const k of Object.keys(PROGRAM_TRUST_WEIGHTS)) {
      const v = components[k];
      const w = PROGRAM_TRUST_WEIGHTS[k];
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
      runtimeVersion: PROGRAM_TRUST_VERSION,
      ok: true, reason: '',
      overall, band: _bandOf(overall),
      components: Object.freeze(componentScores),
    });
  }, _nullEnvelope('error'));
}
