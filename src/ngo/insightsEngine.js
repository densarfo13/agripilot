/**
 * insightsEngine.js — region-level NGO insights derived from
 * the existing predictor + outbreak + label stores.
 *
 *   computeRegionInsights(farms, risks?)
 *     -> Array<RegionInsight>
 *
 *   computeAllRegionInsights(farms)
 *     -> same as above, but resolves cluster + risk PER farm
 *        internally so callers can pass just the farm roster.
 *
 * Output shape (stable, NGO-readable):
 *   {
 *     region,         // canonical lowercase region key
 *     country,
 *     farms,          // count of farms in this region
 *     pestHigh,       // count of farms at HIGH pest risk
 *     droughtHigh,
 *     pestMedium,     // medium counts surfaced too for trends
 *     droughtMedium,
 *     confidence,     // 'HIGH' | 'MEDIUM' | 'LOW' - explained below
 *     severity,       // 'red' | 'orange' | 'green' - for the
 *                      // map heat / row dot indicator
 *     reportCount,    // outbreak reports inside the cluster window
 *     labelCount,     // farmer-confirmed labels (high+medium) in
 *                      // the region
 *   }
 *
 * Confidence is derived from the volume + consistency of farmer-
 * confirmed labels in the region:
 *   HIGH    >= 10 confirmed labels
 *   MEDIUM  >= 3
 *   LOW     <  3
 *
 * Strict rules respected
 *   * raw model weights / probabilities NEVER appear in the
 *     output - this is the consumer-safe surface
 *   * pure: no I/O beyond the local stores it composes
 *   * never throws on missing inputs
 *   * lightweight: O(farms) + O(reports) + O(labels)
 */

import { detectActiveClusters } from '../outbreak/outbreakClusterEngine.js';
import { getOutbreakReports } from '../outbreak/outbreakStore.js';
import { getAlertsForFarm } from '../outbreak/farmerOutbreakAlerts.js';
import { computeFarmRisks } from '../outbreak/riskEngine.js';
import { normaliseRegion, normaliseCountry } from '../outbreak/regionNormaliser.js';
import { getLabels } from '../data/labels.js';

const HIGH_CONF_THRESHOLD = 10;
const MED_CONF_THRESHOLD  = 3;

const SEVERITY = Object.freeze({
  RED:    'red',
  ORANGE: 'orange',
  GREEN:  'green',
});

function _bucketKey(country, region) {
  return `${country}|${region}`;
}

/**
 * Pick the row colour from the high-risk farm count.
 *   any HIGH cluster of 5+ farms          -> red
 *   any HIGH count >= 1                   -> orange
 *   no HIGH counts                        -> green
 *
 * Tunable threshold below; set to 5 because the spec's
 * actionEngine fires its first recommendation at the same
 * count - we want the row colour and the action to land
 * together.
 */
function _severity(pestHigh, droughtHigh) {
  if ((pestHigh + droughtHigh) >= 5) return SEVERITY.RED;
  if ((pestHigh + droughtHigh) >= 1) return SEVERITY.ORANGE;
  return SEVERITY.GREEN;
}

function _confidence(labelCount) {
  if (labelCount >= HIGH_CONF_THRESHOLD) return 'HIGH';
  if (labelCount >= MED_CONF_THRESHOLD)  return 'MEDIUM';
  return 'LOW';
}

/**
 * Pure variant: caller already has a per-farm risks dictionary
 * (e.g. computed once at the top of the page render).
 *
 *   risks: { [farmId]: { drought, pest, top } }
 */
export function computeRegionInsights(farms, risks = {}) {
  if (!Array.isArray(farms) || farms.length === 0) return [];

  const reports = getOutbreakReports();
  const labels  = getLabels();

  // Pre-aggregate report + label counts per region for the
  // confidence + reportCount columns.
  const reportCount = new Map();
  for (const r of reports) {
    if (!r || !r.location) continue;
    const country = normaliseCountry(r.location.country);
    const region  = normaliseRegion(r.location.region, country);
    if (!country || !region) continue;
    const k = _bucketKey(country, region);
    reportCount.set(k, (reportCount.get(k) || 0) + 1);
  }
  const labelCount = new Map();
  for (const l of labels) {
    if (!l) continue;
    if (l.confidence === 'low') continue;
    const farmId = l.farmId == null ? null : String(l.farmId);
    if (!farmId) continue;
    // We don't have the region directly on the label record; the
    // matching farm in `farms` will project it below.
    labelCount.set(farmId, (labelCount.get(farmId) || 0) + 1);
  }

  const buckets = new Map();
  let regionLabelCounts = new Map();

  for (const farm of farms) {
    if (!farm || typeof farm !== 'object') continue;
    const country = normaliseCountry(farm.country);
    const region  = normaliseRegion(farm.region || farm.stateCode, country);
    if (!country || !region) continue;

    const key = _bucketKey(country, region);
    if (!buckets.has(key)) {
      buckets.set(key, {
        country, region,
        farms: 0,
        pestHigh: 0, droughtHigh: 0,
        pestMedium: 0, droughtMedium: 0,
      });
    }
    const b = buckets.get(key);
    b.farms += 1;

    const farmId = farm.id != null ? String(farm.id) : null;
    const r = farmId ? risks[farmId] : null;
    if (r && r.pest === 'HIGH')      b.pestHigh    += 1;
    if (r && r.pest === 'MEDIUM')    b.pestMedium  += 1;
    if (r && r.drought === 'HIGH')   b.droughtHigh += 1;
    if (r && r.drought === 'MEDIUM') b.droughtMedium += 1;

    // Label tally per region: sum the per-farm label counts the
    // farm contributes.
    if (farmId && labelCount.has(farmId)) {
      regionLabelCounts.set(key, (regionLabelCounts.get(key) || 0) + labelCount.get(farmId));
    }
  }

  const rows = [];
  for (const b of buckets.values()) {
    const key  = _bucketKey(b.country, b.region);
    const lbl  = regionLabelCounts.get(key) || 0;
    const rep  = reportCount.get(key)       || 0;
    rows.push(Object.freeze({
      region:        b.region,
      country:       b.country,
      farms:         b.farms,
      pestHigh:      b.pestHigh,
      droughtHigh:   b.droughtHigh,
      pestMedium:    b.pestMedium,
      droughtMedium: b.droughtMedium,
      confidence:    _confidence(lbl),
      severity:      _severity(b.pestHigh, b.droughtHigh),
      reportCount:   rep,
      labelCount:    lbl,
    }));
  }

  // Sort: red first, then orange, then green; within each
  // colour, by combined HIGH count desc, then region asc.
  const colourRank = { red: 3, orange: 2, green: 1 };
  rows.sort((a, b) => {
    const r = (colourRank[b.severity] || 0) - (colourRank[a.severity] || 0);
    if (r !== 0) return r;
    const cnt = (b.pestHigh + b.droughtHigh) - (a.pestHigh + a.droughtHigh);
    if (cnt !== 0) return cnt;
    return a.region.localeCompare(b.region);
  });

  return rows;
}

/**
 * Convenience: when callers don't already have per-farm risks
 * computed (most NGO surfaces), we run the full chain here once
 * per render.
 */
export function computeAllRegionInsights(farms) {
  if (!Array.isArray(farms) || farms.length === 0) return [];
  const reports  = getOutbreakReports();
  const clusters = detectActiveClusters(reports, farms);

  const risks = {};
  for (const farm of farms) {
    if (!farm || typeof farm !== 'object') continue;
    const id = farm.id != null ? String(farm.id) : null;
    if (!id) continue;
    const matched = getAlertsForFarm(farm, clusters);
    const cluster = matched && matched.length ? matched[0] : null;
    risks[id] = computeFarmRisks(farm, cluster);
  }
  return computeRegionInsights(farms, risks);
}

export const SEVERITY_LEVELS = SEVERITY;
export const _internal = Object.freeze({
  HIGH_CONF_THRESHOLD, MED_CONF_THRESHOLD,
  _severity, _confidence,
});
