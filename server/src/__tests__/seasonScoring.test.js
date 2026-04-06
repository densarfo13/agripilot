import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database.js', () => ({
  default: {
    farmSeason: { findUnique: vi.fn() },
    progressScore: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock('../modules/regionConfig/service.js', () => ({
  DEFAULT_COUNTRY_CODE: 'KE',
  getRegionConfig: () => ({ areaUnit: 'acres', currencyCode: 'KES' }),
  getCropCalendar: (cc, crop) => {
    if (crop === 'maize') return { plantMonths: [3, 4], harvestMonths: [7, 8], growingDays: 120 };
    return null;
  },
}));

vi.mock('../modules/lifecycle/service.js', () => ({
  STAGE_ORDER: ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'],
}));

vi.mock('../modules/reminders/service.js', () => ({
  generateCropLifecycleReminders: vi.fn().mockResolvedValue([]),
}));

import prisma from '../config/database.js';
import { getSeasonComparison } from '../modules/seasons/comparison.js';
import { computeProgressScore, CLASSIFICATION_LABELS } from '../modules/seasons/scoring.js';

function mockSeason(overrides = {}) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return {
    id: 's-1',
    farmerId: 'f-1',
    cropType: 'maize',
    plantingDate: thirtyDaysAgo,
    expectedHarvestDate: new Date(thirtyDaysAgo.getTime() + 120 * 86400000),
    status: 'active',
    farmSizeAcres: 5,
    farmer: { id: 'f-1', fullName: 'Test', countryCode: 'KE' },
    progressEntries: [],
    stageConfirmations: [],
    harvestReport: null,
    ...overrides,
  };
}

describe('Season Comparison', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns structured comparison with all dimensions', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason());

    const result = await getSeasonComparison('s-1');

    expect(result).toHaveProperty('seasonId', 's-1');
    expect(result).toHaveProperty('dimensions');
    expect(result.dimensions).toHaveProperty('stageAlignment');
    expect(result.dimensions).toHaveProperty('activityConsistency');
    expect(result.dimensions).toHaveProperty('cropCondition');
    expect(result.dimensions).toHaveProperty('adviceAdherence');
    expect(result.dimensions).toHaveProperty('imageProgression');
    expect(result.dimensions).toHaveProperty('harvestCompletion');
  });

  it('detects stage alignment from confirmations', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason({
      stageConfirmations: [
        { confirmedStage: 'vegetative', isMismatch: false, createdAt: new Date() },
      ],
    }));

    const result = await getSeasonComparison('s-1');
    expect(result.dimensions.stageAlignment.actualStage).toBe('vegetative');
    expect(result.dimensions.stageAlignment.actualSource).toBe('farmer_confirmation');
  });

  it('reports at_risk for no activities', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason());

    const result = await getSeasonComparison('s-1');
    expect(result.dimensions.activityConsistency.status).toBe('at_risk');
    expect(result.dimensions.activityConsistency.totalEntries).toBe(0);
  });

  it('reports good activity consistency', async () => {
    const entries = Array.from({ length: 3 }, (_, i) => ({
      entryType: 'activity',
      activityType: 'fertilizing',
      entryDate: new Date(),
      cropCondition: null,
      followedAdvice: null,
      imageUrl: null,
      imageStage: null,
      lifecycleStage: 'vegetative',
    }));

    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason({ progressEntries: entries }));

    const result = await getSeasonComparison('s-1');
    // 3 entries over ~4 weeks (expect ~2) should be on_track
    expect(['on_track', 'slight_delay']).toContain(result.dimensions.activityConsistency.status);
  });

  it('reports condition trend', async () => {
    const condEntries = [
      { entryType: 'condition', cropCondition: 'poor', conditionNotes: null, entryDate: new Date(Date.now() - 14 * 86400000), followedAdvice: null, imageUrl: null, imageStage: null, lifecycleStage: null, activityType: null },
      { entryType: 'condition', cropCondition: 'average', conditionNotes: null, entryDate: new Date(Date.now() - 7 * 86400000), followedAdvice: null, imageUrl: null, imageStage: null, lifecycleStage: null, activityType: null },
      { entryType: 'condition', cropCondition: 'good', conditionNotes: null, entryDate: new Date(), followedAdvice: null, imageUrl: null, imageStage: null, lifecycleStage: null, activityType: null },
    ];

    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason({ progressEntries: condEntries }));

    const result = await getSeasonComparison('s-1');
    expect(result.dimensions.cropCondition.latestCondition).toBe('good');
    expect(result.dimensions.cropCondition.trend).toBe('improving');
  });

  it('calculates advice adherence', async () => {
    const adviceEntries = [
      { entryType: 'advice', followedAdvice: 'yes', adviceNotes: null, entryDate: new Date(), cropCondition: null, imageUrl: null, imageStage: null, lifecycleStage: null, activityType: null },
      { entryType: 'advice', followedAdvice: 'yes', adviceNotes: null, entryDate: new Date(), cropCondition: null, imageUrl: null, imageStage: null, lifecycleStage: null, activityType: null },
      { entryType: 'advice', followedAdvice: 'no', adviceNotes: null, entryDate: new Date(), cropCondition: null, imageUrl: null, imageStage: null, lifecycleStage: null, activityType: null },
    ];

    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason({ progressEntries: adviceEntries }));

    const result = await getSeasonComparison('s-1');
    expect(result.dimensions.adviceAdherence.followed).toBe(2);
    expect(result.dimensions.adviceAdherence.ignored).toBe(1);
    expect(result.dimensions.adviceAdherence.adherenceRate).toBe(67);
  });

  it('throws 404 for nonexistent season', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(null);
    await expect(getSeasonComparison('bad')).rejects.toThrow(/Season not found/);
  });
});

describe('Progress Scoring', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('computes score and persists result', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason());
    prisma.progressScore.upsert.mockImplementation(({ create }) => Promise.resolve(create));

    const result = await computeProgressScore('s-1');

    expect(result).toHaveProperty('progressScore');
    expect(result).toHaveProperty('performanceClassification');
    expect(result).toHaveProperty('riskLevel');
    expect(result).toHaveProperty('factors');
    expect(result).toHaveProperty('reasons');
    expect(result).toHaveProperty('comparison');

    expect(typeof result.progressScore).toBe('number');
    expect(result.progressScore).toBeGreaterThanOrEqual(0);
    expect(result.progressScore).toBeLessThanOrEqual(100);

    expect(prisma.progressScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seasonId: 's-1' },
      })
    );
  });

  it('classifies good season as on_track', async () => {
    const goodEntries = [
      ...Array.from({ length: 4 }, (_, i) => ({
        entryType: 'activity', activityType: 'fertilizing', entryDate: new Date(),
        cropCondition: null, followedAdvice: null, imageUrl: null, imageStage: null, lifecycleStage: 'vegetative',
      })),
      { entryType: 'condition', cropCondition: 'good', conditionNotes: null, entryDate: new Date(), followedAdvice: null, imageUrl: null, imageStage: null, lifecycleStage: null, activityType: null },
      { entryType: 'advice', followedAdvice: 'yes', adviceNotes: null, entryDate: new Date(), cropCondition: null, imageUrl: null, imageStage: null, lifecycleStage: null, activityType: null },
      { entryType: 'activity', imageUrl: '/img1.jpg', imageStage: 'early_growth', entryDate: new Date(), cropCondition: null, followedAdvice: null, lifecycleStage: null, activityType: null },
      { entryType: 'activity', imageUrl: '/img2.jpg', imageStage: 'mid_stage', entryDate: new Date(), cropCondition: null, followedAdvice: null, lifecycleStage: null, activityType: null },
    ];

    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason({
      progressEntries: goodEntries,
      stageConfirmations: [{ confirmedStage: 'vegetative', isMismatch: false, createdAt: new Date() }],
    }));
    prisma.progressScore.upsert.mockImplementation(({ create }) => Promise.resolve(create));

    const result = await computeProgressScore('s-1');
    expect(result.progressScore).toBeGreaterThanOrEqual(55);
    expect(['on_track', 'slight_delay']).toContain(result.performanceClassification);
  });

  it('classifies empty season as at_risk or critical', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason());
    prisma.progressScore.upsert.mockImplementation(({ create }) => Promise.resolve(create));

    const result = await computeProgressScore('s-1');
    expect(result.progressScore).toBeLessThan(55);
    expect(['at_risk', 'critical']).toContain(result.performanceClassification);
  });

  it('includes all 5 weighted factors', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason());
    prisma.progressScore.upsert.mockImplementation(({ create }) => Promise.resolve(create));

    const result = await computeProgressScore('s-1');
    const factors = result.factors;

    expect(factors).toHaveProperty('stageAlignment');
    expect(factors).toHaveProperty('activityConsistency');
    expect(factors).toHaveProperty('cropCondition');
    expect(factors).toHaveProperty('adviceAdherence');
    expect(factors).toHaveProperty('imageProgression');

    // Weights should sum to 1.0
    const totalWeight = Object.values(factors).reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 2);
  });

  it('has valid classification labels', () => {
    expect(CLASSIFICATION_LABELS).toHaveProperty('on_track');
    expect(CLASSIFICATION_LABELS).toHaveProperty('slight_delay');
    expect(CLASSIFICATION_LABELS).toHaveProperty('at_risk');
    expect(CLASSIFICATION_LABELS).toHaveProperty('critical');

    for (const cls of Object.values(CLASSIFICATION_LABELS)) {
      expect(cls).toHaveProperty('label');
      expect(cls).toHaveProperty('color');
      expect(cls).toHaveProperty('description');
    }
  });
});
