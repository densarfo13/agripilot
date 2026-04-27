/**
 * farmerOutbreakAlerts.js — match a farm against active clusters.
 *
 *   getAlertsForFarm(farm, clusters)
 *     -> Array<Cluster>
 *
 * Rules:
 *   * same country
 *   * region matches the cluster's canonical region OR any region
 *     in cluster.regions[] (populated when the GIS proximity
 *     merge collapses several adjacent regions into one cluster)
 *   * same crop
 *   * cluster.active === true
 *
 * Strict-rule audit:
 *   * pure: no I/O, no global reads
 *   * never throws on missing inputs (returns [])
 *   * stable order: highest-severity first, then most recent
 *   * uses the same regionNormaliser the store + engine use, so
 *     the farm-side comparison stays robust to suffix / casing
 *     drift.
 */

import { normaliseRegion, normaliseCountry } from './regionNormaliser.js';

function _norm(s) {
  if (s == null) return '';
  return String(s).trim().toLowerCase();
}

const SEVERITY_RANK = Object.freeze({ high: 3, medium: 2, low: 1 });

/**
 * getAlertsForFarm(farm, clusters)
 *
 * Returns the subset of `clusters` that should appear as a banner
 * for this farm. Pass already-active clusters from
 * detectActiveClusters() OR pass the full list and we'll filter
 * out the inactive ones here too.
 */
export function getAlertsForFarm(farm, clusters) {
  if (!farm || typeof farm !== 'object') return [];
  if (!Array.isArray(clusters) || clusters.length === 0) return [];

  const country = normaliseCountry(farm.country);
  const region  = normaliseRegion(farm.region || farm.stateCode, country);
  const crop    = _norm(farm.crop || farm.cropType);
  if (!country || !region || !crop) return [];

  const matched = [];
  for (const c of clusters) {
    if (!c || typeof c !== 'object') continue;
    if (c.active === false) continue;
    if (_norm(c.country) !== country) continue;
    if (_norm(c.crop)    !== crop)    continue;
    // Match the cluster's canonical region OR any region in the
    // merged cluster's regions[] (set by the GIS proximity merge).
    const regions = Array.isArray(c.regions) && c.regions.length > 0
      ? c.regions.map((x) => _norm(x))
      : [_norm(c.region)];
    if (!regions.includes(region)) continue;
    matched.push(c);
  }

  matched.sort((a, b) => {
    const r = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
    if (r !== 0) return r;
    return (b.lastReportedAt || 0) - (a.lastReportedAt || 0);
  });
  return matched;
}

export const _internal = Object.freeze({ _norm });
