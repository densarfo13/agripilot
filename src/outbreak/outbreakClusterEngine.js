/**
 * outbreakClusterEngine.js — pure clustering for the Outbreak
 * Intelligence System.
 *
 *   detectOutbreakClusters(reports, farms?, opts?)
 *     -> Array<Cluster>
 *
 * Logic
 *   * Group reports by   country + region + crop + issueType
 *     (region passes through normaliseRegion at read time so
 *      typed variants like "Volta Region" cluster cleanly with
 *      "volta" written by another tab).
 *   * Optional GIS proximity merge (limitation 1 fix): clusters
 *     with the same crop + issueType whose representative
 *     coordinates fall in adjacent ~28km buckets get merged.
 *     Off by default; enable with opts.geoMerge = true.
 *   * Activate when      report count >= 3 inside last 7 days
 *   * Severity:
 *       high    -> 5+ reports OR 2+ high-severity reports
 *       medium  -> 3-4 reports
 *       low     -> below the activation threshold (returned
 *                  but flagged inactive)
 *
 * Strict-rule audit:
 *   * Pure function: no I/O; callers can pass `now` for tests.
 *   * Never throws on missing / malformed inputs.
 *   * GIS merge is opt-in so the existing /ngo/value + farmer
 *     banner default behaviour is unchanged.
 */

import { normaliseRegion, normaliseCountry } from './regionNormaliser.js';
import { distanceKm, centroid } from '../utils/geo.js';

export const CLUSTER_TUNING = Object.freeze({
  WINDOW_DAYS:        7,
  MIN_REPORTS_ACTIVE: 3,
  HIGH_REPORTS:       5,
  HIGH_SEVERE_REPORTS: 2,
  // ~0.25 deg ≈ 28 km at the equator. Tighter than the v0
  // pest-cluster bucket (0.5deg ≈ 55 km) so geoMerge doesn't
  // over-collapse adjacent regions.
  GEO_BUCKET_DEG:     0.25,
  // proximityKm mode default - haversine distance threshold
  // for the "are these reports nearby?" check. Spec section 4
  // calls for 20-50km; 30km is the demo-friendly default.
  PROXIMITY_KM:       30,
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

function _geoBucket(lat, lng, deg) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const round = (v) => Math.floor(v / deg) * deg;
  return `${round(lat).toFixed(3)},${round(lng).toFixed(3)}`;
}

/**
 * Average lat/lng across a group's reports, ignoring missing
 * coordinates. Returns { lat, lng } or null.
 */
function _centroid(reports) {
  let lat = 0, lng = 0, n = 0;
  for (const r of reports) {
    const ll = r && r.location;
    const a = Number(ll && ll.lat);
    const b = Number(ll && ll.lng);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    lat += a; lng += b; n += 1;
  }
  if (n === 0) return null;
  return { lat: lat / n, lng: lng / n };
}

function _affectedFarms(farms, key) {
  if (!Array.isArray(farms) || farms.length === 0) return [];
  const out = [];
  for (const f of farms) {
    if (!f || typeof f !== 'object') continue;
    const country = normaliseCountry(f.country);
    const region  = normaliseRegion(f.region || f.stateCode, country);
    const crop    = _norm(f.crop || f.cropType);
    const matches =
      country === key.country &&
      region  === key.region  &&
      crop    === key.crop;
    if (matches) {
      const id = f.id != null ? String(f.id) : null;
      if (id) out.push(id);
    }
  }
  return out;
}

/* ─── grouping ─────────────────────────────────────────────────── */

function _buildBaseGroups(reports, { now, windowDays }) {
  const groups = new Map();
  for (const r of reports) {
    if (!r || typeof r !== 'object') continue;
    if (!_withinWindow(r.createdAt, now, windowDays)) continue;
    const country  = normaliseCountry(r.location && r.location.country);
    const region   = normaliseRegion(r.location && r.location.region, country);
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
        regions: new Set([region]),
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
  return groups;
}

/**
 * GIS proximity merge. Iterates the base groups and merges any
 * pair where:
 *   * country matches
 *   * crop matches
 *   * issueType matches
 *   * geo buckets are equal OR adjacent
 *
 * Adjacency is the 8-neighbourhood plus same-bucket. The merged
 * cluster keeps the highest-count region as the canonical
 * `region` field; all merged regions are kept on `regions[]` for
 * the UI to surface.
 */
function _mergeAdjacentGeo(groups, bucketDeg) {
  // Pre-compute centroid + bucket per group so we don't
  // recompute inside the merge loop.
  const enriched = [];
  for (const g of groups.values()) {
    const centroid = _centroid(g.reports);
    const bucket = centroid
      ? _geoBucket(centroid.lat, centroid.lng, bucketDeg)
      : null;
    enriched.push({ g, centroid, bucket });
  }

  // Union-Find over the enriched list.
  const parent = enriched.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  function adjacent(b1, b2) {
    if (!b1 || !b2) return false;
    if (b1 === b2) return true;
    const [la, lna] = b1.split(',').map(Number);
    const [lb, lnb] = b2.split(',').map(Number);
    if (![la, lna, lb, lnb].every(Number.isFinite)) return false;
    const dy = Math.round((la - lb) / bucketDeg);
    const dx = Math.round((lna - lnb) / bucketDeg);
    return Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
  }

  for (let i = 0; i < enriched.length; i += 1) {
    for (let j = i + 1; j < enriched.length; j += 1) {
      const A = enriched[i], B = enriched[j];
      if (A.g.country  !== B.g.country)   continue;
      if (A.g.crop     !== B.g.crop)      continue;
      if (A.g.issueType !== B.g.issueType) continue;
      if (!adjacent(A.bucket, B.bucket))   continue;
      union(i, j);
    }
  }

  // Coalesce groups by union-find root.
  const merged = new Map();
  for (let i = 0; i < enriched.length; i += 1) {
    const root = find(i);
    const A = enriched[i].g;
    if (!merged.has(root)) {
      merged.set(root, {
        id:        A.id, // overwritten below to reflect merge
        country:   A.country,
        region:    A.region,
        crop:      A.crop,
        issueType: A.issueType,
        reports:   [...A.reports],
        count:     A.count,
        firstReportedAt: A.firstReportedAt,
        lastReportedAt:  A.lastReportedAt,
        regions:   new Set(A.regions),
        regionCounts: new Map([[A.region, A.count]]),
      });
    } else {
      const M = merged.get(root);
      M.reports.push(...A.reports);
      M.count += A.count;
      M.firstReportedAt = Math.min(M.firstReportedAt, A.firstReportedAt);
      M.lastReportedAt  = Math.max(M.lastReportedAt,  A.lastReportedAt);
      for (const r of A.regions) M.regions.add(r);
      M.regionCounts.set(A.region, (M.regionCounts.get(A.region) || 0) + A.count);
    }
  }

  // Pick the canonical region per merged cluster as the one with
  // the most reports.
  for (const M of merged.values()) {
    let best = '', bestCount = -1;
    for (const [region, count] of M.regionCounts) {
      if (count > bestCount) { best = region; bestCount = count; }
    }
    if (best) M.region = best;
    M.id = `${M.country}|${M.region}|${M.crop}|${M.issueType}|geo`;
    delete M.regionCounts;
  }

  return merged;
}

/**
 * Haversine-based proximity merge (limitation 1 v2 fix).
 *
 *   For every pair of base groups with the same country + crop +
 *   issueType, compute the haversine distance between their
 *   centroids; merge when distance <= proximityKm. Uses the
 *   union-find primitive above so the merge is order-independent.
 *
 * Use this mode when reports carry real lat/lng (Open-Meteo +
 * geolocation are wired). Falls through gracefully for
 * coordinates-less groups: they're left as-is, never merged
 * across by mistake.
 */
function _mergeByProximity(groups, proximityKm) {
  const enriched = [];
  for (const g of groups.values()) {
    const c = _centroid(g.reports);
    enriched.push({ g, centroid: c });
  }

  const parent = enriched.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < enriched.length; i += 1) {
    for (let j = i + 1; j < enriched.length; j += 1) {
      const A = enriched[i], B = enriched[j];
      if (A.g.country  !== B.g.country)   continue;
      if (A.g.crop     !== B.g.crop)      continue;
      if (A.g.issueType !== B.g.issueType) continue;
      if (!A.centroid || !B.centroid)      continue;
      const d = distanceKm(A.centroid, B.centroid);
      if (!Number.isFinite(d) || d > proximityKm) continue;
      union(i, j);
    }
  }

  const merged = new Map();
  for (let i = 0; i < enriched.length; i += 1) {
    const root = find(i);
    const A = enriched[i].g;
    if (!merged.has(root)) {
      merged.set(root, {
        id:        A.id,
        country:   A.country,
        region:    A.region,
        crop:      A.crop,
        issueType: A.issueType,
        reports:   [...A.reports],
        count:     A.count,
        firstReportedAt: A.firstReportedAt,
        lastReportedAt:  A.lastReportedAt,
        regions:   new Set(A.regions),
        regionCounts: new Map([[A.region, A.count]]),
      });
    } else {
      const M = merged.get(root);
      M.reports.push(...A.reports);
      M.count += A.count;
      M.firstReportedAt = Math.min(M.firstReportedAt, A.firstReportedAt);
      M.lastReportedAt  = Math.max(M.lastReportedAt,  A.lastReportedAt);
      for (const r of A.regions) M.regions.add(r);
      M.regionCounts.set(A.region, (M.regionCounts.get(A.region) || 0) + A.count);
    }
  }

  // Same canonicalisation as _mergeAdjacentGeo: pick the
  // highest-count region and tag the cluster id with `|prox`.
  for (const M of merged.values()) {
    let best = '', bestCount = -1;
    for (const [region, count] of M.regionCounts) {
      if (count > bestCount) { best = region; bestCount = count; }
    }
    if (best) M.region = best;
    M.id = `${M.country}|${M.region}|${M.crop}|${M.issueType}|prox`;
    delete M.regionCounts;
  }

  return merged;
}

/* ─── public ───────────────────────────────────────────────────── */

/**
 * detectOutbreakClusters(reports, farms, opts)
 *
 * Options:
 *   now         (number, ms)     — for deterministic tests
 *   windowDays  (number)
 *   minActive   (number)
 *   onlyActive  (boolean)
 *   geoMerge    (boolean)         — enable bucket-adjacency merge
 *   bucketDeg   (number)          — geo bucket size
 *   proximityKm (number)           — when supplied, runs the
 *                                    haversine-based merge
 *                                    (limitation 1 v2 fix). Wins
 *                                    over `geoMerge`.
 */
export function detectOutbreakClusters(reports, farms = [], opts = {}) {
  const {
    now            = Date.now(),
    windowDays     = CLUSTER_TUNING.WINDOW_DAYS,
    minActive      = CLUSTER_TUNING.MIN_REPORTS_ACTIVE,
    onlyActive     = false,
    geoMerge       = false,
    bucketDeg      = CLUSTER_TUNING.GEO_BUCKET_DEG,
    proximityKm    = null,
  } = opts || {};

  if (!Array.isArray(reports) || reports.length === 0) return [];

  const baseGroups = _buildBaseGroups(reports, { now, windowDays });

  // Mode pick: explicit proximityKm wins; then geoMerge bucket
  // adjacency; then no merge at all.
  let groups;
  if (Number.isFinite(Number(proximityKm)) && Number(proximityKm) > 0) {
    groups = _mergeByProximity(baseGroups, Number(proximityKm));
  } else if (geoMerge) {
    groups = _mergeAdjacentGeo(baseGroups, bucketDeg);
  } else {
    groups = baseGroups;
  }

  const result = [];
  for (const g of groups.values()) {
    const severity = _computeSeverity(g);
    const active = g.count >= minActive;
    if (onlyActive && !active) continue;
    const key = { country: g.country, region: g.region, crop: g.crop };
    // Cluster centroid - derived from the reports' lat/lng. Used
    // by the NGO panel + farmer banner to surface "within Xkm"
    // copy. Reports without coords yield null here; consumers
    // hide the lat/lng row in that case.
    const c = _centroid(g.reports);
    result.push(Object.freeze({
      id:                g.id,
      country:           g.country,
      region:            g.region,
      regions:           Object.freeze([...(g.regions || [g.region])]),
      crop:              g.crop,
      issueType:         g.issueType,
      reportCount:       g.count,
      severity,
      active,
      lat:               c ? c.lat : null,
      lng:               c ? c.lng : null,
      firstReportedAt:   Number.isFinite(g.firstReportedAt) ? g.firstReportedAt : null,
      lastReportedAt:    Number.isFinite(g.lastReportedAt)  ? g.lastReportedAt  : null,
      affectedFarmIds:   Object.freeze(_affectedFarms(farms, key)),
      messageKey:        'outbreak.nearbyRiskMessage',
    }));
  }

  // Sort: severity desc, then count desc, then most recent first.
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
  _geoBucket, _centroid, _mergeAdjacentGeo,
});
