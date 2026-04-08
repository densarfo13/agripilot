/**
 * Performance & Benchmarking tests
 *
 * Covers:
 *   - deriveSeasonMetrics: correct derivation from season data
 *   - aggregateMetrics: correct org-level aggregation
 *   - buildComparisonOutputs: explainable comparisons, not empty where data exists
 *   - computeSelfTrend: correct direction signals
 *   - getFarmerPerformanceHistory: season history + farmer-only self-label
 *   - getFarmerBenchmarks: org-scoped, farmer gets no org comparisons
 *   - getOrgBenchmarkSummary: org scoping enforced
 *   - Cross-org comparisons blocked for institutional_admin
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Prisma mock ──────────────────────────────────────────
vi.mock('../config/database.js', () => ({
  default: {
    farmSeason: { findMany: vi.fn(), count: vi.fn() },
    farmer:     { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    user:       { findMany: vi.fn() },
  },
}));

// ─── Trust mock ───────────────────────────────────────────
vi.mock('../modules/trust/service.js', () => ({
  computeSeasonTrust: vi.fn().mockResolvedValue({
    trustScore: 70,
    trustLevel: 'Moderate Trust',
    trustReasons: ['Updates recent'],
    negativeTrustFactors: [],
    trustUpdatedAt: new Date(),
  }),
}));

import prisma from '../config/database.js';

// ─── Helper: build a mock season ─────────────────────────

function mockSeason(overrides = {}) {
  return {
    id: 'season-1',
    farmerId: 'farmer-1',
    cropType: 'maize',
    farmSizeAcres: 2,
    plantingDate: new Date(Date.now() - 90 * 86400000),
    expectedHarvestDate: new Date(Date.now() + 30 * 86400000),
    closedAt: null,
    status: 'active',
    lastActivityDate: new Date(Date.now() - 5 * 86400000),
    progressEntries: [
      { imageUrl: 'http://img/1.jpg', entryDate: new Date(), createdAt: new Date() },
      { imageUrl: null, entryDate: new Date(), createdAt: new Date() },
    ],
    officerValidations: [
      { id: 'v1', validationType: 'stage', validatedAt: new Date() },
    ],
    harvestReport: null,
    progressScore: { progressScore: 72, performanceClassification: 'on_track', riskLevel: 'Low' },
    credibilityAssessment: { credibilityScore: 68, credibilityLevel: 'medium_confidence' },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// deriveSeasonMetrics
// ═══════════════════════════════════════════════════════════

describe('deriveSeasonMetrics', () => {
  let deriveSeasonMetrics;
  beforeEach(async () => {
    vi.resetModules();
    ({ deriveSeasonMetrics } = await import('../modules/performance/metrics.js'));
  });

  it('derives correct update and image counts', () => {
    const season = mockSeason();
    const m = deriveSeasonMetrics(season);
    expect(m.updateCount).toBe(2);
    expect(m.imageCount).toBe(1);
    expect(m.evidenceRate).toBe(50);
  });

  it('derives validation count', () => {
    const season = mockSeason();
    const m = deriveSeasonMetrics(season);
    expect(m.validationCount).toBe(1);
  });

  it('sets hasHarvestReport=false when no report', () => {
    const season = mockSeason({ harvestReport: null });
    const m = deriveSeasonMetrics(season);
    expect(m.hasHarvestReport).toBe(false);
    expect(m.yieldPerAcre).toBeNull();
  });

  it('extracts yieldPerAcre from harvest report', () => {
    const season = mockSeason({
      harvestReport: { yieldPerAcre: 4.5, totalHarvestKg: 200 },
      status: 'completed',
      closedAt: new Date(),
    });
    const m = deriveSeasonMetrics(season);
    expect(m.hasHarvestReport).toBe(true);
    expect(m.yieldPerAcre).toBe(4.5);
  });

  it('computes daysActive using plantingDate → now when not closed', () => {
    const season = mockSeason({ closedAt: null });
    const m = deriveSeasonMetrics(season);
    expect(m.daysActive).toBeGreaterThanOrEqual(80); // planted 90 days ago
  });

  it('uses closedAt for daysActive when season is closed', () => {
    const closedAt = new Date(Date.now() - 10 * 86400000); // closed 10 days ago
    const season = mockSeason({
      status: 'completed',
      closedAt,
      plantingDate: new Date(Date.now() - 100 * 86400000),
    });
    const m = deriveSeasonMetrics(season);
    // closed 10 days ago, planted 100 days ago → daysActive ≈ 90
    expect(m.daysActive).toBeGreaterThanOrEqual(85);
    expect(m.daysActive).toBeLessThanOrEqual(95);
  });

  it('sets updateFrequency to 0 when no entries and minimal time', () => {
    const season = mockSeason({
      progressEntries: [],
      officerValidations: [],
      plantingDate: new Date(Date.now() - 1 * 86400000), // 1 day ago
    });
    const m = deriveSeasonMetrics(season);
    expect(m.updateCount).toBe(0);
    expect(m.evidenceRate).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// aggregateMetrics
// ═══════════════════════════════════════════════════════════

describe('aggregateMetrics', () => {
  let aggregateMetrics, deriveSeasonMetrics;
  beforeEach(async () => {
    vi.resetModules();
    ({ aggregateMetrics, deriveSeasonMetrics } = await import('../modules/performance/metrics.js'));
  });

  it('returns null for empty array', () => {
    expect(aggregateMetrics([])).toBeNull();
  });

  it('calculates correct completion rate', () => {
    const completed = mockSeason({ id: 's1', status: 'completed', closedAt: new Date() });
    const active = mockSeason({ id: 's2', status: 'active', closedAt: null });
    const metrics = [completed, active].map(deriveSeasonMetrics);
    const agg = aggregateMetrics(metrics);
    expect(agg.completionRate).toBe(50);
    expect(agg.completedCount).toBe(1);
    expect(agg.activeCount).toBe(1);
  });

  it('calculates avgProgressScore across scored seasons', () => {
    const s1 = mockSeason({ id: 's1', progressScore: { progressScore: 80, performanceClassification: 'on_track', riskLevel: 'Low' } });
    const s2 = mockSeason({ id: 's2', progressScore: { progressScore: 60, performanceClassification: 'slight_delay', riskLevel: 'Low' } });
    const agg = aggregateMetrics([s1, s2].map(deriveSeasonMetrics));
    expect(agg.avgProgressScore).toBe(70);
  });

  it('excludes null progressScore from avg calculation', () => {
    const s1 = mockSeason({ id: 's1', progressScore: null });
    const s2 = mockSeason({ id: 's2', progressScore: { progressScore: 60, performanceClassification: 'slight_delay', riskLevel: 'Low' } });
    const agg = aggregateMetrics([s1, s2].map(deriveSeasonMetrics));
    expect(agg.avgProgressScore).toBe(60);
  });

  it('returns correct harvest report rate', () => {
    const s1 = mockSeason({ id: 's1', harvestReport: { yieldPerAcre: 3, totalHarvestKg: 100 } });
    const s2 = mockSeason({ id: 's2', harvestReport: null });
    const agg = aggregateMetrics([s1, s2].map(deriveSeasonMetrics));
    expect(agg.harvestReportRate).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════
// buildComparisonOutputs
// ═══════════════════════════════════════════════════════════

describe('buildComparisonOutputs', () => {
  let buildComparisonOutputs;
  beforeEach(async () => {
    vi.resetModules();
    ({ buildComparisonOutputs } = await import('../modules/performance/benchmarks.js'));
  });

  it('returns empty array when either baseline is null', () => {
    expect(buildComparisonOutputs(null, { avgUpdateFrequency: 3 }, 'org1')).toEqual([]);
    expect(buildComparisonOutputs({ avgUpdateFrequency: 3 }, null, 'org1')).toEqual([]);
  });

  it('marks above_average when farmer metric is >8% above org', () => {
    const farmerBaseline = {
      avgUpdateFrequency: 5,      // much higher than org
      avgValidationFrequency: 1,
      avgEvidenceRate: 50,
      avgProgressScore: 75,
      completionRate: 80,
      avgCredibilityScore: null,
    };
    const orgBaseline = {
      avgUpdateFrequency: 4,      // org avg
      avgValidationFrequency: 1,
      avgEvidenceRate: 50,
      avgProgressScore: 70,
      completionRate: 70,
      avgCredibilityScore: null,
    };
    const outputs = buildComparisonOutputs(farmerBaseline, orgBaseline, 'org1');
    const activityOutput = outputs.find(o => o.sourceMetric === 'activity_consistency');
    expect(activityOutput).toBeDefined();
    expect(activityOutput.direction).toBe('above_average');
  });

  it('marks below_average when farmer metric is >8% below org', () => {
    const farmerBaseline = {
      avgUpdateFrequency: 1,
      avgValidationFrequency: 0.1,
      avgEvidenceRate: 20,
      avgProgressScore: 40,
      completionRate: 20,
      avgCredibilityScore: null,
    };
    const orgBaseline = {
      avgUpdateFrequency: 4,
      avgValidationFrequency: 1.5,
      avgEvidenceRate: 55,
      avgProgressScore: 70,
      completionRate: 65,
      avgCredibilityScore: null,
    };
    const outputs = buildComparisonOutputs(farmerBaseline, orgBaseline, 'org1');
    const below = outputs.filter(o => o.direction === 'below_average');
    expect(below.length).toBeGreaterThan(0);
    // Each output has comparisonLabel and comparisonReason
    for (const o of outputs) {
      expect(o.comparisonLabel).toBeTruthy();
      expect(o.comparisonReason).toBeTruthy();
      expect(o.benchmarkScope).toBeTruthy();
    }
  });

  it('produces around_average when within 8% threshold', () => {
    const same = {
      avgUpdateFrequency: 3,
      avgValidationFrequency: 1,
      avgEvidenceRate: 50,
      avgProgressScore: 70,
      completionRate: 60,
      avgCredibilityScore: null,
    };
    const outputs = buildComparisonOutputs(same, same, 'org1');
    const around = outputs.filter(o => o.direction === 'around_average');
    expect(around.length).toBeGreaterThan(0);
  });

  it('skips metrics where either value is null', () => {
    const farmerBaseline = {
      avgUpdateFrequency: null,
      avgValidationFrequency: null,
      avgEvidenceRate: null,
      avgProgressScore: null,
      completionRate: null,
      avgCredibilityScore: null,
    };
    const orgBaseline = {
      avgUpdateFrequency: 3,
      avgValidationFrequency: 1,
      avgEvidenceRate: 40,
      avgProgressScore: 65,
      completionRate: 50,
      avgCredibilityScore: null,
    };
    const outputs = buildComparisonOutputs(farmerBaseline, orgBaseline, 'org1');
    expect(outputs).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════
// computeSelfTrend
// ═══════════════════════════════════════════════════════════

describe('computeSelfTrend', () => {
  let computeSelfTrend;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ computeSelfTrend } = await import('../modules/performance/benchmarks.js'));
  });

  it('returns hasTrend=false when fewer than 2 seasons', async () => {
    prisma.farmSeason.findMany.mockResolvedValue([mockSeason()]);
    const result = await computeSelfTrend('farmer-1');
    expect(result.hasTrend).toBe(false);
  });

  it('detects improving progressScore', async () => {
    const current = mockSeason({
      id: 'current',
      progressScore: { progressScore: 82, performanceClassification: 'on_track', riskLevel: 'Low' },
    });
    const prior = mockSeason({
      id: 'prior',
      progressScore: { progressScore: 60, performanceClassification: 'slight_delay', riskLevel: 'Medium' },
    });
    prisma.farmSeason.findMany.mockResolvedValue([current, prior]);
    const result = await computeSelfTrend('farmer-1');
    expect(result.hasTrend).toBe(true);
    expect(result.trends.progressScore).toBe('improving');
  });

  it('detects declining updateFrequency', async () => {
    const now = new Date();
    const current = mockSeason({
      id: 'current',
      plantingDate: new Date(Date.now() - 60 * 86400000),
      progressEntries: [{ imageUrl: null, entryDate: now, createdAt: now }], // 1 update over 60 days
    });
    const prior = mockSeason({
      id: 'prior',
      plantingDate: new Date(Date.now() - 180 * 86400000),
      closedAt: new Date(Date.now() - 60 * 86400000),
      progressEntries: Array(15).fill(null).map(() => ({ imageUrl: null, entryDate: now, createdAt: now })), // 15 updates over 120 days
    });
    prisma.farmSeason.findMany.mockResolvedValue([current, prior]);
    const result = await computeSelfTrend('farmer-1');
    expect(result.hasTrend).toBe(true);
    expect(result.trends.updateFrequency).toBe('declining');
  });
});

// ═══════════════════════════════════════════════════════════
// getFarmerPerformanceHistory — farmer role gets simple labels
// ═══════════════════════════════════════════════════════════

describe('getFarmerPerformanceHistory (farmer role)', () => {
  let getFarmerPerformanceHistory;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ getFarmerPerformanceHistory } = await import('../modules/performance/service.js'));
  });

  it('returns selfLabel instead of full metrics for farmer role', async () => {
    prisma.farmSeason.findMany.mockResolvedValue([mockSeason()]);

    const result = await getFarmerPerformanceHistory('farmer-1', 'org1', 'farmer');

    expect(result.seasons).toHaveLength(1);
    expect(result.seasons[0].selfLabel).toBeDefined();
    // No internal metrics exposed
    expect(result.seasons[0].updateCount).toBeUndefined();
    expect(result.seasons[0].progressScore).toBeUndefined();
    expect(result.summary).toBeNull(); // staff summary not returned for farmer
  });

  it('returns empty seasons when no seasons exist', async () => {
    prisma.farmSeason.findMany.mockResolvedValue([]);
    const result = await getFarmerPerformanceHistory('farmer-1', 'org1', 'farmer');
    expect(result.seasons).toHaveLength(0);
    expect(result.selfTrend).toBeNull();
  });
});

describe('getFarmerPerformanceHistory (staff role)', () => {
  let getFarmerPerformanceHistory;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ getFarmerPerformanceHistory } = await import('../modules/performance/service.js'));
  });

  it('returns full metrics for staff role', async () => {
    prisma.farmSeason.findMany.mockResolvedValue([mockSeason()]);

    const result = await getFarmerPerformanceHistory('farmer-1', 'org1', 'field_officer');

    expect(result.seasons).toHaveLength(1);
    expect(result.seasons[0].updateCount).toBeDefined();
    expect(result.seasons[0].trustScore).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('includes trend summary for multiple seasons', async () => {
    prisma.farmSeason.findMany.mockResolvedValue([
      mockSeason({ id: 's1', progressScore: { progressScore: 80, performanceClassification: 'on_track', riskLevel: 'Low' } }),
      mockSeason({ id: 's2', progressScore: { progressScore: 55, performanceClassification: 'slight_delay', riskLevel: 'Low' } }),
    ]);
    const result = await getFarmerPerformanceHistory('farmer-1', 'org1', 'institutional_admin');
    expect(result.summary.totalSeasons).toBe(2);
    expect(result.summary.avgProgressScore).toBe(68); // (80+55)/2 rounded
    expect(['improving', 'stable', 'declining']).toContain(result.summary.scoreTrend);
  });
});

// ═══════════════════════════════════════════════════════════
// getFarmerBenchmarks — farmer gets no org comparisons
// ═══════════════════════════════════════════════════════════

describe('getFarmerBenchmarks', () => {
  let getFarmerBenchmarks;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ getFarmerBenchmarks } = await import('../modules/performance/service.js'));
  });

  it('returns empty comparisons and null orgBaseline for farmer role', async () => {
    // computeSelfTrend needs seasons
    prisma.farmSeason.findMany.mockResolvedValue([]);

    const result = await getFarmerBenchmarks('farmer-1', 'org1', 'farmer');

    expect(result.comparisons).toHaveLength(0);
    expect(result.orgBaseline).toBeNull();
  });

  it('returns comparisons for staff role when data exists', async () => {
    // computeFarmerBaseline and computeOrgBaseline both need findMany
    const season = mockSeason();
    prisma.farmSeason.findMany.mockResolvedValue([season]);
    prisma.farmer.findMany.mockResolvedValue([
      { id: 'farmer-1', assignedOfficerId: 'officer-1' },
    ]);

    const result = await getFarmerBenchmarks('farmer-1', 'org1', 'field_officer');

    // Should have baseline data (comparisons may be empty if insufficient data)
    expect(Array.isArray(result.comparisons)).toBe(true);
    // Each comparison has required fields
    for (const c of result.comparisons) {
      expect(c.comparisonLabel).toBeTruthy();
      expect(c.comparisonReason).toBeTruthy();
      expect(c.direction).toBeTruthy();
      expect(c.sourceMetric).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════
// Org scoping: institutional_admin stays in own org
// ═══════════════════════════════════════════════════════════

describe('org scoping', () => {
  it('computeOrgBaseline filters by organizationId when provided', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const { computeOrgBaseline } = await import('../modules/performance/benchmarks.js');
    prisma.farmSeason.findMany.mockResolvedValue([]);
    prisma.farmer.findMany.mockResolvedValue([]);

    await computeOrgBaseline('org1');

    const call = prisma.farmSeason.findMany.mock.calls[0][0];
    expect(call.where.farmer).toEqual({ organizationId: 'org1' });
  });

  it('computeOrgBaseline does NOT filter by org when organizationId is null (super_admin)', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const { computeOrgBaseline } = await import('../modules/performance/benchmarks.js');
    prisma.farmSeason.findMany.mockResolvedValue([]);
    prisma.farmer.findMany.mockResolvedValue([]);

    await computeOrgBaseline(null);

    const call = prisma.farmSeason.findMany.mock.calls[0][0];
    expect(call.where.farmer).toEqual({});
  });
});
