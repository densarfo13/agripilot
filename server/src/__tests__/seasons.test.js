import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    farmer: { findUnique: vi.fn() },
    farmSeason: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    seasonProgressEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    stageConfirmation: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    reminder: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async (fn) => fn(mockPrisma)),
  };
  return { default: mockPrisma };
});

vi.mock('../modules/regionConfig/service.js', () => ({
  DEFAULT_COUNTRY_CODE: 'KE',
  getRegionConfig: () => ({ areaUnit: 'acres', currencyCode: 'KES' }),
  getCropCalendar: (cc, crop) => {
    if (crop === 'maize') return { plantMonths: [3, 4], harvestMonths: [7, 8], growingDays: 120 };
    return null;
  },
}));

vi.mock('../modules/reminders/service.js', () => ({
  generateCropLifecycleReminders: vi.fn().mockResolvedValue([]),
}));

vi.mock('../modules/lifecycle/service.js', () => ({
  STAGE_ORDER: ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'],
}));

import prisma from '../config/database.js';
import {
  createSeason,
  listSeasons,
  getSeasonById,
  updateSeason,
  createProgressEntry,
  createConditionUpdate,
  createStageConfirmation,
  computeExpectedStage,
  getExpectedTimeline,
} from '../modules/seasons/service.js';

const mockFarmer = { id: 'f-1', fullName: 'Test Farmer', countryCode: 'KE' };

describe('Season Service', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ─── Season Creation ────────────────────────────────
  describe('createSeason', () => {
    it('creates a season with auto-computed harvest date', async () => {
      prisma.farmer.findUnique.mockResolvedValue(mockFarmer);
      prisma.farmSeason.findFirst.mockResolvedValue(null); // no existing active
      prisma.farmSeason.create.mockResolvedValue({
        id: 's-1', farmerId: 'f-1', cropType: 'maize', status: 'active',
        plantingDate: new Date('2026-03-15'), expectedHarvestDate: new Date('2026-07-13'),
      });

      const result = await createSeason('f-1', {
        cropType: 'maize', plantingDate: '2026-03-15', farmSizeAcres: 5,
      });

      expect(prisma.farmSeason.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            farmerId: 'f-1',
            cropType: 'maize',
            farmSizeAcres: 5,
            status: 'active',
          }),
        })
      );
      expect(result.id).toBe('s-1');
    });

    it('rejects if farmer not found', async () => {
      prisma.farmer.findUnique.mockResolvedValue(null);
      await expect(createSeason('bad-id', { cropType: 'maize', plantingDate: '2026-03-15', farmSizeAcres: 5 }))
        .rejects.toThrow(/Farmer not found/);
    });

    it('rejects if active season for same crop exists', async () => {
      prisma.farmer.findUnique.mockResolvedValue(mockFarmer);
      prisma.farmSeason.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(createSeason('f-1', { cropType: 'maize', plantingDate: '2026-03-15', farmSizeAcres: 5 }))
        .rejects.toThrow(/active season.*already exists/);
    });

    it('rejects if required fields missing', async () => {
      prisma.farmer.findUnique.mockResolvedValue(mockFarmer);
      await expect(createSeason('f-1', { cropType: 'maize' }))
        .rejects.toThrow(/required/);
    });
  });

  // ─── Season Update ──────────────────────────────────
  describe('updateSeason', () => {
    it('allows updating active season', async () => {
      prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'active' });
      prisma.farmSeason.update.mockResolvedValue({ id: 's-1', seedType: 'hybrid' });

      const result = await updateSeason('s-1', { seedType: 'hybrid' });
      expect(result.seedType).toBe('hybrid');
    });

    it('rejects updating completed season', async () => {
      prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'completed' });
      await expect(updateSeason('s-1', { seedType: 'hybrid' }))
        .rejects.toThrow(/Cannot update a season with status/);
    });
  });

  // ─── Progress Entries ───────────────────────────────
  describe('createProgressEntry', () => {
    it('creates an activity progress entry', async () => {
      prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'active', plantingDate: new Date('2026-03-15') });
      prisma.seasonProgressEntry.create.mockResolvedValue({ id: 'pe-1', entryType: 'activity' });

      const result = await createProgressEntry('s-1', {
        entryType: 'activity', activityType: 'fertilizing', description: 'Applied DAP',
      });
      expect(result.entryType).toBe('activity');
    });

    it('rejects progress on non-active season', async () => {
      prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'completed' });
      await expect(createProgressEntry('s-1', { entryType: 'activity' }))
        .rejects.toThrow(/active seasons/);
    });

    it('rejects invalid entry type', async () => {
      prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'active' });
      await expect(createProgressEntry('s-1', { entryType: 'invalid' }))
        .rejects.toThrow(/entryType must be one of/);
    });
  });

  // ─── Condition Update ───────────────────────────────
  describe('createConditionUpdate', () => {
    it('creates a condition entry', async () => {
      prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'active', plantingDate: new Date('2026-03-15') });
      prisma.seasonProgressEntry.create.mockResolvedValue({ id: 'pe-2', entryType: 'condition', cropCondition: 'good' });

      const result = await createConditionUpdate('s-1', { cropCondition: 'good' });
      expect(result.cropCondition).toBe('good');
    });

    it('rejects without cropCondition', async () => {
      await expect(createConditionUpdate('s-1', {}))
        .rejects.toThrow(/cropCondition is required/);
    });
  });

  // ─── Stage Confirmation ─────────────────────────────
  describe('createStageConfirmation', () => {
    it('creates confirmation and detects mismatch', async () => {
      prisma.farmSeason.findUnique.mockResolvedValue({
        id: 's-1', plantingDate: new Date('2026-03-15'), cropType: 'maize',
        farmer: { countryCode: 'KE' },
      });
      prisma.stageConfirmation.create.mockImplementation(({ data }) => Promise.resolve({ id: 'sc-1', ...data }));

      // Confirm a stage that differs from expected
      const result = await createStageConfirmation('s-1', { confirmedStage: 'pre_planting' });
      expect(result).toHaveProperty('expectedStage');
      expect(result).toHaveProperty('confirmedStage', 'pre_planting');
      expect(result).toHaveProperty('isMismatch');
    });

    it('rejects invalid confirmedStage', async () => {
      prisma.farmSeason.findUnique.mockResolvedValue({
        id: 's-1', plantingDate: new Date(), cropType: 'maize', farmer: { countryCode: 'KE' },
      });
      await expect(createStageConfirmation('s-1', { confirmedStage: 'invalid' }))
        .rejects.toThrow(/confirmedStage is required/);
    });
  });

  // ─── Expected Stage Computation ─────────────────────
  describe('computeExpectedStage', () => {
    it('returns planting for day 0', () => {
      const today = new Date();
      expect(computeExpectedStage(today, 'maize', 'KE')).toBe('planting');
    });

    it('returns pre_planting for future date', () => {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      expect(computeExpectedStage(future, 'maize', 'KE')).toBe('pre_planting');
    });

    it('returns post_harvest for very old planting', () => {
      const old = new Date();
      old.setDate(old.getDate() - 200);
      expect(computeExpectedStage(old, 'maize', 'KE')).toBe('post_harvest');
    });

    it('returns vegetative around day 30 of 120-day crop', () => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      expect(computeExpectedStage(d, 'maize', 'KE')).toBe('vegetative');
    });

    it('returns flowering around day 60 of 120-day crop', () => {
      const d = new Date();
      d.setDate(d.getDate() - 60);
      expect(computeExpectedStage(d, 'maize', 'KE')).toBe('flowering');
    });

    it('returns harvest around day 90 of 120-day crop', () => {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      expect(computeExpectedStage(d, 'maize', 'KE')).toBe('harvest');
    });
  });

  // ─── Expected Timeline ──────────────────────────────
  describe('getExpectedTimeline', () => {
    it('returns 5 stages with dates', () => {
      const timeline = getExpectedTimeline('2026-03-15', 'maize', 'KE');
      expect(timeline).toHaveLength(5);
      expect(timeline[0].stage).toBe('planting');
      expect(timeline[1].stage).toBe('vegetative');
      expect(timeline[2].stage).toBe('flowering');
      expect(timeline[3].stage).toBe('harvest');
      expect(timeline[4].stage).toBe('post_harvest');

      // Each has expected dates
      for (const s of timeline) {
        expect(s).toHaveProperty('expectedStartDate');
        expect(s).toHaveProperty('expectedEndDate');
        expect(s).toHaveProperty('durationDays');
      }
    });

    it('scales to crop growing days (120 for maize)', () => {
      const timeline = getExpectedTimeline('2026-03-15', 'maize', 'KE');
      const totalDays = timeline.reduce((sum, s) => sum + s.durationDays, 0);
      // Total should be ~144 days (120% of growing period)
      expect(totalDays).toBe(144);
    });
  });
});
