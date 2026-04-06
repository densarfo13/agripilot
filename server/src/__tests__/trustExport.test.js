import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database.js', () => ({
  default: {
    farmer: { findUnique: vi.fn() },
    farmSeason: { findUnique: vi.fn(), findMany: vi.fn() },
    seasonProgressEntry: { findMany: vi.fn() },
    stageConfirmation: { findMany: vi.fn() },
    officerValidation: { findMany: vi.fn() },
    credibilityAssessment: { findUnique: vi.fn(), upsert: vi.fn() },
    progressScore: { findUnique: vi.fn() },
    harvestReport: { findUnique: vi.fn() },
  },
}));

vi.mock('../modules/regionConfig/service.js', () => ({
  DEFAULT_COUNTRY_CODE: 'KE',
  getRegionConfig: () => ({
    areaUnit: 'acres', currencyCode: 'KES', country: 'Kenya',
    cropCalendars: { maize: { growingDays: 120 } },
  }),
}));

vi.mock('../modules/lifecycle/service.js', () => ({
  STAGE_ORDER: ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'],
}));

vi.mock('../modules/reminders/service.js', () => ({
  generateCropLifecycleReminders: vi.fn().mockResolvedValue([]),
}));

import prisma from '../config/database.js';
import { getSeasonTrustSummary, getPerformanceExport } from '../modules/seasons/trustSummary.js';

describe('Season Trust Summary', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns structured trust summary', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', cropType: 'maize', farmSizeAcres: 5,
      plantingDate: new Date(Date.now() - 90 * 86400000),
      expectedHarvestDate: new Date(Date.now() + 30 * 86400000),
      status: 'active', cropFailureReported: false, partialHarvest: false,
      farmer: {
        id: 'f-1', fullName: 'Jane', region: 'Nakuru', district: 'Central',
        countryCode: 'KE', primaryCrop: 'maize', farmSizeAcres: 5, yearsExperience: 3,
      },
      progressEntries: [
        { entryType: 'activity', activityType: 'weeding', cropCondition: null, followedAdvice: null, imageUrl: null, imageStage: null, entryDate: new Date() },
        { entryType: 'condition', activityType: null, cropCondition: 'good', followedAdvice: null, imageUrl: null, imageStage: null, entryDate: new Date() },
        { entryType: 'activity', activityType: null, cropCondition: null, followedAdvice: 'yes', imageUrl: 'url1', imageStage: 'early_growth', entryDate: new Date() },
      ],
      stageConfirmations: [{ confirmedStage: 'vegetative' }],
      harvestReport: null,
      progressScore: {
        progressScore: 78, performanceClassification: 'on_track', riskLevel: 'low',
        reasons: ['Season progressing well'],
        factors: {
          stageAlignment: { score: 100, weight: 0.25, weighted: 25, label: 'On track' },
          activityConsistency: { score: 60, weight: 0.25, weighted: 15, label: 'Slight gap' },
          cropCondition: { score: 100, weight: 0.20, weighted: 20, label: 'Good' },
          adviceAdherence: { score: 80, weight: 0.15, weighted: 12, label: 'Strong' },
          imageProgression: { score: 40, weight: 0.15, weighted: 6, label: 'Low' },
        },
      },
      credibilityAssessment: {
        credibilityScore: 85, credibilityLevel: 'high_confidence',
        confidence: 'medium', flags: [], reasons: ['No inconsistencies detected'],
      },
      officerValidations: [
        { validationType: 'stage', confirmedStage: 'vegetative', validatedAt: new Date(), note: 'Confirmed' },
      ],
    });
    prisma.officerValidation.findMany.mockResolvedValue([
      { validationType: 'stage', confirmedStage: 'vegetative', confirmedCondition: null, confirmedHarvest: null, validatedAt: new Date(), note: 'OK' },
    ]);

    const result = await getSeasonTrustSummary('s-1');

    expect(result.season.id).toBe('s-1');
    expect(result.farmer.fullName).toBe('Jane');
    expect(result.farmer).not.toHaveProperty('phone');
    expect(result.progressClassification.score).toBe(78);
    expect(result.progressClassification.classification).toBe('on_track');
    expect(result.progressClassification.scoreBreakdown).toBeDefined();
    expect(result.progressClassification.scoreBreakdown.contributingFactors.length).toBeGreaterThan(0);
    expect(result.credibility.score).toBe(85);
    expect(result.credibility.level).toBe('high_confidence');
    expect(result.evidenceCoverage.totalEntries).toBe(3);
    expect(result.evidenceCoverage.progressImages).toBe(1);
    expect(result.officerValidation.hasValidation).toBe(true);
    expect(result.harvestOutcome).toBeNull();
  });

  it('includes harvest outcome when available', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', cropType: 'maize', farmSizeAcres: 5,
      plantingDate: new Date(), expectedHarvestDate: new Date(),
      status: 'completed', cropFailureReported: false, partialHarvest: false,
      farmer: {
        id: 'f-1', fullName: 'Jane', region: 'Nakuru', district: null,
        countryCode: 'KE', primaryCrop: 'maize', farmSizeAcres: 5, yearsExperience: 3,
      },
      progressEntries: [],
      stageConfirmations: [],
      harvestReport: {
        totalHarvestKg: 2500, yieldPerAcre: 500, salesAmount: 60000,
        salesCurrency: 'KES', notes: 'Good harvest',
      },
      progressScore: null,
      credibilityAssessment: null,
      officerValidations: [],
    });
    prisma.officerValidation.findMany.mockResolvedValue([]);
    // getCredibility will be called since credibilityAssessment is null
    prisma.credibilityAssessment.findUnique.mockResolvedValue(null);
    prisma.credibilityAssessment.upsert.mockImplementation((args) =>
      Promise.resolve({ id: 'ca-1', seasonId: 's-1', credibilityScore: 60, credibilityLevel: 'medium_confidence', confidence: 'low', flags: ['no_updates_logged'], reasons: ['No progress entries'], ...args.create })
    );

    const result = await getSeasonTrustSummary('s-1');
    expect(result.harvestOutcome.totalHarvestKg).toBe(2500);
    expect(result.harvestOutcome.yieldPerAcre).toBe(500);
    expect(result.harvestOutcome.salesCurrency).toBe('KES');
  });

  it('throws 404 for missing season', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(null);
    await expect(getSeasonTrustSummary('bad')).rejects.toThrow(/Season not found/);
  });
});

describe('Performance Export', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns bridge-ready export structure', async () => {
    prisma.farmer.findUnique.mockResolvedValue({
      id: 'f-1', fullName: 'Jane', region: 'Nakuru', district: 'Central',
      countryCode: 'KE', primaryCrop: 'maize', farmSizeAcres: 5,
      yearsExperience: 3, registrationStatus: 'approved', createdAt: new Date('2024-01-01'),
    });
    prisma.farmSeason.findMany.mockResolvedValue([
      {
        id: 's-2', cropType: 'maize', farmSizeAcres: 5,
        plantingDate: new Date('2025-03-01'), expectedHarvestDate: new Date('2025-07-01'),
        status: 'completed', cropFailureReported: false, partialHarvest: false,
        harvestReport: { totalHarvestKg: 3000, yieldPerAcre: 600, salesAmount: 75000, salesCurrency: 'KES' },
        progressScore: { progressScore: 82, performanceClassification: 'on_track', riskLevel: 'low' },
        credibilityAssessment: { credibilityScore: 88, credibilityLevel: 'high_confidence', confidence: 'high', flags: [] },
        officerValidations: [{ id: 'ov-1' }, { id: 'ov-2' }],
        _count: { progressEntries: 15, stageConfirmations: 4 },
      },
      {
        id: 's-1', cropType: 'maize', farmSizeAcres: 5,
        plantingDate: new Date('2024-10-01'), expectedHarvestDate: new Date('2025-02-01'),
        status: 'completed', cropFailureReported: false, partialHarvest: false,
        harvestReport: { totalHarvestKg: 2000, yieldPerAcre: 400, salesAmount: 50000, salesCurrency: null },
        progressScore: { progressScore: 65, performanceClassification: 'slight_delay', riskLevel: 'medium' },
        credibilityAssessment: { credibilityScore: 70, credibilityLevel: 'medium_confidence', confidence: 'medium', flags: ['update_gap_detected'] },
        officerValidations: [],
        _count: { progressEntries: 8, stageConfirmations: 2 },
      },
    ]);

    const result = await getPerformanceExport('f-1');

    expect(result.exportVersion).toBe('1.0');
    expect(result.exportedAt).toBeDefined();
    expect(result.farmer.id).toBe('f-1');
    expect(result.farmer).not.toHaveProperty('phone');
    expect(result.farmer.country).toBe('Kenya');
    expect(result.farmer.currency).toBe('KES');
    expect(result.summary.totalSeasons).toBe(2);
    expect(result.summary.completedSeasons).toBe(2);
    expect(result.summary.avgYieldPerAcre).toBe(500);
    expect(result.summary.avgProgressScore).toBe(74); // (82+65)/2
    expect(result.summary.avgCredibilityScore).toBe(79); // (88+70)/2
    expect(result.summary.yieldTrend).toBe('improving');
    expect(result.summary.totalOfficerValidations).toBe(2);
    expect(result.summary.credibilityFlags).toContain('update_gap_detected');
    expect(result.seasons).toHaveLength(2);
    expect(result.seasons[0].harvest.totalHarvestKg).toBe(3000);
  });

  it('handles farmer with no seasons', async () => {
    prisma.farmer.findUnique.mockResolvedValue({
      id: 'f-1', fullName: 'Jane', region: 'Nakuru', district: null,
      countryCode: 'KE', primaryCrop: 'maize', farmSizeAcres: 5,
      yearsExperience: 1, registrationStatus: 'approved', createdAt: new Date(),
    });
    prisma.farmSeason.findMany.mockResolvedValue([]);

    const result = await getPerformanceExport('f-1');
    expect(result.summary.totalSeasons).toBe(0);
    expect(result.summary.avgYieldPerAcre).toBeNull();
    expect(result.seasons).toHaveLength(0);
  });

  it('throws 404 for missing farmer', async () => {
    prisma.farmer.findUnique.mockResolvedValue(null);
    await expect(getPerformanceExport('bad')).rejects.toThrow(/Farmer not found/);
  });

  it('score breakdown separates contributing and negative factors', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', cropType: 'maize', farmSizeAcres: 5,
      plantingDate: new Date(), expectedHarvestDate: new Date(),
      status: 'active', cropFailureReported: false, partialHarvest: false,
      farmer: {
        id: 'f-1', fullName: 'Jane', region: 'Nakuru', district: null,
        countryCode: 'KE', primaryCrop: 'maize', farmSizeAcres: 5, yearsExperience: 3,
      },
      progressEntries: [],
      stageConfirmations: [],
      harvestReport: null,
      progressScore: {
        progressScore: 55, performanceClassification: 'slight_delay', riskLevel: 'medium',
        reasons: ['Low activity'],
        factors: {
          stageAlignment: { score: 100, weight: 0.25, weighted: 25, label: 'On track' },
          activityConsistency: { score: 25, weight: 0.25, weighted: 6, label: 'Low' },
          cropCondition: { score: 40, weight: 0.20, weighted: 8, label: 'Unknown' },
          adviceAdherence: { score: 40, weight: 0.15, weighted: 6, label: 'Unknown' },
          imageProgression: { score: 40, weight: 0.15, weighted: 6, label: 'Unknown' },
        },
      },
      credibilityAssessment: null,
      officerValidations: [],
    });
    prisma.officerValidation.findMany.mockResolvedValue([]);
    prisma.credibilityAssessment.findUnique.mockResolvedValue(null);
    prisma.credibilityAssessment.upsert.mockImplementation((args) =>
      Promise.resolve({ id: 'ca-1', ...args.create })
    );

    const result = await getSeasonTrustSummary('s-1');
    const breakdown = result.progressClassification.scoreBreakdown;

    expect(breakdown.contributingFactors.length).toBeGreaterThan(0);
    expect(breakdown.negativeFactors.length).toBeGreaterThan(0);
    // stageAlignment (score 100) should be contributing
    expect(breakdown.contributingFactors.some(f => f.dimension === 'stageAlignment')).toBe(true);
    // activityConsistency (score 25) should be negative
    expect(breakdown.negativeFactors.some(f => f.dimension === 'activityConsistency')).toBe(true);
  });
});
