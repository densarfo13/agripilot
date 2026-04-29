/**
 * impactMetrics.js — honest farmer-impact numbers derived from
 * the local event log.
 *
 *   tasksCompletedThisWeek(events)
 *   activeFarmers(events)
 *   labelCompletionRate(events)
 *   avgChecksPerWeek(events)
 *   riskReportsThisWeek(events)
 *   outcomeHelpfulnessRate(events)
 *
 * Each function takes an event array (the caller can pass
 * `getEvents()` from src/data/eventLogger.js or a pre-filtered
 * slice for a single farm / region) and returns a number or a
 * 0..1 ratio. Pure + sync — no I/O inside.
 *
 * Why a separate module from src/metrics/roiMetrics.js
 *   roiMetrics composes a 7-field summary for the WeeklySummary
 *   card. impactMetrics returns the SIX atomic values the
 *   spec calls out, named exactly per the brief, ready for the
 *   NGO ROI dashboard. Both modules read the same canonical
 *   event log so the numbers stay consistent.
 *
 * Wording rules (per spec § 8 — never claim yield)
 *   The function names + return values are honest counts /
 *   ratios; the caller is responsible for the user-visible
 *   labels. Recommended labels:
 *     "X farm checks completed"
 *     "X risks reported"
 *     "X farmers active this week"
 *     "Monitoring improved"
 *   No "yield uplift", no "X% better", no projected impact.
 *
 * Strict-rule audit
 *   * Pure: no I/O, no globals
 *   * Never throws on missing / partial input — defensive
 *     filters, returns 0 on empty arrays
 *   * Honest: every metric is a literal count of farmer-driven
 *     actions; nothing imputed
 */

import { EVENT_TYPES } from '../data/eventLogger.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function _safeArr(events) {
  return Array.isArray(events) ? events.filter(Boolean) : [];
}

function _ts(e) {
  if (!e) return null;
  if (Number.isFinite(e.timestamp)) return e.timestamp;
  if (Number.isFinite(e.ts)) return e.ts;
  return null;
}

function _isInLastDays(e, days) {
  const t = _ts(e);
  if (t == null) return false;
  return t >= (Date.now() - days * DAY_MS);
}

function _farmIdOf(e) {
  if (!e || !e.payload) return null;
  const fid = e.payload.farmId;
  return fid != null ? String(fid) : null;
}

/**
 * tasksCompletedThisWeek(events) → number
 */
export function tasksCompletedThisWeek(events) {
  return _safeArr(events).filter((e) =>
    e.type === EVENT_TYPES.TASK_COMPLETED && _isInLastDays(e, 7)
  ).length;
}

/**
 * activeFarmers(events) → number of distinct farmIds that have
 * ANY event in the last 7 days. Caller-supplied events array
 * may be the global log or a per-NGO filtered slice.
 */
export function activeFarmers(events) {
  const seen = new Set();
  for (const e of _safeArr(events)) {
    if (!_isInLastDays(e, 7)) continue;
    const fid = _farmIdOf(e);
    if (fid) seen.add(fid);
  }
  return seen.size;
}

/**
 * labelCompletionRate(events) → ratio in [0, 1].
 *
 * Numerator:   LABEL_SUBMITTED events in last 7 days.
 * Denominator: TASK_COMPLETED events in last 7 days.
 *
 * The ratio represents "how often a completed task is followed
 * by a label", which is the directly-measurable signal of
 * farmer engagement with the labeling prompt. Returns 0 when
 * the denominator is 0 (avoids dividing by zero + reads as
 * "no labels yet" which is correct for cold-start farms).
 */
export function labelCompletionRate(events) {
  const arr = _safeArr(events).filter((e) => _isInLastDays(e, 7));
  let labels = 0;
  let completes = 0;
  for (const e of arr) {
    if (e.type === EVENT_TYPES.LABEL_SUBMITTED) labels += 1;
    if (e.type === EVENT_TYPES.TASK_COMPLETED) completes += 1;
  }
  if (completes === 0) return 0;
  return Math.min(1, labels / completes);
}

/**
 * avgChecksPerWeek(events) → number.
 *
 * "Check" = any TODAY_VIEWED or TASK_COMPLETED event. Counted
 * over a 4-week window then divided by 4 to smooth a single
 * busy day. Returns 0 when there are no events in the window.
 */
export function avgChecksPerWeek(events) {
  const since = Date.now() - 4 * WEEK_MS;
  let n = 0;
  for (const e of _safeArr(events)) {
    const t = _ts(e);
    if (t == null || t < since) continue;
    if (e.type === EVENT_TYPES.TODAY_VIEWED
     || e.type === EVENT_TYPES.TASK_VIEWED
     || e.type === EVENT_TYPES.TASK_COMPLETED) {
      n += 1;
    }
  }
  return n / 4;
}

/**
 * riskReportsThisWeek(events) → number of farmer-submitted
 * pest + drought reports in the last 7 days.
 */
export function riskReportsThisWeek(events) {
  return _safeArr(events).filter((e) =>
    (e.type === EVENT_TYPES.PEST_REPORTED
      || e.type === EVENT_TYPES.DROUGHT_REPORTED)
    && _isInLastDays(e, 7)
  ).length;
}

/**
 * outcomeHelpfulnessRate(events) → ratio in [0, 1].
 *
 * Outcome events carry payload.outcome ∈ { 'helped',
 * 'not_helpful', 'issue_found', 'issue_resolved', 'unknown' }.
 * "Helpful" tier = { helped, issue_resolved }.
 * Numerator: outcomes in helpful tier.
 * Denominator: total outcomes that aren't 'unknown'.
 * Returns 0 when the denominator is 0.
 */
export function outcomeHelpfulnessRate(events) {
  let helpful = 0;
  let total   = 0;
  for (const e of _safeArr(events)) {
    if (e.type !== EVENT_TYPES.OUTCOME_SUBMITTED) continue;
    const o = String((e.payload && e.payload.outcome) || '').toLowerCase();
    if (!o || o === 'unknown') continue;
    total += 1;
    if (o === 'helped' || o === 'issue_resolved') helpful += 1;
  }
  if (total === 0) return 0;
  return Math.min(1, helpful / total);
}

/**
 * Convenience composer for surfaces (e.g. NGO ROI panel) that
 * want every metric in one call. Returns a frozen object with
 * the exact spec wording on the labels.
 */
export function summariseImpact(events) {
  return Object.freeze({
    tasksCompletedThisWeek:   tasksCompletedThisWeek(events),
    activeFarmers:            activeFarmers(events),
    labelCompletionRate:      labelCompletionRate(events),
    avgChecksPerWeek:         avgChecksPerWeek(events),
    riskReportsThisWeek:      riskReportsThisWeek(events),
    outcomeHelpfulnessRate:   outcomeHelpfulnessRate(events),
    generatedAt:              new Date().toISOString(),
  });
}

export default summariseImpact;

/* ────────────────────────────────────────────────────────────
 *  v3 Funding/Impact Layer additions (per Buyer + Funding spec)
 *  ─────────────────────────────────────────────────────────
 *  These compute helpers share the same event input as the
 *  weekly-summary functions above but return the 8-field
 *  ImpactSummary the FundingImpact NGO card consumes. We add
 *  them in this file rather than fork a new one so there is
 *  ONE event taxonomy and the legacy summariseImpact()
 *  consumers keep working.
 *
 *  Wording rule (spec § 8): NO yield-increase claims. Every
 *  metric here is monitoring + activity:
 *    - "monitoring improved"
 *    - "farmers active"
 *    - "tasks completed"
 *    - "risks reported"
 * ──────────────────────────────────────────────────────────── */

const SEVEN_DAYS_MS_V3 = 7 * 24 * 60 * 60 * 1000;

export const IMPACT_EVENTS = Object.freeze({
  TASK_COMPLETED:   'TASK_COMPLETED',
  TODAY_VIEWED:     'TODAY_VIEWED',
  LABEL_SUBMITTED:  'LABEL_SUBMITTED',
  PEST_REPORTED:    'PEST_REPORTED',
  DROUGHT_REPORTED: 'DROUGHT_REPORTED',
  RISK_ALERT_SHOWN: 'RISK_ALERT_SHOWN',
});

function _v3Ts(e) {
  if (!e) return 0;
  const v = e.ts || e.timestamp || e.createdAt;
  if (!v) return 0;
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function _v3IsType(e, type) {
  return e && String(e.type || e.event || '').toUpperCase() === type;
}

function _v3SafeArr(x) { return Array.isArray(x) ? x : []; }

/**
 * computeTaskCompletionRate(events) → 0..1
 *
 * Ratio of TASK_COMPLETED events to TODAY_VIEWED events.
 * Capped at 1.0 — a noisy queue can fire more completions
 * than views on a single device.
 */
export function computeTaskCompletionRate(events) {
  const evs = _v3SafeArr(events);
  let completed = 0, viewed = 0;
  for (const e of evs) {
    if (_v3IsType(e, IMPACT_EVENTS.TASK_COMPLETED))   completed += 1;
    else if (_v3IsType(e, IMPACT_EVENTS.TODAY_VIEWED)) viewed   += 1;
  }
  if (viewed === 0) return 0;
  return Math.min(1, completed / viewed);
}

/**
 * computeActiveFarmers7d(events) → integer
 *
 * Distinct farmerIds that have produced ANY event in the
 * last 7 days.
 */
export function computeActiveFarmers7d(events) {
  const evs = _v3SafeArr(events);
  const cutoff = Date.now() - SEVEN_DAYS_MS_V3;
  const set = new Set();
  for (const e of evs) {
    if (_v3Ts(e) < cutoff) continue;
    const farmer = e.farmerId || e.userId
                || (e.metadata && e.metadata.farmerId);
    if (!farmer) continue;
    set.add(String(farmer));
  }
  return set.size;
}

/**
 * computeAvgTasksPerFarmer(events, farmCount) → number
 */
export function computeAvgTasksPerFarmer(events, farmCount) {
  const evs = _v3SafeArr(events);
  const fc  = Math.max(1, Number(farmCount) || 0);
  let completed = 0;
  for (const e of evs) {
    if (_v3IsType(e, IMPACT_EVENTS.TASK_COMPLETED)) completed += 1;
  }
  return completed / fc;
}

/**
 * computeReports7d(events, type) → integer
 * Generic counter — pass an IMPACT_EVENTS value.
 */
export function computeReports7d(events, type) {
  const evs = _v3SafeArr(events);
  const cutoff = Date.now() - SEVEN_DAYS_MS_V3;
  let n = 0;
  for (const e of evs) {
    if (!_v3IsType(e, type)) continue;
    if (_v3Ts(e) < cutoff) continue;
    n += 1;
  }
  return n;
}

export function computeLabelsSubmitted7d(events) {
  return computeReports7d(events, IMPACT_EVENTS.LABEL_SUBMITTED);
}

/**
 * computeHighRiskFarms(farms, risks?) → integer
 * Counts farms whose `riskLevel` is 'HIGH' OR whose entry
 * in the optional `risks` map flags HIGH pest/drought.
 */
export function computeHighRiskFarms(farms, risks) {
  const list = _v3SafeArr(farms);
  if (!list.length) return 0;
  let n = 0;
  for (const f of list) {
    if (!f) continue;
    const direct = String(f.riskLevel || '').toUpperCase();
    if (direct === 'HIGH') { n += 1; continue; }
    if (risks && typeof risks === 'object') {
      const r = risks[f.id] || risks[f.farmerId];
      if (r) {
        const pest    = String(r.pest    || '').toUpperCase();
        const drought = String(r.drought || '').toUpperCase();
        if (pest === 'HIGH' || drought === 'HIGH') { n += 1; continue; }
      }
    }
  }
  return n;
}

/**
 * computeImpactSummary({ events, farms, risks }) → ImpactSummary
 *
 *   {
 *     totalFarmers, activeFarmers7d,
 *     taskCompletionRate, avgTasksPerFarmer,
 *     highRiskFarms,
 *     labelsSubmitted7d, pestReports7d, droughtReports7d,
 *   }
 *
 * Single function the FundingImpact card consumes. All zeros
 * on missing input — never NaN.
 */
export function computeImpactSummary({
  events = [],
  farms  = [],
  risks  = null,
} = {}) {
  const farmCount = _v3SafeArr(farms).length;
  return {
    totalFarmers:       farmCount,
    activeFarmers7d:    computeActiveFarmers7d(events),
    taskCompletionRate: computeTaskCompletionRate(events),
    avgTasksPerFarmer:
      Number(computeAvgTasksPerFarmer(events, farmCount).toFixed(2)),
    highRiskFarms:      computeHighRiskFarms(farms, risks),
    labelsSubmitted7d:  computeLabelsSubmitted7d(events),
    pestReports7d:      computeReports7d(events, IMPACT_EVENTS.PEST_REPORTED),
    droughtReports7d:   computeReports7d(events, IMPACT_EVENTS.DROUGHT_REPORTED),
  };
}

/* ────────────────────────────────────────────────────────────
 *  NGO Farmer Engagement (Apr 2026 spec)
 *  ──────────────────────────────────────
 *  Reads the same `farroway_events` log as the v1/v3 helpers
 *  above and produces a single 8-field summary the
 *  NgoDashboard's Farmer Engagement section consumes.
 *
 *  Active = ANY event in the last 7 days for that farmerId.
 *  Inactive = totalFarmers - activeFarmers7d (clamped at 0).
 *  Verified = TASK_COMPLETED events whose payload carries
 *  a non-null `verificationLevel` (set when the task model
 *  flags the action as photo/location/peer-confirmed). The
 *  count is honest — no imputation, no projected verification.
 *
 *  Pure + sync. Never throws. All zeros on missing input.
 * ──────────────────────────────────────────────────────────── */

const SEVEN_DAYS_MS_NGO = 7 * 24 * 60 * 60 * 1000;

function _ngoFarmerOf(e) {
  if (!e) return null;
  // Support both the v1 payload-nested shape and the v3 flat
  // shape. The newer TASK_COMPLETED/STREAK_UPDATED events write
  // farmerId inside payload; APP_OPENED has none. Prefer farmerId,
  // fall back to farmId so single-farmer devices still count.
  const p = e.payload || {};
  const id = p.farmerId || e.farmerId || p.farmId || e.farmId || null;
  return id != null ? String(id) : null;
}

function _ngoTs(e) {
  if (!e) return 0;
  if (Number.isFinite(e.timestamp)) return e.timestamp;
  if (Number.isFinite(e.ts)) return e.ts;
  return 0;
}

function _ngoIsType(e, type) {
  return e && String(e.type || e.event || '').toUpperCase() === type;
}

/**
 * computeTasksCompleted7d(events) → integer
 * Count of TASK_COMPLETED rows with timestamp in the last 7 days.
 */
export function computeTasksCompleted7d(events) {
  const cutoff = Date.now() - SEVEN_DAYS_MS_NGO;
  let n = 0;
  for (const e of (Array.isArray(events) ? events : [])) {
    if (!_ngoIsType(e, 'TASK_COMPLETED')) continue;
    if (_ngoTs(e) < cutoff) continue;
    n += 1;
  }
  return n;
}

/**
 * computeCurrentActiveStreaks(events) → integer
 * Distinct farmerIds with a STREAK_UPDATED event in the last
 * 7 days. A streak older than that has lapsed by definition
 * (getEffectiveStreak returns 0 when the gap > 1 day).
 */
export function computeCurrentActiveStreaks(events) {
  const cutoff = Date.now() - SEVEN_DAYS_MS_NGO;
  const set = new Set();
  for (const e of (Array.isArray(events) ? events : [])) {
    if (!_ngoIsType(e, 'STREAK_UPDATED')) continue;
    if (_ngoTs(e) < cutoff) continue;
    const fid = _ngoFarmerOf(e);
    if (fid) set.add(fid);
  }
  return set.size;
}

/**
 * computeInactiveFarmers7d({events, totalFarmers}) → integer
 * totalFarmers minus the count of distinct farmerIds active in
 * the last 7 days. Clamped at 0 so an over-counted active set
 * (e.g. duplicate farmer-ids from a noisy device) never returns
 * a negative value.
 */
export function computeInactiveFarmers7d({ events, totalFarmers }) {
  const cutoff = Date.now() - SEVEN_DAYS_MS_NGO;
  const active = new Set();
  for (const e of (Array.isArray(events) ? events : [])) {
    if (_ngoTs(e) < cutoff) continue;
    const fid = _ngoFarmerOf(e);
    if (fid) active.add(fid);
  }
  const total = Math.max(0, Number(totalFarmers) || 0);
  return Math.max(0, total - active.size);
}

/**
 * computeVerifiedCompletions7d(events) → integer
 * TASK_COMPLETED rows whose payload.verificationLevel is set
 * (non-null, non-empty string) and timestamp is within 7 days.
 */
export function computeVerifiedCompletions7d(events) {
  const cutoff = Date.now() - SEVEN_DAYS_MS_NGO;
  let n = 0;
  for (const e of (Array.isArray(events) ? events : [])) {
    if (!_ngoIsType(e, 'TASK_COMPLETED')) continue;
    if (_ngoTs(e) < cutoff) continue;
    const v = e.payload && e.payload.verificationLevel;
    if (v != null && String(v).trim() !== '') n += 1;
  }
  return n;
}

/**
 * computeNgoEngagementSummary({ events, farms }) → summary
 *
 * Single call the NGO dashboard renders into the Farmer
 * Engagement section + the CSV export.
 *
 * Returns:
 *   {
 *     totalFarmers, activeFarmers7d, inactiveFarmers7d,
 *     tasksCompleted7d, taskCompletionRate,
 *     avgTasksPerFarmer, currentActiveStreaks,
 *     verifiedCompletions7d, generatedAt,
 *     hasActivity: boolean,
 *   }
 *
 * `hasActivity` is the empty-state signal for the dashboard:
 * when false, render the "No activity yet" copy instead of a
 * row of zero-cards.
 */
export function computeNgoEngagementSummary({
  events = [],
  farms  = [],
} = {}) {
  const evs   = Array.isArray(events) ? events : [];
  const fs    = Array.isArray(farms)  ? farms  : [];
  const total = fs.length;

  const tasksCompleted7d        = computeTasksCompleted7d(evs);
  const activeFarmers7d         = computeActiveFarmers7d(evs);
  const inactiveFarmers7d       = computeInactiveFarmers7d({ events: evs, totalFarmers: total });
  const taskCompletionRate      = computeTaskCompletionRate(evs);
  const avgTasksPerFarmer       = total > 0
    ? Number(computeAvgTasksPerFarmer(evs, total).toFixed(2))
    : 0;
  const currentActiveStreaks    = computeCurrentActiveStreaks(evs);
  const verifiedCompletions7d   = computeVerifiedCompletions7d(evs);

  return Object.freeze({
    totalFarmers:           total,
    activeFarmers7d,
    inactiveFarmers7d,
    tasksCompleted7d,
    taskCompletionRate,
    avgTasksPerFarmer,
    currentActiveStreaks,
    verifiedCompletions7d,
    generatedAt:            new Date().toISOString(),
    hasActivity:            tasksCompleted7d > 0
                          || activeFarmers7d > 0
                          || currentActiveStreaks > 0,
  });
}

/**
 * engagementToCsv({ events, farms }) → CSV string.
 *
 * Per-farmer roll-up suitable for the dashboard's "Download
 * Engagement Report" button. Columns match the impact spec
 * exactly: farmerId, crop, region, tasksCompleted, lastActive,
 * streak, verifiedActions.
 *
 * lastActive is an ISO timestamp (or empty when the farmer has
 * no events). streak is computed from the latest STREAK_UPDATED
 * event for that farmer in the last 7 days; falls back to 0
 * when no recent streak event exists.
 */
export function engagementToCsv({ events = [], farms = [] } = {}) {
  const evs = Array.isArray(events) ? events : [];
  const fs  = Array.isArray(farms)  ? farms  : [];

  // Group events per farmerId in one pass.
  const cutoff = Date.now() - SEVEN_DAYS_MS_NGO;
  const perFarmer = new Map(); // id → { tasksCompleted, lastActive, streak, verifiedActions, crop, region }
  function bucket(id) {
    if (!perFarmer.has(id)) {
      perFarmer.set(id, {
        tasksCompleted: 0,
        lastActive:     0,
        streak:         0,
        verifiedActions: 0,
        crop:           '',
        region:         '',
      });
    }
    return perFarmer.get(id);
  }

  for (const e of evs) {
    const id = _ngoFarmerOf(e);
    if (!id) continue;
    const ts = _ngoTs(e);
    const b  = bucket(id);
    if (ts > b.lastActive) b.lastActive = ts;
    const p = e.payload || {};
    if (p.crop && !b.crop)     b.crop   = String(p.crop);
    if (p.region && !b.region) b.region = String(p.region);
    if (_ngoIsType(e, 'TASK_COMPLETED')) {
      b.tasksCompleted += 1;
      if (p.verificationLevel != null
          && String(p.verificationLevel).trim() !== '') {
        b.verifiedActions += 1;
      }
    }
    if (_ngoIsType(e, 'STREAK_UPDATED') && ts >= cutoff) {
      // Latest streak for this farmer in the active window.
      const after = Number((p.after != null) ? p.after : p.streak);
      if (Number.isFinite(after) && after >= 0) b.streak = after;
    }
  }

  // Pull crop/region off the canonical farms list when the events
  // didn't carry it (older rows). Keeps the CSV usable even when
  // the event log is sparse.
  const farmRowById = new Map();
  for (const f of fs) {
    if (!f) continue;
    const id = String(f.farmerId || f.id || '');
    if (id) farmRowById.set(id, f);
    // Also bucket so farmers with zero events still appear in CSV.
    if (id && !perFarmer.has(id)) bucket(id);
  }
  for (const [id, b] of perFarmer) {
    const f = farmRowById.get(id);
    if (f) {
      if (!b.crop)   b.crop   = String(f.crop || '');
      if (!b.region) b.region = String(f.region || f.location || '');
    }
  }

  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const isoOr = (ts) => {
    if (!ts || !Number.isFinite(Number(ts))) return '';
    try { return new Date(Number(ts)).toISOString(); } catch { return ''; }
  };
  const rows = [
    ['farmerId', 'crop', 'region', 'tasksCompleted', 'lastActive', 'streak', 'verifiedActions']
      .join(','),
  ];
  for (const [id, b] of perFarmer) {
    rows.push([
      esc(id),
      esc(b.crop),
      esc(b.region),
      esc(b.tasksCompleted),
      esc(isoOr(b.lastActive)),
      esc(b.streak),
      esc(b.verifiedActions),
    ].join(','));
  }
  return rows.join('\n') + (rows.length > 1 ? '\n' : '');
}

/**
 * impactSummaryToCsv(summary) → CSV string. Used by the
 * "Export Impact Summary" button to build a Blob download.
 * Conservative wording — the trailing "Note" row makes it
 * clear these are monitoring metrics, not yield guarantees.
 */
export function impactSummaryToCsv(summary) {
  const s = summary || {};
  const rate = Math.round(((s.taskCompletionRate ?? 0) * 100));
  const rows = [
    ['Metric', 'Value'],
    ['Total Farmers',         s.totalFarmers           ?? 0],
    ['Active Farmers (7d)',   s.activeFarmers7d        ?? 0],
    ['Task Completion Rate',  `${rate}%`],
    ['Avg Tasks per Farmer',  s.avgTasksPerFarmer      ?? 0],
    ['High Risk Farms',       s.highRiskFarms          ?? 0],
    ['Labels Submitted (7d)', s.labelsSubmitted7d      ?? 0],
    ['Pest Reports (7d)',     s.pestReports7d          ?? 0],
    ['Drought Reports (7d)',  s.droughtReports7d       ?? 0],
    [],
    ['Generated', new Date().toISOString()],
    ['Source',    'Farroway'],
    ['Note',      'Monitoring + activity metrics. Not a guarantee of yield.'],
  ];
  return rows
    .map((r) =>
      r.map((cell) => {
        const str = String(cell ?? '');
        return /[",\n]/.test(str)
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    )
    .join('\n');
}
