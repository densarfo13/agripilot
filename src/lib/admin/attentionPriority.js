/**
 * attentionPriority.js — deterministic priority scoring for farmer/
 * farm records that need admin attention.
 *
 *   scoreAttentionTarget({ farm, issue?, now? }) → {
 *     score:     0..100,
 *     priority:  'low' | 'medium' | 'high' | 'critical',
 *     daysSince: number | null,      // days since issue/inactivity started
 *     reasons:   Array<{ rule, weight, detail }>,
 *   }
 *
 *   sortByPriority(targets) — stable descending sort by score,
 *     tie-break by daysSince descending (oldest problem first).
 *
 * Scoring inputs (no ML):
 *   • farm size            — bigger farms weight more (logarithmic)
 *   • staple crop bump     — maize / cassava / rice / wheat / sorghum / yam / millet
 *   • existing risk level  — from issue.severity / farm.riskLevel
 *   • days since issue     — older unresolved → more urgent
 *
 * Deliberately simple + explainable. Every rule writes to `reasons`
 * so the UI can show "why this farmer is high priority".
 *
 * Pure. No React, no storage, no side effects.
 */

const DAY_MS = 24 * 3600 * 1000;

const STAPLE_CROPS = new Set([
  'maize', 'cassava', 'rice', 'wheat', 'sorghum', 'yam', 'millet',
]);

const SEVERITY_WEIGHTS = Object.freeze({
  critical: 30,
  high:     20,
  medium:   10,
  low:       3,
});

const RISK_LEVEL_WEIGHTS = Object.freeze({
  high:   15,
  medium:  8,
  low:     0,
});

/** Log-scaled farm-size weight. Caps at 15 so a huge plot can't
 *  dominate a pile of smaller real concerns.
 *    0.5 ha → 0
 *    2   ha → ~3
 *    5   ha → ~7
 *    10  ha → ~10
 *    50+ ha → 15 (cap)
 */
function farmSizeWeight(size) {
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 1) return 0;
  // log-scaled with a soft cap
  return Math.min(15, Math.round(Math.log2(n) * 3));
}

function daysBetween(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((b - a) / DAY_MS));
}

/**
 * scoreAttentionTarget — single-row scoring.
 *
 *   farm      — the farm record (any shape from farrowayLocal.getFarms)
 *   issue     — optional issue record with { severity, createdAt, … }
 *   now       — epoch ms (for deterministic testing)
 */
export function scoreAttentionTarget({ farm = null, issue = null, now = Date.now() } = {}) {
  const reasons = [];
  let score = 0;

  // ─── Farm size bump ──────────────────────────────────────────
  const farmSize = farm && (farm.farmSize != null ? farm.farmSize : farm.size);
  const sizeW = farmSizeWeight(farmSize);
  if (sizeW > 0) {
    score += sizeW;
    reasons.push({
      rule: 'farm_size',
      weight: sizeW,
      detail: `Farm is ${Number(farmSize)} ha`,
    });
  }

  // ─── Staple-crop bump ────────────────────────────────────────
  const crop = farm && farm.crop ? String(farm.crop).toLowerCase() : '';
  if (STAPLE_CROPS.has(crop)) {
    score += 8;
    reasons.push({
      rule: 'staple_crop',
      weight: 8,
      detail: `Staple crop: ${crop}`,
    });
  }

  // ─── Issue severity ──────────────────────────────────────────
  const sev = issue && issue.severity ? String(issue.severity).toLowerCase() : null;
  if (sev && SEVERITY_WEIGHTS[sev] != null) {
    const w = SEVERITY_WEIGHTS[sev];
    score += w;
    reasons.push({
      rule: 'issue_severity',
      weight: w,
      detail: `Open issue severity: ${sev}`,
    });
  }

  // ─── Risk level (from Location Intelligence Engine) ──────────
  const risk = (issue && issue.riskLevel) || (farm && farm.riskLevel);
  const riskKey = risk ? String(risk).toLowerCase() : null;
  if (riskKey && RISK_LEVEL_WEIGHTS[riskKey]) {
    const w = RISK_LEVEL_WEIGHTS[riskKey];
    score += w;
    reasons.push({
      rule: 'risk_level',
      weight: w,
      detail: `Risk flagged: ${riskKey}`,
    });
  }

  // ─── Days since issue started ────────────────────────────────
  let daysSince = null;
  const issueStart = issue && (issue.createdAt || issue.firstAssignedAt);
  if (Number.isFinite(issueStart)) {
    daysSince = daysBetween(issueStart, now);
    if (daysSince >= 14) {
      score += 20;
      reasons.push({ rule: 'issue_14d_plus', weight: 20, detail: `${daysSince} days unresolved` });
    } else if (daysSince >= 7) {
      score += 10;
      reasons.push({ rule: 'issue_7d_plus', weight: 10, detail: `${daysSince} days unresolved` });
    } else if (daysSince >= 3) {
      score += 4;
      reasons.push({ rule: 'issue_3d_plus', weight: 4, detail: `${daysSince} days unresolved` });
    }
  }

  // ─── Inactivity fallback ─────────────────────────────────────
  // When no issue is supplied but we have a lastActivityAt, convert
  // that into a stalled-progress signal. Mirrors the `inactive` tile
  // on the NeedsAttention panel.
  if (!issue && farm && Number.isFinite(farm.lastActivityAt)) {
    const d = daysBetween(farm.lastActivityAt, now);
    daysSince = d;
    if (d >= 21) {
      score += 12;
      reasons.push({ rule: 'inactive_21d_plus', weight: 12, detail: `${d} days since last activity` });
    } else if (d >= 14) {
      score += 6;
      reasons.push({ rule: 'inactive_14d_plus', weight: 6, detail: `${d} days since last activity` });
    } else if (d >= 7) {
      score += 3;
      reasons.push({ rule: 'inactive_7d_plus', weight: 3, detail: `${d} days since last activity` });
    }
  }

  // Clamp to [0, 100]
  score = Math.max(0, Math.min(100, score));

  const priority =
      score >= 60 ? 'critical'
    : score >= 35 ? 'high'
    : score >= 15 ? 'medium'
    :                'low';

  return Object.freeze({
    score,
    priority,
    daysSince,
    reasons: Object.freeze(reasons.map(Object.freeze)),
  });
}

/**
 * sortByPriority — stable descending sort by score, tie-break by
 * daysSince (older problem first), then by farmId for determinism.
 *
 *   targets: Array<{ farmId, score, daysSince, ... }>
 */
export function sortByPriority(targets = []) {
  if (!Array.isArray(targets)) return [];
  const indexed = targets.map((t, i) => ({ t, i }));
  indexed.sort((a, b) => {
    const sa = Number(a.t.score) || 0;
    const sb = Number(b.t.score) || 0;
    if (sb !== sa) return sb - sa;
    const da = Number(a.t.daysSince) || 0;
    const db = Number(b.t.daysSince) || 0;
    if (db !== da) return db - da;
    return a.i - b.i;
  });
  return indexed.map((x) => x.t);
}

export const _internal = Object.freeze({
  STAPLE_CROPS, SEVERITY_WEIGHTS, RISK_LEVEL_WEIGHTS,
  farmSizeWeight, daysBetween, DAY_MS,
});
