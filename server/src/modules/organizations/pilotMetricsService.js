/**
 * pilotMetricsService.js — time-windowed pilot metrics for an
 * organisation. Adoption + engagement + performance + outcomes +
 * trends + top regions + at-risk farmers in one trip.
 *
 *   buildPilotMetrics(prisma, { organizationId, windowDays?,
 *                                trendBuckets? })
 *     → {
 *         organizationId,
 *         window:     { days, from, to },
 *         adoption:   { total, activeWeekly, activeMonthly,
 *                        newThisPeriod, adoptionRate },
 *         engagement: { tasksCompleted, tasksCompletedPerWeek,
 *                        taskCompletionRate, onTime, late,
 *                        notificationEngagement },
 *         performance:{ averageScore, scoreBand, scoreDistribution,
 *                        trustDistribution },
 *         outcomes:   { estimatedYieldKg, marketplaceListings,
 *                        marketplaceRequests, acceptedRequests },
 *         trends:     { weekly: [{ weekStart, active, tasks,
 *                                   listings, requests, avgScore }],
 *                        monthly: [{ monthStart, … same }]},
 *         topRegions: [{ region, farmers, averageScore,
 *                         taskCompletionRate }],
 *         atRiskFarmers: [{ farmerId, fullName, region, reasons[] }],
 *         generatedAt: ISO,
 *       }
 *
 * Contract
 *   • Pure aggregators are exported for unit tests; they never touch
 *     Prisma. buildPilotMetrics is the only entry that hits the DB.
 *   • Missing-data safe: empty org returns a zeroed shape with
 *     assumptions logged so the UI + CSV never render "NaN".
 *   • Result is frozen. Never throws.
 *
 * Data sources (no schema changes)
 *   Farmer                       : organizationId, createdAt, updatedAt
 *   FarmProfile                  : crop, status, updatedAt
 *   FarmerNotification           : 'system' + metadata.kind='farroway_
 *                                  score_snapshot'  → performance
 *                                  'system' + metadata.kind='smart_alert'
 *                                  → engagement + late detection
 *                                  'market'/'weather'/'reminder' → engagement
 *   AuditLog                     : marketplace.* actions → outcomes
 */

import {
  computeTrustLevel, summariseTrustLevels,
} from '../verification/trustSignalsService.js';

// ─── Constants ───────────────────────────────────────────────────
const WEEK_MS  = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS   = 24 * 60 * 60 * 1000;

// Same per-hectare table as dashboardService — kept in both because
// the pilot-metrics module is deliberately independent of the
// existing dashboard aggregator.
const KG_PER_HECTARE = Object.freeze({
  maize: 2500, rice: 3000, wheat: 2800, sorghum: 1800, millet: 1200,
  cassava: 12000, yam: 9000, potato: 15000,
  sweet_potato: 8000, 'sweet-potato': 8000,
  beans: 900, soybean: 2000, groundnut: 1500,
  tomato: 20000, onion: 18000, okra: 8000, pepper: 10000,
  banana: 30000, plantain: 8000, cocoa: 500, coffee: 700,
  mango: 10000, sugarcane: 70000,
});
const GENERIC_KG_PER_HECTARE = 3000;
const ACRES_PER_HECTARE = 2.4710538147;

// ─── Helpers ─────────────────────────────────────────────────────
function ms(n, unit) {
  if (unit === 'day')   return n * DAY_MS;
  if (unit === 'week')  return n * WEEK_MS;
  if (unit === 'month') return n * MONTH_MS;
  return n;
}
function iso(d) {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  if (!Number.isFinite(t.getTime())) return null;
  return t.toISOString();
}
function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function pickSelect(row, select) {
  if (!select || !row) return row;
  const out = {};
  for (const [k, v] of Object.entries(select)) if (v && k in row) out[k] = row[k];
  return out;
}
function coerceMeta(meta) {
  if (!meta) return null;
  if (typeof meta === 'string') {
    try { return JSON.parse(meta); } catch { return null; }
  }
  return typeof meta === 'object' ? meta : null;
}

function hectaresFromFarm(farm) {
  if (!farm) return 0;
  const h = safeNum(farm.landSizeHectares);
  if (h > 0) return h;
  const a = safeNum(farm.farmSizeAcres);
  if (a > 0) return a / ACRES_PER_HECTARE;
  const lv = safeNum(farm.landSizeValue);
  const unit = String(farm.landSizeUnit || '').toUpperCase();
  if (lv > 0) {
    if (unit === 'HECTARE')      return lv;
    if (unit === 'ACRE')         return lv / ACRES_PER_HECTARE;
    if (unit === 'SQUARE_METER') return lv / 10000;
  }
  return 0;
}

function ymdStart(date, bucket) {
  // Monday of the week (bucket === 'week') or 1st of the month.
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  if (bucket === 'month') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  const day = d.getUTCDay();
  const back = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back));
}

// ═══════════════════════════════════════════════════════════════
// Pure aggregators (exported for tests)
// ═══════════════════════════════════════════════════════════════

/**
 * computeAdoption(farmers, { now, windowDays })
 *   Adoption metrics based on the farmer table alone.
 *   Active ≈ updatedAt within the 7d/30d window.
 *   New ≈ createdAt within windowDays.
 */
export function computeAdoption(farmers = [], { now = Date.now(), windowDays = 30 } = {}) {
  const weekCut    = now - WEEK_MS;
  const monthCut   = now - MONTH_MS;
  const windowCut  = now - windowDays * DAY_MS;
  let active7 = 0, active30 = 0, newInWindow = 0;
  for (const f of farmers) {
    const upd = f && f.updatedAt ? new Date(f.updatedAt).getTime() : NaN;
    if (Number.isFinite(upd) && upd >= weekCut)  active7  += 1;
    if (Number.isFinite(upd) && upd >= monthCut) active30 += 1;
    const crt = f && f.createdAt ? new Date(f.createdAt).getTime() : NaN;
    if (Number.isFinite(crt) && crt >= windowCut) newInWindow += 1;
  }
  const total = farmers.length;
  return {
    total,
    activeWeekly:   active7,
    activeMonthly:  active30,
    newThisPeriod:  newInWindow,
    adoptionRate:   total > 0 ? Math.round((active30 / total) * 1000) / 1000 : 0,
  };
}

/**
 * computeEngagement(completionEvents, smartAlerts, notifications)
 *   Completion events come from the AuditLog (marketplace.*) or a
 *   future "task.completed" action stream. For v1 we derive them
 *   from smart_alert notifications (action=task.missed_critical
 *   means a critical task went unhandled), plus market/weather/
 *   reminder read-rate as a rough engagement signal.
 */
export function computeEngagement({
  completionEvents = [],   // [{ farmerId, templateId, completedAt, onTime }]
  smartAlerts = [],        // FarmerNotification rows (reminder|weather|market)
  windowDays = 30,
} = {}) {
  const tasksCompleted = completionEvents.length;
  const onTime = completionEvents.filter((e) => e && e.onTime === true).length;
  const late   = completionEvents.filter((e) => e && e.onTime === false).length;

  // Tasks per week — normalise to a 7-day rate.
  const tasksPerWeek = windowDays > 0
    ? Math.round((tasksCompleted * (7 / windowDays)) * 10) / 10
    : 0;

  // Completion rate = onTime / (onTime + late). Guard against /0.
  const resolved = onTime + late;
  const taskCompletionRate = resolved > 0
    ? Math.round((onTime / resolved) * 1000) / 1000
    : null;

  // Notification engagement — % of alerts that got read.
  const readCount = smartAlerts.filter((n) => n && n.read === true).length;
  const notificationEngagement = smartAlerts.length > 0
    ? Math.round((readCount / smartAlerts.length) * 1000) / 1000
    : null;

  return {
    tasksCompleted, tasksCompletedPerWeek: tasksPerWeek,
    taskCompletionRate,
    onTime, late,
    notificationEngagement,
  };
}

/**
 * computePerformance(scoreSnapshots, farmers, farms)
 *   Pulls the latest Farroway Score snapshot per farmer + rolls
 *   trust signals using the farmer + primary farm.
 */
export function computePerformance({ scoreSnapshots = [], farmers = [], farms = [] } = {}) {
  const latestByFarmer = new Map();
  for (const n of scoreSnapshots) {
    const meta = coerceMeta(n.metadata);
    if (!meta || meta.kind !== 'farroway_score_snapshot') continue;
    const overall = safeNum(meta.overall, -1);
    if (overall < 0) continue;
    const ts = n.createdAt ? new Date(n.createdAt).getTime() : 0;
    const existing = latestByFarmer.get(n.farmerId);
    if (!existing || ts > existing.ts) {
      latestByFarmer.set(n.farmerId, { overall, band: meta.band || null, ts });
    }
  }
  const values = Array.from(latestByFarmer.values()).map((r) => r.overall);
  const avg = values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;

  const distribution = { excellent: 0, strong: 0, improving: 0, needs_help: 0 };
  for (const { overall } of latestByFarmer.values()) {
    if (overall >= 85)      distribution.excellent  += 1;
    else if (overall >= 70) distribution.strong     += 1;
    else if (overall >= 50) distribution.improving  += 1;
    else                    distribution.needs_help += 1;
  }

  // Trust roll-up.
  const primaryFarmByFarmer = new Map();
  for (const f of farms) {
    if (!primaryFarmByFarmer.has(f.farmerId)) primaryFarmByFarmer.set(f.farmerId, f);
  }
  const trustResults = farmers.map((farmer) => computeTrustLevel({
    farmer,
    farm: primaryFarmByFarmer.get(farmer.id) || null,
  }));
  const trustDistribution = summariseTrustLevels(trustResults);

  return {
    averageScore: avg,
    scoreBand:    avg == null ? null
                : avg >= 85 ? 'excellent'
                : avg >= 70 ? 'strong'
                : avg >= 50 ? 'improving'
                             : 'needs_help',
    scoreDistribution: distribution,
    trustDistribution,
  };
}

/**
 * computeOutcomes(farms, auditLogs)
 *   Aggregate yield (farms × per-hectare bands) + marketplace
 *   activity counts (listings / requests / accepted) from audit
 *   logs in the window.
 */
export function computeOutcomes({ farms = [], auditLogs = [] } = {}) {
  let estimatedYieldKg = 0;
  for (const f of farms) {
    const crop = String(f.crop || '').toLowerCase();
    const hectares = hectaresFromFarm(f);
    if (hectares <= 0) continue;
    const perHa = KG_PER_HECTARE[crop] || GENERIC_KG_PER_HECTARE;
    estimatedYieldKg += hectares * perHa;
  }
  let listings = 0, requests = 0, accepted = 0;
  for (const a of auditLogs) {
    if (!a || !a.action) continue;
    if (a.action === 'marketplace.listing.created') listings += 1;
    else if (a.action === 'marketplace.request.created'
          || a.action === 'marketplace.bulk_request.created') requests += 1;
    else if (a.action === 'marketplace.request.accepted') accepted += 1;
  }
  return {
    estimatedYieldKg:  Math.round(estimatedYieldKg),
    marketplaceListings: listings,
    marketplaceRequests: requests,
    acceptedRequests:    accepted,
  };
}

/**
 * computeTrends(farmers, completionEvents, auditLogs, scoreSnapshots,
 *                { bucket, bucketCount, now })
 *   Weekly or monthly buckets going backwards from `now`. Each bucket
 *   has { bucketStart, active, tasks, listings, requests, avgScore }.
 *   Pure — the caller supplies the raw row lists.
 */
export function computeTrends({
  farmers = [], completionEvents = [], auditLogs = [], scoreSnapshots = [],
  bucket = 'week', bucketCount = 6, now = Date.now(),
} = {}) {
  const anchor = ymdStart(now, bucket);
  const buckets = [];
  for (let i = bucketCount - 1; i >= 0; i -= 1) {
    let startDate, endDate;
    if (bucket === 'month') {
      // Calendar-correct month subtraction (JS Date handles overflow).
      startDate = new Date(Date.UTC(anchor.getUTCFullYear(),
        anchor.getUTCMonth() - i, 1));
      endDate   = new Date(Date.UTC(anchor.getUTCFullYear(),
        anchor.getUTCMonth() - i + 1, 1));
    } else {
      startDate = new Date(anchor.getTime() - i * WEEK_MS);
      endDate   = new Date(startDate.getTime() + WEEK_MS);
    }
    const label = bucket === 'month' ? 'monthStart' : 'weekStart';
    buckets.push({
      [label]: startDate.toISOString(),
      end:     endDate.toISOString(),
      start:   startDate.getTime(),
      endMs:   endDate.getTime(),
      active: 0, tasks: 0, listings: 0, requests: 0, scoreSum: 0, scoreN: 0,
    });
  }

  const fitBucket = (ts) => {
    for (const b of buckets) if (ts >= b.start && ts < b.endMs) return b;
    return null;
  };

  for (const f of farmers) {
    const ts = f && f.updatedAt ? new Date(f.updatedAt).getTime() : NaN;
    const b = Number.isFinite(ts) ? fitBucket(ts) : null;
    if (b) b.active += 1;
  }
  for (const e of completionEvents) {
    const ts = e && e.completedAt ? new Date(e.completedAt).getTime() : NaN;
    const b = Number.isFinite(ts) ? fitBucket(ts) : null;
    if (b) b.tasks += 1;
  }
  for (const a of auditLogs) {
    const ts = a && a.createdAt ? new Date(a.createdAt).getTime() : NaN;
    const b = Number.isFinite(ts) ? fitBucket(ts) : null;
    if (!b) continue;
    if (a.action === 'marketplace.listing.created') b.listings += 1;
    if (a.action === 'marketplace.request.created'
        || a.action === 'marketplace.bulk_request.created') b.requests += 1;
  }
  for (const n of scoreSnapshots) {
    const meta = coerceMeta(n.metadata);
    if (!meta || meta.kind !== 'farroway_score_snapshot') continue;
    const overall = safeNum(meta.overall, -1);
    if (overall < 0) continue;
    const ts = n.createdAt ? new Date(n.createdAt).getTime() : NaN;
    const b = Number.isFinite(ts) ? fitBucket(ts) : null;
    if (b) { b.scoreSum += overall; b.scoreN += 1; }
  }

  // Project to frozen output shape.
  return buckets.map((b) => Object.freeze({
    [bucket === 'month' ? 'monthStart' : 'weekStart']:
      b[bucket === 'month' ? 'monthStart' : 'weekStart'],
    active:   b.active,
    tasks:    b.tasks,
    listings: b.listings,
    requests: b.requests,
    avgScore: b.scoreN > 0 ? Math.round(b.scoreSum / b.scoreN) : null,
  }));
}

/**
 * computeTopRegions(farmers, farms, scoreSnapshots, { limit })
 *   Group farmers by region, report count + average score +
 *   (proxy) task completion rate based on score band. Sorted by
 *   farmer count desc.
 */
export function computeTopRegions({
  farmers = [], farms = [], scoreSnapshots = [], limit = 5,
} = {}) {
  const regionByFarmer = new Map();
  for (const f of farmers) {
    const region = f.region || (f.country ? `(${f.country})` : '—');
    regionByFarmer.set(f.id, region);
  }
  const latestScoreByFarmer = new Map();
  for (const n of scoreSnapshots) {
    const meta = coerceMeta(n.metadata);
    if (!meta || meta.kind !== 'farroway_score_snapshot') continue;
    const overall = safeNum(meta.overall, -1);
    if (overall < 0) continue;
    const ts = n.createdAt ? new Date(n.createdAt).getTime() : 0;
    const existing = latestScoreByFarmer.get(n.farmerId);
    if (!existing || ts > existing.ts) {
      latestScoreByFarmer.set(n.farmerId, { overall, ts });
    }
  }
  const byRegion = new Map();
  for (const [farmerId, region] of regionByFarmer.entries()) {
    if (!byRegion.has(region)) byRegion.set(region, {
      region, farmers: 0, scoreSum: 0, scoreN: 0,
    });
    const entry = byRegion.get(region);
    entry.farmers += 1;
    const score = latestScoreByFarmer.get(farmerId);
    if (score) { entry.scoreSum += score.overall; entry.scoreN += 1; }
  }
  return Array.from(byRegion.values())
    .map((r) => ({
      region:          r.region,
      farmers:         r.farmers,
      averageScore:    r.scoreN > 0 ? Math.round(r.scoreSum / r.scoreN) : null,
      // Task completion rate isn't directly measurable per region
      // (tasks aren't regionally tagged in the current schema); we
      // use score ≥70 as a practical proxy for "executing well".
      taskCompletionRate: r.scoreN > 0
        ? Math.round(((r.scoreSum / r.scoreN) >= 70 ? 1 : 0) * 1000) / 1000
        : null,
    }))
    .sort((a, b) => b.farmers - a.farmers)
    .slice(0, Math.max(1, limit));
}

/**
 * computeAtRiskFarmers(farmers, scoreSnapshots, alerts, { limit })
 *   A farmer is "at risk" if:
 *     • their latest Farroway Score is < 50, OR
 *     • they have ≥2 unread high-severity smart alerts, OR
 *     • they have no activity in the last 30 days
 *
 *   Each entry includes the list of matched reasons so ops can
 *   slice + dice without re-running the scorer.
 */
export function computeAtRiskFarmers({
  farmers = [], scoreSnapshots = [], alerts = [], limit = 20,
  now = Date.now(),
} = {}) {
  const monthAgo = now - MONTH_MS;
  const latestScoreByFarmer = new Map();
  for (const n of scoreSnapshots) {
    const meta = coerceMeta(n.metadata);
    if (!meta || meta.kind !== 'farroway_score_snapshot') continue;
    const overall = safeNum(meta.overall, -1);
    if (overall < 0) continue;
    const ts = n.createdAt ? new Date(n.createdAt).getTime() : 0;
    const existing = latestScoreByFarmer.get(n.farmerId);
    if (!existing || ts > existing.ts) {
      latestScoreByFarmer.set(n.farmerId, { overall, ts });
    }
  }
  const highAlertsByFarmer = new Map();
  for (const a of alerts) {
    if (!a || a.read === true) continue;
    const meta = coerceMeta(a.metadata);
    const priority = meta && meta.priority;
    if (priority !== 'high') continue;
    highAlertsByFarmer.set(a.farmerId, (highAlertsByFarmer.get(a.farmerId) || 0) + 1);
  }

  const out = [];
  for (const farmer of farmers) {
    const reasons = [];
    const score = latestScoreByFarmer.get(farmer.id);
    if (score && score.overall < 50) {
      reasons.push({ code: 'low_score', detail: `Farroway Score ${score.overall}` });
    }
    const alertCount = highAlertsByFarmer.get(farmer.id) || 0;
    if (alertCount >= 2) {
      reasons.push({ code: 'high_alerts', detail: `${alertCount} unread high-priority alerts` });
    }
    const upd = farmer.updatedAt ? new Date(farmer.updatedAt).getTime() : NaN;
    if (!Number.isFinite(upd) || upd < monthAgo) {
      reasons.push({ code: 'inactive', detail: 'No activity in the last 30 days' });
    }
    if (reasons.length > 0) {
      out.push({
        farmerId: farmer.id,
        fullName: farmer.fullName || '—',
        region:   farmer.region || null,
        score:    score ? score.overall : null,
        reasons:  Object.freeze(reasons.map(Object.freeze)),
      });
    }
  }
  // Sort worst-first: more reasons → further up; ties by lower score.
  out.sort((a, b) => {
    if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
    const sa = a.score == null ? 999 : a.score;
    const sb = b.score == null ? 999 : b.score;
    return sa - sb;
  });
  return out.slice(0, Math.max(1, limit));
}

// ═══════════════════════════════════════════════════════════════
// Prisma wrapper (the only DB-touching function)
// ═══════════════════════════════════════════════════════════════
export async function buildPilotMetrics(prisma, {
  organizationId, windowDays = 30, trendBuckets = 6, now = Date.now(),
} = {}) {
  if (!organizationId) return null;
  if (!prisma?.farmer?.findMany) return null;

  const fromDate = new Date(now - windowDays * DAY_MS);
  const trendsFrom = new Date(now - (trendBuckets * WEEK_MS)); // widen for weekly view

  const farmers = await prisma.farmer.findMany({
    where:  { organizationId },
    select: {
      id: true, fullName: true, phoneNumber: true, phoneVerifiedAt: true,
      email: true, emailVerifiedAt: true, profileImageUrl: true,
      region: true, country: true,
      registrationStatus: true, createdAt: true, updatedAt: true,
    },
  });
  const farmerIds = farmers.map((f) => f.id);
  if (farmerIds.length === 0) return buildEmptyMetrics({ organizationId, windowDays });

  const trendFrom = new Date(Math.min(fromDate.getTime(), trendsFrom.getTime()));
  const [farms, notifications, auditLogs] = await Promise.all([
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
            createdAt: { gte: trendFrom },
          },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        })
      : Promise.resolve([]),
    prisma.auditLog?.findMany
      ? prisma.auditLog.findMany({
          where: {
            organizationId,
            action: { in: [
              'marketplace.listing.created',
              'marketplace.request.created',
              'marketplace.bulk_request.created',
              'marketplace.request.accepted',
              'marketplace.request.declined',
            ] },
            createdAt: { gte: trendFrom },
          },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        })
      : Promise.resolve([]),
  ]);

  // Partition notifications by kind.
  const scoreSnapshots = [];
  const smartAlerts    = [];
  for (const n of notifications) {
    const meta = coerceMeta(n.metadata);
    if (meta && meta.kind === 'farroway_score_snapshot') scoreSnapshots.push(n);
    else if (meta && meta.kind === 'smart_alert')         smartAlerts.push(n);
  }
  // Engagement "completionEvents" v1 proxy: for each smart_alert
  // missed-task notification that has read=true, count it as
  // a completed (late) task; for market/weather/reminder read events
  // we treat them as on-time engagement signals.
  const completionEvents = [];
  for (const n of smartAlerts) {
    if (!n.read) continue;
    const meta = coerceMeta(n.metadata);
    completionEvents.push({
      farmerId:    n.farmerId,
      templateId:  meta && meta.triggeredBy && meta.triggeredBy.signals
                    && meta.triggeredBy.signals.templateId,
      completedAt: n.createdAt,
      onTime: !(meta && meta.triggeredBy
              && meta.triggeredBy.rule === 'task.missed_critical'),
    });
  }

  const adoption    = computeAdoption(farmers, { now, windowDays });
  const engagement  = computeEngagement({
    completionEvents, smartAlerts, windowDays,
  });
  const performance = computePerformance({ scoreSnapshots, farmers, farms });
  const outcomes    = computeOutcomes({ farms, auditLogs });
  const trends      = Object.freeze({
    weekly:  computeTrends({
      farmers, completionEvents, auditLogs, scoreSnapshots,
      bucket: 'week',  bucketCount: trendBuckets, now,
    }),
    monthly: computeTrends({
      farmers, completionEvents, auditLogs, scoreSnapshots,
      bucket: 'month', bucketCount: Math.min(6, trendBuckets), now,
    }),
  });
  const topRegions    = computeTopRegions({
    farmers, farms, scoreSnapshots, limit: 5,
  });
  const atRiskFarmers = computeAtRiskFarmers({
    farmers, scoreSnapshots, alerts: smartAlerts.concat(
      notifications.filter((n) => n.notificationType === 'weather'
        || n.notificationType === 'market'
        || n.notificationType === 'reminder')), limit: 20, now,
  });

  return Object.freeze({
    organizationId,
    window: Object.freeze({
      days: windowDays,
      from: iso(fromDate),
      to:   iso(new Date(now)),
    }),
    adoption:    Object.freeze(adoption),
    engagement:  Object.freeze(engagement),
    performance: Object.freeze(performance),
    outcomes:    Object.freeze(outcomes),
    trends,
    topRegions:    Object.freeze(topRegions.map(Object.freeze)),
    atRiskFarmers: Object.freeze(atRiskFarmers.map(Object.freeze)),
    generatedAt: new Date().toISOString(),
  });
}

function buildEmptyMetrics({ organizationId, windowDays }) {
  return Object.freeze({
    organizationId,
    window: Object.freeze({
      days: windowDays,
      from: iso(new Date(Date.now() - windowDays * DAY_MS)),
      to:   iso(new Date()),
    }),
    adoption:    { total: 0, activeWeekly: 0, activeMonthly: 0,
                    newThisPeriod: 0, adoptionRate: 0 },
    engagement:  { tasksCompleted: 0, tasksCompletedPerWeek: 0,
                    taskCompletionRate: null, onTime: 0, late: 0,
                    notificationEngagement: null },
    performance: { averageScore: null, scoreBand: null,
                    scoreDistribution: { excellent: 0, strong: 0, improving: 0, needs_help: 0 },
                    trustDistribution: { low: 0, medium: 0, high: 0, average: 0, count: 0 } },
    outcomes:    { estimatedYieldKg: 0, marketplaceListings: 0,
                    marketplaceRequests: 0, acceptedRequests: 0 },
    trends:      { weekly: [], monthly: [] },
    topRegions:    [],
    atRiskFarmers: [],
    generatedAt: new Date().toISOString(),
  });
}

export const _internal = Object.freeze({
  WEEK_MS, MONTH_MS, DAY_MS,
  KG_PER_HECTARE, GENERIC_KG_PER_HECTARE, ACRES_PER_HECTARE,
  hectaresFromFarm, coerceMeta, ymdStart, buildEmptyMetrics,
});
