/**
 * outbreakClusterEngine.js — pure clustering for the Outbreak
 * Intelligence System v1.
 *
 *   detectOutbreakClusters(reports, farms?, opts?)
 *     -> Array<Cluster>
 *
 * Logic v1 (per spec):
 *   * Group reports by   country + region + crop + issueType
 *   * Activate when      report count >= 3 inside last 7 days
 *   * Severity:
 *       high    -> 5+ reports OR 2+ high-severity reports
 *       medium  -> 3-4 reports
 *       low     -> below the activation threshold (returned
 *                  but flagged inactive)
 *
 * Strict-rule audit:
 *   * Pure function: no I/O, no Date.now read inside the body
 *     (callers can pass `now` for deterministic tests).
 *   * Never throws on missing / malformed inputs.
 *   * No GIS dependency. Lat/lng inside reports is preserved on
 *     each report record but not used to merge clusters in v1.
 */

export const CLUSTER_TUNING = Object.freeze({
  WINDOW_DAYS:       7,
  MIN_REPORTS_ACTIVE: 3,
  HIGH_REPORTS:       5,
  HIGH_SEVERE_REPORTS: 2,
});

const MS_PER_DAY = 86_400_000;

/* ─── helpers ──────────────────────────────────────────────────── */

function _norm(s) {
  if (s == null) return '';
  return String(s).trim().toLowerCase();
}

function _withinWindow(ts, now, windowDays) {
  const t = (typeof ts === 'string') ? Date.parse(ts) : Number(ts);
  if (!Number.isFinite(t)) return false;
  return t >= now - windowDays * MS_PER_DAY;
}

function _computeSeverity(group) {
  const high = group.reports.filter((r) => r && r.severity === 'high').length;
  if (group.count >= CLUSTER_TUNING.HIGH_REPORTS) return 'high';
  if (high >= CLUSTER_TUNING.HIGH_SEVERE_REPORTS) return 'high';
  if (group.count >= CLUSTER_TUNING.MIN_REPORTS_ACTIVE) return 'medium';
  return 'low';
}

function _affectedFarms(farms, key) {
  if (!Array.isArray(farms) || farms.length === 0) return [];
  const out = [];
  for (const f of farms) {
    if (!f || typeof f !== 'object') continue;
    const matches =
      _norm(f.country) === key.country  &&
      _norm(f.region)  === key.region   &&
      _norm(f.crop)    === key.crop;
    if (matches) {
      const id = f.id != null ? String(f.id) : null;
      if (id) out.push(id);
    }
  }
  return out;
}

/* ─── public ───────────────────────────────────────────────────── */

/**
 * detectOutbreakClusters(reports, farms, opts)
 *
 * Returns ALL clusters, including those below the activation
 * threshold (callers can filter on `active === true` for the v1
 * banner / NGO panel use cases). Sorted with high-severity +
 * higher-count clusters first.
 */
export function detectOutbreakClusters(reports, farms = [], opts = {}) {
  const {
    now            = Date.now(),
    windowDays     = CLUSTER_TUNING.WINDOW_DAYS,
    minActive      = CLUSTER_TUNING.MIN_REPORTS_ACTIVE,
    onlyActive     = false,
  } = opts || {};

  if (!Array.isArray(reports) || reports.length === 0) return [];

  const groups = new Map();
  for (const r of reports) {
    if (!r || typeof r !== 'object') continue;
    if (!_withinWindow(r.createdAt, now, windowDays)) continue;
    const country  = _norm(r.location && r.location.country);
    const region   = _norm(r.location && r.location.region);
    const crop     = _norm(r.crop);
    const issue    = _norm(r.issueType);
    if (!country || !region || !crop || !issue) continue;

    const id = `${country}|${region}|${crop}|${issue}`;
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        country, region, crop, issueType: issue,
        reports: [],
        count: 0,
        firstReportedAt: Number.POSITIVE_INFINITY,
        lastReportedAt:  Number.NEGATIVE_INFINITY,
      });
    }
    const g = groups.get(id);
    g.reports.push(r);
    g.count += 1;
    const t = (typeof r.createdAt === 'string') ? Date.parse(r.createdAt) : Number(r.createdAt);
    if (Number.isFinite(t)) {
      if (t < g.firstReportedAt) g.firstReportedAt = t;
      if (t > g.lastReportedAt)  g.lastReportedAt  = t;
    }
  }

  const result = [];
  for (const g of groups.values()) {
    const severity = _computeSeverity(g);
    const active = g.count >= minActive;
    if (onlyActive && !active) continue;
    const key = { country: g.country, region: g.region, crop: g.crop };
    result.push(Object.freeze({
      id:                g.id,
      country:           g.country,
      region:            g.region,
      crop:              g.crop,
      issueType:         g.issueType,
      reportCount:       g.count,
      severity,
      active,
      firstReportedAt:   Number.isFinite(g.firstReportedAt) ? g.firstReportedAt : null,
      lastReportedAt:    Number.isFinite(g.lastReportedAt)  ? g.lastReportedAt  : null,
      affectedFarmIds:   Object.freeze(_affectedFarms(farms, key)),
      messageKey:        'outbreak.nearbyRiskMessage',
    }));
  }

  // Sort: severity desc (high > medium > low), then count desc,
  // then most recent activity first.
  const sevRank = { high: 3, medium: 2, low: 1 };
  result.sort((a, b) => {
    const r = (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0);
    if (r !== 0) return r;
    if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
    return (b.lastReportedAt || 0) - (a.lastReportedAt || 0);
  });
  return result;
}

/** Convenience: only the active clusters. */
export function detectActiveClusters(reports, farms = [], opts = {}) {
  return detectOutbreakClusters(reports, farms, { ...opts, onlyActive: true });
}

export const _internal = Object.freeze({
  _norm, _withinWindow, _computeSeverity, _affectedFarms,
});
