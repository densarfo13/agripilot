/**
 * outbreakClusterEngine.js — NGO-facing cluster facade.
 *
 *   detectClusters({ farms, reports, risks })
 *     -> Array<NgoCluster>
 *
 * NgoCluster shape (matches the brief's contract):
 *   {
 *     id,                    // stable string key
 *     crop,                  // canonical crop id
 *     issueType,             // 'pest' | 'drought' | 'unknown'
 *     region,                // human label "country / region"
 *     country, district,
 *     centerLat, centerLng,  // null when no GPS in cluster
 *     reportCount,           // farmer reports in last 7 days
 *     highRiskFarmCount,     // farms scored HIGH for this domain
 *     severity,              // 'LOW' | 'MEDIUM' | 'HIGH'
 *     recommendedAction,     // i18n key + fallback
 *     updatedAt,             // ISO timestamp
 *   }
 *
 * Activation rules
 *   * 3+ reports in the same crop+issueType+region within 7 days
 *     -> active cluster from the underlying outbreak engine
 *   * OR 5+ HIGH-risk farms in the same region for the same
 *     issue type (pest / drought)
 *
 * The "5 high-risk farms" rule is the new path the spec calls
 * for. The existing src/outbreak/outbreakClusterEngine.js
 * activates on REPORTS only — this facade fans out a second
 * pass over (farms x risks) and merges the two activation
 * sources into one unified cluster list.
 *
 * Strict-rule audit
 *   * Pure: caller passes farms + reports + per-farm risks; no
 *     I/O, no globals
 *   * Never throws on partial input — missing risks per farm
 *     count as LOW; farms without coords still cluster by
 *     country/region/district via getRegionKey
 *   * Privacy-safe: cluster output never echoes individual
 *     farm coords or farmer ids — only aggregates + a single
 *     centroid (also droppable when no GPS in the cluster)
 *   * Coexists with src/outbreak/outbreakClusterEngine.js (the
 *     core report-clustering engine); this is the NGO-facade
 *     that adds the high-risk-farms activation source on top
 */

import {
  detectActiveClusters as _detectReportClusters,
  detectOutbreakClusters as _detectAllReportClusters,
} from '../outbreak/outbreakClusterEngine.js';
import { getRegionKey, distanceKm, hasGPS } from '../location/geoUtils.js';

const REPORT_THRESHOLD     = 3;
const HIGH_RISK_THRESHOLD  = 5;
const ISSUE_TYPES          = Object.freeze(['pest', 'drought']);

function _toIso(ts) {
  if (!Number.isFinite(ts)) return new Date().toISOString();
  try { return new Date(ts).toISOString(); }
  catch { return new Date().toISOString(); }
}

function _farmIssueRisk(perFarmRisks, farmId, issueType) {
  if (!perFarmRisks || !farmId) return 'LOW';
  const r = perFarmRisks[farmId];
  if (!r) return 'LOW';
  if (issueType === 'pest')    return String(r.pest    || 'LOW').toUpperCase();
  if (issueType === 'drought') return String(r.drought || 'LOW').toUpperCase();
  return 'LOW';
}

function _centroidOf(items) {
  let lat = 0;
  let lng = 0;
  let n = 0;
  for (const it of items) {
    if (!hasGPS(it)) continue;
    const loc = it.location || it;
    lat += Number(loc.lat != null ? loc.lat : loc.latitude);
    lng += Number(loc.lng != null ? loc.lng : loc.longitude);
    n += 1;
  }
  if (n === 0) return { centerLat: null, centerLng: null };
  return { centerLat: lat / n, centerLng: lng / n };
}

function _humanRegion(parts) {
  const tokens = [parts.country, parts.region, parts.district]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  return tokens.join(' / ') || 'Unknown region';
}

function _severityForCluster({ reportCount, highRiskFarmCount }) {
  if (reportCount >= 5 || highRiskFarmCount >= 8) return 'HIGH';
  if (reportCount >= REPORT_THRESHOLD
      || highRiskFarmCount >= HIGH_RISK_THRESHOLD) return 'MEDIUM';
  return 'LOW';
}

function _recommendedAction(issueType, severity) {
  if (severity === 'HIGH' && issueType === 'pest') {
    return {
      messageKey: 'ngo.actions.pestDeploy',
      fallback:   'Send field agent to inspect high-risk farms',
    };
  }
  if (severity === 'HIGH' && issueType === 'drought') {
    return {
      messageKey: 'ngo.actions.droughtMonitor',
      fallback:   'Monitor drought-risk farms this week',
    };
  }
  if (issueType === 'pest') {
    return {
      messageKey: 'ngo.actions.pestAdvise',
      fallback:   'Advise farmers to check crops today',
    };
  }
  if (issueType === 'drought') {
    return {
      messageKey: 'ngo.actions.droughtOutreach',
      fallback:   'Reach out to farmers about water-saving practices',
    };
  }
  return {
    messageKey: 'ngo.actions.monitor',
    fallback:   'Monitor this region for the next 48 hours.',
  };
}

/**
 * detectClusters({ farms, reports, risks }) → Array<NgoCluster>
 *
 * `risks` may be either:
 *   * a Map / object keyed by farmId mapping to
 *     { pest: 'HIGH'|..., drought: 'HIGH'|... }
 *   * OR omitted — high-risk-farm activation is then disabled
 *     and only the report path produces clusters
 */
export function detectClusters({ farms = [], reports = [], risks = null } = {}) {
  const safeFarms   = Array.isArray(farms)   ? farms.filter(Boolean) : [];
  const safeReports = Array.isArray(reports) ? reports.filter(Boolean) : [];

  // ── 1) Report-driven activation via the existing engine ────
  const reportClusters = _detectReportClusters(safeReports, safeFarms) || [];

  // Map by deterministic id so the high-risk pass can merge in.
  const out = new Map();
  for (const rc of reportClusters) {
    if (!rc) continue;
    const issueType = String(rc.issueType || 'unknown').toLowerCase();
    const country   = rc.country   || '';
    const region    = rc.region    || '';
    const district  = rc.district  || '';
    const crop      = rc.crop      || '';
    const id = `${issueType}|${crop}|${getRegionKey({ country, region, district }) || ''}`;
    const reportCount = Number(rc.reportCount) || 0;
    const center = (rc.centerLat != null && rc.centerLng != null)
      ? { centerLat: rc.centerLat, centerLng: rc.centerLng }
      : _centroidOf(safeReports.filter(
          (r) => String(r.issueType || '').toLowerCase() === issueType
              && String(r.crop || '').toLowerCase() === String(crop).toLowerCase()
              && getRegionKey({ country: r.country, region: r.region, district: r.district })
                 === getRegionKey({ country, region, district }),
        ));
    out.set(id, {
      id,
      crop,
      issueType,
      region:   _humanRegion({ country, region, district }),
      country,  district,
      centerLat: center.centerLat,
      centerLng: center.centerLng,
      reportCount,
      highRiskFarmCount: 0,
      _activatedBy: ['reports'],
      updatedAt: _toIso(rc.updatedAt || Date.now()),
    });
  }

  // ── 2) High-risk-farms activation (NEW) ────────────────────
  // Group farms by (issue, crop, region-key). Count HIGH-risk
  // entries per group via the supplied risks map. When a group
  // exceeds HIGH_RISK_THRESHOLD, either merge into the existing
  // cluster or create a fresh one.
  if (risks && typeof risks === 'object') {
    const buckets = new Map();
    for (const farm of safeFarms) {
      if (!farm) continue;
      const farmId = String(farm.id || farm.farmerId || '');
      if (!farmId) continue;
      for (const issueType of ISSUE_TYPES) {
        const level = _farmIssueRisk(risks, farmId, issueType);
        if (level !== 'HIGH') continue;
        const country  = (farm.country || (farm.location && farm.location.country) || '');
        const region   = (farm.region   || (farm.location && farm.location.region)   || '');
        const district = (farm.district || (farm.location && farm.location.district) || '');
        const crop     = farm.crop || '';
        const id = `${issueType}|${crop}|${getRegionKey({ country, region, district }) || ''}`;
        if (!buckets.has(id)) {
          buckets.set(id, {
            id, issueType, crop, country, region, district,
            farms: [],
          });
        }
        buckets.get(id).farms.push(farm);
      }
    }
    for (const [id, b] of buckets) {
      if (b.farms.length < HIGH_RISK_THRESHOLD) continue;
      const centroid = _centroidOf(b.farms);
      if (out.has(id)) {
        const existing = out.get(id);
        existing.highRiskFarmCount = Math.max(
          existing.highRiskFarmCount, b.farms.length);
        if (existing.centerLat == null && centroid.centerLat != null) {
          existing.centerLat = centroid.centerLat;
          existing.centerLng = centroid.centerLng;
        }
        existing._activatedBy.push('highRiskFarms');
      } else {
        out.set(id, {
          id,
          crop:     b.crop,
          issueType: b.issueType,
          region:   _humanRegion(b),
          country:  b.country,
          district: b.district,
          centerLat: centroid.centerLat,
          centerLng: centroid.centerLng,
          reportCount: 0,
          highRiskFarmCount: b.farms.length,
          _activatedBy: ['highRiskFarms'],
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  // ── 3) Severity + action wording ──────────────────────────
  const list = [];
  for (const cluster of out.values()) {
    const severity = _severityForCluster(cluster);
    const action   = _recommendedAction(cluster.issueType, severity);
    list.push(Object.freeze({
      id:                 cluster.id,
      crop:               cluster.crop,
      issueType:          cluster.issueType,
      region:             cluster.region,
      country:            cluster.country,
      district:           cluster.district,
      centerLat:          cluster.centerLat,
      centerLng:          cluster.centerLng,
      reportCount:        cluster.reportCount,
      highRiskFarmCount:  cluster.highRiskFarmCount,
      severity,
      recommendedAction:  action,
      updatedAt:          cluster.updatedAt,
    }));
  }

  // Sort: HIGH > MEDIUM > LOW; ties by reportCount + highRisk
  // farm count so the most-actionable cluster surfaces first.
  list.sort((a, b) => {
    const sevRank = (s) => (s === 'HIGH' ? 2 : s === 'MEDIUM' ? 1 : 0);
    const r = sevRank(b.severity) - sevRank(a.severity);
    if (r !== 0) return r;
    const aScore = (a.reportCount || 0) + (a.highRiskFarmCount || 0);
    const bScore = (b.reportCount || 0) + (b.highRiskFarmCount || 0);
    return bScore - aScore;
  });

  return list;
}

/**
 * isFarmInCluster(farm, cluster, opts?) — privacy-safe membership
 * check used by the farmer-side alert ("Risk reported near your
 * farm. Check crops today."). Considers a farm to be inside a
 * cluster when:
 *   * same region key (country / region / district), OR
 *   * within `distanceKm` of the cluster centroid (default 30 km)
 *
 * The function never returns the cluster's other farm coords —
 * only a boolean — so the farmer app stays privacy-safe per the
 * brief's § 9 + § 10 rules.
 */
export function isFarmInCluster(farm, cluster, opts = {}) {
  if (!farm || !cluster) return false;
  const sameRegion =
    getRegionKey({
      country: farm.country || (farm.location && farm.location.country),
      region:  farm.region  || (farm.location && farm.location.region),
      district: farm.district || (farm.location && farm.location.district),
    })
    === getRegionKey({
      country: cluster.country, region: cluster.region, district: cluster.district,
    });
  if (sameRegion) return true;
  const maxKm = Number.isFinite(opts.distanceKm) ? opts.distanceKm : 30;
  if (cluster.centerLat == null || cluster.centerLng == null) return false;
  return distanceKm(farm,
    { lat: cluster.centerLat, lng: cluster.centerLng }) < maxKm;
}

// Re-export the underlying engine for callers that need access
// to all clusters (active + inactive) — useful for an admin
// "show everything" view that the live dashboard doesn't surface.
export { _detectAllReportClusters as _detectAllReportClusters };

export const NGO_CLUSTER_THRESHOLDS = Object.freeze({
  REPORT:    REPORT_THRESHOLD,
  HIGH_RISK: HIGH_RISK_THRESHOLD,
});

export default detectClusters;
