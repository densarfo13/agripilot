/**
 * predictionCalibration.js — prediction-vs-outcome calibration
 * (v2 §7).
 *
 *   import { computePredictionCalibration }
 *     from 'src/core/prediction/predictionCalibration.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure helper that scores how well past predictions matched
 *   reality, and returns honest adjustment knobs the predictive
 *   layer can apply: a recommendation weight, an alert-confidence
 *   adjustment, and a task-urgency damping factor.
 *
 *   It is NOT a model and NOT fake ML — it is arithmetic over
 *   recorded outcomes. `getPredictiveBriefing.js` stays the single
 *   predictive engine; this module only calibrates it.
 *
 * Outcome vocabulary (per record)
 *   'confirmed'    — a follow-up scan confirmed the predicted issue
 *   'intervened'   — the farmer acted and the issue was handled
 *   'false_alarm'  — checked, nothing there
 *   'ignored'      — the alert was never acted on
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O.
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();

/**
 * @param {Array<{predictedRisk?:string, outcome:string}>} records
 * @returns {object}
 */
export function computePredictionCalibration(records) {
  try {
    const list = Array.isArray(records) ? records.filter(Boolean) : [];
    let confirmed = 0;
    let intervened = 0;
    let falseAlarms = 0;
    let ignored = 0;

    for (const r of list) {
      switch (_str(r.outcome)) {
        case 'confirmed':   confirmed += 1; break;
        case 'intervened':  intervened += 1; break;
        case 'false_alarm': falseAlarms += 1; break;
        case 'ignored':     ignored += 1; break;
        default: break;
      }
    }

    const total = confirmed + intervened + falseAlarms + ignored;
    const rate = (n) => (total > 0 ? Math.round((n / total) * 1000) / 1000 : 0);

    // A "useful" prediction is one that was confirmed or acted on.
    const useful = confirmed + intervened;
    const hitRate          = rate(useful);
    const falsePositiveRate = rate(falseAlarms);
    const ignoreRate        = rate(ignored);

    // Recommendation weight — a 0.5..1.5 multiplier the predictive
    // layer applies. Too many false alarms → damp down; strong hit
    // rate → keep full strength. Defaults to 1.0 with no data.
    let recommendationWeight = 1.0;
    if (total >= 3) {
      recommendationWeight = 1.0 + (hitRate - falsePositiveRate) * 0.5;
      recommendationWeight = Math.max(0.5, Math.min(1.5, Math.round(recommendationWeight * 100) / 100));
    }

    // Alert confidence — lower it when false alarms dominate so the
    // UI can soften the wording ('possible' instead of 'likely').
    const alertConfidenceAdjustment = falsePositiveRate > 0.4 ? -1
      : (hitRate > 0.6 ? 1 : 0);

    // Task urgency damping — when alerts are widely ignored OR
    // mostly false, rank predicted tasks lower so the real ones
    // are not buried.
    const urgencyDamping = (ignoreRate > 0.5 || falsePositiveRate > 0.5) ? 0.7 : 1.0;

    return {
      total,
      confirmed,
      interventions: intervened,
      falsePositives: falseAlarms,
      ignored,
      hitRate,
      falsePositiveRate,
      ignoreRate,
      recommendationWeight,
      alertConfidenceAdjustment,
      urgencyDamping,
      hasEnoughData: total >= 3,
    };
  } catch {
    return {
      total: 0, confirmed: 0, interventions: 0, falsePositives: 0,
      ignored: 0, hitRate: 0, falsePositiveRate: 0, ignoreRate: 0,
      recommendationWeight: 1.0, alertConfidenceAdjustment: 0,
      urgencyDamping: 1.0, hasEnoughData: false,
    };
  }
}

const _module = { computePredictionCalibration };
export default _module;
