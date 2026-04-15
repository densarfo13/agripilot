/**
 * Farm Benchmarking — season-over-season comparison engine.
 *
 * Compares farm performance across two periods using recorded data:
 *   - harvest/yield records → total harvested, total sold, revenue
 *   - cost records → total costs, category breakdown
 *   - computed → profit, percentage changes, trends
 *
 * No fake data — if a period lacks records, it says so honestly.
 * Pure computation — no DB calls. Caller provides the records.
 *
 * Trend labels: 'up' | 'down' | 'flat' | 'no_data'
 */

import { z } from 'zod';

// ─── Types (JSDoc) ────────────────────────────────────────

/**
 * @typedef {'up'|'down'|'flat'|'no_data'} BenchmarkTrend
 *
 * @typedef {Object} BenchmarkPeriod
 * @property {string} label
 * @property {Date|string} startDate
 * @property {Date|string} endDate
 *
 * @typedef {Object} FarmBenchmarkMetric
 * @property {number|null} current
 * @property {number|null} previous
 * @property {number|null} change        - absolute change
 * @property {number|null} changePercent - percentage change (e.g. 12.5 = +12.5%)
 * @property {BenchmarkTrend} trend
 *
 * @typedef {Object} FarmBenchmarkSummary
 * @property {string} farmId
 * @property {BenchmarkPeriod} currentPeriod
 * @property {BenchmarkPeriod} previousPeriod
 * @property {FarmBenchmarkMetric} yield
 * @property {FarmBenchmarkMetric} revenue
 * @property {FarmBenchmarkMetric} costs
 * @property {FarmBenchmarkMetric} profit
 * @property {boolean} hasEnoughData
 * @property {string|null} insufficientDataReason
 */

// ─── Validation ──────────────────────────────────────────

export const benchmarkQuerySchema = z.object({
  currentStart: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'currentStart must be a valid date',
  }).optional(),
  currentEnd: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'currentEnd must be a valid date',
  }).optional(),
  previousStart: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'previousStart must be a valid date',
  }).optional(),
  previousEnd: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'previousEnd must be a valid date',
  }).optional(),
  mode: z.enum(['season', 'year', 'custom']).optional(),
});

export function validateBenchmarkQuery(query) {
  const result = benchmarkQuerySchema.safeParse(query);
  if (result.success) {
    return { success: true, data: result.data, error: null };
  }
  return { success: false, data: null, error: result.error.issues[0].message };
}

// ─── Period helpers ──────────────────────────────────────

/**
 * Build default 6-month comparison periods (current vs previous).
 * Current: last 6 months. Previous: 6 months before that.
 */
export function buildDefaultPeriods() {
  const now = new Date();
  const currentEnd = new Date(now);
  const currentStart = new Date(now);
  currentStart.setMonth(currentStart.getMonth() - 6);

  const previousEnd = new Date(currentStart);
  const previousStart = new Date(previousEnd);
  previousStart.setMonth(previousStart.getMonth() - 6);

  return {
    current: {
      label: 'Current season',
      startDate: currentStart.toISOString(),
      endDate: currentEnd.toISOString(),
    },
    previous: {
      label: 'Previous season',
      startDate: previousStart.toISOString(),
      endDate: previousEnd.toISOString(),
    },
  };
}

/**
 * Build 12-month comparison periods.
 */
export function buildYearPeriods() {
  const now = new Date();
  const currentEnd = new Date(now);
  const currentStart = new Date(now);
  currentStart.setFullYear(currentStart.getFullYear() - 1);

  const previousEnd = new Date(currentStart);
  const previousStart = new Date(previousEnd);
  previousStart.setFullYear(previousStart.getFullYear() - 1);

  return {
    current: {
      label: 'Current 12 months',
      startDate: currentStart.toISOString(),
      endDate: currentEnd.toISOString(),
    },
    previous: {
      label: 'Previous 12 months',
      startDate: previousStart.toISOString(),
      endDate: previousEnd.toISOString(),
    },
  };
}

// ─── Filtering helpers ───────────────────────────────────

function filterByPeriod(records, startDate, endDate, dateField) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return records.filter((r) => {
    const d = new Date(r[dateField]).getTime();
    return d >= start && d <= end;
  });
}

// ─── Metric computation ─────────────────────────────────

function round2(val) {
  return Math.round(val * 100) / 100;
}

function computeTrend(current, previous) {
  if (current == null || previous == null) return 'no_data';
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

function computeChange(current, previous) {
  if (current == null || previous == null) {
    return { change: null, changePercent: null, trend: 'no_data' };
  }
  const change = round2(current - previous);
  const changePercent = previous !== 0
    ? round2(((current - previous) / Math.abs(previous)) * 100)
    : (current > 0 ? 100 : 0);
  const trend = computeTrend(current, previous);
  return { change, changePercent, trend };
}

function buildMetric(current, previous) {
  const { change, changePercent, trend } = computeChange(current, previous);
  return {
    current: current != null ? round2(current) : null,
    previous: previous != null ? round2(previous) : null,
    change,
    changePercent,
    trend,
  };
}

// ─── Period totals ───────────────────────────────────────

function computePeriodTotals(harvestRecords, costRecords) {
  let totalHarvested = 0;
  let totalRevenue = 0;
  let revenueCount = 0;

  for (const rec of harvestRecords) {
    totalHarvested += rec.quantityHarvested || 0;
    if (rec.quantitySold != null && rec.averageSellingPrice != null) {
      totalRevenue += rec.quantitySold * rec.averageSellingPrice;
      revenueCount++;
    }
  }

  let totalCosts = 0;
  for (const rec of costRecords) {
    totalCosts += rec.amount || 0;
  }

  const hasRevenue = revenueCount > 0;
  const profit = hasRevenue ? totalRevenue - totalCosts : null;

  return {
    totalHarvested: round2(totalHarvested),
    totalRevenue: hasRevenue ? round2(totalRevenue) : null,
    totalCosts: round2(totalCosts),
    profit: profit != null ? round2(profit) : null,
    harvestCount: harvestRecords.length,
    costCount: costRecords.length,
  };
}

// ─── Main benchmark function ─────────────────────────────

/**
 * Calculate farm benchmarks comparing two periods.
 *
 * @param {Object} params
 * @param {string} params.farmId
 * @param {Array} params.harvestRecords - all harvest records for farm
 * @param {Array} params.costRecords - all cost records for farm
 * @param {BenchmarkPeriod} [params.currentPeriod]
 * @param {BenchmarkPeriod} [params.previousPeriod]
 * @param {string} [params.mode] - 'season' | 'year' | 'custom'
 * @returns {FarmBenchmarkSummary}
 */
export function calculateFarmBenchmarks({
  farmId,
  harvestRecords = [],
  costRecords = [],
  currentPeriod,
  previousPeriod,
  mode = 'season',
}) {
  // Determine periods
  let periods;
  if (currentPeriod && previousPeriod) {
    periods = { current: currentPeriod, previous: previousPeriod };
  } else if (mode === 'year') {
    periods = buildYearPeriods();
  } else {
    periods = buildDefaultPeriods();
  }

  // Filter records into periods
  const currentHarvest = filterByPeriod(
    harvestRecords, periods.current.startDate, periods.current.endDate, 'harvestDate',
  );
  const previousHarvest = filterByPeriod(
    harvestRecords, periods.previous.startDate, periods.previous.endDate, 'harvestDate',
  );
  const currentCosts = filterByPeriod(
    costRecords, periods.current.startDate, periods.current.endDate, 'date',
  );
  const previousCosts = filterByPeriod(
    costRecords, periods.previous.startDate, periods.previous.endDate, 'date',
  );

  // Compute period totals
  const currentTotals = computePeriodTotals(currentHarvest, currentCosts);
  const previousTotals = computePeriodTotals(previousHarvest, previousCosts);

  // Determine if enough data for comparison
  const hasCurrentData = currentTotals.harvestCount > 0 || currentTotals.costCount > 0;
  const hasPreviousData = previousTotals.harvestCount > 0 || previousTotals.costCount > 0;
  const hasEnoughData = hasCurrentData && hasPreviousData;

  let insufficientDataReason = null;
  if (!hasCurrentData && !hasPreviousData) {
    insufficientDataReason = 'No harvest or cost records found for any period';
  } else if (!hasPreviousData) {
    insufficientDataReason = 'Not enough past data yet for comparison';
  } else if (!hasCurrentData) {
    insufficientDataReason = 'No records in the current period yet';
  }

  // Build metrics
  const yieldMetric = buildMetric(
    currentTotals.harvestCount > 0 ? currentTotals.totalHarvested : null,
    previousTotals.harvestCount > 0 ? previousTotals.totalHarvested : null,
  );

  const revenueMetric = buildMetric(
    currentTotals.totalRevenue,
    previousTotals.totalRevenue,
  );

  const costsMetric = buildMetric(
    currentTotals.costCount > 0 ? currentTotals.totalCosts : null,
    previousTotals.costCount > 0 ? previousTotals.totalCosts : null,
  );

  const profitMetric = buildMetric(
    currentTotals.profit,
    previousTotals.profit,
  );

  return {
    farmId,
    currentPeriod: periods.current,
    previousPeriod: periods.previous,
    yield: yieldMetric,
    revenue: revenueMetric,
    costs: costsMetric,
    profit: profitMetric,
    hasEnoughData,
    insufficientDataReason,
    currentTotals,
    previousTotals,
  };
}

/**
 * Detect benchmark-based insights for task engine.
 *
 * @param {FarmBenchmarkSummary} benchmark
 * @returns {{ profitDropped: boolean, yieldDropped: boolean, costsIncreased: boolean, noComparisonData: boolean }}
 */
export function detectBenchmarkInsights(benchmark) {
  if (!benchmark || !benchmark.hasEnoughData) {
    return {
      profitDropped: false,
      yieldDropped: false,
      costsIncreased: false,
      noComparisonData: true,
    };
  }

  const profitDropped = benchmark.profit.trend === 'down'
    && benchmark.profit.changePercent != null
    && benchmark.profit.changePercent <= -10;

  const yieldDropped = benchmark.yield.trend === 'down'
    && benchmark.yield.changePercent != null
    && benchmark.yield.changePercent <= -10;

  const costsIncreased = benchmark.costs.trend === 'up'
    && benchmark.costs.changePercent != null
    && benchmark.costs.changePercent >= 15;

  return {
    profitDropped,
    yieldDropped,
    costsIncreased,
    noComparisonData: false,
  };
}
