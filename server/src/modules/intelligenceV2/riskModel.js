/**
 * riskModel.js — V2 intelligence risk scoring.
 *
 *   computeFarmRisk({
 *     farm,          // { id, crop, countryCode, stateCode, farmSize, … }
 *     issues,        // open/resolved issue rows for this farm
 *     disease,       // optional disease-detection payload
 *     weather,       // optional weather summary
 *     activity,      // { lastActivityAt?, taskCompletionRate? }
 *     now,
 *   }) → {
 *     score:     0..100,
 *     level:     'low' | 'medium' | 'high' | 'critical',
 *     factors:   Array<{ rule, weight, detail, source }>,
 *     audience:  { farmer: 'summary text', admin: 'summary text' },
 *   }
 *
 * Design goals:
 *   • deterministic + explainable — every contributing rule is in
 *     `factors[]` so both farmer UI and admin dashboard can show
 *     the "why"
 *   • no ML — five categories of signal feed a weighted sum:
 *       open issues / disease detection / weather / activity / profile
 *   • one-call surface for both audiences: `audience.farmer` is
 *     short + action-framed, `audience.admin` lists top factors
 *
 * Pure. No Prisma, no network. Missing inputs contribute zero.
 */

const DAY_MS = 24 * 3600 * 1000;

const STAPLE_CROPS = new Set([
  'maize', 'cassava', 'rice', 'wheat', 'sorghum', 'yam', 'millet',
]);

const ISSUE_SEVERITY_WEIGHTS = Object.freeze({
  critical: 30, high: 20, medium: 10, low: 3,
});

const WEATHER_STATUS_WEIGHTS = Object.freeze({
  excessive_heat: 15,
  low_rain:        8,
  dry_ahead:       5,
  uncertain:       0,
  ok:              0,
  unavailable:     0,
});

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function asTs(x) {
  if (x == null) return null;
  if (x instanceof Date) return x.getTime();
  const n = Number(x);
  if (Number.isFinite(n)) return n;
  const p = Date.parse(String(x));
  return Number.isFinite(p) ? p : null;
}

function lower(s) { return String(s || '').toLowerCase(); }

// ─── Category scoring helpers ────────────────────────────────────

function scoreIssues(issues = [], now, factors) {
  let weight = 0;
  if (!Array.isArray(issues) || issues.length === 0) return 0;
  for (const i of issues) {
    if (!i || i.status === 'resolved') continue;
    const sev = lower(i.severity);
    const w = ISSUE_SEVERITY_WEIGHTS[sev] || 0;
    if (w <= 0) continue;
    weight += w;
    factors.push({
      rule:   `issue_${sev || 'unknown'}`,
      weight: w,
      detail: `Open ${sev} issue: ${i.issueType || 'unspecified'}`,
      source: 'issues',
    });
    // Critical severity gets an extra +10 so a standalone brand-new
    // critical issue lifts the overall risk to `high` even without
    // age or staple-crop bumps. Any open critical issue deserves
    // admin attention immediately.
    if (sev === 'critical') {
      weight += 10;
      factors.push({
        rule: 'issue_critical_priority', weight: 10,
        detail: 'Critical severity requires immediate attention',
        source: 'issues',
      });
    }
    const created = asTs(i.createdAt);
    if (created != null) {
      const days = Math.max(0, Math.floor((now - created) / DAY_MS));
      if (days >= 14) {
        weight += 10;
        factors.push({
          rule: 'issue_14d_plus', weight: 10,
          detail: `Unresolved for ${days} days`, source: 'issues',
        });
      } else if (days >= 7) {
        weight += 5;
        factors.push({
          rule: 'issue_7d_plus', weight: 5,
          detail: `Unresolved for ${days} days`, source: 'issues',
        });
      }
    }
  }
  return weight;
}

function scoreDisease(disease, farm, factors) {
  if (!disease || typeof disease !== 'object') return 0;
  let weight = 0;
  const riskKey = lower(disease.riskLevel);
  const base = riskKey === 'critical' ? 30
           : riskKey === 'high'      ? 20
           : riskKey === 'medium'    ? 10
           : riskKey === 'low'       ? 3
           :                            0;
  if (base > 0) {
    weight += base;
    factors.push({
      rule:   `disease_${riskKey}`,
      weight: base,
      detail: disease.likelyIssue
        ? `Detected: ${disease.likelyIssue}`
        : `Disease risk: ${riskKey}`,
      source: 'disease',
    });
  }
  // Confidence amplifies the detection — high-confidence detections
  // add on top, low-confidence pull back.
  const conf = Number(disease.confidenceScore);
  if (Number.isFinite(conf)) {
    if (conf >= 0.8) {
      weight += 5;
      factors.push({
        rule: 'disease_high_confidence', weight: 5,
        detail: `Confidence ${Math.round(conf * 100)}%`, source: 'disease',
      });
    } else if (conf < 0.4 && base > 0) {
      weight -= 3;
      factors.push({
        rule: 'disease_low_confidence', weight: -3,
        detail: `Confidence ${Math.round(conf * 100)}% — model uncertain`,
        source: 'disease',
      });
    }
  }
  // Staple-crop bump when the detection targets a staple.
  const crop = lower(farm && farm.crop);
  if (base > 0 && STAPLE_CROPS.has(crop)) {
    weight += 5;
    factors.push({
      rule: 'disease_on_staple', weight: 5,
      detail: `On staple crop (${crop})`, source: 'disease',
    });
  }
  return weight;
}

function scoreWeather(weather, factors) {
  if (!weather || typeof weather !== 'object') return 0;
  const status = lower(weather.status);
  const w = WEATHER_STATUS_WEIGHTS[status];
  if (!w) return 0;
  factors.push({
    rule: `weather_${status}`,
    weight: w,
    detail: `Weather status: ${status}`,
    source: 'weather',
  });
  return w;
}

function scoreActivity(activity, now, factors) {
  if (!activity || typeof activity !== 'object') return 0;
  let weight = 0;
  const last = asTs(activity.lastActivityAt);
  if (last != null) {
    const days = Math.max(0, Math.floor((now - last) / DAY_MS));
    if (days >= 21) {
      weight += 12;
      factors.push({ rule: 'inactive_21d_plus', weight: 12,
        detail: `${days} days inactive`, source: 'activity' });
    } else if (days >= 14) {
      weight += 6;
      factors.push({ rule: 'inactive_14d_plus', weight: 6,
        detail: `${days} days inactive`, source: 'activity' });
    } else if (days >= 7) {
      weight += 3;
      factors.push({ rule: 'inactive_7d_plus', weight: 3,
        detail: `${days} days inactive`, source: 'activity' });
    }
  }
  const rate = Number(activity.taskCompletionRate);
  if (Number.isFinite(rate) && rate < 0.3) {
    weight += 5;
    factors.push({ rule: 'low_task_completion', weight: 5,
      detail: `Completion rate ${Math.round(rate * 100)}%`, source: 'activity' });
  }
  return weight;
}

function scoreProfile(farm, factors) {
  if (!farm || typeof farm !== 'object') return 0;
  let weight = 0;
  // Incomplete profile → the farmer probably isn't getting good
  // guidance. Small bump, explainable.
  const missing = [];
  if (!farm.crop)     missing.push('crop');
  if (!farm.stateCode && !farm.state) missing.push('location');
  if (missing.length > 0) {
    weight += 3;
    factors.push({ rule: 'profile_incomplete', weight: 3,
      detail: `Missing: ${missing.join(', ')}`, source: 'profile' });
  }
  return weight;
}

// ─── Main entry ──────────────────────────────────────────────────

/**
 * computeFarmRisk — single source of truth for farm risk in V2.
 * Caller supplies whatever signals they have; missing ones
 * contribute zero. Result is safe for both farmer UI (short copy,
 * simple level) and admin dashboard (full factor list).
 */
export function computeFarmRisk({
  farm      = null,
  issues    = [],
  disease   = null,
  weather   = null,
  activity  = null,
  now       = Date.now(),
} = {}) {
  const factors = [];
  let score = 0;

  score += scoreIssues(issues, now, factors);
  score += scoreDisease(disease, farm, factors);
  score += scoreWeather(weather, factors);
  score += scoreActivity(activity, now, factors);
  score += scoreProfile(farm, factors);

  score = clamp(Math.round(score), 0, 100);
  const level = score >= 60 ? 'critical'
              : score >= 35 ? 'high'
              : score >= 15 ? 'medium'
              :                'low';

  const farmerSummary = buildFarmerSummary(level, factors);
  const adminSummary  = buildAdminSummary(level, factors);

  return Object.freeze({
    score, level,
    factors: Object.freeze(factors.map(Object.freeze)),
    audience: Object.freeze({ farmer: farmerSummary, admin: adminSummary }),
  });
}

function buildFarmerSummary(level, factors) {
  if (level === 'low') {
    return 'Your farm looks stable. Keep up the daily tasks.';
  }
  // Prefer the top-weighted explainable factor (excluding profile).
  const top = factors
    .filter((f) => f.source !== 'profile')
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))[0];
  if (!top) return 'Check today\u2019s task list and follow up on any open items.';
  switch (top.source) {
    case 'issues':
      return 'There\u2019s an open issue to resolve. Tap the task list for next steps.';
    case 'disease':
      return 'A possible crop problem was detected. Inspect affected plants and log what you see.';
    case 'weather':
      return 'Weather conditions need attention today. See the recommended task.';
    case 'activity':
      return 'You haven\u2019t checked in recently. Open today\u2019s task to stay on track.';
    default:
      return 'Check today\u2019s task list and follow up on any open items.';
  }
}

function buildAdminSummary(level, factors) {
  if (factors.length === 0) return `Risk ${level}: no active signals.`;
  const top = factors.slice()
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, 3)
    .map((f) => `${f.rule} (+${f.weight})`);
  return `Risk ${level} — ${top.join(', ')}`;
}

export const _internal = Object.freeze({
  DAY_MS, STAPLE_CROPS, ISSUE_SEVERITY_WEIGHTS, WEATHER_STATUS_WEIGHTS,
  scoreIssues, scoreDisease, scoreWeather, scoreActivity, scoreProfile,
  buildFarmerSummary, buildAdminSummary,
});
