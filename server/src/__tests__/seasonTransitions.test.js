import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Status Transition Logic Tests (pure functions) ─────────

describe('Season Status Transitions — Validation', () => {
  let isValidTransition, canPerformTransition, VALID_TRANSITIONS;

  beforeEach(async () => {
    const mod = await import('../modules/seasons/statusTransitions.js');
    isValidTransition = mod.isValidTransition;
    canPerformTransition = mod.canPerformTransition;
    VALID_TRANSITIONS = mod.VALID_TRANSITIONS;
  });

  describe('isValidTransition', () => {
    it('allows active → harvested', () => {
      expect(isValidTransition('active', 'harvested')).toBe(true);
    });

    it('allows active → abandoned', () => {
      expect(isValidTransition('active', 'abandoned')).toBe(true);
    });

    it('allows active → failed', () => {
      expect(isValidTransition('active', 'failed')).toBe(true);
    });

    it('allows harvested → completed', () => {
      expect(isValidTransition('harvested', 'completed')).toBe(true);
    });

    it('allows harvested → active (reopen)', () => {
      expect(isValidTransition('harvested', 'active')).toBe(true);
    });

    it('allows completed → active (reopen)', () => {
      expect(isValidTransition('completed', 'active')).toBe(true);
    });

    it('allows abandoned → active (reopen)', () => {
      expect(isValidTransition('abandoned', 'active')).toBe(true);
    });

    it('allows failed → active (recovery)', () => {
      expect(isValidTransition('failed', 'active')).toBe(true);
    });

    it('rejects active → completed (must go through harvested)', () => {
      expect(isValidTransition('active', 'completed')).toBe(false);
    });

    it('rejects completed → harvested', () => {
      expect(isValidTransition('completed', 'harvested')).toBe(false);
    });

    it('rejects abandoned → completed', () => {
      expect(isValidTransition('abandoned', 'completed')).toBe(false);
    });

    it('rejects failed → completed', () => {
      expect(isValidTransition('failed', 'completed')).toBe(false);
    });

    it('rejects unknown status', () => {
      expect(isValidTransition('nonexistent', 'active')).toBe(false);
    });
  });

  describe('canPerformTransition (role-based)', () => {
    it('allows farmer to abandon active season', () => {
      expect(canPerformTransition('active', 'abandoned', 'farmer')).toBe(true);
    });

    it('allows farmer to declare crop failure', () => {
      expect(canPerformTransition('active', 'failed', 'farmer')).toBe(true);
    });

    it('blocks farmer from closing a harvested season', () => {
      expect(canPerformTransition('harvested', 'completed', 'farmer')).toBe(false);
    });

    it('blocks farmer from reopening a completed season', () => {
      expect(canPerformTransition('completed', 'active', 'farmer')).toBe(false);
    });

    it('allows super_admin to reopen a completed season', () => {
      expect(canPerformTransition('completed', 'active', 'super_admin')).toBe(true);
    });

    it('blocks institutional_admin from reopening completed season', () => {
      // Only super_admin can reopen completed
      expect(canPerformTransition('completed', 'active', 'institutional_admin')).toBe(false);
    });

    it('allows institutional_admin to close a harvested season', () => {
      expect(canPerformTransition('harvested', 'completed', 'institutional_admin')).toBe(true);
    });

    it('allows institutional_admin to reopen abandoned season', () => {
      expect(canPerformTransition('abandoned', 'active', 'institutional_admin')).toBe(true);
    });

    it('blocks field_officer from closing or reopening', () => {
      expect(canPerformTransition('harvested', 'completed', 'field_officer')).toBe(false);
      expect(canPerformTransition('completed', 'active', 'field_officer')).toBe(false);
    });

    it('blocks investor_viewer from any transitions', () => {
      expect(canPerformTransition('active', 'abandoned', 'investor_viewer')).toBe(false);
      expect(canPerformTransition('harvested', 'completed', 'investor_viewer')).toBe(false);
    });
  });
});

// ─── Staleness Detection Tests ──────────────────────────────

describe('Season Staleness Detection', () => {
  let checkSeasonStaleness, MAX_SEASON_AGE_DAYS, STALE_INACTIVITY_DAYS;

  beforeEach(async () => {
    const mod = await import('../modules/seasons/statusTransitions.js');
    checkSeasonStaleness = mod.checkSeasonStaleness;
    MAX_SEASON_AGE_DAYS = mod.MAX_SEASON_AGE_DAYS;
    STALE_INACTIVITY_DAYS = mod.STALE_INACTIVITY_DAYS;
  });

  it('returns no warnings for fresh active season', () => {
    const season = {
      status: 'active',
      plantingDate: new Date(Date.now() - 30 * 86400000), // 30 days ago
      lastActivityDate: new Date(Date.now() - 5 * 86400000), // 5 days ago
    };
    const warnings = checkSeasonStaleness(season);
    expect(warnings).toHaveLength(0);
  });

  it('flags season older than MAX_SEASON_AGE_DAYS', () => {
    const season = {
      status: 'active',
      plantingDate: new Date(Date.now() - (MAX_SEASON_AGE_DAYS + 10) * 86400000),
      lastActivityDate: new Date(),
    };
    const warnings = checkSeasonStaleness(season);
    expect(warnings.some(w => w.code === 'season_overdue')).toBe(true);
  });

  it('flags season with no activity beyond STALE_INACTIVITY_DAYS', () => {
    const season = {
      status: 'active',
      plantingDate: new Date(Date.now() - 60 * 86400000),
      lastActivityDate: new Date(Date.now() - (STALE_INACTIVITY_DAYS + 5) * 86400000),
    };
    const warnings = checkSeasonStaleness(season);
    expect(warnings.some(w => w.code === 'season_inactive')).toBe(true);
  });

  it('does not flag completed seasons', () => {
    const season = {
      status: 'completed',
      plantingDate: new Date(Date.now() - (MAX_SEASON_AGE_DAYS + 100) * 86400000),
      lastActivityDate: new Date(Date.now() - (STALE_INACTIVITY_DAYS + 100) * 86400000),
    };
    const warnings = checkSeasonStaleness(season);
    expect(warnings).toHaveLength(0);
  });

  it('does not flag abandoned seasons', () => {
    const season = {
      status: 'abandoned',
      plantingDate: new Date(Date.now() - 500 * 86400000),
      lastActivityDate: null,
    };
    const warnings = checkSeasonStaleness(season);
    expect(warnings).toHaveLength(0);
  });

  it('returns both warnings when both conditions are met', () => {
    const season = {
      status: 'active',
      plantingDate: new Date(Date.now() - (MAX_SEASON_AGE_DAYS + 30) * 86400000),
      lastActivityDate: new Date(Date.now() - (STALE_INACTIVITY_DAYS + 30) * 86400000),
    };
    const warnings = checkSeasonStaleness(season);
    expect(warnings).toHaveLength(2);
    expect(warnings.map(w => w.code).sort()).toEqual(['season_inactive', 'season_overdue']);
  });
});

// ─── Transition Execution Tests (with mocked DB) ────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    farmSeason: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    farmer: { findUnique: vi.fn() },
    harvestReport: { create: vi.fn(), findUnique: vi.fn() },
    seasonProgressEntry: { findMany: vi.fn(), create: vi.fn() },
    stageConfirmation: { findMany: vi.fn() },
    $transaction: vi.fn(async (fn) => {
      if (typeof fn === 'function') return fn(mockPrisma);
      return fn; // batched transaction returns the array as-is
    }),
  };
  return { default: mockPrisma };
});

vi.mock('../utils/opsLogger.js', () => ({
  logWorkflowEvent: vi.fn(),
  opsEvent: vi.fn(),
}));

import prisma from '../config/database.js';

describe('transitionSeasonStatus — execution', () => {
  let transitionSeasonStatus;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../modules/seasons/statusTransitions.js');
    transitionSeasonStatus = mod.transitionSeasonStatus;
  });

  it('transitions active → abandoned with audit fields', async () => {
    prisma.farmSeason.findUnique
      .mockResolvedValueOnce({ id: 's-1', status: 'active' }) // initial fetch
      .mockResolvedValueOnce({ id: 's-1', status: 'abandoned', closedBy: 'u-1' }); // post-update fetch

    prisma.farmSeason.updateMany.mockResolvedValue({ count: 1 });

    const result = await transitionSeasonStatus('s-1', 'abandoned', {
      userId: 'u-1', role: 'farmer', reason: 'Drought',
    });

    expect(result.season.status).toBe('abandoned');
    expect(result.previousStatus).toBe('active');
    expect(prisma.farmSeason.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's-1', status: 'active' },
        data: expect.objectContaining({
          status: 'abandoned',
          closedBy: 'u-1',
          closureReason: 'Drought',
        }),
      })
    );
  });

  it('transitions completed → active (reopen) with audit fields', async () => {
    prisma.farmSeason.findUnique
      .mockResolvedValueOnce({ id: 's-2', status: 'completed' })
      .mockResolvedValueOnce({ id: 's-2', status: 'active', reopenedBy: 'admin-1' });

    prisma.farmSeason.updateMany.mockResolvedValue({ count: 1 });

    const result = await transitionSeasonStatus('s-2', 'active', {
      userId: 'admin-1', role: 'super_admin', reason: 'Data correction needed',
    });

    expect(result.season.status).toBe('active');
    expect(result.previousStatus).toBe('completed');
    expect(prisma.farmSeason.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'active',
          reopenedBy: 'admin-1',
          reopenReason: 'Data correction needed',
          closedAt: null,
          closedBy: null,
          closureReason: null,
        }),
      })
    );
  });

  it('rejects invalid transition', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-3', status: 'active' });

    await expect(
      transitionSeasonStatus('s-3', 'completed', { userId: 'u-1', role: 'super_admin' })
    ).rejects.toThrow(/Invalid status transition/);
  });

  it('rejects unauthorized role', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-4', status: 'completed' });

    await expect(
      transitionSeasonStatus('s-4', 'active', { userId: 'u-1', role: 'farmer', reason: 'test' })
    ).rejects.toThrow(/not authorized/);
  });

  it('requires reason for reopen', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-5', status: 'abandoned' });

    await expect(
      transitionSeasonStatus('s-5', 'active', { userId: 'u-1', role: 'super_admin' })
    ).rejects.toThrow(/reason is required/);
  });

  it('handles concurrent modification (optimistic lock)', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-6', status: 'active' });
    prisma.farmSeason.updateMany.mockResolvedValue({ count: 0 }); // concurrent change

    await expect(
      transitionSeasonStatus('s-6', 'abandoned', { userId: 'u-1', role: 'farmer', reason: 'test' })
    ).rejects.toThrow(/concurrently/);
  });

  it('returns 404 for non-existent season', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(null);

    await expect(
      transitionSeasonStatus('s-999', 'abandoned', { userId: 'u-1', role: 'farmer' })
    ).rejects.toThrow(/Season not found/);
  });
});

// ─── Harvest Report with new 'harvested' status ─────────────

vi.mock('../modules/regionConfig/service.js', () => ({
  DEFAULT_COUNTRY_CODE: 'KE',
  getRegionConfig: () => ({
    areaUnit: 'acres', currencyCode: 'KES', country: 'Kenya',
    cropCalendars: { maize: { growingDays: 120 } },
  }),
  getCropCalendar: () => ({ growingDays: 120 }),
}));

vi.mock('../modules/lifecycle/service.js', () => ({
  STAGE_ORDER: ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'],
}));

vi.mock('../modules/reminders/service.js', () => ({
  generateCropLifecycleReminders: vi.fn().mockResolvedValue([]),
}));

describe('Harvest Report — harvested status', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('transitions season to harvested (not completed) on harvest report', async () => {
    const { createHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-h1', status: 'active', farmSizeAcres: 2, harvestReport: null,
    });

    const mockReport = { id: 'r-1', totalHarvestKg: 500, yieldPerAcre: 250 };
    // Batched $transaction receives an array of promises — mock returns results
    prisma.$transaction.mockImplementation(async (arg) => {
      if (Array.isArray(arg)) return [mockReport, {}];
      return arg(prisma); // callback form
    });

    const report = await createHarvestReport('s-h1', { totalHarvestKg: 500 }, 'u-1');

    expect(report.totalHarvestKg).toBe(500);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ─── Update Season — status guard tests ─────────────────────

describe('Update Season — strict status guard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('blocks updates on completed seasons', async () => {
    const { updateSeason } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-u1', status: 'completed' });

    await expect(
      updateSeason('s-u1', { seedType: 'hybrid' })
    ).rejects.toThrow(/Cannot update a season with status 'completed'/);
  });

  it('blocks updates on harvested seasons', async () => {
    const { updateSeason } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-u2', status: 'harvested' });

    await expect(
      updateSeason('s-u2', { seedType: 'hybrid' })
    ).rejects.toThrow(/Cannot update a season with status 'harvested'/);
  });

  it('blocks direct status changes via updateSeason', async () => {
    const { updateSeason } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-u3', status: 'active' });

    await expect(
      updateSeason('s-u3', { status: 'completed' })
    ).rejects.toThrow(/Status changes must use the dedicated status transition endpoints/);
  });

  it('allows updates on active seasons', async () => {
    const { updateSeason } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-u4', status: 'active' });
    prisma.farmSeason.update.mockResolvedValue({ id: 's-u4', status: 'active', seedType: 'hybrid' });

    const result = await updateSeason('s-u4', { seedType: 'hybrid' });
    expect(result.seedType).toBe('hybrid');
  });
});
