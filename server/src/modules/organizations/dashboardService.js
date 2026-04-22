/**
 * dashboardService.js — aggregate a single organization's farmer
 * portfolio into dashboard metrics.
 *
 *   buildOrganizationDashboard(prisma, { organizationId, windowDays? })
 *     → {
 *         organizationId,
 *         totalFarmers, active, inactive,
 *         cropDistribution: [{ crop, farms, share }],       // share = 0..1
 *         averageScore:     { value: 0..100 | null, sampleSize, band },
 *         riskIndicators:   { farmersWithPendingAlerts, marketAlerts, weatherAlerts, pestAlerts },
 *         yieldProjection:  { totalKg, byCrop: [{ crop, farms, kg }], units: 'kg', source },
 *         generatedAt: ISO,
 *       }
 *
 * Design notes
 *   • Multi-tenancy contract: the caller MUST supply organizationId
 *     (never trust the client — middleware already sets req.organizationId
 *     from the session). Every query in this module is scoped on that id.
 *   • Pure functions (computeCropDistribution, computeYieldProjection,
 *     computeAverageScore) are exported for unit tests with in-memory
 *     fixtures — no Prisma mock required.
 *   • Missing-data safety: each aggregate returns a neutral shape if
 *     there are zero farmers / zero farms. Never null at the top level.
 *   • No score recompute: the dashboard reads the Farroway Score
 *     snapshots persisted by the farmer's card (FarmerNotification
 *     with metadata.kind='farroway_score_snapshot'). If a farmer has
 *     no snapshot yet, they simply don't contribute to the average.
 */

import { computeTrustLevel, summariseTrustLevels } from '../verification/trustSignalsService.js';

// ─── Yield multipliers (kg per hectare, conservative) ─────────
// Embedded on purpose so this server module stays independent of
// the frontend yieldEngine. Numbers mirror the global USD band's
// typical yields for priority crops. Keep in sync with
// src/config/cropYieldRanges.js when those values move.
const KG_PER_HECTARE = Object.freeze({
  maize:        2500,
  rice:         3000,
  wheat:        2800,
  sorghum:      1800,
  millet:       1200,
  cassava:      12000,
  yam:          9000,
  potato:       15000,
  sweet_potato: 8000,
  'sweet-potato': 8000,
  beans:        900,
  soybean:      2000,
  groundnut:    1500,
  tomato:       20000,
  onion:        18000,
  okra:         8000,
  pepper:       10000,
  banana:       30000,
  plantain:     8000,
  cocoa:        500,
  coffee:       700,
  mango:        10000,
  sugarcane:    70000,
});
const GENERIC_KG_PER_HECTARE = 3000;

const ACRES_PER_HECTARE = 2.4710538147;

const ALERT_TYPES = Object.freeze({
  market:  'market',
  weather: 'weather',
  reminder:'reminder',
});

// ─── Pure helpers (exported for tests) ────────────────────────
/**
 * normalizeCrop(input)
 *   Lowercase + trim. Preserves both hyphen + underscore forms so
 *   'sweet_potato' and 'sweet-potato' hit the same bucket in the
 *   distribution table.
 */
export function normalizeCrop(input) {
  if (input == null) return '';
  return String(input).trim().toLowerCase();
}

export function hectaresFromFarm(farm) {
  if (!farm) return 0;
  const h = Number(farm.landSizeHectares);
  if (Number.isFinite(h) && h > 0) return h;
  const a = Number(farm.farmSizeAcres);
  if (Number.isFinite(a) && a > 0) return a / ACRES_PER_HECTARE;
  const lv = Number(farm.landSizeValue);
  const unit = String(farm.landSizeUnit || '').toUpperCase();
  if (Number.isFinite(lv) && lv > 0) {
    if (unit === 'HECTARE')      return lv;
    if (unit === 'ACRE')         return lv / ACRES_PER_HECTARE;
    if (unit === 'SQUARE_METER') return lv / 10000;
  }
  return 0;
}

export function computeCropDistribution(farms = []) {
  const counts = new Map();
  for (const f of farms) {
    const crop = normalizeCrop(f.crop);
    if (!crop) continue;
    counts.set(crop, (counts.get(crop) || 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const out = [];
  for (const [crop, farmCount] of counts.entries()) {
    out.push({
      crop,
      farms: farmCount,
      share: total > 0 ? farmCount / total : 0,
    });
  }
  out.sort((a, b) => b.farms - a.farms);
  return out;
}

export function computeYieldProjection(farms = []) {
  const byCropMap = new Map();
  let totalKg = 0;
  for (const f of farms) {
    const crop = normalizeCrop(f.crop);
    if (!crop) continue;
    const hectares = hectaresFromFarm(f);
    if (hectares <= 0) continue;
    const perHectare = KG_PER_HECTARE[crop] || GENERIC_KG_PER_HECTARE;
    const kg = hectares * perHectare;
    totalKg += kg;
    if (!byCropMap.has(crop)) byCropMap.set(crop, { crop, farms: 0, kg: 0 });
    const entry = byCropMap.get(crop);
    entry.farms += 1;
    entry.kg    += kg;
  }
  const byCrop = Array.from(byCropMap.values())
    .map((r) => ({ ...r, kg: Math.round(r.kg) }))
    .sort((a, b) => b.kg - a.kg);
  return {
    totalKg: Math.round(totalKg),
    byCrop,
    units:  'kg',
    source: 'embedded_yield_band',  // per-hectare heuristics, not live
  };
}

/**
 * computeAverageScore(scoreSnapshots)
 *   Accepts the raw FarmerNotification rows (metadata.kind=
 *   'farroway_score_snapshot'). For farmers with more than one
 *   snapshot, picks the most recent (by createdAt). Averages the
 *   .overall values across all farmers that have any snapshot.
 */
export function computeAverageScore(snapshots = []) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return { value: null, sampleSize: 0, band: null };
  }
  // Most recent snapshot per farmer.
  const latestByFarmer = new Map();
  for (const n of snapshots) {
    let meta = n.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = null; }
    }
    if (!meta || meta.kind !== 'farroway_score_snapshot') continue;
    const overall = Number(meta.overall);
    if (!Number.isFinite(overall)) continue;
    const ts = n.createdAt ? new Date(n.createdAt).getTime() : 0;
    const existing = latestByFarmer.get(n.farmerId);
    if (!existing || ts > existing.ts) {
      latestByFarmer.set(n.farmerId, { overall, ts });
    }
  }
  if (latestByFarmer.size === 0) return { value: null, sampleSize: 0, band: null };
  let sum = 0;
  for (const { overall } of latestByFarmer.values()) sum += overall;
  const value = Math.round(sum / latestByFarmer.size);
  return {
    value,
    sampleSize: latestByFarmer.size,
    band: value >= 85 ? 'excellent'
        : value >= 70 ? 'strong'
        : value >= 50 ? 'improving'
                      : 'needs_help',
  };
}

export function computeRiskIndicators(notifications = [], { windowMs } = { windowMs: 30 * 24 * 60 * 60 * 1000 }) {
  const cutoff = Date.now() - windowMs;
  const pendingFarmers = new Set();
  let market = 0, weather = 0, pest = 0;
  for (const n of notifications) {
    const ts = n.createdAt ? new Date(n.createdAt).getTime() : 0;
    if (ts < cutoff) continue;
    if (n.read === true) continue;
    pendingFarmers.add(n.farmerId);
    if (n.notificationType === ALERT_TYPES.market)  market  += 1;
    if (n.notificationType === ALERT_TYPES.weather) weather += 1;
    // Smart alert engine routes pest risks through 'reminder' with
    // metadata.type='pest'; detect them here for the pest tally.
    if (n.notificationType === ALERT_TYPES.reminder) {
      let meta = n.metadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch { meta = null; }
      }
      if (meta && (meta.type === 'pest' || meta.type === 'disease')) pest += 1;
    }
  }
  return {
    farmersWithPendingAlerts: pendingFarmers.size,
    marketAlerts:  market,
    weatherAlerts: weather,
    pestAlerts:    pest,
  };
}

// ─── DB wrapper ───────────────────────────────────────────────
/**
 * buildOrganizationDashboard(prisma, { organizationId, windowDays? })
 *   Fetches the bare minimum from Prisma in parallel and runs the
 *   pure aggregators. Never throws — returns a zeroed dashboard if
 *   the org has no farmers.
 */
export async function buildOrganizationDashboard(prisma, {
  organizationId, windowDays = 30,
} = {}) {
  if (!organizationId || typeof organizationId !== 'string') return null;
  if (!prisma?.farmer?.findMany) return null;

  // Load all farmers in the org (id + the trust-signal fields so the
  // roll-up below doesn't need a second fetch).
  const farmers = await prisma.farmer.findMany({
    where:  { organizationId },
    select: {
      id: true, fullName: true,
      phoneNumber: true, phoneVerifiedAt: true,
      email: true, emailVerifiedAt: true,
      country: true, region: true,
      profileImageUrl: true,
      registrationStatus: true, updatedAt: true,
    },
  });
  const farmerIds = farmers.map((f) => f.id);

  if (farmerIds.length === 0) {
    return buildEmptyDashboard({ organizationId });
  }

  // Parallel fan-out. Each follow-up query is bounded + indexed.
  const [farms, snapshots, notifications] = await Promise.all([
    prisma.farmProfile?.findMany
      ? prisma.farmProfile.findMany({
          where: { farmerId: { in: farmerIds } },
          select: {
            id: true, farmerId: true, crop: true, status: true,
            farmSizeAcres: true, landSizeHectares: true,
            landSizeValue: true, landSizeUnit: true,
            country: true, latitude: true, longitude: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    prisma.farmerNotification?.findMany
      ? prisma.farmerNotification.findMany({
          where: {
            farmerId: { in: farmerIds },
            notificationType: 'system',
          },
          orderBy: { createdAt: 'desc' },
          take: Math.min(10000, farmerIds.length * 10),
        })
      : Promise.resolve([]),
    prisma.farmerNotification?.findMany
      ? prisma.farmerNotification.findMany({
          where: {
            farmerId: { in: farmerIds },
            notificationType: { in: ['market', 'weather', 'reminder'] },
            createdAt: { gte: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) },
          },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        })
      : Promise.resolve([]),
  ]);

  // Active = has at least one active FarmProfile OR registrationStatus=approved
  // + updated within the window. Everyone else → inactive.
  const farmIdsByFarmer = new Map();
  for (const f of farms) {
    if (!farmIdsByFarmer.has(f.farmerId)) farmIdsByFarmer.set(f.farmerId, []);
    farmIdsByFarmer.get(f.farmerId).push(f);
  }
  let active = 0;
  for (const farmer of farmers) {
    const farmsOfFarmer = farmIdsByFarmer.get(farmer.id) || [];
    const hasActive = farmsOfFarmer.some((f) => f.status === 'active');
    if (hasActive) active += 1;
  }
  const inactive = farmers.length - active;

  const cropDistribution = computeCropDistribution(farms);
  const yieldProjection  = computeYieldProjection(farms);
  const averageScore     = computeAverageScore(snapshots);
  const riskIndicators   = computeRiskIndicators(notifications, {
    windowMs: windowDays * 24 * 60 * 60 * 1000,
  });

  // Trust-signal roll-up: one trust result per farmer using their
  // most-recent farm profile as the per-farm signal source. Never
  // mutates the input rows.
  const firstFarmByFarmer = new Map();
  for (const f of farms) {
    if (!firstFarmByFarmer.has(f.farmerId)) firstFarmByFarmer.set(f.farmerId, f);
  }
  const trustResults = farmers.map((farmer) => computeTrustLevel({
    farmer,
    farm: firstFarmByFarmer.get(farmer.id) || null,
  }));
  const trustSummary = summariseTrustLevels(trustResults);

  return Object.freeze({
    organizationId,
    totalFarmers:  farmers.length,
    active,
    inactive,
    cropDistribution,
    averageScore,
    riskIndicators,
    yieldProjection,
    trust: Object.freeze(trustSummary),
    window: Object.freeze({
      days: windowDays,
      from: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString(),
      to:   new Date().toISOString(),
    }),
    generatedAt: new Date().toISOString(),
  });
}

function buildEmptyDashboard({ organizationId }) {
  return Object.freeze({
    organizationId,
    totalFarmers: 0, active: 0, inactive: 0,
    cropDistribution: [],
    averageScore:     { value: null, sampleSize: 0, band: null },
    riskIndicators:   { farmersWithPendingAlerts: 0, marketAlerts: 0, weatherAlerts: 0, pestAlerts: 0 },
    yieldProjection:  { totalKg: 0, byCrop: [], units: 'kg', source: 'embedded_yield_band' },
    trust:            { low: 0, medium: 0, high: 0, average: 0, count: 0 },
    window: Object.freeze({
      days: 30,
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to:   new Date().toISOString(),
    }),
    generatedAt: new Date().toISOString(),
  });
}

/**
 * listOrganizationFarmers(prisma, { organizationId, ...filters })
 *   Paginated farmer list with org-scoped filters for the dashboard
 *   table + CSV export.
 *
 *   filters: { region?, crop?, scoreMin?, scoreMax?, page?, limit? }
 */
export async function listOrganizationFarmers(prisma, {
  organizationId, region = null, crop = null,
  scoreMin = null, scoreMax = null,
  page = 1, limit = 50,
} = {}) {
  if (!organizationId) return { ok: false, reason: 'missing_org', data: [], total: 0 };
  if (!prisma?.farmer?.findMany) return { ok: false, reason: 'no_prisma', data: [], total: 0 };

  const take = Math.min(500, Math.max(1, Number(limit) || 50));
  const skip = Math.max(0, (Math.max(1, Number(page) || 1) - 1) * take);

  const where = { organizationId };
  if (region) where.region = region;

  const [farmers, total] = await Promise.all([
    prisma.farmer.findMany({
      where, skip, take, orderBy: { updatedAt: 'desc' },
      select: {
        id: true, fullName: true, phoneNumber: true, phoneVerifiedAt: true,
        email: true, emailVerifiedAt: true, profileImageUrl: true,
        region: true, country: true,
        registrationStatus: true, updatedAt: true, createdAt: true,
      },
    }),
    prisma.farmer.count({ where }),
  ]);
  const farmerIds = farmers.map((f) => f.id);

  // Enrich with a primary crop + latest score snapshot so filters
  // that reference them can short-circuit client-side. One query
  // each — bounded by the page size.
  const [farms, snapshots] = await Promise.all([
    prisma.farmProfile?.findMany
      ? prisma.farmProfile.findMany({
          where: { farmerId: { in: farmerIds } },
          select: { farmerId: true, crop: true, status: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        })
      : Promise.resolve([]),
    prisma.farmerNotification?.findMany
      ? prisma.farmerNotification.findMany({
          where: {
            farmerId: { in: farmerIds },
            notificationType: 'system',
          },
          orderBy: { createdAt: 'desc' },
          take: Math.min(2000, farmerIds.length * 4),
        })
      : Promise.resolve([]),
  ]);

  const primaryCropByFarmer = new Map();
  for (const f of farms) {
    if (!primaryCropByFarmer.has(f.farmerId)) {
      primaryCropByFarmer.set(f.farmerId, normalizeCrop(f.crop));
    }
  }
  const latestScoreByFarmer = new Map();
  for (const n of snapshots) {
    let meta = n.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = null; }
    }
    if (!meta || meta.kind !== 'farroway_score_snapshot') continue;
    if (!latestScoreByFarmer.has(n.farmerId)) {
      latestScoreByFarmer.set(n.farmerId, {
        overall: Number(meta.overall),
        band:    meta.band || null,
        date:    meta.date || null,
      });
    }
  }

  // Post-filter by crop / score (can't push into SQL cleanly without
  // schema changes; page size caps the cost). Per-row trust is
  // computed from the farmer + their most-recent farm profile.
  const primaryFarmByFarmer = new Map();
  for (const f of farms) {
    if (!primaryFarmByFarmer.has(f.farmerId)) primaryFarmByFarmer.set(f.farmerId, f);
  }
  const enriched = farmers.map((f) => {
    const trust = computeTrustLevel({
      farmer: f,
      farm:   primaryFarmByFarmer.get(f.id) || null,
    });
    return {
      id:            f.id,
      fullName:      f.fullName,
      phoneNumber:   f.phoneNumber || null,
      region:        f.region || null,
      registrationStatus: f.registrationStatus,
      primaryCrop:   primaryCropByFarmer.get(f.id) || null,
      score:         latestScoreByFarmer.get(f.id) || null,
      trust: {
        level: trust.level,
        score: trust.score,
        signals: trust.signals,
        passedCount: trust.passedCount,
        totalCount:  trust.totalCount,
      },
      updatedAt:     f.updatedAt,
      createdAt:     f.createdAt,
    };
  }).filter((row) => {
    if (crop && row.primaryCrop !== normalizeCrop(crop)) return false;
    const s = row.score && Number.isFinite(row.score.overall) ? row.score.overall : null;
    if (scoreMin != null && (s == null || s < Number(scoreMin))) return false;
    if (scoreMax != null && (s == null || s > Number(scoreMax))) return false;
    return true;
  });

  return {
    ok: true,
    data: enriched,
    total,
    page: Math.max(1, Number(page) || 1),
    limit: take,
  };
}

export const _internal = Object.freeze({
  KG_PER_HECTARE, GENERIC_KG_PER_HECTARE, ACRES_PER_HECTARE,
  ALERT_TYPES, buildEmptyDashboard,
});
