/**
 * outbreakEngine.js — unified outbreak detection layer. Builds on
 * the lower-level `clusterDetection.js` primitive to emit rich
 * Cluster rows for admin, officer, and farmer-facing surfaces.
 *
 *   detectOutbreaks({ issues, regionProfiles?, timeWindowDays? })
 *     → { clusters, summary }
 *
 *   getOfficerFocus({ clusters, officer, limit })
 *     → top clusters a named officer should inspect first
 *
 *   getFarmerVisibleAlerts({ clusters, farmer, now, lastSeenMap })
 *     → clusters safe to show a specific farmer — same region +
 *       same crop + level ≥ medium + not dismissed for this cycle
 *
 *   classifyStatus(cluster) — suggested status string when no
 *     human has moved it yet (`monitoring` / `under_review`)
 *
 * Safety contract:
 *   • Hedged language: "possible outbreak", "rising reports".
 *     Never "confirmed". Callers wanting "confirmed_risk" must go
 *     through `clusterStore.confirmCluster()` (human-in-the-loop).
 *   • Farmer visibility strictly gated: same region + same crop +
 *     level >= medium. No crop match → no farmer alert.
 *   • Deterministic — same inputs always produce the same
 *     clusters + ordering.
 */

const DAY_MS = 24 * 3600 * 1000;
const RECENT_HALF_WINDOW_DAYS = 3;

function lower(s) { return String(s || '').toLowerCase(); }

function regionKeyOf(report) {
  if (!report) return 'unknown';
  const country = String(report.countryCode || '').toUpperCase();
  const state   = String(report.stateCode   || report.region || '').toUpperCase();
  if (country && state && state !== '*') return `${country}/${state}`;
  if (state  && state  !== '*') return state;
  if (country) return country;
  return String(report.location || 'unknown').toUpperCase();
}

function asTs(x) {
  if (x == null) return null;
  if (x instanceof Date) return x.getTime();
  const n = Number(x);
  if (Number.isFinite(n)) return n;
  const parsed = Date.parse(String(x));
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── Clustering ──────────────────────────────────────────────────

/**
 * Build a key-stable cluster id so an admin view can correlate the
 * same cluster across refreshes (no random suffixes).
 */
function clusterIdFor({ regionKey, crop, category }) {
  const safe = (s) => String(s || 'unknown').toLowerCase().replace(/\s+/g, '_');
  return `cluster_${safe(regionKey)}_${safe(crop)}_${safe(category)}`;
}

/**
 * Category + confidence of a single report, tolerant of either the
 * legacy `issueType` shape (from createIssue) or the health-triage
 * shape (`triage.predictedCategory`).
 */
function readReportCategory(report) {
  if (!report) return { category: 'unknown', confidence: 'low' };
  const triage = report.triage;
  if (triage && triage.predictedCategory) {
    return {
      category: lower(triage.predictedCategory),
      confidence: lower(triage.confidenceLevel) || 'low',
    };
  }
  // Fall back to issueType when the pre-triage pipeline was used.
  const t = lower(report.issueType);
  const map = {
    pest: 'pest', disease: 'disease',
    soil: 'nutrient_deficiency', input_shortage: 'nutrient_deficiency',
    irrigation: 'water_stress', weather_damage: 'physical_damage',
    access: 'unknown', other: 'unknown',
  };
  return { category: map[t] || 'unknown', confidence: 'low' };
}

function severityFor(count) {
  if (count >= 5) return 'high';
  if (count >= 3) return 'medium';
  return 'low';
}

/**
 * Cluster-level confidence:
 *   • high if ≥75% of reports share the same category AND at least
 *     half carry medium/high individual confidence
 *   • medium when the winning category has a plurality
 *   • low when most reports are `unknown`
 */
function confidenceFor(reports) {
  if (!reports.length) return 'low';
  const tally = new Map();
  let medOrHigh = 0;
  for (const r of reports) {
    const { category, confidence } = readReportCategory(r);
    tally.set(category, (tally.get(category) || 0) + 1);
    if (confidence === 'medium' || confidence === 'high') medOrHigh += 1;
  }
  const top = Math.max(...tally.values());
  const topShare = top / reports.length;
  const medShare = medOrHigh / reports.length;
  const unknownShare = (tally.get('unknown') || 0) / reports.length;
  if (unknownShare > 0.5) return 'low';
  if (topShare >= 0.75 && medShare >= 0.5) return 'high';
  if (topShare >= 0.5) return 'medium';
  return 'low';
}

/**
 * Trend direction using recent 3d vs prior 3d inside the cluster's
 * time window. Stable when neither window has any reports or the
 * delta is within ±1.
 */
function trendDirection(reports, now, windowDays) {
  if (!reports.length) return 'stable';
  const halfMs = RECENT_HALF_WINDOW_DAYS * DAY_MS;
  const recentStart = now - halfMs;
  const priorStart  = now - 2 * halfMs;
  let recent = 0; let prior = 0;
  for (const r of reports) {
    const ts = asTs(r.createdAt) || 0;
    if (ts >= recentStart)                  recent += 1;
    else if (ts >= priorStart && ts < recentStart) prior += 1;
  }
  const delta = recent - prior;
  if (delta > 1)  return 'rising';
  if (delta < -1) return 'declining';
  return 'stable';
}

function collectFarmers(reports) {
  const set = new Set();
  for (const r of reports) {
    const v = r && r.farmerId;
    if (v) set.add(String(v));
  }
  return Array.from(set);
}

// ─── Public: detectOutbreaks ─────────────────────────────────────

/**
 * detectOutbreaks — group reports by (regionKey, crop, category)
 * over the recent window, score severity + confidence + trend, and
 * return the full cluster list plus a summary roll-up for the NGO
 * dashboard.
 */
export function detectOutbreaks({
  issues          = [],
  regionProfiles  = {},             // eslint-disable-line no-unused-vars
  timeWindowDays  = 7,
  mediumThreshold = 3,
  highThreshold   = 5,
  now             = Date.now(),
} = {}) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return Object.freeze({
      clusters: Object.freeze([]),
      summary: Object.freeze({
        activeClusters:       0,
        highSeverityClusters: 0,
        topAffectedCrop:      null,
        topAffectedRegion:    null,
      }),
    });
  }
  const cutoff = now - Math.max(1, timeWindowDays) * DAY_MS;

  // Key → bucket with reports. We keep the raw rows so confidence +
  // trend can inspect them without another pass.
  const buckets = new Map();
  for (const issue of issues) {
    if (!issue) continue;
    const createdAt = asTs(issue.createdAt);
    if (createdAt == null || createdAt < cutoff) continue;
    const regionKey = regionKeyOf(issue);
    const crop      = lower(issue.crop) || 'unknown';
    const { category } = readReportCategory(issue);
    const key = `${regionKey}::${crop}::${category}`;
    const bucket = buckets.get(key) || {
      regionKey, crop, category, reports: [],
    };
    bucket.reports.push(issue);
    buckets.set(key, bucket);
  }

  const clusters = [];
  for (const b of buckets.values()) {
    const count = b.reports.length;
    if (count < mediumThreshold) continue;
    const severity = count >= highThreshold ? 'high' : 'medium';
    const confidence = confidenceFor(b.reports);
    const trend = trendDirection(b.reports, now, timeWindowDays);
    const timestamps = b.reports.map((r) => asTs(r.createdAt) || 0);
    const firstSeenAt  = Math.min(...timestamps);
    const latestSeenAt = Math.max(...timestamps);
    clusters.push(Object.freeze({
      id:              clusterIdFor(b),
      regionKey:       b.regionKey,
      crop:            b.crop,
      predictedCategory: b.category,
      count,
      severity,
      firstSeenAt,
      latestSeenAt,
      confidenceLevel: confidence,
      trend,
      farmerIds:       Object.freeze(collectFarmers(b.reports)),
      issueIds:        Object.freeze(
        b.reports.map((r) => r.id).filter(Boolean).slice(0, 50),
      ),
    }));
  }

  // Summary — sort by severity desc, count desc for deterministic
  // "top" fields.
  clusters.sort((a, b) =>
    (severityRank(b.severity) - severityRank(a.severity))
    || (b.count - a.count)
    || a.regionKey.localeCompare(b.regionKey)
    || a.crop.localeCompare(b.crop));

  const activeClusters       = clusters.length;
  const highSeverityClusters = clusters.filter((c) => c.severity === 'high').length;
  const topAffectedCrop      = clusters[0] ? clusters[0].crop : null;
  const topAffectedRegion    = clusters[0] ? clusters[0].regionKey : null;

  return Object.freeze({
    clusters: Object.freeze(clusters),
    summary: Object.freeze({
      activeClusters, highSeverityClusters,
      topAffectedCrop, topAffectedRegion,
    }),
  });
}

function severityRank(s) {
  return s === 'high' ? 3 : s === 'medium' ? 2 : s === 'low' ? 1 : 0;
}

// ─── Officer focus view ──────────────────────────────────────────

/**
 * getOfficerFocus — rank clusters the given officer should act on
 * first. Matching by region (string includes on regionKey) and
 * optional crop coverage is enough for v1; the server-side officer
 * registry will tighten this when available.
 *
 *   officer: { id, regions: [string], crops: [string] }
 */
export function getOfficerFocus({
  clusters = [],
  officer  = null,
  limit    = 5,
} = {}) {
  if (!officer || !officer.id || !Array.isArray(clusters)) return [];
  const regions = (officer.regions || []).map((x) => String(x).toUpperCase());
  const crops   = (officer.crops   || []).map((x) => String(x).toLowerCase());
  const picks = [];
  for (const c of clusters) {
    const regionMatch = regions.length === 0
      ? false
      : regions.some((r) => c.regionKey.includes(r));
    const cropMatch = crops.length === 0
      ? false
      : crops.includes(c.crop);
    if (!regionMatch && !cropMatch) continue;
    const score = severityRank(c.severity) * 10
                + (regionMatch ? 5 : 0)
                + (cropMatch   ? 3 : 0)
                + Math.min(10, c.count);
    picks.push({ cluster: c, score, regionMatch, cropMatch });
  }
  picks.sort((a, b) => b.score - a.score);
  return picks.slice(0, Math.max(1, Math.min(50, Number(limit) || 5)))
    .map(({ cluster, score, regionMatch, cropMatch }) => Object.freeze({
      ...cluster,
      focusScore: score,
      reason:
        regionMatch && cropMatch ? 'region_and_crop'
      : regionMatch              ? 'region'
      : cropMatch                ? 'crop'
      :                            'fallback',
      recommendedAction:
        cluster.severity === 'high' ? 'inspect_and_escalate_if_worsening'
      : cluster.severity === 'medium' ? 'inspect_and_support_farmers'
      :                                   'verify_spread',
    }));
}

// ─── Farmer-visible alerts ───────────────────────────────────────

/**
 * farmer: { id, region, crop }
 * lastSeenMap: optional { [clusterId]: epoch ms } so the caller can
 *              suppress duplicates within the same cycle.
 *
 * Rules (spec §6, §10):
 *   • Same region key (loose prefix match — UI passes state code)
 *   • Same crop (strict)
 *   • Severity >= medium (no low-level panic)
 *   • No exact diagnosis — hedged copy only
 */
export function getFarmerVisibleAlerts({
  clusters    = [],
  farmer      = null,
  now         = Date.now(),
  lastSeenMap = null,
  cycleMs     = DAY_MS,
} = {}) {
  if (!farmer || !farmer.region || !farmer.crop) return [];
  const farmerRegion = String(farmer.region).toUpperCase();
  const farmerCrop   = lower(farmer.crop);
  const seen = (lastSeenMap && typeof lastSeenMap === 'object') ? lastSeenMap : {};

  const out = [];
  for (const c of clusters) {
    if (c.severity !== 'medium' && c.severity !== 'high') continue;
    if (!c.regionKey.includes(farmerRegion)) continue;
    if (c.crop !== farmerCrop) continue;

    const lastSeen = Number(seen[c.id]) || 0;
    if (lastSeen && (now - lastSeen) < cycleMs) continue;

    const msg = safeFarmerMessageFor(c);
    out.push(Object.freeze({
      clusterId:  c.id,
      category:   c.predictedCategory,
      severity:   c.severity,
      messageKey: msg.key,
      message:    msg.en,
      count:      c.count,
    }));
  }
  return out;
}

const FARMER_MESSAGES = Object.freeze({
  pest:                { key: 'outbreak.farmer.pest',
                         en:  'Pest reports are increasing nearby. Inspect your crop today.' },
  disease:             { key: 'outbreak.farmer.disease',
                         en:  'Possible disease risk in your area. Check affected leaves and report changes.' },
  nutrient_deficiency: { key: 'outbreak.farmer.nutrient',
                         en:  'Nutrient-like symptoms rising nearby. Compare your plants with healthy ones.' },
  water_stress:        { key: 'outbreak.farmer.water',
                         en:  'Water stress rising nearby. Check soil moisture before watering.' },
  physical_damage:     { key: 'outbreak.farmer.physical',
                         en:  'Several farms nearby reported physical damage. Check your crop.' },
  unknown:             { key: 'outbreak.farmer.unknown',
                         en:  'Nearby farms are reporting issues. An officer will follow up.' },
});

function safeFarmerMessageFor(cluster) {
  return FARMER_MESSAGES[cluster.predictedCategory] || FARMER_MESSAGES.unknown;
}

// ─── Classification helper ───────────────────────────────────────

/**
 * classifyStatus — suggested cluster status when no human has
 * touched it yet. `confirmed_risk` is intentionally NOT emittable
 * here — a human must call clusterStore.confirmCluster().
 */
export function classifyStatus(cluster) {
  if (!cluster) return 'monitoring';
  if (cluster.severity === 'high') return 'under_review';
  return 'monitoring';
}

export const _internal = Object.freeze({
  DAY_MS, RECENT_HALF_WINDOW_DAYS,
  regionKeyOf, asTs, clusterIdFor, readReportCategory,
  severityFor, confidenceFor, trendDirection, severityRank,
  FARMER_MESSAGES, safeFarmerMessageFor,
});
