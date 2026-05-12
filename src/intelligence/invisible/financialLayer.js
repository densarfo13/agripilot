/**
 * financialLayer.js — funding-readiness + cost-awareness signals
 * (Invisible Intelligence spec §4).
 *
 *   const signal = computeFinancialLayer({
 *     crop, farmSize, completedTaskCount, scanHistoryCount,
 *     hasExpenseLog, hasFundingProfile, dataCompleteness,
 *   });
 *
 * Honest "no fake revenue" guarantee
 * ──────────────────────────────────
 *   The spec is explicit: "No fake revenue certainty. Use ranges
 *   and confidence." We extend that: do not emit profit estimates,
 *   revenue numbers, or funding-eligibility scores derived from
 *   data we don't have. The module surfaces ONLY the
 *   data-completeness signal — "your farm record is improving as
 *   you log tasks + scans" — which the spec EXPLICITLY calls out.
 *
 *   The other spec outputs (basic profit estimate / cost warning /
 *   next financial action) need:
 *     • Expense logs (don't exist on-device today)
 *     • Cost-input prices (don't exist on-device today)
 *     • Market price feed (covered separately in marketIntelligence)
 *
 *   Until those data sources arrive, the module returns a calm
 *   "track your inputs" hint when data is sparse, and a quiet
 *   acknowledgement when data is building up.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Returns ranges + qualitative confidence, NEVER absolute
 *     revenue / cost / profit numbers.
 *   • visibleToUser:false when there's literally nothing to say.
 */

import { makeQuietFallback, makeActiveSignal } from './moduleShape.js';

const SOURCE = 'financialLayer';

export function computeFinancialLayer(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const tasksDone  = Math.max(0, Number(safe.completedTaskCount) || 0);
  const scansLogged = Math.max(0, Number(safe.scanHistoryCount) || 0);
  const hasExpenseLog = safe.hasExpenseLog === true;
  const hasFundingProfile = safe.hasFundingProfile === true;

  // ── Funding readiness — qualitative only ─────────────────────
  // We DON'T compute a numeric score. We surface a calm hint that
  // tracks data-completeness over time. Two states:
  //   1. Sparse data → "Track inputs before funding review"
  //   2. Building up data → "Your farm record is improving"
  //   3. Nothing to say → quiet fallback

  const dataCompleteness = tasksDone + scansLogged + (hasExpenseLog ? 5 : 0);

  if (dataCompleteness === 0 && !hasFundingProfile) {
    return makeQuietFallback(
      SOURCE,
      'Financial guidance will improve as you log tasks, scans, and expenses.',
    );
  }

  if (!hasExpenseLog && dataCompleteness < 5) {
    return makeActiveSignal({
      signal:           'inputs_needed',
      confidence:       'medium',
      farmerMessage:    'You may need to track input costs before funding review.',
      recommendedAction: 'Start an expense log',
      urgency:          'low',
      source:           SOURCE,
      visibleToUser:    true,
    });
  }

  if (dataCompleteness >= 5) {
    return makeActiveSignal({
      signal:           'record_improving',
      confidence:       'medium',
      farmerMessage:    'Your farm record is improving — keep logging activity.',
      recommendedAction: null,
      urgency:          'low',
      source:           SOURCE,
      visibleToUser:    true,
    });
  }

  return makeQuietFallback(SOURCE, '');
}

export default { computeFinancialLayer };
