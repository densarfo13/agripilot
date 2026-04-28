/**
 * ingest/ngoAggregates.js — server-side NGO summary +
 * region table + cluster builder.
 *
 *   buildSummary({ prisma, region })            -> SummaryShape
 *   buildRegionTable({ prisma })                -> RegionRow[]
 *   buildClusters({ prisma })                   -> Cluster[]
 *
 * All three functions take the prisma client as a parameter so
 * the route + tests can inject the same instance / a stub.
 *
 * Strict-rule audit
 *   * Pure read paths — no writes
 *   * Defensive: all groupBy results coerced to numbers; missing
 *     rows produce 0
 *   * Indexed: every WHERE clause matches an index added in
 *     prisma/schema.prisma (created_at, region, risk_level,
 *     type+createdAt composite)
 *   * <300ms target: each function makes at most a small number
 *     of grouped queries; no N+1 fan-outs
 */

const DAY_MS  = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function _since7d() { return new Date(Date.now() - WEEK_MS); }

// ─────────────────────────────────────────────────────────────
// Helpers shared by the three builders
// ─────────────────────────────────────────────────────────────

async function _activeFarmers7d(prisma, regionFilter = null) {
  const where = {
    createdAt: { gte: _since7d() },
    type: { in: ['TASK_COMPLETED', 'TODAY_VIEWED'] },
  };
  // Region filter goes through farms join — when region is
  // supplied we narrow to events whose farmId resolves to a
  // farm in that region.
  if (regionFilter) {
    const farms = await prisma.farmer.findMany({
      where: { region: regionFilter },
      select: { id: true },
    });
    const farmIds = farms.map((f) => f.id);
    if (farmIds.length === 0) return 0;
    where.OR = [
      { farmerId: { in: farmIds } },
      { farmId:   { in: farmIds } },
    ];
  }
  // distinct farmerId via Prisma's groupBy — single roundtrip
  const grouped = await prisma.clientEvent.groupBy({
    by: ['farmerId'],
    where: { ...where, farmerId: { not: null } },
  });
  return grouped.length;
}

async function _tasksCompleted7d(prisma, regionFilter = null) {
  const where = {
    createdAt: { gte: _since7d() },
    type: 'TASK_COMPLETED',
  };
  if (regionFilter) {
    const farms = await prisma.farmer.findMany({
      where: { region: regionFilter },
      select: { id: true },
    });
    where.farmId = { in: farms.map((f) => f.id) };
  }
  return prisma.clientEvent.count({ where });
}

async function _labelReports7d(prisma, label, regionFilter = null) {
  // Postgres jsonb path filter: payload->>'label' = $1.
  // Prisma supports this via the `path` + `equals` shape on
  // a Json column — written via prisma.$queryRaw to keep the
  // index on (type, createdAt) usable.
  const where = {
    createdAt: { gte: _since7d() },
    type: 'LABEL_SUBMITTED',
  };
  if (regionFilter) {
    const farms = await prisma.farmer.findMany({
      where: { region: regionFilter },
      select: { id: true },
    });
    where.farmId = { in: farms.map((f) => f.id) };
  }
  // Pull and filter in JS rather than a JSON-path query — the
  // dataset is small enough at v1, and avoiding a raw SQL path
  // keeps Prisma migrations simple. Future scale-up can add a
  // generated column for payload->>'label'.
  const rows = await prisma.clientEvent.findMany({
    where,
    select: { payload: true },
  });
  let n = 0;
  for (const r of rows) {
    const p = r && r.payload;
    if (p && typeof p === 'object'
        && String(p.label || '').toLowerCase() === label) {
      n += 1;
    }
  }
  return n;
}

async function _highRiskFarms(prisma, regionFilter = null) {
  // Latest risk per (farmId, riskType). Postgres window
  // functions are clean here but Prisma doesn't expose them
  // directly — we approximate with a "rows within 24h with
  // risk_level=HIGH" filter, which matches the rule engine's
  // refresh cadence. Trade-off: a stale HIGH older than 24h
  // doesn't surface; ops can tune via the constant below.
  const since = new Date(Date.now() - 7 * DAY_MS);
  const where = {
    createdAt: { gte: since },
    riskLevel: 'HIGH',
  };
  if (regionFilter) where.region = regionFilter;
  const rows = await prisma.riskSnapshot.groupBy({
    by: ['farmId'],
    where,
  });
  return rows.length;
}

// ─────────────────────────────────────────────────────────────
// Public builders
// ─────────────────────────────────────────────────────────────

/**
 * GET /ngo/summary?region=optional
 *
 * Returns the headline numbers the NGO dashboard renders at
 * the top. Optional `region` filter narrows to one region.
 */
export async function buildSummary({ prisma, region = null } = {}) {
  const totalFarmersWhere = region ? { region } : {};
  const [
    totalFarmers,
    activeFarmers7d,
    tasksCompleted7d,
    pestReports7d,
    droughtReports7d,
    highRiskFarms,
  ] = await Promise.all([
    prisma.farmer.count({ where: totalFarmersWhere }),
    _activeFarmers7d(prisma, region),
    _tasksCompleted7d(prisma, region),
    _labelReports7d(prisma, 'pest', region),
    _labelReports7d(prisma, 'drought', region),
    _highRiskFarms(prisma, region),
  ]);

  // clusters count = a quick aggregate that doesn't pull the
  // full cluster list. We surface only the count here; the
  // dashboard fetches the full list via /ngo/clusters.
  const clusters = await _activeClusterCount({ prisma, region });

  return {
    totalFarmers,
    activeFarmers7d,
    tasksCompleted7d,
    pestReports7d,
    droughtReports7d,
    highRiskFarms,
    clusters,
    serverTime: new Date().toISOString(),
  };
}

async function _activeClusterCount({ prisma, region = null }) {
  // Reuse the cluster builder + count the non-LOW entries.
  const list = await buildClusters({ prisma, region });
  return list.filter((c) => c.severity !== 'LOW').length;
}

/**
 * GET /ngo/regions
 *
 * Returns one row per region in the farms table, with all the
 * farmer-side aggregates joined in. Sorted by (highRisk +
 * pestReports + droughtReports) desc so the most-actionable
 * region surfaces first.
 */
export async function buildRegionTable({ prisma } = {}) {
  // Step 1: per-region farmer counts
  const farmerByRegion = await prisma.farmer.groupBy({
    by: ['region', 'countryCode'],
    _count: { _all: true },
  });

  const rows = new Map();
  for (const r of farmerByRegion) {
    if (!r.region) continue;
    const key = `${r.countryCode || ''}|${r.region}`;
    rows.set(key, {
      region:           r.region,
      country:          r.countryCode || '',
      farmers:          Number(r._count._all) || 0,
      active7d:         0,
      highRisk:         0,
      pestReports7d:    0,
      droughtReports7d: 0,
      recommendedAction: null,
    });
  }

  // Step 2: active farmers per region (last 7d)
  const since = _since7d();
  const activeRows = await prisma.clientEvent.findMany({
    where: {
      createdAt: { gte: since },
      type: { in: ['TASK_COMPLETED', 'TODAY_VIEWED'] },
      farmId: { not: null },
    },
    select: { farmId: true, farmerId: true },
  });
  const farmIdToRegion = new Map();
  if (activeRows.length > 0) {
    const farms = await prisma.farmer.findMany({
      where: { id: { in: [...new Set(activeRows.map((r) => r.farmId))] } },
      select: { id: true, region: true, countryCode: true },
    });
    for (const f of farms) {
      farmIdToRegion.set(f.id, `${f.countryCode || ''}|${f.region || ''}`);
    }
  }
  const activePerRegion = new Map();
  for (const ev of activeRows) {
    const key = farmIdToRegion.get(ev.farmId);
    if (!key) continue;
    if (!activePerRegion.has(key)) activePerRegion.set(key, new Set());
    activePerRegion.get(key).add(ev.farmerId || ev.farmId);
  }
  for (const [key, set] of activePerRegion) {
    if (rows.has(key)) rows.get(key).active7d = set.size;
  }

  // Step 3: pest + drought labels per region (last 7d)
  const labelRows = await prisma.clientEvent.findMany({
    where: {
      createdAt: { gte: since },
      type: 'LABEL_SUBMITTED',
      farmId: { not: null },
    },
    select: { farmId: true, payload: true },
  });
  for (const ev of labelRows) {
    const key = farmIdToRegion.get(ev.farmId);
    if (!key || !rows.has(key)) continue;
    const label = String((ev.payload || {}).label || '').toLowerCase();
    if (label === 'pest')    rows.get(key).pestReports7d += 1;
    if (label === 'drought') rows.get(key).droughtReports7d += 1;
  }

  // Step 4: highRisk per region (last 7d, level=HIGH)
  const riskRows = await prisma.riskSnapshot.groupBy({
    by: ['farmId', 'region'],
    where: {
      createdAt: { gte: since },
      riskLevel: 'HIGH',
    },
  });
  for (const r of riskRows) {
    if (!r.region) continue;
    // Region rows in the farms table live under (country, region)
    // — we don't have country on the snapshot here, so we sum
    // into all matching region keys.
    for (const [key, row] of rows) {
      if (row.region === r.region) row.highRisk += 1;
    }
  }

  // Step 5: per-row recommended action
  for (const row of rows.values()) {
    row.recommendedAction = _pickRegionAction(row);
  }

  return Array.from(rows.values()).sort((a, b) =>
    (b.highRisk + b.pestReports7d + b.droughtReports7d)
    - (a.highRisk + a.pestReports7d + a.droughtReports7d),
  );
}

function _pickRegionAction(row) {
  if (row.pestReports7d >= 3 && row.highRisk >= 5) {
    return {
      messageKey: 'ngo.actions.pestDeploy',
      fallback:   'Send field agent to inspect farms',
    };
  }
  if (row.droughtReports7d >= 3) {
    return {
      messageKey: 'ngo.actions.droughtMonitor',
      fallback:   'Advise irrigation support',
    };
  }
  if (row.highRisk >= 1 || row.pestReports7d >= 1
   || row.droughtReports7d >= 1) {
    return {
      messageKey: 'ngo.actions.monitor',
      fallback:   'Monitor region for the next 48 hours',
    };
  }
  return null;
}

/**
 * GET /ngo/clusters
 *
 * Group LABEL_SUBMITTED (pest|drought) events by (region,
 * issueType) over last 7 days. Cluster rule:
 *   - 3+ reports in 7d -> active
 *   - OR 5+ HIGH-risk farms in same region+issueType
 *
 * Severity:
 *   - 3-4 reports -> MEDIUM
 *   - 5+ reports OR 8+ high-risk farms -> HIGH
 *   - else LOW (returned but flagged)
 */
export async function buildClusters({ prisma, region = null } = {}) {
  const since = _since7d();

  // Pull label events + risk snapshots in parallel.
  const labelWhere = {
    createdAt: { gte: since },
    type: 'LABEL_SUBMITTED',
    farmId: { not: null },
  };
  const [labelRows, riskRows] = await Promise.all([
    prisma.clientEvent.findMany({
      where: labelWhere,
      select: { id: true, farmId: true, payload: true, createdAt: true },
    }),
    prisma.riskSnapshot.findMany({
      where: {
        createdAt: { gte: since },
        riskLevel: 'HIGH',
        ...(region ? { region } : {}),
      },
      select: { farmId: true, riskType: true, region: true,
                country: true, district: true },
    }),
  ]);

  // Resolve farmId -> region for label rows.
  const farmIds = new Set();
  for (const r of labelRows) farmIds.add(r.farmId);
  const farmMeta = farmIds.size > 0
    ? await prisma.farmer.findMany({
        where: { id: { in: [...farmIds] } },
        select: { id: true, region: true, countryCode: true,
                  district: true, primaryCrop: true },
      })
    : [];
  const farmById = new Map();
  for (const f of farmMeta) farmById.set(f.id, f);

  // Build buckets keyed by issueType|region.
  const buckets = new Map();
  function _bucket(key, partial) {
    if (!buckets.has(key)) {
      buckets.set(key, {
        id: key,
        issueType:        partial.issueType,
        region:           partial.region,
        country:          partial.country,
        district:         partial.district,
        crop:             partial.crop || '',
        reportCount:      0,
        highRiskFarmCount: 0,
        centerLat:        null,
        centerLng:        null,
      });
    }
    return buckets.get(key);
  }

  // 1) Reports
  for (const ev of labelRows) {
    const label = String((ev.payload || {}).label || '').toLowerCase();
    if (label !== 'pest' && label !== 'drought') continue;
    const farm = farmById.get(ev.farmId);
    if (!farm) continue;
    if (region && farm.region !== region) continue;
    const key = `${label}|${farm.countryCode || ''}|${farm.region || ''}`;
    const b = _bucket(key, {
      issueType: label,
      region:    farm.region || '',
      country:   farm.countryCode || '',
      district:  farm.district || '',
      crop:      farm.primaryCrop || '',
    });
    b.reportCount += 1;
  }

  // 2) High-risk farms — counted per (riskType, region).
  for (const r of riskRows) {
    const issue = String(r.riskType || '').toLowerCase();
    if (issue !== 'pest' && issue !== 'drought') continue;
    const key = `${issue}|${r.country || ''}|${r.region || ''}`;
    const b = _bucket(key, {
      issueType: issue,
      region:    r.region || '',
      country:   r.country || '',
      district:  r.district || '',
    });
    b.highRiskFarmCount += 1;
  }

  // 3) Severity + recommended action.
  const out = [];
  for (const b of buckets.values()) {
    let severity = 'LOW';
    if (b.reportCount >= 5 || b.highRiskFarmCount >= 8) severity = 'HIGH';
    else if (b.reportCount >= 3 || b.highRiskFarmCount >= 5) severity = 'MEDIUM';

    out.push({
      id:                 b.id,
      region:             b.region,
      country:            b.country,
      district:           b.district,
      issueType:          b.issueType,
      crop:               b.crop,
      reportCount:        b.reportCount,
      highRiskFarmCount:  b.highRiskFarmCount,
      severity,
      centerLat:          b.centerLat,
      centerLng:          b.centerLng,
      recommendedAction:  _pickClusterAction(b.issueType, severity),
    });
  }
  out.sort((a, b) => {
    const rank = (s) => (s === 'HIGH' ? 2 : s === 'MEDIUM' ? 1 : 0);
    const r = rank(b.severity) - rank(a.severity);
    if (r !== 0) return r;
    return (b.reportCount + b.highRiskFarmCount)
         - (a.reportCount + a.highRiskFarmCount);
  });
  return out;
}

function _pickClusterAction(issueType, severity) {
  if (severity === 'HIGH' && issueType === 'pest') {
    return {
      messageKey: 'ngo.actions.pestDeploy',
      fallback:   'Send field agent to inspect farms',
    };
  }
  if (severity === 'HIGH' && issueType === 'drought') {
    return {
      messageKey: 'ngo.actions.droughtMonitor',
      fallback:   'Advise irrigation support',
    };
  }
  if (severity === 'MEDIUM') {
    return {
      messageKey: 'ngo.actions.monitor',
      fallback:   'Monitor region for 48 hours',
    };
  }
  return null;
}

export default { buildSummary, buildRegionTable, buildClusters };
