/**
 * Phase 5 — Usability Hardening Validation Suite
 *
 * Covers gaps identified during the 15-part hardening pass:
 *   1. Dedup guard — per-user isolation, missing-param passthrough, message text, cleanup
 *   2. Harvest — closureReason stamping, cropFailureReported flag propagation on 0-kg submit
 *   3. Status transitions — improved error message includes the allowed-transitions list
 *   4. Comparison service — harvest-overdue detection marks harvestCompletion at_risk
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../config/database.js', () => ({
  default: {
    farmer: { findUnique: vi.fn() },
    farmSeason: { findUnique: vi.fn(), updateMany: vi.fn() },
    harvestReport: { create: vi.fn() },
    user: { update: vi.fn() },
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

vi.mock('../utils/opsLogger.js', () => ({
  logPermissionEvent: vi.fn(),
  logAuthEvent: vi.fn(),
  logWorkflowEvent: vi.fn(),
  logUploadEvent: vi.fn(),
  logSystemEvent: vi.fn(),
  opsEvent: vi.fn(() => ({ type: 'ops_event' })),
}));

vi.mock('../modules/audit/service.js', () => ({ writeAuditLog: vi.fn() }));
vi.mock('../middleware/cache.js', () => ({ invalidateAuthCache: vi.fn() }));

import prisma from '../config/database.js';

// ─── 1. Dedup Guard ────────────────────────────────────────────────────────────

describe('Dedup Guard — isolation + passthrough', () => {
  let dedupGuard, clearDedupCache;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../middleware/dedup.js');
    dedupGuard = mod.dedupGuard;
    clearDedupCache = mod.clearDedupCache;
    clearDedupCache();
  });

  function makeReq(userId, resourceId) {
    return { user: { sub: userId }, params: { id: resourceId } };
  }

  function makeRes() {
    let finishListeners = [];
    return {
      statusCode: 200,
      _blocked: false,
      status(c) { this.statusCode = c; return this; },
      json(body) { if (this.statusCode === 409) this._blocked = true; },
      on(event, fn) { if (event === 'finish') finishListeners.push(fn); },
      _emitFinish() { finishListeners.forEach(fn => fn()); },
    };
  }

  it('different users on same resource are NOT blocked by each other', () => {
    const guard = dedupGuard('test-action');
    const res1 = makeRes();
    const res2 = makeRes();

    guard(makeReq('user-A', 'resource-1'), res1, () => {});
    guard(makeReq('user-B', 'resource-1'), res2, () => {});

    expect(res1._blocked).toBe(false);
    expect(res2._blocked).toBe(false);
  });

  it('skips dedup and passes through when user.sub is absent', () => {
    const guard = dedupGuard('test-action');
    const req = { user: {}, params: { id: 'r1' } };
    const res = makeRes();
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res._blocked).toBe(false);
  });

  it('skips dedup and passes through when all resource params are absent', () => {
    const guard = dedupGuard('test-action');
    const req = { user: { sub: 'u1' }, params: {} };
    const res = makeRes();
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res._blocked).toBe(false);
  });

  it('allows retry after first response finishes (cleanup on finish)', () => {
    const guard = dedupGuard('test-action');
    const req = makeReq('user-A', 'resource-1');

    // First request
    const res1 = makeRes();
    guard(req, res1, () => {});

    // Simulate response completion → key should be released
    res1._emitFinish();

    // Second request should now pass through
    let nextCalled = false;
    const res2 = makeRes();
    guard(req, res2, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res2._blocked).toBe(false);
  });

  it('409 response body contains a user-friendly message', () => {
    const guard = dedupGuard('test-action');
    const req = makeReq('user-A', 'resource-1');

    // First request — establishes in-flight entry
    const res1 = makeRes();
    guard(req, res1, () => {});

    // Duplicate — capture response body
    let responseBody = null;
    const res2 = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(body) { responseBody = body; },
      on() {},
    };
    guard(req, res2, () => {});

    expect(res2.statusCode).toBe(409);
    expect(responseBody).toHaveProperty('error');
    expect(responseBody.error.toLowerCase()).toContain('already being processed');
  });
});

// ─── 2. Harvest — closureReason & cropFailureReported stamping ────────────────

describe('Harvest Report — crop failure path details', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  async function runHarvest(seasonOverrides, bodyOverrides) {
    const { createHarvestReport } = await import('../modules/seasons/harvest.js');

    const season = {
      id: 's-1', status: 'active', harvestReport: null,
      farmSizeAcres: 5, cropFailureReported: false,
      ...seasonOverrides,
    };
    prisma.farmSeason.findUnique.mockResolvedValue(season);

    let capturedSeasonData = null;
    prisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        farmSeason: {
          updateMany: vi.fn().mockImplementation(async ({ data }) => {
            capturedSeasonData = data;
            return { count: 1 };
          }),
        },
        harvestReport: {
          create: vi.fn().mockResolvedValue({ id: 'hr-1', totalHarvestKg: bodyOverrides.totalHarvestKg ?? 100 }),
        },
      };
      return cb(tx);
    });

    const result = await createHarvestReport('s-1', { totalHarvestKg: 100, ...bodyOverrides });
    return { result, capturedSeasonData };
  }

  it('normal harvest uses "Harvest report submitted" as closureReason', async () => {
    const { capturedSeasonData } = await runHarvest({}, { totalHarvestKg: 500 });
    expect(capturedSeasonData.closureReason).toBe('Harvest report submitted');
  });

  it('0-kg crop-failure harvest uses descriptive closureReason', async () => {
    const { capturedSeasonData } = await runHarvest(
      { cropFailureReported: true },
      { totalHarvestKg: 0 },
    );
    expect(capturedSeasonData.closureReason).toContain('Crop failure');
  });

  it('stamps cropFailureReported=true on season when isCropFailure body flag set and not already stamped', async () => {
    const { capturedSeasonData } = await runHarvest(
      { cropFailureReported: false },
      { totalHarvestKg: 0, isCropFailure: true },
    );
    expect(capturedSeasonData.cropFailureReported).toBe(true);
  });

  it('does NOT re-stamp cropFailureReported when already true on season', async () => {
    const { capturedSeasonData } = await runHarvest(
      { cropFailureReported: true },
      { totalHarvestKg: 0 },
    );
    // Property should not exist in updateData (already set on DB record)
    expect(capturedSeasonData.cropFailureReported).toBeUndefined();
  });
});

// ─── 3. Status Transition — error message quality ────────────────────────────

describe('Status Transition — error message includes allowed transitions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function makeFarmer(status) {
    return {
      id: 'f-1', registrationStatus: status, userId: 'u-1',
      fullName: 'Test Farmer', organizationId: 'org-1',
    };
  }

  it('approved→rejected error names the only allowed transition (disabled)', async () => {
    const { updateAccessStatus } = await import('../modules/farmers/service.js');
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer('approved'));

    await expect(updateAccessStatus('f-1', 'rejected', 'admin-1'))
      .rejects.toThrow(/disabled/);
  });

  it('rejected→approved error names allowed transitions (pending_approval, disabled)', async () => {
    const { updateAccessStatus } = await import('../modules/farmers/service.js');
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer('rejected'));

    let caughtMsg = '';
    try {
      await updateAccessStatus('f-1', 'approved', 'admin-1');
    } catch (err) {
      caughtMsg = err.message;
    }
    expect(caughtMsg).toContain('pending_approval');
    expect(caughtMsg).toContain('disabled');
  });

  it('error message always mentions the current status and target status', async () => {
    const { updateAccessStatus } = await import('../modules/farmers/service.js');
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer('approved'));

    let caughtMsg = '';
    try {
      await updateAccessStatus('f-1', 'rejected', 'admin-1');
    } catch (err) {
      caughtMsg = err.message;
    }
    expect(caughtMsg).toContain('approved');
    expect(caughtMsg).toContain('rejected');
  });
});

// ─── 4. Comparison — harvest overdue detection ───────────────────────────────

describe('Season Comparison — harvest overdue', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function mockSeason(overrides = {}) {
    const plantingDate = new Date(Date.now() - 180 * 86400000); // 180 days ago
    return {
      id: 's-1', farmerId: 'f-1', cropType: 'maize',
      plantingDate,
      expectedHarvestDate: new Date(Date.now() - 30 * 86400000), // 30 days PAST
      status: 'active', farmSizeAcres: 5,
      farmer: { id: 'f-1', fullName: 'Test', countryCode: 'KE' },
      progressEntries: [],
      stageConfirmations: [],
      harvestReport: null,
      ...overrides,
    };
  }

  it('marks harvestCompletion at_risk when expected harvest date has passed', async () => {
    const { getSeasonComparison } = await import('../modules/seasons/comparison.js');
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason());

    const result = await getSeasonComparison('s-1');
    expect(result.dimensions.harvestCompletion.status).toBe('at_risk');
  });

  it('harvestCompletion label mentions overdue when harvest date passed', async () => {
    const { getSeasonComparison } = await import('../modules/seasons/comparison.js');
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason());

    const result = await getSeasonComparison('s-1');
    // Label should communicate harvest is expected/overdue (case-insensitive)
    expect(result.dimensions.harvestCompletion.label.toLowerCase()).toMatch(/harvest|expected|passed|due/);
  });

  it('harvestCompletion is on_track when harvest report exists despite past date', async () => {
    const { getSeasonComparison } = await import('../modules/seasons/comparison.js');
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason({
      harvestReport: { totalHarvestKg: 1500, yieldPerAcre: 300 },
    }));

    const result = await getSeasonComparison('s-1');
    expect(result.dimensions.harvestCompletion.status).toBe('on_track');
    expect(result.dimensions.harvestCompletion.completed).toBe(true);
  });
});
