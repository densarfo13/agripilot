/**
 * ngoAggregates.js — top-level NGO summary aggregator.
 *
 *   buildNgoAggregates({ farms, events, perFarmRisks, reports })
 *     -> {
 *          totalFarmers,
 *          activeFarmers7d,
 *          tasksCompleted7d,
 *          highRiskFarms,
 *          pestReports7d,
 *          droughtReports7d,
 *          recommendedActions,   // Array<{messageKey, fallback, severity, kind}>
 *          byRegion,             // Array<RegionRow>
 *          byCrop,               // Array<CropRow>
 *          generatedAt,
 *        }
 *
 * Pure: every number comes from the local stores the caller
 * supplies (events from src/data/eventLogger, farms from
 * src/store/farrowayLocal or the server-provided list, risks
 * from src/outbreak/riskEngine).
 *
 * Why a separate module from src/ngo/insightsEngine.js
 *   insightsEngine emits the per-region NGO insight rows used
 *   by the older richer panel. ngoAggregates is the FLAT
 *   dashboard-level summary the spec calls for — one object,
 *   six headline numbers, plus light region/crop breakdowns
 *   for the table beneath. Both can run side-by-side; this
 *   module is the simpler primitive.
 *
 * Strict-rule audit
 *   * Pure + sync; no I/O
 *   * Never throws on partial input — missing fields collapse
 *     to 0 / [] without crashing
 *   * Honest counts only; no imputed numbers, no projected
 *     impact
 *   * tSafe friendly: recommendedActions carry messageKey +
 *     fallback so callers route through tSafe
 */

import { EVENT_TYPES } from '../data/eventLogger.js';
import { getNGOAction } from './actionRecommendations.js';
import { getRegionKey, hasGPS } from '../location/geoUtils.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function _safeArr(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }

function _ts(e) {
  if (!e) return null;
  if (Number.isFinite(e.timestamp)) return e.timestamp;
  if (Number.isFinite(e.ts)) return e.ts;
  return null;
}

function _inLastDays(e, days) {
  const t = _ts(e);
  if (t == null) return false;
  return t >= (Date.now() - days * DAY_MS);
}

function _farmIdOf(e) {
  if (!e || !e.payload) return null;
  const fid = e.payload.farmId;
  return fid != null ? String(fid) : null;
}

function _highRiskFarmCount(farms, perFarmRisks) {
  if (!perFarmRisks || typeof perFarmRisks !== 'object') return 0;
  let n = 0;
  for (const farm of _safeArr(farms)) {
    const id = String(farm.id || farm.farmerId || '');
    if (!id) continue;
    const r = perFarmRisks[id];
    if (!r) continue;
    if (String(r.pest    || '').toUpperCase() === 'HIGH'
     || String(r.drought || '').toUpperCase() === 'HIGH') {
      n += 1;
    }
  }
  return n;
}

function _byRegion({ farms, events, perFarmRisks, reports }) {
  const buckets = new Map();
  const add = (key, partial) => {
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        country: partial.country || '',
        region:  partial.region  || '',
        district: partial.district || '',
        farmCount:   0,
        activeCount: 0,
        highRisk:    0,
        pestReports: 0,
        droughtReports: 0,
      });
    }
    return buckets.get(key);
  };

  for (const f of _safeArr(farms)) {
    const country  = f.country  || (f.location && f.location.country)  || '';
    const region   = f.region   || (f.location && f.location.region)   || '';
    const district = f.district || (f.location && f.location.district) || '';
    const key = getRegionKey({ country, region, district });
    if (!key) continue;
    const b = add(key, { country, region, district });
    b.farmCount += 1;
    const id = String(f.id || f.farmerId || '');
    const r = (perFarmRisks && id) ? perFarmRisks[id] : null;
    if (r && (String(r.pest || '').toUpperCase() === 'HIGH'
           || String(r.drought || '').toUpperCase() === 'HIGH')) {
      b.highRisk += 1;
    }
  }

  // Active farmers (per region) from the 7-day event slice.
  const farmRegion = new Map();
  for (const f of _safeArr(farms)) {
    const id = String(f.id || f.farmerId || '');
    if (!id) continue;
    const country  = f.country  || (f.location && f.location.country)  || '';
    const region   = f.region   || (f.location && f.location.region)   || '';
    const district = f.district || (f.location && f.location.district) || '';
    const key = getRegionKey({ country, region, district });
    if (key) farmRegion.set(id, key);
  }
  const activeByRegion = new Map();
  for (const e of _safeArr(events)) {
    if (!_inLastDays(e, 7)) continue;
    const fid = _farmIdOf(e);
    if (!fid) continue;
    const key = farmRegion.get(fid);
    if (!key) continue;
    if (!activeByRegion.has(key)) activeByRegion.set(key, new Set());
    activeByRegion.get(key).add(fid);
  }
  for (const [key, set] of activeByRegion) {
    if (buckets.has(key)) buckets.get(key).activeCount = set.size;
  }

  // Reports per region.
  for (const r of _safeArr(reports)) {
    const key = getRegionKey({
      country: r.country, region: r.region, district: r.district,
    });
    if (!key) continue;
    if (!buckets.has(key)) {
      add(key, { country: r.country, region: r.region, district: r.district });
    }
    const kind = String(r.kind || r.issueType || '').toLowerCase();
    if (/pest/.test(kind)) buckets.get(key).pestReports += 1;
    else if (/drought|dry/.test(kind)) buckets.get(key).droughtReports += 1;
  }

  return Array.from(buckets.values())
    .sort((a, b) => (b.highRisk + b.pestReports + b.droughtReports)
                  - (a.highRisk + a.pestReports + a.droughtReports));
}

function _byCrop({ farms, perFarmRisks }) {
  const buckets = new Map();
  for (const f of _safeArr(farms)) {
    const crop = String(f.crop || '').trim().toLowerCase();
    if (!crop) continue;
    if (!buckets.has(crop)) {
      buckets.set(crop, { crop, farmCount: 0, highRisk: 0 });
    }
    const b = buckets.get(crop);
    b.farmCount += 1;
    const id = String(f.id || f.farmerId || '');
    const r = (perFarmRisks && id) ? perFarmRisks[id] : null;
    if (r && (String(r.pest || '').toUpperCase() === 'HIGH'
           || String(r.drought || '').toUpperCase() === 'HIGH')) {
      b.highRisk += 1;
    }
  }
  return Array.from(buckets.values())
    .sort((a, b) => b.farmCount - a.farmCount);
}

function _countActive7d(events) {
  const seen = new Set();
  for (const e of _safeArr(events)) {
    if (!_inLastDays(e, 7)) continue;
    const fid = _farmIdOf(e);
    if (fid) seen.add(fid);
  }
  return seen.size;
}

function _countCompletes7d(events) {
  return _safeArr(events).filter((e) =>
    e.type === EVENT_TYPES.TASK_COMPLETED && _inLastDays(e, 7)
  ).length;
}

function _countReports7d(events, type) {
  return _safeArr(events).filter((e) =>
    e.type === type && _inLastDays(e, 7)
  ).length;
}

/**
 * buildNgoAggregates({ farms, events, perFarmRisks, reports })
 *   -> aggregated summary for the NGO dashboard.
 *
 * Inputs (all optional, defaulted to empty)
 *   farms          Array of farm records
 *   events         Array from getEvents()
 *   perFarmRisks   Map / object keyed by farmId -> { pest, drought }
 *   reports        Array of outbreak reports (from outbreakStore)
 *
 * Each input is filtered + reduced independently so a missing
 * source still produces a usable summary (zeros where the
 * source is empty).
 */
export function buildNgoAggregates({
  farms        = [],
  events       = [],
  perFarmRisks = null,
  reports      = [],
} = {}) {
  const safeFarms   = _safeArr(farms);
  const safeEvents  = _safeArr(events);
  const safeReports = _safeArr(reports);

  const totalFarmers     = safeFarms.length;
  const activeFarmers7d  = _countActive7d(safeEvents);
  const tasksCompleted7d = _countCompletes7d(safeEvents);
  const highRiskFarms    = _highRiskFarmCount(safeFarms, perFarmRisks);

  // Reports counted from BOTH the event log (where reports
  // were captured via PEST_REPORTED / DROUGHT_REPORTED) AND
  // the outbreakStore reports list (legacy + cross-tab) so a
  // farmer who reported via either path is counted once.
  const pestEventCount    = _countReports7d(safeEvents, EVENT_TYPES.PEST_REPORTED);
  const droughtEventCount = _countReports7d(safeEvents, EVENT_TYPES.DROUGHT_REPORTED);
  const reportInLast7 = (r) => {
    const t = Number(r.ts || r.timestamp || 0);
    return Number.isFinite(t) && t >= (Date.now() - 7 * DAY_MS);
  };
  const pestStoreCount = safeReports.filter((r) => {
    if (!reportInLast7(r)) return false;
    return /pest/.test(String(r.kind || r.issueType || '').toLowerCase());
  }).length;
  const droughtStoreCount = safeReports.filter((r) => {
    if (!reportInLast7(r)) return false;
    return /drought|dry/.test(String(r.kind || r.issueType || '').toLowerCase());
  }).length;
  // Take the larger of (events-only, store-only) to avoid
  // double-counting when both paths recorded the same report.
  const pestReports7d    = Math.max(pestEventCount, pestStoreCount);
  const droughtReports7d = Math.max(droughtEventCount, droughtStoreCount);

  // Inactive farms = total - active7d (conservative; a farm
  // may have been provisioned and never used yet, which is
  // legitimately inactive from the NGO's perspective).
  const inactiveFarms = Math.max(0, totalFarmers - activeFarmers7d);

  const recommendedActions = getNGOAction({
    pestHigh:      highRiskFarms,           // approximate; per-domain
    droughtHigh:   highRiskFarms,           // counts available via byRegion
    inactiveFarms,
  });

  const byRegion = _byRegion({ farms: safeFarms, events: safeEvents,
                               perFarmRisks, reports: safeReports });
  const byCrop   = _byCrop({ farms: safeFarms, perFarmRisks });

  return Object.freeze({
    totalFarmers,
    activeFarmers7d,
    tasksCompleted7d,
    highRiskFarms,
    pestReports7d,
    droughtReports7d,
    recommendedActions,
    byRegion,
    byCrop,
    generatedAt: new Date().toISOString(),
  });
}

export default buildNgoAggregates;
