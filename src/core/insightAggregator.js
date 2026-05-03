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

/**
 * aggregateActionSuccessRates(events) — per-action success-rate
 * roll-up for the Learning + Scoring spec.
 *
 *   import { aggregateActionSuccessRates } from '../core/insightAggregator.js';
 *
 *   const rows = aggregateActionSuccessRates(getEvents());
 *   //  → [
 *   //      { action: 'no_water_moist',
 *   //        total: 4, completed: 6, healthy: 3, worse: 1,
 *   //        success_rate: 0.75, confidence: 4 },
 *   //      ...
 *   //    ]
 *
 * Spec mapping
 * ────────────
 *   total          — # of (action attempt → outcome reported) pairs
 *                    where outcome is 'healthy' OR 'getting_worse'
 *   healthy        — pairs where outcome was 'healthy'
 *   worse          — pairs where outcome was 'getting_worse'
 *   success_rate   — healthy / total (per spec §3)
 *   confidence     — total samples, raw count (per spec §3)
 *   completed      — companion field — # of `primary_action_completed`
 *                    events seen for this action; useful for
 *                    "completion rate" follow-ups
 *
 * Correlation rule
 * ────────────────
 * Both `primary_action_completed` and `health_feedback_submitted`
 * events carry `payload.primaryActionType` (set by the gate's
 * safeTrack helper). We correlate by that field — no time-window
 * heuristic needed because the gate's prompt fires immediately
 * after the action, so the payload is the canonical link.
 *
 * 'not_sure' feedback is intentionally excluded from total — the
 * spec asks for healthy / total; a "not_sure" reply is neither.
 *
 * Returns an array sorted by confidence DESC, then success_rate
 * DESC. Empty array on missing / malformed input.
 */
export function aggregateActionSuccessRates(events) {
  if (!Array.isArray(events) || events.length === 0) return [];
  const stats = new Map();
  for (const e of events) {
    if (!e || !e.name) continue;
    const p = e.payload || {};
    const type = p.primaryActionType;
    if (!type) continue;
    let row = stats.get(type);
    if (!row) {
      row = { action: type, completed: 0, healthy: 0, worse: 0 };
      stats.set(type, row);
    }
    if (e.name === 'primary_action_completed') {
      row.completed += 1;
    } else if (e.name === 'health_feedback_submitted') {
      const v = String(p.feedback || p.healthFeedback || '').toLowerCase();
      if (v === 'yes' || v === 'looks_healthy' || v === 'healthy') {
        row.healthy += 1;
      } else if (v === 'no' || v === 'getting_worse' || v === 'worse') {
        row.worse += 1;
      }
      // 'not_sure' / 'unsure' deliberately excluded from total.
    }
  }
  const out = [];
  for (const r of stats.values()) {
    const samples = r.healthy + r.worse;
    out.push({
      action:       r.action,
      completed:    r.completed,
      healthy:      r.healthy,
      worse:        r.worse,
      total:        samples,
      success_rate: samples > 0 ? r.healthy / samples : 0,
      confidence:   samples,
    });
  }
  out.sort((a, b) =>
    (b.confidence - a.confidence) || (b.success_rate - a.success_rate),
  );
  return out;
}

/**
 * Convenience: pick the row matching `actionType`. Returns null
 * when the action has no recorded outcomes yet (spec §5: low
 * confidence → no boost).
 */
export function getActionScore(actionType, events) {
  if (!actionType) return null;
  const rows = aggregateActionSuccessRates(events);
  for (const r of rows) {
    if (r.action === actionType) return r;
  }
  return null;
}

export default aggregateLocalInsights;
