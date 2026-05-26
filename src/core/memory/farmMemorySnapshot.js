/**
 * farmMemorySnapshot.js — Phase 14 unified READ facade over the
 * full farm memory + outcome surface.
 *
 *   import { getFarmMemorySnapshot, deriveMemoryGuidance }
 *     from 'src/core/memory/farmMemorySnapshot.js';
 *
 *   const memory = getFarmMemorySnapshot({
 *     crop:    'tomato',
 *     region:  'Ashanti',
 *     country: 'Ghana',
 *   });
 *
 *   const hints = deriveMemoryGuidance(memory);
 *   // [{ key, fallback, params, kind, severity }]
 *
 * What this is
 * ────────────
 *   Phase 14 stitches eight existing memory + outcome stores
 *   into a single read API. Surfaces calling this don't need to
 *   know there are eight stores — they get one snapshot and a
 *   small derived-guidance list ready for tSafe rendering.
 *
 *   Composes (no replacement):
 *     • scanSessionManager.getScanHistory       — last 25 scans
 *     • scanOutcomeTracker.getScanOutcomes      — outcome log
 *     • scanOutcomeTracker.aggregateOutcomes    — per-bucket roll-up
 *     • diseaseMemory.summariseDiseaseMemory    — recurrence summary
 *     • diseaseMemory.isRecurringIssue          — same-issue probe
 *     • diseaseMemory.recoveryTrendFor          — trend per issue
 *     • recommendationLearning.getLearningSnapshot — task action signals
 *     • outcomeAnalytics.recoveryOutcomes        — global distribution
 *
 *   Outputs:
 *     {
 *       crop, region, country, generatedAt,
 *       scanHistorySize,           — n scans we've seen
 *       outcomesRecordedSize,      — n outcomes confirmed
 *       lastScanAt,                — ISO of most recent scan
 *       daysSinceLastScan,
 *       recurringIssues,           — [{ category, count, lastSeenIso }]
 *       resolvedCount,
 *       worsenedCount,
 *       activeFlags: {
 *         hasRecurringIssue:           boolean,
 *         hasWorseningTrend:           boolean,
 *         hasSuccessfulInterventions:  boolean,
 *         hasIgnoredRecommendations:   boolean,
 *       },
 *       learningSignal:            { adjustmentCount, averageBoost },
 *       recoveryDistribution:      { resolved, improved, no_change, worsened, … },
 *       seasonalPatternHint:       string | null,
 *     }
 *
 *   `deriveMemoryGuidance(snapshot)` returns a small ordered list
 *   of `{key, fallback, params, kind, severity}` envelopes ready
 *   for tSafe rendering. Each derived hint corresponds to one
 *   active flag (recurring issue → "Same issue scanned X times";
 *   worsening trend → "This issue is getting worse"; long gap →
 *   "It's been X days since your last scan"; etc.).
 *
 *   The output is the "invisible intelligence" Phase 14 calls
 *   out: surfaces use it to subtly tune their copy without
 *   exposing a giant dashboard. Hints are HEDGED — calm wording
 *   only.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Read-only — never writes to any store.
 *   • Every visible string is an envelope; tSafe resolves.
 */

import { getScanHistory } from '../scan/scanSessionManager.js';
import {
  getScanOutcomes, aggregateOutcomes, OUTCOME,
} from '../scan/scanOutcomeTracker.js';
import {
  summariseDiseaseMemory, isRecurringIssue, recoveryTrendFor,
  seasonalPatternFor,
} from '../scan/diseaseMemory.js';
import { getLearningSnapshot } from '../intelligence/recommendationLearning.js';
import { recoveryOutcomes } from '../ngo/outcomeAnalytics.js';

const _isObj = (v) => v != null && typeof v === 'object';

function _safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

function _daysBetween(t1, t2) {
  const dt = Math.abs(t1 - t2);
  return Math.floor(dt / (24 * 60 * 60 * 1000));
}

/**
 * Build the unified memory snapshot. Inputs are optional context
 * fields that narrow the recurring-issue + recovery-trend lookups.
 *
 * @param {object} [opts]
 * @param {string} [opts.crop]
 * @param {string} [opts.region]
 * @param {string} [opts.country]
 */
export function getFarmMemorySnapshot(opts) {
  return _safe(() => {
    const o = _isObj(opts) ? opts : {};
    const crop    = typeof o.crop === 'string' ? o.crop : null;
    const region  = typeof o.region === 'string' ? o.region : null;
    const country = typeof o.country === 'string' ? o.country : null;

    const scanHistory  = _safe(getScanHistory, []);
    const outcomes     = _safe(getScanOutcomes, []);
    const memory       = _safe(() => summariseDiseaseMemory({ scanHistory }), {});
    const learning     = _safe(getLearningSnapshot, { adjustmentCount: 0, averageBoost: 0 });
    const distribution = _safe(recoveryOutcomes, { counts: {}, pct: {}, total: 0 });

    // Last scan signal
    const lastScan = scanHistory.length > 0 ? scanHistory[0] : null;
    const lastScanAt = lastScan && lastScan.createdAt
      ? new Date(lastScan.createdAt).toISOString() : null;
    const daysSinceLastScan = lastScan && lastScan.createdAt
      ? _daysBetween(Date.now(), lastScan.createdAt) : null;

    // Recurring issues — counts per category in the last 6 scans
    const recurringIssues = [];
    const categoryCounts = new Map();
    for (const s of scanHistory.slice(0, 12)) {
      const cat = s && (s.diseasePrediction || s.cropPrediction || s.lifecycle);
      if (!cat) continue;
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
    for (const [cat, count] of categoryCounts) {
      if (count >= 2) {
        recurringIssues.push(Object.freeze({
          category: cat,
          count,
          lastSeenIso: lastScanAt,
        }));
      }
    }

    // Outcome counts
    const resolvedCount = outcomes.filter((o2) => o2 && o2.outcome === OUTCOME.RESOLVED).length;
    const worsenedCount = outcomes.filter((o2) => o2 && o2.outcome === OUTCOME.WORSENED).length;
    const ignoredCount  = (learning && learning.adjustmentCount > 0
      && learning.averageBoost < 0) ? 1 : 0;

    // Trend for the supplied crop
    const recoveryTrend = (crop && categoryCounts.size > 0)
      ? _safe(() => {
          const [firstCat] = [...categoryCounts.keys()];
          return recoveryTrendFor(scanHistory, firstCat);
        }, null)
      : null;

    // Seasonal pattern (best-effort — module reads scanHistory itself)
    const seasonalPatternHint = (recurringIssues[0] && recurringIssues[0].category)
      ? _safe(() => seasonalPatternFor(scanHistory, recurringIssues[0].category), null)
      : null;

    const activeFlags = Object.freeze({
      hasRecurringIssue:          recurringIssues.length > 0,
      hasWorseningTrend:          recoveryTrend === 'worsening',
      hasSuccessfulInterventions: resolvedCount >= 1,
      hasIgnoredRecommendations:  ignoredCount > 0
        || (learning && learning.averageBoost < -0.10),
    });

    return Object.freeze({
      crop, region, country,
      generatedAt:           Date.now(),
      scanHistorySize:       scanHistory.length,
      outcomesRecordedSize:  outcomes.length,
      lastScanAt,
      daysSinceLastScan,
      recurringIssues:       Object.freeze(recurringIssues),
      resolvedCount,
      worsenedCount,
      recoveryTrend,
      activeFlags,
      learningSignal:        Object.freeze({
        adjustmentCount: learning.adjustmentCount || 0,
        averageBoost:    learning.averageBoost || 0,
      }),
      recoveryDistribution:  distribution.counts || {},
      memorySummary:         memory || null,
      seasonalPatternHint,
    });
  }, _emptySnapshot());
}

function _emptySnapshot() {
  return Object.freeze({
    crop: null, region: null, country: null,
    generatedAt: Date.now(),
    scanHistorySize: 0,
    outcomesRecordedSize: 0,
    lastScanAt: null,
    daysSinceLastScan: null,
    recurringIssues: [],
    resolvedCount: 0,
    worsenedCount: 0,
    recoveryTrend: null,
    activeFlags: Object.freeze({
      hasRecurringIssue: false,
      hasWorseningTrend: false,
      hasSuccessfulInterventions: false,
      hasIgnoredRecommendations: false,
    }),
    learningSignal: Object.freeze({ adjustmentCount: 0, averageBoost: 0 }),
    recoveryDistribution: {},
    memorySummary: null,
    seasonalPatternHint: null,
  });
}

/**
 * Translate snapshot signals into a small ordered list of guidance
 * envelopes the surface renders. Self-limits to 3 hints — surfaces
 * stay calm even on a heavily-memoried farm.
 */
export function deriveMemoryGuidance(snapshot) {
  return _safe(() => {
    if (!_isObj(snapshot)) return [];
    const hints = [];
    // 1. Recurring issue — highest priority signal.
    if (snapshot.recurringIssues && snapshot.recurringIssues.length > 0) {
      const top = snapshot.recurringIssues[0];
      hints.push(Object.freeze({
        kind:     'recurring_issue',
        severity: 'medium',
        key:      'memory.recurring.issue',
        fallback: 'You’ve scanned this same issue {count} times — let’s try a different approach.',
        params:   { count: top.count, category: top.category },
      }));
    }
    // 2. Worsening trend.
    if (snapshot.activeFlags && snapshot.activeFlags.hasWorseningTrend) {
      hints.push(Object.freeze({
        kind:     'worsening_trend',
        severity: 'high',
        key:      'memory.trend.worsening',
        fallback: 'Recent scans suggest this is getting worse — act sooner rather than later.',
      }));
    }
    // 3. Successful interventions — positive reinforcement.
    if (snapshot.activeFlags && snapshot.activeFlags.hasSuccessfulInterventions
        && !snapshot.activeFlags.hasWorseningTrend) {
      hints.push(Object.freeze({
        kind:     'wins',
        severity: 'low',
        key:      'memory.wins.recent',
        fallback: 'Your care has resolved {count} issues recently. Keep the routine going.',
        params:   { count: snapshot.resolvedCount },
      }));
    }
    // 4. Long gap since last scan.
    if (snapshot.daysSinceLastScan != null && snapshot.daysSinceLastScan >= 14) {
      hints.push(Object.freeze({
        kind:     'long_gap',
        severity: 'low',
        key:      'memory.lastScan.longGap',
        fallback: 'It has been {days} days since your last scan. A quick check helps catch issues early.',
        params:   { days: snapshot.daysSinceLastScan },
      }));
    }
    // 5. Seasonal pattern.
    if (snapshot.seasonalPatternHint && typeof snapshot.seasonalPatternHint === 'string') {
      hints.push(Object.freeze({
        kind:     'seasonal',
        severity: 'medium',
        key:      'memory.seasonal.pattern',
        fallback: 'This issue tends to show up around this time of year on your farm.',
      }));
    }
    return hints.slice(0, 3);
  }, []);
}

const _module = { getFarmMemorySnapshot, deriveMemoryGuidance };
export default _module;
