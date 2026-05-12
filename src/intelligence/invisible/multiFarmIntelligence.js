/**
 * multiFarmIntelligence.js — cross-farm comparison + "which farm
 * needs attention today" synthesis (spec §11).
 *
 *   const summary = computeMultiFarmIntelligence({
 *     farms: [
 *       { farmId, name, snapshot: getFarmIntelligence({...}) },
 *       ...
 *     ],
 *   });
 *   // → {
 *   //     farms:            ranked-by-urgency list
 *   //     mostUrgentFarmId: farmId | null
 *   //     summary:          one calm sentence the UI can render
 *   //     visibleToUser:    boolean (single-farm users skip the surface)
 *   //   }
 *
 * Why this exists
 * ───────────────
 *   A commercial farmer with two or more farms shouldn't have to
 *   open each one to know where to focus. This module synthesises
 *   the per-farm intelligence snapshots (already computed by
 *   farmIntelligenceSnapshot) into ONE comparison: which farm
 *   needs attention, which looks stable.
 *
 *   The output is INTENTIONALLY narrow:
 *     • A ranked list (most-urgent first).
 *     • One calm sentence — "North Field needs attention today.
 *       South Field looks stable." — that the UI can render
 *       verbatim without each surface re-deriving the summary.
 *     • The mostUrgentFarmId so the UI can deep-link or
 *       auto-switch context.
 *
 *   Single-farm users get visibleToUser:false — they don't need
 *   a "comparison" they can't make. The whole module hides cleanly
 *   for them.
 *
 * Ranking model
 * ─────────────
 *   Per farm, a priorityScore (higher = more urgent):
 *     • NBA urgency      high=30 / medium=15 / low=0
 *     • NBA kind         crop_health=20 / severe_weather=18 /
 *                        urgent_task=15 / scan_followup=10 /
 *                        yield_risk=12 / market_*=5 / encouragement=0
 *     • Health band      urgent=20 / needs_care=10 / good=2 /
 *                        excellent=0
 *     • Open tasks       +2 per overdue, +1 per high-urgency open
 *     • High-level risk  +10 each (capped at 30)
 *
 *   Tied farms hold their input order (stable sort).
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Returns visibleToUser:false when fewer than 2 farms (or no
 *     snapshots) so the UI never shows a meaningless surface.
 *   • Calm language: "needs attention" / "looks stable" only.
 *     Never quantifies a score, never names a metric.
 *   • The summary mentions at most TWO farms (most-urgent +
 *     most-stable) to avoid the spec's "no clutter" trap.
 */

import { makeQuietFallback, makeActiveSignal } from './moduleShape.js';

const SOURCE = 'multiFarmIntelligence';

const _NBA_KIND_WEIGHT = Object.freeze({
  crop_health:               20,
  severe_weather:            18,
  urgent_task:               15,
  scan_followup:             10,
  yield_risk:                12,
  market_opportunity:         5,
  buyer_opportunity:          5,
  funding_opportunity:        3,
  cooperative_opportunity:    3,
  encouragement:              0,
});

const _URGENCY_WEIGHT = Object.freeze({ high: 30, medium: 15, low: 0 });
const _HEALTH_WEIGHT  = Object.freeze({ urgent: 20, needs_care: 10, good: 2, excellent: 0 });

function _str(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s : null;
}

function _scoreFarm(entry, nowMs) {
  if (!entry || !entry.snapshot || typeof entry.snapshot !== 'object') return 0;
  const snap = entry.snapshot;
  let score = 0;

  // NBA contribution
  const nba = snap.nextBestAction;
  if (nba && typeof nba === 'object') {
    score += _NBA_KIND_WEIGHT[String(nba.kind || '').toLowerCase()] || 0;
    score += _URGENCY_WEIGHT[String(nba.urgency || '').toLowerCase()] || 0;
  }

  // Health band
  if (snap.healthScore && typeof snap.healthScore === 'object') {
    score += _HEALTH_WEIGHT[String(snap.healthScore.band || '').toLowerCase()] || 0;
  }

  // Open tasks pressure
  const tasks = Array.isArray(snap.scanTasks) ? snap.scanTasks : [];
  let overdue = 0;
  let highUrgency = 0;
  for (const t of tasks) {
    if (!t || t.completed) continue;
    if (String(t.urgency || '').toLowerCase() === 'high') highUrgency += 1;
    if (t.dueAt) {
      const due = Date.parse(String(t.dueAt));
      if (!Number.isNaN(due) && due <= nowMs) overdue += 1;
    }
  }
  score += (overdue * 2) + (highUrgency * 1);

  // High-level predictive risks
  const risks = Array.isArray(snap.risks) ? snap.risks : [];
  const highRisks = Math.min(3, risks.filter((r) => r && r.level === 'high').length);
  score += highRisks * 10;

  return score;
}

function _statusLabel(score) {
  if (score >= 40) return 'needs attention';
  if (score >= 20) return 'worth a closer look';
  return 'looks stable';
}

/**
 * @param {object} input
 * @param {Array<{ farmId: string, name?: string, snapshot: object }>} input.farms
 * @param {number} [input.nowMs]
 * @returns {{
 *   farms: Array<{
 *     farmId: string,
 *     name: string|null,
 *     priorityScore: number,
 *     statusLabel: string,
 *     topAction: { kind, title }|null,
 *   }>,
 *   mostUrgentFarmId: string|null,
 *   summary: string,
 *   visibleToUser: boolean,
 *   source: string,
 * }}
 */
export function computeMultiFarmIntelligence(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const farms = Array.isArray(safe.farms) ? safe.farms : [];
  const nowMs = (typeof safe.nowMs === 'number') ? safe.nowMs : Date.now();

  // Single-farm users get a clean hide. Comparison is meaningless
  // with one farm and would just clutter the surface.
  if (farms.length < 2) {
    return {
      farms:            [],
      mostUrgentFarmId: null,
      summary:          '',
      visibleToUser:    false,
      source:           SOURCE,
    };
  }

  const scored = farms.map((entry, idx) => {
    if (!entry || !entry.farmId) return null;
    const score = _scoreFarm(entry, nowMs);
    const snap = entry.snapshot || {};
    const nba = (snap.nextBestAction && typeof snap.nextBestAction === 'object')
      ? snap.nextBestAction : null;
    return {
      farmId:        String(entry.farmId),
      name:          _str(entry.name),
      priorityScore: score,
      statusLabel:   _statusLabel(score),
      topAction: nba ? {
        kind:  String(nba.kind || ''),
        title: String(nba.title || ''),
      } : null,
      _originalIdx:  idx,
    };
  }).filter(Boolean);

  if (scored.length < 2) {
    return {
      farms:            [],
      mostUrgentFarmId: null,
      summary:          '',
      visibleToUser:    false,
      source:           SOURCE,
    };
  }

  scored.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return a._originalIdx - b._originalIdx;
  });

  const mostUrgent = scored[0];
  const mostStable = scored[scored.length - 1];
  const ranked = scored.map(({ _originalIdx, ...rest }) => rest);  // eslint-disable-line no-unused-vars

  // Compose the calm one-sentence summary. Only quantitative
  // information allowed: the farm name(s). Never expose the score.
  let summary = '';
  if (mostUrgent.priorityScore === mostStable.priorityScore) {
    summary = 'All your farms look stable today.';
  } else {
    const urgentLabel = mostUrgent.name || `Farm ${mostUrgent.farmId}`;
    const stableLabel = mostStable.name || `Farm ${mostStable.farmId}`;
    if (mostUrgent.priorityScore >= 40) {
      summary = `${urgentLabel} needs attention today. ${stableLabel} looks stable.`;
    } else if (mostUrgent.priorityScore >= 20) {
      summary = `${urgentLabel} is worth a closer look. ${stableLabel} looks stable.`;
    } else {
      summary = `All your farms look stable today.`;
    }
  }

  return {
    farms:            ranked,
    mostUrgentFarmId: mostUrgent.farmId,
    summary,
    visibleToUser:    mostUrgent.priorityScore > 0,
    source:           SOURCE,
  };
}

export default { computeMultiFarmIntelligence };
