/**
 * insightAggregator.js — region + crop aggregation for the
 * data moat (Data Moat Layer §6).
 *
 *   import { aggregateLocalInsights } from '../core/insightAggregator.js';
 *
 *   const events = getEvents();
 *   const insights = aggregateLocalInsights(events);
 *   // → {
 *   //     topCompletedTasks: { 'water': 12, 'inspect': 8 },
 *   //     commonIssues:      { 'leaf-spot': 4, 'wilt': 1 },
 *   //     healthTrend:       { healthy: 0.6, mixed: 0.2, worse: 0.2 },
 *   //     scanUsageRate:     0.18,        // scans / opens
 *   //     byRegion:          { ... },
 *   //     byCropOrPlant:     { ... },
 *   //     byExperience:      { ... },
 *   //     bySetup:           { ... },
 *   //   }
 *
 * Why local-first
 * ───────────────
 * NGO dashboards eventually want a server-side rollup, but
 * the data-moat foundation (this module) computes the same
 * shape locally so:
 *   • a pilot operator can see "what does this device's user
 *     actually do" without a network roundtrip;
 *   • the same function shape ports to a server-side worker
 *     when the back-end is ready (events become DB rows; the
 *     aggregator runs over a SQL projection instead of an
 *     array);
 *   • privacy spec §7 stays clean — the local-only rollup
 *     never sends individual events to a backend.
 *
 * Strict-rule audit
 *   • Pure function. No I/O. Caller passes the events array.
 *   • Never throws. Bad / non-array input collapses to the
 *     empty-shape object so consumers can read every field
 *     without null-checking.
 *   • No personal-info leakage. All groupings are by
 *     region / crop / experience / setup — all already
 *     present on the events.
 */

const EMPTY_INSIGHTS = Object.freeze({
  topCompletedTasks: {},
  commonIssues:      {},
  healthTrend:       { healthy: 0, mixed: 0, worse: 0 },
  scanUsageRate:     0,
  byRegion:          {},
  byCropOrPlant:     {},
  byExperience:      {},
  bySetup:           {},
});

function _safeGroupCount(map, key) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

/**
 * aggregateLocalInsights(events) → insights shape.
 *
 * @param {Array} events  — the full event log (or a slice).
 * @returns {object}
 */
export function aggregateLocalInsights(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return JSON.parse(JSON.stringify(EMPTY_INSIGHTS));
  }

  const topCompletedTasks = Object.create(null);
  const commonIssues      = Object.create(null);
  const byRegion          = Object.create(null);
  const byCropOrPlant     = Object.create(null);
  const byExperience      = Object.create(null);
  const bySetup           = Object.create(null);

  let healthyVotes = 0;
  let mixedVotes   = 0;
  let worseVotes   = 0;
  let scanCount    = 0;
  let openCount    = 0;

  for (const e of events) {
    if (!e || typeof e.name !== 'string') continue;
    const p = e.payload || {};

    // Group by dimensions on EVERY event.
    _safeGroupCount(byRegion,      p.region);
    _safeGroupCount(byCropOrPlant, p.cropOrPlant);
    _safeGroupCount(byExperience,  p.activeExperience || p.experience);
    _safeGroupCount(bySetup,       p.growingSetup);

    if (e.name === 'task_completed') {
      const t = p.taskType || p.taskCategory || 'inspect';
      _safeGroupCount(topCompletedTasks, t);
    } else if (e.name === 'scan_completed') {
      scanCount += 1;
      const issue = p.issueType || p.disease || p.diagnosis;
      if (issue) _safeGroupCount(commonIssues, String(issue));
    } else if (e.name === 'scan_started') {
      // Count starts as scans too (some users abandon before
      // result), so the scanUsageRate denominator (opens)
      // doesn't outpace the numerator on flaky networks.
      scanCount += 1;
    } else if (e.name === 'daily_open') {
      openCount += 1;
    } else if (e.name === 'health_feedback_submitted') {
      const v = p.healthFeedback || p.feedback;
      if (v === 'yes' || v === 'looks_healthy')          healthyVotes += 1;
      else if (v === 'not_sure')                          mixedVotes   += 1;
      else if (v === 'no' || v === 'getting_worse')       worseVotes   += 1;
    }
  }

  const totalVotes = healthyVotes + mixedVotes + worseVotes;
  const healthTrend = totalVotes > 0
    ? {
        healthy: +(healthyVotes / totalVotes).toFixed(3),
        mixed:   +(mixedVotes   / totalVotes).toFixed(3),
        worse:   +(worseVotes   / totalVotes).toFixed(3),
      }
    : { healthy: 0, mixed: 0, worse: 0 };

  // scanUsageRate = scans / opens. Capped at 1; collapses to 0
  // when there are no opens yet (a fresh device).
  const scanUsageRate = openCount > 0
    ? Math.min(1, +(scanCount / openCount).toFixed(3))
    : 0;

  return {
    topCompletedTasks,
    commonIssues,
    healthTrend,
    scanUsageRate,
    byRegion,
    byCropOrPlant,
    byExperience,
    bySetup,
  };
}

export default aggregateLocalInsights;
