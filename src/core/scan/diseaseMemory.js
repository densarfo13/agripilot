/**
 * diseaseMemory.js — recurring-issue + recovery tracker over the
 * scan history.
 *
 *   import {
 *     summariseDiseaseMemory, isRecurringIssue,
 *     recoveryTrendFor, seasonalPatternFor,
 *   } from 'src/core/scan/diseaseMemory.js';
 *
 *   const m = summariseDiseaseMemory({ scanHistory });
 *   // m = {
 *   //   recurringIssues: [{ issue, count, lastSeenMs }],
 *   //   recoverySuccess: number 0..1 | null,
 *   //   ignoredAlerts:   [{ issue, count }],
 *   //   seasonalPatterns: [{ issue, monthsSeen }],
 *   // }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure aggregator over the scan-history list (output of the
 *   existing `scanHistory.js` store). Returns calm structural
 *   counts the priority + follow-up engines can use to decide
 *   "this is the 3rd time — promote to higher urgency."
 *
 *   It is NOT a treatment recommender, NOT a confidence
 *   calculator, and NOT a data fetcher (caller hands in the
 *   history; this module just summarises).
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. No PII.
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const _RECURRING_THRESHOLD = 2;       // ≥ 2 occurrences → recurring

function _countBy(list, keyFn) {
  const out = Object.create(null);
  for (const x of list || []) {
    const k = keyFn(x);
    if (!k) continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/**
 * Summarise the scan-history list into structural counts.
 *
 * @param {object} ctx
 * @returns {object}
 */
export function summariseDiseaseMemory(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const scanHistory = Array.isArray(c.scanHistory) ? c.scanHistory : [];
    const nowMs = Number.isFinite(c.nowMs) ? c.nowMs : Date.now();

    // Per-issue counts + most recent timestamp.
    const perIssue = Object.create(null);
    for (const s of scanHistory) {
      if (!s || typeof s !== 'object') continue;
      const issue = _str(s.issueCategory);
      if (!issue || issue === 'healthy') continue;
      if (!perIssue[issue]) perIssue[issue] = { count: 0, lastSeenMs: 0 };
      perIssue[issue].count += 1;
      const ts = Number(s.createdAt) || Number(s.atMs) || 0;
      if (ts > perIssue[issue].lastSeenMs) perIssue[issue].lastSeenMs = ts;
    }

    const recurringIssues = Object.entries(perIssue)
      .filter(([, v]) => v.count >= _RECURRING_THRESHOLD)
      .map(([issue, v]) => ({
        issue,
        count: v.count,
        lastSeenMs: v.lastSeenMs || null,
      }))
      .sort((a, b) => b.count - a.count);

    // Recovery success rate — count scans flagged `outcome:
    // 'recovered' | 'improved'` over all follow-ups with an outcome.
    let recoveryTotal = 0;
    let recoveryWon = 0;
    for (const s of scanHistory) {
      if (!s || !s.followupOutcome) continue;
      recoveryTotal += 1;
      const out = _str(s.followupOutcome);
      if (out === 'recovered' || out === 'improved') recoveryWon += 1;
    }
    const recoverySuccess = recoveryTotal > 0
      ? Math.round((recoveryWon / recoveryTotal) * 100) / 100
      : null;

    // Ignored alerts — scans where the user marked the follow-up
    // as 'ignored' or where the recurring pattern repeats without
    // the recommended action being acknowledged.
    const ignoredAlerts = Object.entries(_countBy(
      scanHistory.filter((s) => s && _str(s.followupOutcome) === 'ignored'),
      (s) => _str(s.issueCategory),
    )).map(([issue, count]) => ({ issue, count }));

    // Seasonal pattern — which months each recurring issue appeared
    // in. Useful for the priority engine to weight a recurring
    // issue as "expected this season" vs "unusual now."
    const seasonalPatterns = recurringIssues.map(({ issue }) => {
      const months = new Set();
      for (const s of scanHistory) {
        if (!s || _str(s.issueCategory) !== issue) continue;
        const ts = Number(s.createdAt) || Number(s.atMs) || 0;
        if (!ts) continue;
        try { months.add(new Date(ts).getUTCMonth() + 1); } catch { /* skip */ }
      }
      return { issue, monthsSeen: Array.from(months).sort((a, b) => a - b) };
    });

    return {
      ok:               true,
      recurringIssues,
      recoverySuccess,
      ignoredAlerts,
      seasonalPatterns,
      generatedAt:      nowMs,
      sampleSize:       scanHistory.length,
    };
  } catch {
    return {
      ok: false, recurringIssues: [], recoverySuccess: null,
      ignoredAlerts: [], seasonalPatterns: [],
      generatedAt: Date.now(), sampleSize: 0,
    };
  }
}

/**
 * Quick check used by the priority engine: is this issue recurring
 * on this farm?
 */
export function isRecurringIssue(scanHistory, issueCategory) {
  try {
    const issue = _str(issueCategory);
    if (!issue) return false;
    const list = Array.isArray(scanHistory) ? scanHistory : [];
    let n = 0;
    for (const s of list) {
      if (s && _str(s.issueCategory) === issue) n += 1;
      if (n >= _RECURRING_THRESHOLD) return true;
    }
    return false;
  } catch { return false; }
}

/**
 * Recovery trend for a specific issue — returns null when there's
 * no data, otherwise an envelope envelope-style summary.
 */
export function recoveryTrendFor(scanHistory, issueCategory) {
  try {
    const issue = _str(issueCategory);
    const list = (Array.isArray(scanHistory) ? scanHistory : [])
      .filter((s) => s && _str(s.issueCategory) === issue);
    if (list.length === 0) return null;
    const withOutcome = list.filter((s) => s.followupOutcome);
    if (withOutcome.length === 0) return { issue, attempted: list.length, knownOutcomes: 0, successRate: null };
    const won = withOutcome.filter((s) =>
      ['recovered', 'improved'].includes(_str(s.followupOutcome))).length;
    return {
      issue,
      attempted:       list.length,
      knownOutcomes:   withOutcome.length,
      successRate:     Math.round((won / withOutcome.length) * 100) / 100,
    };
  } catch { return null; }
}

/**
 * Seasonal pattern for a single issue — bare months-seen array.
 */
export function seasonalPatternFor(scanHistory, issueCategory) {
  try {
    const issue = _str(issueCategory);
    const months = new Set();
    for (const s of (Array.isArray(scanHistory) ? scanHistory : [])) {
      if (!s || _str(s.issueCategory) !== issue) continue;
      const ts = Number(s.createdAt) || Number(s.atMs) || 0;
      if (!ts) continue;
      try { months.add(new Date(ts).getUTCMonth() + 1); } catch { /* skip */ }
    }
    return Array.from(months).sort((a, b) => a - b);
  } catch { return []; }
}

const _module = {
  summariseDiseaseMemory, isRecurringIssue,
  recoveryTrendFor, seasonalPatternFor,
};
export default _module;
