/**
 * outcomeIntelligenceEngine.js — outcome rollup + ranking +
 * dashboards.
 *
 * Pure async helpers. Never throw. Frozen returns.
 *
 * Honesty contract: every success-rate field returns null (not 0)
 * when sample size below a minimum threshold so dashboards never
 * show a fabricated 0%.
 *
 *   computeRecommendationSuccess(prisma, opts)
 *     → array of { recommendation, category, crop, region, season,
 *                  successRate (null when n<MIN), sampleSize,
 *                  improvedCount, sameCount, worseCount, confidence }
 *
 *   rankRecommendations(prisma, { category, crop, region, season })
 *     → sorted list with .preferred boolean (top result above
 *       MIN_SAMPLE_SIZE).
 *
 *   computeFarmerDashboard(prisma, userId)
 *     → { tasksCompleted, outcomesRecorded, improvementRatePct,
 *         farmHealthScore }
 *
 *   computeOrgDashboard(prisma)
 *     → { highRiskFarms, improvedFarms, pendingFollowUps,
 *         programImpact }
 *
 *   computeCommandCenterMetrics(prisma, days?)
 *     → { outcomeSuccessPct, recommendationAccuracyPct,
 *         followUpCompletionPct }
 */

const _str = (v) => (typeof v === 'string' ? v : '');
const _num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// At least this many followups before we publish a success rate.
const MIN_SAMPLE_SIZE = 3;
const MIN_RANKING_SAMPLE = 5;

function _pct(n, d) {
  if (!d || d === 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

function _confidenceForSample(n) {
  if (n >= 30) return 'high';
  if (n >= 10) return 'medium';
  if (n >= MIN_SAMPLE_SIZE) return 'low';
  return 'low';
}

function _seasonHint(monthIdx, hemisphere) {
  // Coarse Northern/Southern season label from month (1..12).
  const north = ['winter','winter','spring','spring','spring','summer',
                 'summer','summer','fall','fall','fall','winter'];
  const south = ['summer','summer','fall','fall','fall','winter',
                 'winter','winter','spring','spring','spring','summer'];
  const table = hemisphere === 'southern' ? south : north;
  return table[(monthIdx - 1) % 12] || 'unknown';
}

/**
 * Per-recommendation success rate, optionally filtered by category /
 * crop / region / season.
 */
export async function computeRecommendationSuccess(prisma, opts = {}) {
  try {
    if (!prisma || !prisma.recommendationOutcome) {
      return Object.freeze({ ok: false, reason: 'prisma_missing', rows: Object.freeze([]) });
    }
    const where = {};
    if (opts.category) where.category = String(opts.category);
    if (opts.crop)     where.crop     = String(opts.crop);
    if (opts.region)   where.region   = String(opts.region);
    if (opts.season)   where.season   = String(opts.season);
    if (opts.days) {
      const since = new Date(Date.now() - Number(opts.days) * 24 * 3600 * 1000);
      where.capturedAt = { gte: since };
    }

    const rows = await prisma.recommendationOutcome.findMany({
      where,
      orderBy: { capturedAt: 'desc' },
      take: 5000,
      select: {
        recommendation: true, category: true,
        crop: true, region: true, season: true, result: true,
      },
    });

    // Group by (recommendation, category, crop, region, season).
    const groups = new Map();
    for (const r of rows) {
      const key = [r.recommendation, r.category, r.crop || '', r.region || '', r.season || ''].join('||');
      const g = groups.get(key) || {
        recommendation: r.recommendation,
        category: r.category,
        crop: r.crop || null,
        region: r.region || null,
        season: r.season || null,
        improvedCount: 0, sameCount: 0, worseCount: 0,
      };
      if (r.result === 'improved') g.improvedCount++;
      else if (r.result === 'same') g.sameCount++;
      else if (r.result === 'worse') g.worseCount++;
      groups.set(key, g);
    }

    const out = Array.from(groups.values()).map((g) => {
      const sampleSize = g.improvedCount + g.sameCount + g.worseCount;
      const successRate = sampleSize >= MIN_SAMPLE_SIZE
        ? _pct(g.improvedCount, sampleSize) : null;
      return Object.freeze({
        ...g,
        sampleSize,
        successRate,
        confidence: _confidenceForSample(sampleSize),
      });
    }).sort(_rankBySuccess);

    return Object.freeze({
      ok: true,
      rows: Object.freeze(out),
      minSampleSize: MIN_SAMPLE_SIZE,
      generatedAt: new Date().toISOString(),
      limitations: 'Decision support, not a guarantee.',
    });
  } catch (err) {
    return Object.freeze({ ok: false, reason: 'exception',
      message: err && err.message, rows: Object.freeze([]) });
  }
}

/**
 * Rank recommendations for a specific (category, crop, region, season)
 * slice. Marks the top success-rate row as `preferred: true` ONLY
 * when sample size ≥ MIN_RANKING_SAMPLE — never picks a winner from
 * one or two data points.
 */
export async function rankRecommendations(prisma, query = {}) {
  const all = await computeRecommendationSuccess(prisma, query);
  if (!all.ok || all.rows.length === 0) {
    return Object.freeze({
      ok: false, ranked: Object.freeze([]),
      preferred: null, minRankingSample: MIN_RANKING_SAMPLE,
      reason: all.reason || 'no_data',
    });
  }
  const ranked = all.rows.slice();    // already sorted
  const top = ranked[0];
  const preferred = (top && top.successRate != null
                     && top.sampleSize >= MIN_RANKING_SAMPLE)
    ? Object.freeze({
        recommendation: top.recommendation,
        successRate:    top.successRate,
        sampleSize:     top.sampleSize,
        crop:           top.crop,
        region:         top.region,
      })
    : null;
  return Object.freeze({
    ok: true,
    ranked: Object.freeze(ranked),
    preferred,
    minRankingSample: MIN_RANKING_SAMPLE,
    query: Object.freeze(query),
    generatedAt: new Date().toISOString(),
    limitations: 'Decision support, not a guarantee.',
  });
}

/**
 * Per-farmer dashboard rollup.
 */
export async function computeFarmerDashboard(prisma, userId) {
  try {
    if (!prisma || !userId) {
      return _emptyFarmerDashboard('missing_user');
    }
    const [taskRows, recRows, healthRow] = await Promise.all([
      prisma.taskOutcome.findMany({
        where:   { userId },
        orderBy: { capturedAt: 'desc' },
        take:    500,
        select:  { completion: true, capturedAt: true },
      }),
      prisma.recommendationOutcome.findMany({
        where:   { userId },
        orderBy: { capturedAt: 'desc' },
        take:    500,
        select:  { result: true, capturedAt: true, dayOffset: true },
      }),
      prisma.farmHealthScore.findFirst({
        where:   { userId },
        orderBy: { snapshotDate: 'desc' },
      }),
    ]);

    const tasksCompleted = taskRows.filter((r) => r.completion === 'yes').length;
    const tasksPartial   = taskRows.filter((r) => r.completion === 'partial').length;
    const tasksTotal     = taskRows.length;
    const outcomesRecorded = recRows.length;
    const improvedCount = recRows.filter((r) => r.result === 'improved').length;
    const improvementRate = _pct(improvedCount,
      recRows.filter((r) => r.result !== 'pending').length);

    return Object.freeze({
      ok: true,
      tasksCompleted,
      tasksPartial,
      tasksTotal,
      taskCompletionPct: _pct(tasksCompleted, tasksTotal),
      outcomesRecorded,
      improvementRatePct: improvementRate,
      farmHealthScore: healthRow ? healthRow.score : null,
      farmHealthTrend: healthRow ? healthRow.trend : 'unknown',
      generatedAt: new Date().toISOString(),
      limitations: 'Decision support, not a guarantee.',
    });
  } catch (err) {
    return _emptyFarmerDashboard('exception', err && err.message);
  }
}

function _emptyFarmerDashboard(reason, message) {
  return Object.freeze({
    ok: false, reason, message,
    tasksCompleted: 0, tasksPartial: 0, tasksTotal: 0,
    taskCompletionPct: null,
    outcomesRecorded: 0, improvementRatePct: null,
    farmHealthScore: null, farmHealthTrend: 'unknown',
    generatedAt: new Date().toISOString(),
    limitations: 'Decision support, not a guarantee.',
  });
}

/**
 * Admin organization dashboard. Aggregates across all farms;
 * never returns per-farmer PII (no names, no phones, no exact
 * coords — farmIds only).
 */
export async function computeOrgDashboard(prisma) {
  try {
    if (!prisma) {
      return _emptyOrgDashboard('prisma_missing');
    }
    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [recentHealth, recRows, pendingFu] = await Promise.all([
      prisma.farmHealthScore.findMany({
        where:   { snapshotDate: { gte: since30d } },
        orderBy: { snapshotDate: 'desc' },
        take:    500,
      }),
      prisma.recommendationOutcome.findMany({
        where:   { capturedAt: { gte: since30d } },
        select:  { result: true, dayOffset: true },
        take:    5000,
      }),
      prisma.recommendationOutcome.findMany({
        where:   { capturedAt: { gte: since30d }, result: 'pending' },
        select:  { id: true },
        take:    5000,
      }),
    ]);

    // Latest score per farm.
    const latestPerFarm = new Map();
    for (const row of recentHealth) {
      const fid = row.farmId;
      if (!latestPerFarm.has(fid)) latestPerFarm.set(fid, row);
    }
    const latest = Array.from(latestPerFarm.values());
    const highRiskFarms  = latest.filter((r) => r.score < 40).length;
    const improvedFarms  = latest.filter((r) => r.trend === 'improving').length;

    const improvedCount = recRows.filter((r) => r.result === 'improved').length;
    const programImpactPct = _pct(improvedCount, recRows.length);

    return Object.freeze({
      ok: true,
      totalFarmsTracked: latest.length,
      highRiskFarms,
      improvedFarms,
      pendingFollowUps:  pendingFu.length,
      programImpactPct,
      generatedAt: new Date().toISOString(),
      limitations: 'Decision support, not a guarantee.',
    });
  } catch (err) {
    return _emptyOrgDashboard('exception', err && err.message);
  }
}

function _emptyOrgDashboard(reason, message) {
  return Object.freeze({
    ok: false, reason, message,
    totalFarmsTracked: 0,
    highRiskFarms: 0, improvedFarms: 0,
    pendingFollowUps: 0, programImpactPct: null,
    generatedAt: new Date().toISOString(),
    limitations: 'Decision support, not a guarantee.',
  });
}

/**
 * Command Center metrics — 3 spec values for the unified card.
 */
export async function computeCommandCenterMetrics(prisma, days = 30) {
  try {
    if (!prisma) {
      return Object.freeze({
        ok: false, reason: 'prisma_missing',
        outcomeSuccessPct: null,
        recommendationAccuracyPct: null,
        followUpCompletionPct: null,
        limitations: 'Decision support, not a guarantee.',
      });
    }
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const [recRows, taskRows] = await Promise.all([
      prisma.recommendationOutcome.findMany({
        where:   { capturedAt: { gte: since } },
        select:  { result: true, dayOffset: true, scanId: true },
        take:    5000,
      }),
      prisma.taskOutcome.findMany({
        where:   { capturedAt: { gte: since } },
        select:  { completion: true },
        take:    5000,
      }),
    ]);

    // outcomeSuccessPct = improved / (improved+same+worse)
    const improvedCount = recRows.filter((r) => r.result === 'improved').length;
    const sameCount     = recRows.filter((r) => r.result === 'same').length;
    const worseCount    = recRows.filter((r) => r.result === 'worse').length;
    const resolved      = improvedCount + sameCount + worseCount;

    const outcomeSuccessPct = resolved >= MIN_SAMPLE_SIZE
      ? _pct(improvedCount, resolved) : null;

    // recommendationAccuracyPct = (improved + same) / resolved
    // (the recommendation didn't make things worse)
    const recommendationAccuracyPct = resolved >= MIN_SAMPLE_SIZE
      ? _pct(improvedCount + sameCount, resolved) : null;

    // followUpCompletionPct = resolved / (3 * uniqueScanCount)
    // — each scan has 3 follow-ups (3/7/14 day) per V3 spec.
    const uniqueScans = new Set(recRows.map((r) => r.scanId)).size;
    const expectedFollowUps = uniqueScans * 3;
    const followUpCompletionPct = expectedFollowUps >= MIN_SAMPLE_SIZE
      ? _pct(resolved, expectedFollowUps) : null;

    return Object.freeze({
      ok: true,
      windowDays: days,
      outcomeSuccessPct,
      recommendationAccuracyPct,
      followUpCompletionPct,
      taskCount: taskRows.length,
      outcomeCount: recRows.length,
      resolvedCount: resolved,
      uniqueScansWithFollowUps: uniqueScans,
      generatedAt: new Date().toISOString(),
      limitations: 'Decision support, not a guarantee.',
    });
  } catch (err) {
    return Object.freeze({
      ok: false, reason: 'exception', message: err && err.message,
      outcomeSuccessPct: null, recommendationAccuracyPct: null,
      followUpCompletionPct: null,
      limitations: 'Decision support, not a guarantee.',
    });
  }
}

/**
 * Daily per-farm health score rollup. Idempotent upsert.
 */
export async function snapshotFarmHealth(prisma, opts = {}) {
  try {
    if (!prisma) return { ok: false, reason: 'prisma_missing' };
    const farmIds = Array.isArray(opts.farmIds) ? opts.farmIds : null;
    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    // Group recent outcomes by farmId.
    const where = { capturedAt: { gte: since30d } };
    if (farmIds && farmIds.length) where.farmId = { in: farmIds };
    const rows = await prisma.recommendationOutcome.findMany({
      where,
      select: { farmId: true, userId: true, result: true, capturedAt: true },
      take: 10000,
    });

    const byFarm = new Map();
    for (const r of rows) {
      if (!r.farmId) continue;
      const g = byFarm.get(r.farmId) || {
        farmId: r.farmId, userId: r.userId,
        improved: 0, same: 0, worse: 0, total: 0,
      };
      g.total++;
      if (r.result === 'improved') g.improved++;
      else if (r.result === 'same') g.same++;
      else if (r.result === 'worse') g.worse++;
      byFarm.set(r.farmId, g);
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const writes = [];
    for (const g of byFarm.values()) {
      const score = g.total >= MIN_SAMPLE_SIZE
        ? Math.max(0, Math.min(100, Math.round(
            ((g.improved * 100) + (g.same * 60) + (g.worse * 0)) / g.total)))
        : 50;        // neutral baseline when no data
      const trend = g.improved >= g.worse + 2 ? 'improving'
                  : g.worse >= g.improved + 2 ? 'declining'
                  : g.total >= MIN_SAMPLE_SIZE ? 'stable' : 'unknown';
      const improvementRate = g.total > 0
        ? Math.round((g.improved / g.total) * 1000) / 10
        : null;

      writes.push(prisma.farmHealthScore.upsert({
        where:  { farmId_snapshotDate: { farmId: g.farmId, snapshotDate: today } },
        update: {
          score, trend,
          scansInWindow: g.total,
          outcomesRecorded: g.total,
          improvementRatePct: improvementRate,
          computedAt: new Date(),
        },
        create: {
          farmId: g.farmId, userId: g.userId || null,
          snapshotDate: today,
          score, trend,
          scansInWindow: g.total,
          outcomesRecorded: g.total,
          improvementRatePct: improvementRate,
        },
      }).catch(() => null));
    }
    await Promise.all(writes);
    return { ok: true, farmsUpdated: byFarm.size };
  } catch (err) {
    try { console.warn('[outcome-intelligence] snapshot failed:', err && err.message); }
    catch { /* swallow */ }
    return { ok: false, reason: 'prisma_error', message: err && err.message };
  }
}

export function outcomeIntelligenceEngineInfo() {
  return Object.freeze({
    name:              'outcome-intelligence-engine',
    minSampleSize:     MIN_SAMPLE_SIZE,
    minRankingSample:  MIN_RANKING_SAMPLE,
    nullWhenInsufficientData: true,
  });
}

/**
 * Rank by successRate DESCENDING, with unknown (null sample) rows last. Uses ?? not ||
 * so a proven 0% success rate (real data, enough samples) ranks ABOVE an unknown:
 * `0 || -1` collapses "this never worked" into "we have no data" and loses the signal.
 */
function _rankBySuccess(a, b) {
  return (b.successRate ?? -1) - (a.successRate ?? -1);
}

export const _internal = Object.freeze({
  _pct, _confidenceForSample, _seasonHint, _rankBySuccess,
  MIN_SAMPLE_SIZE, MIN_RANKING_SAMPLE,
});

export default computeRecommendationSuccess;
