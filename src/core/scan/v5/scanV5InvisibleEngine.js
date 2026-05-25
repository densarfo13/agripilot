/**
 * scanV5InvisibleEngine.js — adaptive learning layer that quietly
 * refines confidence + follow-up timing + alert suppression based
 * on accumulated outcome data.
 *
 *   import { runScanV5Invisible }
 *     from 'src/core/scan/v5/scanV5InvisibleEngine.js';
 *
 *   const hints = runScanV5Invisible({
 *     v4Output:      { ...v4 envelope... },
 *     scanHistory:   [...],
 *     diseaseMemory: {...},  // summariseDiseaseMemory output
 *     outcomeLog:    [...],  // markScanOutcome rows
 *   });
 *
 *   hints = {
 *     calibratedConfidence,  // tier name OR null when no change
 *     suggestedFollowupAdjMs,// ± offset to followup atMs (or null)
 *     suppressionHints,      // [{ kind, reason }]
 *     trustScore,            // 0..1 — surface uses for "calm vs urgent" tone
 *     suppressed,            // null | { reason }  (whole pass disabled)
 *   }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   The invisible v5 layer. NO visible dashboards. NO surface
 *   adoption. Other engines query it for hints; surfaces NEVER
 *   render v5 output directly.
 *
 *   It is NOT a model — it's a small rules engine over the same
 *   memory + outcome data the recommendation/suppression engines
 *   already see. The "learning" is calibration drift over
 *   observed outcomes:
 *     • If users mark issues as IGNORED → confidence calibrates DOWN
 *       (suggestion: don't promote to primary as aggressively).
 *     • If users mark issues as WORSE despite the recommendation →
 *       follow-up window tightens (recheck sooner).
 *     • If users mark issues as IMPROVED → trust score nudges UP.
 *
 *   It is NOT a predictor — it doesn't claim the next scan will go
 *   one way or another. It just nudges the dials.
 *
 *   Trust score is bounded [0, 1] and starts at 0.6 (neutral-leaning-
 *   positive) so a cold-start user gets calm tone, not skeptical.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Disabled when the SCAN_V5_INVISIBLE flag is OFF — returns
 *     `{ suppressed: { reason: 'disabled' } }` and no hints.
 *   • No visible output — every consumer is engine-side.
 */

import { isFeatureEnabled, FEATURE } from '../../../config/featureFlags.js';

const _CONFIDENCE_TIERS = ['high', 'medium', 'low'];
const _str = (v) => String(v == null ? '' : v).toLowerCase();

function _calibratedConfidence(diseaseMemory, currentTier) {
  try {
    const ignored = Array.isArray(diseaseMemory && diseaseMemory.ignoredAlerts)
      ? diseaseMemory.ignoredAlerts : [];
    const totalIgnored = ignored.reduce((n, x) => n + (Number(x.count) || 0), 0);
    const recovery = Number(diseaseMemory && diseaseMemory.recoverySuccess);
    const tierIdx = _CONFIDENCE_TIERS.indexOf(currentTier);
    if (tierIdx < 0) return null;

    let nextIdx = tierIdx;
    // Many ignored alerts → calibrate DOWN (one tier).
    if (totalIgnored >= 5 && nextIdx < _CONFIDENCE_TIERS.length - 1) nextIdx += 1;
    // Strong recovery track record → calibrate UP (one tier).
    if (Number.isFinite(recovery) && recovery >= 0.7 && nextIdx > 0) nextIdx -= 1;

    if (nextIdx === tierIdx) return null;
    return _CONFIDENCE_TIERS[nextIdx];
  } catch { return null; }
}

function _followupAdjustment(outcomeLog, currentIssue) {
  try {
    const list = Array.isArray(outcomeLog) ? outcomeLog : [];
    if (list.length === 0) return null;
    // Count outcomes for the SAME issue category. If most recent
    // 3 outcomes were WORSE despite the recommendation, tighten
    // the follow-up window by 1 day (in ms). If most were
    // IMPROVED, loosen by 1 day.
    const sameIssue = list.filter((row) =>
      row && _str(row.issueCategory || '') === _str(currentIssue));
    if (sameIssue.length === 0) return null;
    const recent = sameIssue.slice(-3);
    const worseN  = recent.filter((r) => _str(r.outcome) === 'worse').length;
    const improvedN = recent.filter((r) => _str(r.outcome) === 'improved').length;
    if (worseN >= 2) return -86400000;       // -1 day
    if (improvedN >= 2) return +86400000;    // +1 day
    return null;
  } catch { return null; }
}

function _suppressionHints(diseaseMemory) {
  try {
    const hints = [];
    const ignored = Array.isArray(diseaseMemory && diseaseMemory.ignoredAlerts)
      ? diseaseMemory.ignoredAlerts : [];
    for (const row of ignored) {
      if (Number(row.count) >= 3) {
        hints.push({
          kind:   'demote_repeated_alert',
          issue:  row.issue,
          reason: 'user_repeatedly_ignored',
          count:  row.count,
        });
      }
    }
    return hints;
  } catch { return []; }
}

function _trustScore(diseaseMemory, scanHistory) {
  try {
    let score = 0.6;
    const recovery = Number(diseaseMemory && diseaseMemory.recoverySuccess);
    if (Number.isFinite(recovery)) {
      // Recovery success nudges toward 1; failure toward 0.
      score += (recovery - 0.5) * 0.3;
    }
    // Larger scan history → more confidence in the trust signal.
    const sampleSize = Array.isArray(scanHistory) ? scanHistory.length : 0;
    if (sampleSize >= 10) score += 0.05;
    if (sampleSize >= 30) score += 0.05;
    // Clamp
    if (score < 0) score = 0;
    if (score > 1) score = 1;
    return Math.round(score * 100) / 100;
  } catch { return 0.6; }
}

/**
 * @param {object} ctx
 * @returns {object}
 */
export function runScanV5Invisible(ctx) {
  try {
    if (!isFeatureEnabled(FEATURE.SCAN_V5_INVISIBLE)) {
      return {
        suppressed:           { reason: 'disabled' },
        calibratedConfidence: null,
        suggestedFollowupAdjMs: null,
        suppressionHints:     [],
        trustScore:           null,
      };
    }
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const v4 = (c.v4Output && typeof c.v4Output === 'object') ? c.v4Output : {};
    const currentTier = _str(v4.confidenceTone && v4.confidenceTone.key
      ? v4.confidenceTone.key.split('.').pop() : 'medium');
    const issue = _str(v4.possibleIssue && v4.possibleIssue.key
      ? v4.possibleIssue.key.split('.').pop() : null);

    return {
      suppressed:             null,
      calibratedConfidence:   _calibratedConfidence(c.diseaseMemory, currentTier),
      suggestedFollowupAdjMs: _followupAdjustment(c.outcomeLog, issue),
      suppressionHints:       _suppressionHints(c.diseaseMemory),
      trustScore:             _trustScore(c.diseaseMemory, c.scanHistory),
    };
  } catch {
    return {
      suppressed:             { reason: 'exception' },
      calibratedConfidence:   null,
      suggestedFollowupAdjMs: null,
      suppressionHints:       [],
      trustScore:             0.6,
    };
  }
}

const _module = { runScanV5Invisible };
export default _module;
