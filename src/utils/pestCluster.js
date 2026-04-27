/**
 * pestCluster.js — pure clustering over a flat pest-report list.
 *
 * Two grouping strategies live side by side; both return the
 * SAME shape so consumers can swap freely:
 *
 *   { region, count, latest, reports }
 *
 *   region    canonical group key (location string OR
 *             "lat,lng-bucket")
 *   count     reports in the cluster within `windowDays`
 *   latest    most-recent timestamp in the cluster (ms)
 *   reports   the source report records
 *
 * Tunables are exported in `CLUSTER_TUNING` so demos can adjust
 * the threshold + window without hunting through code.
 *
 * Strict rules respected:
 *   * pure       - no I/O, no localStorage read, no Date.now
 *                  inside the function (callers pass `now`)
 *   * never throws on missing / malformed inputs
 *   * lightweight - O(N) over the report list
 */

export const CLUSTER_TUNING = Object.freeze({
  WINDOW_DAYS:        7,    // reports older than this don't count
  MIN_REPORTS_ALERT:  3,    // threshold to trigger an alert
  GEO_BUCKET_DEG:     0.5,  // ~55 km bucket when lat/lng present
});

const MS_PER_DAY = 86_400_000;

/* ─── Helpers ──────────────────────────────────────────────────── */

function _normalizeRegion(loc) {
  if (loc == null) return '';
  return String(loc).trim().toLowerCase();
}

function _geoBucketKey(lat, lng, deg = CLUSTER_TUNING.GEO_BUCKET_DEG) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  const round = (v) => Math.floor(v / deg) * deg;
  return `geo:${round(lat).toFixed(2)},${round(lng).toFixed(2)}`;
}

function _withinWindow(ts, now, windowDays) {
  const t = Number(ts);
  if (!Number.isFinite(t)) return false;
  const cutoff = now - windowDays * MS_PER_DAY;
  return t >= cutoff;
}

/* ─── Grouping ─────────────────────────────────────────────────── */

/**
 * clusterByRegion(reports, opts?)
 *   -> Array<{ region, count, latest, reports }>
 *
 * Groups reports by `report.location` (case-insensitive). Reports
 * with no location are bucketed under `unknown`. Pass
 * `excludeUnknown: true` to drop them from the output.
 */
export function clusterByRegion(reports, opts = {}) {
  const {
    now            = Date.now(),
    windowDays     = CLUSTER_TUNING.WINDOW_DAYS,
    excludeUnknown = false,
  } = opts || {};

  if (!Array.isArray(reports) || reports.length === 0) return [];

  const groups = new Map();
  for (const r of reports) {
    if (!r || typeof r !== 'object') continue;
    if (!_withinWindow(r.timestamp, now, windowDays)) continue;
    const region = _normalizeRegion(r.location) || 'unknown';
    if (excludeUnknown && region === 'unknown') continue;
    if (!groups.has(region)) {
      groups.set(region, { region, count: 0, latest: 0, reports: [] });
    }
    const g = groups.get(region);
    g.count += 1;
    if (Number(r.timestamp) > g.latest) g.latest = Number(r.timestamp);
    g.reports.push(r);
  }

  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

/**
 * clusterByGeo(reports, opts?)
 *   -> Array<{ region, count, latest, reports }>
 *
 * Same shape as clusterByRegion but groups on a coarse lat/lng
 * bucket (~55 km when GEO_BUCKET_DEG = 0.5). Use this when farms
 * have coordinates but no consistent free-text location.
 */
export function clusterByGeo(reports, opts = {}) {
  const {
    now        = Date.now(),
    windowDays = CLUSTER_TUNING.WINDOW_DAYS,
    bucketDeg  = CLUSTER_TUNING.GEO_BUCKET_DEG,
  } = opts || {};

  if (!Array.isArray(reports) || reports.length === 0) return [];

  const groups = new Map();
  for (const r of reports) {
    if (!r || typeof r !== 'object') continue;
    if (!_withinWindow(r.timestamp, now, windowDays)) continue;
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = _geoBucketKey(lat, lng, bucketDeg);
    if (!groups.has(key)) {
      groups.set(key, { region: key, count: 0, latest: 0, reports: [] });
    }
    const g = groups.get(key);
    g.count += 1;
    if (Number(r.timestamp) > g.latest) g.latest = Number(r.timestamp);
    g.reports.push(r);
  }

  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

/* ─── Alerts ───────────────────────────────────────────────────── */

/**
 * shouldAlertForRegion(reports, region, opts?)
 *   -> { alert: boolean, count, threshold }
 *
 * Convenience for the farmer-side banner. Returns whether the
 * given region (free-text, case-insensitive) has enough reports
 * inside the window to trigger an alert.
 */
export function shouldAlertForRegion(reports, region, opts = {}) {
  const {
    now        = Date.now(),
    windowDays = CLUSTER_TUNING.WINDOW_DAYS,
    threshold  = CLUSTER_TUNING.MIN_REPORTS_ALERT,
  } = opts || {};

  const target = _normalizeRegion(region);
  if (!target) return { alert: false, count: 0, threshold };

  let count = 0;
  if (Array.isArray(reports)) {
    for (const r of reports) {
      if (!r || typeof r !== 'object') continue;
      if (!_withinWindow(r.timestamp, now, windowDays)) continue;
      if (_normalizeRegion(r.location) === target) count += 1;
    }
  }
  return { alert: count >= threshold, count, threshold };
}

/**
 * topClusters(reports, opts?)
 *   -> clusters with count >= threshold, sorted by count desc.
 *
 * For the NGO dashboard's "Region X -> 5 pest reports" panel.
 */
export function topClusters(reports, opts = {}) {
  const {
    now            = Date.now(),
    windowDays     = CLUSTER_TUNING.WINDOW_DAYS,
    threshold      = CLUSTER_TUNING.MIN_REPORTS_ALERT,
    excludeUnknown = true,
    limit          = 10,
  } = opts || {};

  const grouped = clusterByRegion(reports, { now, windowDays, excludeUnknown });
  return grouped.filter((g) => g.count >= threshold).slice(0, Math.max(0, limit));
}

export const _internal = Object.freeze({ _normalizeRegion, _geoBucketKey });
