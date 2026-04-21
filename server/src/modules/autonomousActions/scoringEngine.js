/**
 * scoringEngine.js — deterministic server-side priority scoring.
 *
 * Same contract as `src/lib/admin/attentionPriority.js` on the
 * client (kept in sync on purpose so admin UI + autonomous cron
 * agree on "who needs action most") but reads server records.
 *
 *   scoreCandidate({ farmer, application?, issue?, now }) → {
 *     score:     0..100,
 *     priority:  'low' | 'medium' | 'high' | 'critical',
 *     daysSince: number | null,
 *     reasons:   Array<{ rule, weight, detail }>,
 *   }
 *
 *   sortByPriority(rows)
 *
 * Pure. No Prisma, no network, no side effects.
 */

const DAY_MS = 24 * 3600 * 1000;

const STAPLE_CROPS = new Set([
  'maize', 'cassava', 'rice', 'wheat', 'sorghum', 'yam', 'millet',
]);

const SEVERITY_WEIGHTS = Object.freeze({
  critical: 30, high: 20, medium: 10, low: 3,
});

const RISK_LEVEL_WEIGHTS = Object.freeze({
  high: 15, medium: 8, low: 0,
});

function farmSizeWeight(size) {
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 1) return 0;
  return Math.min(15, Math.round(Math.log2(n) * 3));
}

function daysBetween(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((b - a) / DAY_MS));
}

function asTs(x) {
  if (x == null) return null;
  if (x instanceof Date) return x.getTime();
  const n = Number(x);
  if (Number.isFinite(n)) return n;
  const p = Date.parse(String(x));
  return Number.isFinite(p) ? p : null;
}

/**
 * scoreCandidate — one-row scoring. Accepts any combination of
 * farmer / application / issue. All fields are optional; missing
 * data simply contributes no weight.
 */
export function scoreCandidate({
  farmer = null, application = null, issue = null, now = Date.now(),
} = {}) {
  const reasons = [];
  let score = 0;

  const farmSize = (application && application.farmSizeAcres)
    || (farmer && (farmer.farmSize || farmer.farmSizeAcres));
  const sizeW = farmSizeWeight(farmSize);
  if (sizeW > 0) {
    score += sizeW;
    reasons.push({ rule: 'farm_size', weight: sizeW,
      detail: `Farm is ${Number(farmSize)} acres` });
  }

  const crop = ((application && application.primaryCrop)
             || (farmer     && farmer.primaryCrop)
             || (issue      && issue.crop)
             || '').toString().toLowerCase();
  if (STAPLE_CROPS.has(crop)) {
    score += 8;
    reasons.push({ rule: 'staple_crop', weight: 8, detail: `Staple crop: ${crop}` });
  }

  if (issue && issue.severity) {
    const sev = String(issue.severity).toLowerCase();
    const w = SEVERITY_WEIGHTS[sev] || 0;
    if (w > 0) {
      score += w;
      reasons.push({ rule: 'issue_severity', weight: w, detail: `Issue severity: ${sev}` });
    }
  }

  const risk = (issue && issue.riskLevel) || (farmer && farmer.riskLevel);
  const riskKey = risk ? String(risk).toLowerCase() : null;
  if (riskKey && RISK_LEVEL_WEIGHTS[riskKey]) {
    const w = RISK_LEVEL_WEIGHTS[riskKey];
    score += w;
    reasons.push({ rule: 'risk_level', weight: w, detail: `Risk: ${riskKey}` });
  }

  let daysSince = null;
  const issueStart = asTs(issue && (issue.createdAt || issue.firstAssignedAt));
  if (issueStart != null) {
    daysSince = daysBetween(issueStart, now);
    if (daysSince >= 14)      { score += 20; reasons.push({ rule: 'issue_14d_plus', weight: 20, detail: `${daysSince} days unresolved` }); }
    else if (daysSince >= 7)  { score += 10; reasons.push({ rule: 'issue_7d_plus',  weight: 10, detail: `${daysSince} days unresolved` }); }
    else if (daysSince >= 3)  { score += 4;  reasons.push({ rule: 'issue_3d_plus',  weight: 4,  detail: `${daysSince} days unresolved` }); }
  }

  // Stalled onboarding — invite sent but not accepted.
  if (!issue && application) {
    const invited  = asTs(application.invitedAt || application.createdAt);
    const accepted = asTs(application.acceptedAt);
    if (invited && !accepted) {
      const d = daysBetween(invited, now);
      daysSince = daysSince != null ? Math.max(daysSince, d) : d;
      if (d >= 14)      { score += 18; reasons.push({ rule: 'invite_14d_pending', weight: 18, detail: `${d} days since invite` }); }
      else if (d >= 7)  { score += 10; reasons.push({ rule: 'invite_7d_pending',  weight: 10, detail: `${d} days since invite` }); }
      else if (d >= 3)  { score += 4;  reasons.push({ rule: 'invite_3d_pending',  weight: 4,  detail: `${d} days since invite` }); }
    }
  }

  // Inactivity — no login / event in X days.
  if (!issue && farmer) {
    const last = asTs(farmer.lastActivityAt || farmer.lastLoginAt);
    if (last != null) {
      const d = daysBetween(last, now);
      daysSince = daysSince != null ? Math.max(daysSince, d) : d;
      if (d >= 21)      { score += 12; reasons.push({ rule: 'inactive_21d_plus', weight: 12, detail: `${d} days inactive` }); }
      else if (d >= 14) { score += 6;  reasons.push({ rule: 'inactive_14d_plus', weight: 6,  detail: `${d} days inactive` }); }
      else if (d >= 7)  { score += 3;  reasons.push({ rule: 'inactive_7d_plus',  weight: 3,  detail: `${d} days inactive` }); }
    }
  }

  score = Math.max(0, Math.min(100, score));
  const priority =
      score >= 60 ? 'critical'
    : score >= 35 ? 'high'
    : score >= 15 ? 'medium'
    :                'low';

  return Object.freeze({
    score, priority, daysSince,
    reasons: Object.freeze(reasons.map(Object.freeze)),
  });
}

export function sortByPriority(rows = []) {
  if (!Array.isArray(rows)) return [];
  const indexed = rows.map((r, i) => ({ r, i }));
  indexed.sort((a, b) => {
    const sa = Number(a.r.score) || 0;
    const sb = Number(b.r.score) || 0;
    if (sb !== sa) return sb - sa;
    const da = Number(a.r.daysSince) || 0;
    const db = Number(b.r.daysSince) || 0;
    if (db !== da) return db - da;
    return a.i - b.i;
  });
  return indexed.map((x) => x.r);
}

export const _internal = Object.freeze({
  STAPLE_CROPS, SEVERITY_WEIGHTS, RISK_LEVEL_WEIGHTS,
  farmSizeWeight, daysBetween, asTs, DAY_MS,
});
