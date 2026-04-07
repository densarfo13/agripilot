import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database.js', () => ({
  default: {
    farmer: { findUnique: vi.fn() },
    farmSeason: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    harvestReport: { create: vi.fn(), findUnique: vi.fn() },
    progressScore: { findUnique: vi.fn(), upsert: vi.fn() },
    seasonProgressEntry: { findMany: vi.fn() },
    stageConfirmation: { findMany: vi.fn() },
    $transaction: vi.fn(),
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
import { createHarvestReport, getHarvestReport } from '../modules/seasons/harvest.js';
import { getPerformanceProfile, getInvestorIntelligence } from '../modules/seasons/profile.js';

describe('Harvest Report', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates harvest report and closes season', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', farmSizeAcres: 5, harvestReport: null,
    });
    const mockReport = { id: 'hr-1', seasonId: 's-1', totalHarvestKg: 2000, yieldPerAcre: 400 };
    // Interactive transaction: callback receives a tx proxy that delegates to prisma
    prisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        farmSeason: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        harvestReport: { create: vi.fn().mockResolvedValue(mockReport) },
      };
      return cb(tx);
    });

    const result = await createHarvestReport('s-1', { totalHarvestKg: 2000 });
    expect(result.totalHarvestKg).toBe(2000);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects for non-active season', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'completed', harvestReport: null });
    await expect(createHarvestReport('s-1', { totalHarvestKg: 100 }))
      .rejects.toThrow(/active seasons/);
  });

  it('rejects duplicate harvest report', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', harvestReport: { id: 'existing' },
    });
    await expect(createHarvestReport('s-1', { totalHarvestKg: 100 }))
      .rejects.toThrow(/already exists/);
  });

  it('rejects 0 kg harvest without crop failure flag', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'active', harvestReport: null, cropFailureReported: false });
    await expect(createHarvestReport('s-1', { totalHarvestKg: 0 }))
      .rejects.toThrow(/0 kg requires crop failure/);
  });

  it('rejects negative harvest quantity', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'active', harvestReport: null, cropFailureReported: false });
    await expect(createHarvestReport('s-1', { totalHarvestKg: -5 }))
      .rejects.toThrow(/non-negative number/);
  });

  it('allows 0 kg harvest when cropFailureReported is true', async () => {
    const mockReport = { id: 'hr-1', totalHarvestKg: 0, yieldPerAcre: null };
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'active', harvestReport: null, cropFailureReported: true, farmSizeAcres: 5 });
    prisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        farmSeason: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        harvestReport: { create: vi.fn().mockResolvedValue(mockReport) },
      };
      return cb(tx);
    });

    const result = await createHarvestReport('s-1', { totalHarvestKg: 0 });
    expect(result.totalHarvestKg).toBe(0);
    expect(result.yieldPerAcre).toBeNull();
  });

  it('allows 0 kg harvest when isCropFailure passed in body', async () => {
    const mockReport = { id: 'hr-1', totalHarvestKg: 0, yieldPerAcre: null };
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'active', harvestReport: null, cropFailureReported: false, farmSizeAcres: 5 });
    prisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        farmSeason: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        harvestReport: { create: vi.fn().mockResolvedValue(mockReport) },
      };
      return cb(tx);
    });

    const result = await createHarvestReport('s-1', { totalHarvestKg: 0, isCropFailure: true });
    expect(result.totalHarvestKg).toBe(0);
  });

  it('rejects missing season', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(null);
    await expect(createHarvestReport('bad', { totalHarvestKg: 100 }))
      .rejects.toThrow(/Season not found/);
  });

  it('gets harvest report with season info', async () => {
    prisma.harvestReport.findUnique.mockResolvedValue({
      id: 'hr-1', totalHarvestKg: 2000, yieldPerAcre: 400,
      season: { id: 's-1', cropType: 'maize', farmer: { fullName: 'Test' } },
    });

    const result = await getHarvestReport('s-1');
    expect(result.totalHarvestKg).toBe(2000);
    expect(result.season.cropType).toBe('maize');
  });

  it('throws 404 for missing harvest report', async () => {
    prisma.harvestReport.findUnique.mockResolvedValue(null);
    await expect(getHarvestReport('bad')).rejects.toThrow(/No harvest report found/);
  });
});

describe('Performance Profile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const mockFarmer = {
    id: 'f-1', fullName: 'Jane', phone: '123', region: 'Nakuru',
    district: null, countryCode: 'KE', primaryCrop: 'maize',
    farmSizeAcres: 5, yearsExperience: 3, currentStage: 'vegetative',
    registrationStatus: 'approved', createdAt: new Date(),
  };

  it('returns structured profile with seasons', async () => {
    prisma.farmer.findUnique.mockResolvedValue(mockFarmer);
    prisma.farmSeason.findMany.mockResolvedValue([
      {
        id: 's-1', cropType: 'maize', farmSizeAcres: 5, plantingDate: new Date(),
        expectedHarvestDate: new Date(), status: 'completed',
        harvestReport: { totalHarvestKg: 2000, yieldPerAcre: 400, salesAmount: 50000 },
        progressScore: { progressScore: 78, performanceClassification: 'on_track', riskLevel: 'low' },
        _count: { progressEntries: 12, stageConfirmations: 3 },
      },
    ]);

    const result = await getPerformanceProfile('f-1');

    expect(result.farmer.id).toBe('f-1');
    expect(result.summary.totalSeasons).toBe(1);
    expect(result.summary.completedSeasons).toBe(1);
    expect(result.yieldHistory).toHaveLength(1);
    expect(result.reliabilitySignals.length).toBeGreaterThan(0);
    expect(result.seasons).toHaveLength(1);
  });

  it('returns empty profile for farmer with no seasons', async () => {
    prisma.farmer.findUnique.mockResolvedValue(mockFarmer);
    prisma.farmSeason.findMany.mockResolvedValue([]);

    const result = await getPerformanceProfile('f-1');
    expect(result.summary.totalSeasons).toBe(0);
    expect(result.yieldHistory).toHaveLength(0);
    expect(result.seasons).toHaveLength(0);
  });

  it('throws 404 for nonexistent farmer', async () => {
    prisma.farmer.findUnique.mockResolvedValue(null);
    await expect(getPerformanceProfile('bad')).rejects.toThrow(/Farmer not found/);
  });

  it('detects improving productivity trend', async () => {
    prisma.farmer.findUnique.mockResolvedValue(mockFarmer);
    prisma.farmSeason.findMany.mockResolvedValue([
      {
        id: 's-2', cropType: 'maize', farmSizeAcres: 5, plantingDate: new Date(),
        expectedHarvestDate: new Date(), status: 'completed',
        harvestReport: { totalHarvestKg: 3000, yieldPerAcre: 600, salesAmount: null },
        progressScore: { progressScore: 80, performanceClassification: 'on_track', riskLevel: 'low' },
        _count: { progressEntries: 10, stageConfirmations: 2 },
      },
      {
        id: 's-1', cropType: 'maize', farmSizeAcres: 5, plantingDate: new Date(Date.now() - 180 * 86400000),
        expectedHarvestDate: new Date(), status: 'completed',
        harvestReport: { totalHarvestKg: 2000, yieldPerAcre: 400, salesAmount: null },
        progressScore: { progressScore: 65, performanceClassification: 'slight_delay', riskLevel: 'medium' },
        _count: { progressEntries: 6, stageConfirmations: 1 },
      },
    ]);

    const result = await getPerformanceProfile('f-1');
    expect(result.summary.productivityTrend).toBe('improving');
  });
});

describe('Investor Intelligence', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('strips phone from investor view', async () => {
    prisma.farmer.findUnique.mockResolvedValue({
      id: 'f-1', fullName: 'Jane', phone: '0712345678', region: 'Nakuru',
      district: null, countryCode: 'KE', primaryCrop: 'maize',
      farmSizeAcres: 5, yearsExperience: 3, currentStage: 'vegetative',
      registrationStatus: 'approved', createdAt: new Date(),
    });
    prisma.farmSeason.findMany.mockResolvedValue([]);

    const result = await getInvestorIntelligence('f-1');
    expect(result.farmer).not.toHaveProperty('phone');
    expect(result.farmer.fullName).toBe('Jane');
    expect(result).toHaveProperty('seasonOutcomes');
    expect(result).toHaveProperty('reliabilitySignals');
  });
});
