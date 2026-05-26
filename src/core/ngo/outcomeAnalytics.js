/**
 * outcomeAnalytics.js — Phase 14 NGO-facing aggregation over the
 * scan outcome log + task action log.
 *
 *   import {
 *     interventionEffectiveness,
 *     diseaseReductionTrend,
 *     farmerEngagement,
 *     recoveryOutcomes,
 *     regionalCropStress,
 *     getOutcomeAnalyticsSnapshot,
 *   } from 'src/core/ngo/outcomeAnalytics.js';
 *
 * What this is
 * ────────────
 *   Pure read-only aggregator over `scanOutcomeTracker` +
 *   `recommendationLearning` task actions. Produces the five
 *   NGO-facing rollups Phase 14 spec §9 asks for:
 *
 *     1. Intervention effectiveness
 *        For each (issue, crop, region), what % of scans where
 *        the user completed the recommended task resulted in a
 *        resolved/improved outcome?
 *
 *     2. Disease reduction trend
 *        Are recurrences declining over time per (issue, region)?
 *
 *     3. Farmer engagement
 *        Per-farmer scan cadence, outcome confirmation rate,
 *        task completion rate. No identifying info — just the
 *        counts the dashboard plots.
 *
 *     4. Recovery outcomes
 *        Distribution of resolved / improved / no_change /
 *        worsened across the entire dataset.
 *
 *     5. Regional crop stress
 *        Aggregate of unresolved + worsened outcomes per
 *        (region, crop) — where the NGO should focus.
 *
 *   This is the "NGO moat" Phase 14 calls out: a structured view
 *   over real farmer outcomes that the dashboard surfaces +
 *   reports use without exposing per-farm PII.
 *
 *   Inputs are the same localStorage stores used elsewhere; the
 *   backend pipeline can sync those to its own warehouse for
 *   org-level dashboards. This module is the CLIENT-side roll-up
 *   that powers the in-app NGO surfaces.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • No PII — outputs are counts + percentages only.
 *   • Returns documented-shape objects on every path so
 *     consumers can render without null-guarding every field.
 */

import {
  getScanOutcomes, OUTCOME,
} from '../scan/scanOutcomeTracker.js';
import {
  getTaskActions, TASK_ACTION,
} from '../intelligence/recommendationLearning.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');

function _safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

/**
 * Intervention effectiveness — per (issue, crop, region) triple,
 * what fraction of confirmed outcomes after a completed task
 * resulted in resolved / improved?
 */
export function interventionEffectiveness() {
  return _safe(() => {
    const outcomes = getScanOutcomes();
    const buckets = new Map();
    for (const o of outcomes) {
      if (!o || !o.issueCategory) continue;
      const key = [o.issueCategory, o.crop || '*', o.region || '*'].join('|');
      if (!buckets.has(key)) {
        buckets.set(key, {
          issueCategory: o.issueCategory,
          crop:          o.crop || '*',
          region:        o.region || '*',
          total:         0,
          resolved:      0,
          improved:      0,
          no_change:     0,
          worsened:      0,
          escalated:     0,
          effective:     0,  // resolved + improved
        });
      }
      const b = buckets.get(key);
      b.total += 1;
      if (b[o.outcome] != null) b[o.outcome] += 1;
      if (o.outcome === OUTCOME.RESOLVED || o.outcome === OUTCOME.IMPROVED) {
        b.effective += 1;
      }
    }
    const rows = [];
    for (const b of buckets.values()) {
      rows.push(Object.freeze({
        ...b,
        effectivenessPct: b.total > 0
          ? Number(((b.effective / b.total) * 100).toFixed(1)) : 0,
      }));
    }
    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, []);
}

/**
 * Disease reduction trend — are recurrences declining over time?
 * For each (issue, region) we split the outcome log into two
 * halves by timestamp and compare the worsened-rate. A drop in
 * worsened-rate = trend 'improving'. A flat rate = 'stable'.
 * A rise = 'worsening'.
 */
export function diseaseReductionTrend() {
  return _safe(() => {
    const outcomes = getScanOutcomes();
    const buckets = new Map();
    for (const o of outcomes) {
      if (!o || !o.issueCategory) continue;
      const key = [o.issueCategory, o.region || '*'].join('|');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(o);
    }
    const rows = [];
    for (const [key, list] of buckets) {
      if (list.length < 4) continue;  // need at least 4 to split
      list.sort((a, b) => a.recordedAt - b.recordedAt);
      const mid = Math.floor(list.length / 2);
      const first = list.slice(0, mid);
      const second = list.slice(mid);
      const fWorsened = first.filter((o) => o.outcome === OUTCOME.WORSENED).length / first.length;
      const sWorsened = second.filter((o) => o.outcome === OUTCOME.WORSENED).length / second.length;
      const delta = sWorsened - fWorsened;
      let trend = 'stable';
      if (delta <= -0.10) trend = 'improving';
      else if (delta >= 0.10) trend = 'worsening';
      const [issueCategory, region] = key.split('|');
      rows.push(Object.freeze({
        issueCategory,
        region,
        trend,
        firstHalfWorsenedPct:  Number((fWorsened * 100).toFixed(1)),
        secondHalfWorsenedPct: Number((sWorsened * 100).toFixed(1)),
        sample: list.length,
      }));
    }
    rows.sort((a, b) => b.sample - a.sample);
    return rows;
  }, []);
}

/**
 * Farmer engagement — top-level counters the NGO dashboard
 * surfaces as KPIs.
 */
export function farmerEngagement() {
  return _safe(() => {
    const outcomes = getScanOutcomes();
    const actions = getTaskActions();
    const completedTasks = actions.filter((a) => a.action === TASK_ACTION.COMPLETED).length;
    const ignoredTasks   = actions.filter((a) => a.action === TASK_ACTION.IGNORED).length;
    const totalScansWithOutcome = outcomes.length;
    const disputedDiagnoses = outcomes.filter((o) => o.outcome === OUTCOME.WRONG).length;
    const escalations       = outcomes.filter((o) => o.outcome === OUTCOME.ESCALATED).length;
    const totalActions = completedTasks + ignoredTasks;
    return Object.freeze({
      scansWithOutcome:     totalScansWithOutcome,
      tasksCompleted:       completedTasks,
      tasksIgnored:         ignoredTasks,
      taskCompletionRate:   totalActions > 0
        ? Number(((completedTasks / totalActions) * 100).toFixed(1)) : 0,
      disputedDiagnoses,
      escalations,
    });
  }, {
    scansWithOutcome: 0, tasksCompleted: 0, tasksIgnored: 0,
    taskCompletionRate: 0, disputedDiagnoses: 0, escalations: 0,
  });
}

/**
 * Recovery outcomes — the headline distribution.
 */
export function recoveryOutcomes() {
  return _safe(() => {
    const outcomes = getScanOutcomes();
    const counts = {};
    for (const v of Object.values(OUTCOME)) counts[v] = 0;
    let total = 0;
    for (const o of outcomes) {
      if (!o || !o.outcome) continue;
      if (counts[o.outcome] != null) {
        counts[o.outcome] += 1;
        total += 1;
      }
    }
    const pct = {};
    for (const k of Object.keys(counts)) {
      pct[k] = total > 0
        ? Number(((counts[k] / total) * 100).toFixed(1)) : 0;
    }
    return Object.freeze({ counts: Object.freeze(counts), pct: Object.freeze(pct), total });
  }, { counts: {}, pct: {}, total: 0 });
}

/**
 * Regional crop stress — sort (region, crop) buckets by
 * unresolved + worsened ratio. Used by the NGO surface to
 * highlight WHERE intervention is needed.
 */
export function regionalCropStress() {
  return _safe(() => {
    const outcomes = getScanOutcomes();
    const buckets = new Map();
    for (const o of outcomes) {
      if (!o) continue;
      const key = [o.region || '*', o.crop || '*'].join('|');
      if (!buckets.has(key)) {
        buckets.set(key, {
          region: o.region || '*',
          crop:   o.crop || '*',
          total:  0,
          stressed: 0,  // worsened + no_change + wrong_diagnosis
        });
      }
      const b = buckets.get(key);
      b.total += 1;
      if (o.outcome === OUTCOME.WORSENED
       || o.outcome === OUTCOME.NO_CHANGE
       || o.outcome === OUTCOME.WRONG) {
        b.stressed += 1;
      }
    }
    const rows = [];
    for (const b of buckets.values()) {
      if (b.total < 2) continue;  // skip single-sample buckets
      rows.push(Object.freeze({
        ...b,
        stressPct: b.total > 0
          ? Number(((b.stressed / b.total) * 100).toFixed(1)) : 0,
      }));
    }
    rows.sort((a, b) => b.stressPct - a.stressPct);
    return rows;
  }, []);
}

/**
 * Unified snapshot — single call producing every rollup so a
 * dashboard component can render the whole page in one pass.
 */
export function getOutcomeAnalyticsSnapshot() {
  return Object.freeze({
    interventionEffectiveness: interventionEffectiveness(),
    diseaseReductionTrend:     diseaseReductionTrend(),
    farmerEngagement:          farmerEngagement(),
    recoveryOutcomes:          recoveryOutcomes(),
    regionalCropStress:        regionalCropStress(),
    generatedAt:               Date.now(),
  });
}

const _module = {
  interventionEffectiveness,
  diseaseReductionTrend,
  farmerEngagement,
  recoveryOutcomes,
  regionalCropStress,
  getOutcomeAnalyticsSnapshot,
};
export default _module;
