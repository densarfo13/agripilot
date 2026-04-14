import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database.js', () => ({
  default: {
    farmer: { findUnique: vi.fn() },
    farmSeason: { findUnique: vi.fn(), findMany: vi.fn() },
    seasonProgressEntry: { findMany: vi.fn() },
    officerValidation: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../modules/regionConfig/service.js', () => ({
  DEFAULT_COUNTRY_CODE: 'KE',
  getRegionConfig: () => ({ areaUnit: 'acres', currencyCode: 'KES', country: 'Kenya' }),
  getCropCalendar: () => ({ growingDays: 120 }),
}));

vi.mock('../modules/lifecycle/service.js', () => ({
  STAGE_ORDER: ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'],
}));

vi.mock('../modules/reminders/service.js', () => ({
  generateCropLifecycleReminders: vi.fn().mockResolvedValue([]),
}));

import prisma from '../config/database.js';
import { createOfficerValidation, listOfficerValidations, getValidationSummary } from '../modules/seasons/officerValidation.js';
import { getAdviceAdherence } from '../modules/seasons/adviceAdherence.js';
import { getSeasonHistory, compareSeasons } from '../modules/seasons/seasonHistory.js';

describe('Officer Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates officer validation for assigned officer', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', farmer: { id: 'f-1', assignedOfficerId: 'off-1' },
    });
    prisma.officerValidation.create.mockResolvedValue({
      id: 'ov-1', seasonId: 's-1', officerId: 'off-1',
      validationType: 'stage', confirmedStage: 'vegetative',
    });

    const result = await createOfficerValidation('s-1', 'off-1', {
      validationType: 'stage', confirmedStage: 'vegetative', note: 'Confirmed in field',
    });

    expect(result.validationType).toBe('stage');
    expect(result.confirmedStage).toBe('vegetative');
  });

  it('allows admin to validate any season', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', farmer: { id: 'f-1', assignedOfficerId: 'other-officer' },
    });
    prisma.user.findUnique.mockResolvedValue({ role: 'super_admin' });
    prisma.officerValidation.create.mockResolvedValue({
      id: 'ov-1', seasonId: 's-1', officerId: 'admin-1', validationType: 'condition',
    });

    const result = await createOfficerValidation('s-1', 'admin-1', {
      validationType: 'condition', confirmedCondition: 'good',
    });

    expect(result.validationType).toBe('condition');
  });

  it('rejects unassigned officer', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', farmer: { id: 'f-1', assignedOfficerId: 'off-1' },
    });
    prisma.user.findUnique.mockResolvedValue({ role: 'field_officer' });

    await expect(createOfficerValidation('s-1', 'wrong-officer', {
      validationType: 'stage', confirmedStage: 'vegetative',
    })).rejects.toThrow(/not assigned/);
  });

  it('rejects invalid validation type', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', farmer: { id: 'f-1', assignedOfficerId: 'off-1' },
    });

    await expect(createOfficerValidation('s-1', 'off-1', {
      validationType: 'invalid',
    })).rejects.toThrow(/validationType/);
  });

  it('returns validation summary', async () => {
    prisma.officerValidation.findMany.mockResolvedValue([
      { validationType: 'stage', confirmedStage: 'vegetative', confirmedCondition: null, confirmedHarvest: null, validatedAt: new Date(), note: 'OK' },
      { validationType: 'condition', confirmedStage: null, confirmedCondition: 'good', confirmedHarvest: null, validatedAt: new Date(), note: null },
    ]);

    const result = await getValidationSummary('s-1');
    expect(result.hasValidation).toBe(true);
    expect(result.totalValidations).toBe(2);
    expect(result.stageConfirmed).toBe(true);
    expect(result.conditionConfirmed).toBe(true);
    expect(result.harvestConfirmed).toBe(false);
  });

  it('returns empty summary when no validations', async () => {
    prisma.officerValidation.findMany.mockResolvedValue([]);

    const result = await getValidationSummary('s-1');
    expect(result.hasValidation).toBe(false);
    expect(result.totalValidations).toBe(0);
  });
});

describe('Advice Adherence', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns no_data when no advice entries', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', cropType: 'maize', status: 'active', plantingDate: new Date() });
    prisma.seasonProgressEntry.findMany.mockResolvedValue([
      { entryType: 'activity', activityType: 'weeding', followedAdvice: null, entryDate: new Date() },
    ]);

    const result = await getAdviceAdherence('s-1');
    expect(result.adherenceLevel).toBe('no_data');
    expect(result.adherenceRate).toBeNull();
  });

  it('computes high adherence', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', cropType: 'maize', status: 'active', plantingDate: new Date() });
    const now = Date.now();
    prisma.seasonProgressEntry.findMany.mockResolvedValue([
      { id: 'e-1', entryType: 'advice', followedAdvice: 'yes', adviceNotes: 'Applied', entryDate: new Date(now - 30 * 86400000), activityType: 'fertilizing' },
      { id: 'e-2', entryType: 'advice', followedAdvice: 'yes', adviceNotes: 'Done', entryDate: new Date(now - 20 * 86400000), activityType: 'spraying' },
      { id: 'e-3', entryType: 'advice', followedAdvice: 'partial', adviceNotes: null, entryDate: new Date(now - 10 * 86400000), activityType: 'weeding' },
      { id: 'e-4', entryType: 'activity', activityType: 'fertilizing', followedAdvice: null, entryDate: new Date(now - 28 * 86400000) },
    ]);

    const result = await getAdviceAdherence('s-1');
    expect(result.adherenceLevel).toBe('high');
    expect(result.adherenceRate).toBeGreaterThanOrEqual(70);
    expect(result.breakdown.followed).toBe(2);
    expect(result.breakdown.partial).toBe(1);
  });

  it('detects evidence linking', async () => {
    const now = Date.now();
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', cropType: 'maize', status: 'active', plantingDate: new Date() });
    prisma.seasonProgressEntry.findMany.mockResolvedValue([
      { id: 'adv-1', entryType: 'advice', followedAdvice: 'yes', adviceNotes: 'Fertilize', entryDate: new Date(now - 20 * 86400000), activityType: 'fertilizing' },
      { id: 'act-1', entryType: 'activity', activityType: 'fertilizing', followedAdvice: null, entryDate: new Date(now - 18 * 86400000), description: 'Applied DAP' },
    ]);

    const result = await getAdviceAdherence('s-1');
    expect(result.evidenceLinks.length).toBe(1);
    expect(result.evidenceLinks[0].hasEvidence).toBe(true);
    expect(result.evidenceLinks[0].matchingActivity.type).toBe('fertilizing');
  });

  it('throws 404 for missing season', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(null);
    await expect(getAdviceAdherence('bad')).rejects.toThrow(/Season not found/);
  });
});

describe('Season History', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns season history with trends', async () => {
    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', fullName: 'Jane' });
    prisma.farmSeason.findMany.mockResolvedValue([
      {
        id: 's-1', cropType: 'maize', farmSizeAcres: 5, plantingDate: new Date(Date.now() - 300 * 86400000),
        expectedHarvestDate: new Date(), status: 'completed', cropFailureReported: false, partialHarvest: false,
        harvestReport: { totalHarvestKg: 2000, yieldPerAcre: 400, salesAmount: 50000 },
        progressScore: { progressScore: 65, performanceClassification: 'slight_delay', riskLevel: 'medium' },
        credibilityAssessment: { credibilityScore: 70, credibilityLevel: 'medium_confidence', confidence: 'medium' },
        officerValidations: [],
        _count: { progressEntries: 8, stageConfirmations: 2 },
      },
      {
        id: 's-2', cropType: 'maize', farmSizeAcres: 5, plantingDate: new Date(Date.now() - 100 * 86400000),
        expectedHarvestDate: new Date(), status: 'completed', cropFailureReported: false, partialHarvest: false,
        harvestReport: { totalHarvestKg: 3000, yieldPerAcre: 600, salesAmount: 75000 },
        progressScore: { progressScore: 82, performanceClassification: 'on_track', riskLevel: 'low' },
        credibilityAssessment: { credibilityScore: 88, credibilityLevel: 'high_confidence', confidence: 'high' },
        officerValidations: [{ id: 'ov-1' }],
        _count: { progressEntries: 15, stageConfirmations: 4 },
      },
    ]);

    const result = await getSeasonHistory('f-1');
    expect(result.totalSeasons).toBe(2);
    expect(result.trends.yield).toBe('improving');
    expect(result.trends.progressScore).toBe('improving');
    expect(result.history).toHaveLength(2);
    expect(result.history[1].vsPreivous.yieldChangePercent).toBe(50);
  });

  it('returns empty history for farmer with no seasons', async () => {
    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', fullName: 'Jane' });
    prisma.farmSeason.findMany.mockResolvedValue([]);

    const result = await getSeasonHistory('f-1');
    expect(result.totalSeasons).toBe(0);
    expect(result.trends.yield).toBe('insufficient_data');
  });

  it('throws 404 for missing farmer', async () => {
    prisma.farmer.findUnique.mockResolvedValue(null);
    await expect(getSeasonHistory('bad')).rejects.toThrow(/Farmer not found/);
  });
});

describe('Season Comparison', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('compares two seasons', async () => {
    const baseSeason = {
      farmerId: 'f-1', cropType: 'maize', farmSizeAcres: 5, plantingDate: new Date(), status: 'completed',
      _count: { progressEntries: 10, stageConfirmations: 3 },
    };

    prisma.farmSeason.findUnique
      .mockResolvedValueOnce({
        id: 's-1', ...baseSeason,
        harvestReport: { totalHarvestKg: 2000, yieldPerAcre: 400 },
        progressScore: { progressScore: 65, performanceClassification: 'slight_delay' },
        credibilityAssessment: { credibilityScore: 70 },
      })
      .mockResolvedValueOnce({
        id: 's-2', ...baseSeason,
        harvestReport: { totalHarvestKg: 3000, yieldPerAcre: 600 },
        progressScore: { progressScore: 82, performanceClassification: 'on_track' },
        credibilityAssessment: { credibilityScore: 88 },
        _count: { progressEntries: 15, stageConfirmations: 4 },
      });

    const result = await compareSeasons('s-1', 's-2');
    expect(result.changes.yield.direction).toBe('improved');
    expect(result.changes.progressScore.direction).toBe('improved');
    expect(result.overallTrend).toBe('improving');
  });

  it('rejects comparison of different farmers', async () => {
    prisma.farmSeason.findUnique
      .mockResolvedValueOnce({ id: 's-1', farmerId: 'f-1', _count: { progressEntries: 0, stageConfirmations: 0 } })
      .mockResolvedValueOnce({ id: 's-2', farmerId: 'f-2', _count: { progressEntries: 0, stageConfirmations: 0 } });

    await expect(compareSeasons('s-1', 's-2')).rejects.toThrow(/same farmer/);
  });
});
