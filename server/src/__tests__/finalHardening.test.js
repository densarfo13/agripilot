import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Final Hardening Test Suite
 *
 * Focused regression tests for the highest-risk gaps remaining before
 * limited-scale production. Covers:
 *
 * A. Cross-organization access denial
 * B. Season transition full flow (close, reopen, failure, correction)
 * C. Harvest report duplicate/correction safety
 * D. Registration duplicate phone guard
 * E. Evidence upload application-status restriction
 * F. Season creation duplicate guard
 * G. Farmer invite duplicate phone guard
 * H. Application workflow audit atomicity
 */

// ─── Shared Prisma mock ────────────────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    farmer: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    application: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn(), count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn() },
    reviewNote: { create: vi.fn() },
    reviewAssignment: { create: vi.fn() },
    evidenceFile: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    farmSeason: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    seasonProgressEntry: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    stageConfirmation: { findMany: vi.fn(), create: vi.fn() },
    harvestReport: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(async (arg) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      return arg;
    }),
    $queryRaw: vi.fn(),
  };
  return { default: mockPrisma };
});

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

vi.mock('../utils/opsLogger.js', () => ({
  logWorkflowEvent: vi.fn(),
  logAuthEvent: vi.fn(),
  logPermissionEvent: vi.fn(),
  logUploadEvent: vi.fn(),
  opsEvent: vi.fn(),
}));

vi.mock('../middleware/auth.js', () => ({
  invalidateAuthCache: vi.fn(),
}));

import prisma from '../config/database.js';

// ═══════════════════════════════════════════════════════════
//  A. CROSS-ORGANIZATION ACCESS DENIAL
// ═══════════════════════════════════════════════════════════

describe('Cross-Organization Access Denial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('orgScope middleware — query builders', () => {
    let orgWhereFarmer, orgWhereApplication, orgWhereUser, verifyOrgAccess, extractOrganization, clearOrgCache;

    beforeEach(async () => {
      const orgModule = await import('../middleware/orgScope.js');
      orgWhereFarmer = orgModule.orgWhereFarmer;
      orgWhereApplication = orgModule.orgWhereApplication;
      orgWhereUser = orgModule.orgWhereUser;
      verifyOrgAccess = orgModule.verifyOrgAccess;
      extractOrganization = orgModule.extractOrganization;
      clearOrgCache = orgModule.clearOrgCache;
      clearOrgCache();
    });

    it('field_officer query is scoped to own org', () => {
      const req = { organizationId: 'org-A', isCrossOrg: false };
      expect(orgWhereFarmer(req)).toEqual({ organizationId: 'org-A' });
    });

    it('reviewer query is scoped to own org', () => {
      const req = { organizationId: 'org-B', isCrossOrg: false };
      expect(orgWhereApplication(req)).toEqual({ farmer: { organizationId: 'org-B' } });
    });

    it('institutional_admin cannot override org via query param', () => {
      const req = { user: { sub: 'u-1', role: 'institutional_admin' }, query: { orgId: 'org-OTHER' } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-A' });

      extractOrganization(req, res, () => {
        // Should be scoped to user's org, not the query param
        expect(req.organizationId).toBe('org-A');
        expect(req.isCrossOrg).toBe(false);
      });
    });

    it('super_admin gets cross-org access by default', () => {
      const req = { user: { sub: 'u-admin', role: 'super_admin' }, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      // super_admin goes through sync path for cached
      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-A' });

      // Direct test via applyOrgScope logic
      extractOrganization(req, res, () => {
        expect(req.organizationId).toBe(null);
        expect(req.isCrossOrg).toBe(true);
      });
    });

    it('super_admin can scope to specific org via ?orgId', () => {
      const req = { user: { sub: 'u-admin', role: 'super_admin' }, query: { orgId: 'org-X' } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      prisma.user.findUnique.mockResolvedValue({ organizationId: null });

      extractOrganization(req, res, () => {
        expect(req.organizationId).toBe('org-X');
        expect(req.isCrossOrg).toBe(false);
      });
    });

    it('verifyOrgAccess denies access to record from different org', () => {
      const req = { organizationId: 'org-A', isCrossOrg: false };
      expect(verifyOrgAccess(req, 'org-B')).toBe(false);
    });

    it('verifyOrgAccess allows access to record from same org', () => {
      const req = { organizationId: 'org-A', isCrossOrg: false };
      expect(verifyOrgAccess(req, 'org-A')).toBe(true);
    });

    it('verifyOrgAccess allows super_admin cross-org access', () => {
      const req = { organizationId: null, isCrossOrg: true };
      expect(verifyOrgAccess(req, 'org-ANY')).toBe(true);
    });

    it('user with no org is denied on org-scoped endpoints', () => {
      const req = { user: { sub: 'u-orphan', role: 'field_officer' }, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      prisma.user.findUnique.mockResolvedValue({ organizationId: null });

      extractOrganization(req, res, next);
      // After async lookup, should return 403
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
          resolve();
        }, 50);
      });
    });
  });

  describe('org-scoped farmer queries', () => {
    it('listFarmers applies org scope filter', async () => {
      const { listFarmers } = await import('../modules/farmers/service.js');

      prisma.farmer.findMany.mockResolvedValue([]);
      prisma.farmer.count.mockResolvedValue(0);

      await listFarmers({ orgScope: { organizationId: 'org-A' } });

      expect(prisma.farmer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-A' }),
        })
      );
    });

    it('listFarmers with empty orgScope returns unscoped', async () => {
      const { listFarmers } = await import('../modules/farmers/service.js');

      prisma.farmer.findMany.mockResolvedValue([]);
      prisma.farmer.count.mockResolvedValue(0);

      await listFarmers({ orgScope: {} });

      const call = prisma.farmer.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('organizationId');
    });
  });

  describe('org-scoped application queries', () => {
    it('listApplications applies org scope via farmer relation', async () => {
      const { listApplications } = await import('../modules/applications/service.js');

      prisma.application.findMany.mockResolvedValue([]);
      prisma.application.count.mockResolvedValue(0);

      await listApplications({ orgScope: { farmer: { organizationId: 'org-B' } } });

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            farmer: expect.objectContaining({ organizationId: 'org-B' }),
          }),
        })
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════
//  B. SEASON TRANSITION FULL FLOW
// ═══════════════════════════════════════════════════════════

describe('Season Status Transitions', () => {
  let transitionSeasonStatus, isValidTransition, canPerformTransition, checkSeasonStaleness;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../modules/seasons/statusTransitions.js');
    transitionSeasonStatus = mod.transitionSeasonStatus;
    isValidTransition = mod.isValidTransition;
    canPerformTransition = mod.canPerformTransition;
    checkSeasonStaleness = mod.checkSeasonStaleness;
  });

  describe('transition validation rules', () => {
    // Valid transitions
    it.each([
      ['active', 'harvested'],
      ['active', 'abandoned'],
      ['active', 'failed'],
      ['harvested', 'completed'],
      ['harvested', 'active'],
      ['completed', 'active'],
      ['abandoned', 'active'],
      ['failed', 'active'],
    ])('allows %s → %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(true);
    });

    // Invalid transitions
    it.each([
      ['active', 'completed'],       // must go through harvested first
      ['harvested', 'abandoned'],     // harvested can only → completed or active (reopen)
      ['completed', 'harvested'],     // completed can only reopen to active
      ['completed', 'failed'],        // completed cannot go to failed
      ['failed', 'harvested'],        // failed can only reopen to active
      ['abandoned', 'completed'],     // abandoned must reopen first
      ['abandoned', 'harvested'],     // abandoned must reopen first
    ])('blocks %s → %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(false);
    });
  });

  describe('role-based transition permissions', () => {
    it('farmer can abandon own season', () => {
      expect(canPerformTransition('active', 'abandoned', 'farmer')).toBe(true);
    });

    it('farmer can declare crop failure', () => {
      expect(canPerformTransition('active', 'failed', 'farmer')).toBe(true);
    });

    it('farmer cannot close/complete a season', () => {
      expect(canPerformTransition('harvested', 'completed', 'farmer')).toBe(false);
    });

    it('farmer cannot reopen a season', () => {
      expect(canPerformTransition('harvested', 'active', 'farmer')).toBe(false);
      expect(canPerformTransition('completed', 'active', 'farmer')).toBe(false);
    });

    it('institutional_admin can close harvested season', () => {
      expect(canPerformTransition('harvested', 'completed', 'institutional_admin')).toBe(true);
    });

    it('institutional_admin can reopen harvested season', () => {
      expect(canPerformTransition('harvested', 'active', 'institutional_admin')).toBe(true);
    });

    it('only super_admin can reopen completed season', () => {
      expect(canPerformTransition('completed', 'active', 'super_admin')).toBe(true);
      expect(canPerformTransition('completed', 'active', 'institutional_admin')).toBe(false);
      expect(canPerformTransition('completed', 'active', 'field_officer')).toBe(false);
    });

    it('field_officer cannot close season', () => {
      expect(canPerformTransition('harvested', 'completed', 'field_officer')).toBe(false);
    });

    it('reviewer cannot perform any season transitions', () => {
      expect(canPerformTransition('active', 'abandoned', 'reviewer')).toBe(false);
      expect(canPerformTransition('harvested', 'completed', 'reviewer')).toBe(false);
    });

    it('investor_viewer cannot perform any season transitions', () => {
      expect(canPerformTransition('active', 'abandoned', 'investor_viewer')).toBe(false);
    });
  });

  describe('transitionSeasonStatus integration', () => {
    it('transitions active → abandoned with audit fields', async () => {
      prisma.farmSeason.findUnique
        .mockResolvedValueOnce({ id: 's-1', status: 'active' })      // initial lookup
        .mockResolvedValueOnce({ id: 's-1', status: 'abandoned', closedAt: new Date(), farmer: { id: 'f-1', fullName: 'Test' } }); // post-update fetch
      prisma.farmSeason.updateMany.mockResolvedValue({ count: 1 });

      const result = await transitionSeasonStatus('s-1', 'abandoned', {
        userId: 'u-1', role: 'field_officer', reason: 'Drought conditions',
      });

      expect(result.previousStatus).toBe('active');
      expect(result.season.status).toBe('abandoned');
      expect(prisma.farmSeason.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's-1', status: 'active' },
          data: expect.objectContaining({
            status: 'abandoned',
            closedBy: 'u-1',
            closureReason: 'Drought conditions',
          }),
        })
      );
    });

    it('requires reason for reopen transitions', async () => {
      prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'harvested' });

      await expect(
        transitionSeasonStatus('s-1', 'active', { userId: 'u-1', role: 'institutional_admin', reason: '' })
      ).rejects.toThrow(/reason is required/);
    });

    it('rejects unauthorized role for transition', async () => {
      prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'completed' });

      await expect(
        transitionSeasonStatus('s-1', 'active', { userId: 'u-1', role: 'field_officer', reason: 'Need correction' })
      ).rejects.toThrow(/not authorized/);
    });

    it('handles concurrent modification (optimistic lock failure)', async () => {
      prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'active' });
      prisma.farmSeason.updateMany.mockResolvedValue({ count: 0 }); // concurrent change

      await expect(
        transitionSeasonStatus('s-1', 'abandoned', { userId: 'u-1', role: 'farmer', reason: 'Giving up' })
      ).rejects.toThrow(/concurrently/);
    });

    it('clears closure fields on reopen', async () => {
      prisma.farmSeason.findUnique
        .mockResolvedValueOnce({ id: 's-1', status: 'abandoned', closedAt: new Date(), closedBy: 'u-old' })
        .mockResolvedValueOnce({ id: 's-1', status: 'active', closedAt: null, farmer: { id: 'f-1', fullName: 'Test' } });
      prisma.farmSeason.updateMany.mockResolvedValue({ count: 1 });

      await transitionSeasonStatus('s-1', 'active', {
        userId: 'u-admin', role: 'institutional_admin', reason: 'Farmer resumed farming',
      });

      expect(prisma.farmSeason.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'active',
            closedAt: null,
            closedBy: null,
            closureReason: null,
            reopenedBy: 'u-admin',
            reopenReason: 'Farmer resumed farming',
          }),
        })
      );
    });
  });

  describe('staleness checks', () => {
    it('flags season older than 365 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 400);

      const warnings = checkSeasonStaleness({ status: 'active', plantingDate: oldDate });
      expect(warnings.some(w => w.code === 'season_overdue')).toBe(true);
    });

    it('flags season with no activity for 90+ days', () => {
      const lastActivity = new Date();
      lastActivity.setDate(lastActivity.getDate() - 100);

      const warnings = checkSeasonStaleness({
        status: 'active',
        plantingDate: new Date(),
        lastActivityDate: lastActivity,
      });
      expect(warnings.some(w => w.code === 'season_inactive')).toBe(true);
    });

    it('does not flag completed season as stale', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 500);

      const warnings = checkSeasonStaleness({ status: 'completed', plantingDate: oldDate });
      expect(warnings).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════
//  C. HARVEST REPORT DUPLICATE / SAFETY
// ═══════════════════════════════════════════════════════════

describe('Harvest Report Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects harvest report on non-active season', async () => {
    const { createHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'harvested', harvestReport: null,
    });

    await expect(createHarvestReport('s-1', { totalHarvestKg: 100 }))
      .rejects.toThrow(/only be submitted for active seasons/);
  });

  it('rejects duplicate harvest report', async () => {
    const { createHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', harvestReport: { id: 'hr-existing' },
    });

    await expect(createHarvestReport('s-1', { totalHarvestKg: 100 }))
      .rejects.toThrow(/already exists/);
  });

  it('rejects non-positive harvest amount', async () => {
    const { createHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', harvestReport: null, farmSizeAcres: 5,
    });

    await expect(createHarvestReport('s-1', { totalHarvestKg: 0 }))
      .rejects.toThrow(/must be positive/);
  });

  it('creates harvest report with auto-computed yield', async () => {
    const { createHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', harvestReport: null, farmSizeAcres: 5,
    });
    prisma.farmSeason.updateMany.mockResolvedValue({ count: 1 });
    prisma.harvestReport.create.mockResolvedValue({
      id: 'hr-1', totalHarvestKg: 500, yieldPerAcre: 100,
    });

    const result = await createHarvestReport('s-1', { totalHarvestKg: 500 }, 'u-1');

    expect(result.totalHarvestKg).toBe(500);
    // Yield should be auto-computed as 500 / 5 = 100
    expect(prisma.harvestReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalHarvestKg: 500,
          yieldPerAcre: 100,
        }),
      })
    );
  });

  it('uses optimistic lock to prevent concurrent harvest reports', async () => {
    const { createHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', harvestReport: null, farmSizeAcres: 5,
    });
    // Simulate concurrent change — updateMany returns count: 0
    prisma.farmSeason.updateMany.mockResolvedValue({ count: 0 });

    await expect(createHarvestReport('s-1', { totalHarvestKg: 500 }, 'u-1'))
      .rejects.toThrow(/concurrently/);
  });
});

// ═══════════════════════════════════════════════════════════
//  D. REGISTRATION DUPLICATE GUARDS
// ═══════════════════════════════════════════════════════════

describe('Registration Duplicate Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('farmerSelfRegister rejects duplicate email', async () => {
    const { farmerSelfRegister } = await import('../modules/auth/farmer-registration.js');

    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user', email: 'test@test.com' });

    await expect(farmerSelfRegister({
      fullName: 'Test', phone: '+254700000001', email: 'test@test.com',
      password: 'password123', region: 'Nairobi',
    })).rejects.toThrow(/Email already registered/);
  });

  it('farmerSelfRegister rejects duplicate phone', async () => {
    const { farmerSelfRegister } = await import('../modules/auth/farmer-registration.js');

    prisma.user.findUnique.mockResolvedValue(null); // email is unique
    prisma.farmer.findFirst.mockResolvedValue({ id: 'existing-farmer', phone: '+254700000001' });

    await expect(farmerSelfRegister({
      fullName: 'Test', phone: '+254700000001', email: 'new@test.com',
      password: 'password123', region: 'Nairobi',
    })).rejects.toThrow(/Phone number already registered/);
  });

  it('farmerSelfRegister creates user+farmer atomically', async () => {
    const { farmerSelfRegister } = await import('../modules/auth/farmer-registration.js');

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.farmer.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'new-user', email: 'fresh@test.com', fullName: 'Fresh', role: 'farmer' });
    prisma.farmer.create.mockResolvedValue({
      id: 'new-farmer', fullName: 'Fresh', registrationStatus: 'pending_approval',
    });

    const result = await farmerSelfRegister({
      fullName: 'Fresh', phone: '+254700000099', email: 'fresh@test.com',
      password: 'Password1', region: 'Nairobi',
    });

    expect(result.farmer.registrationStatus).toBe('pending_approval');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('inviteFarmer rejects duplicate phone', async () => {
    const { inviteFarmer } = await import('../modules/auth/farmer-registration.js');

    prisma.farmer.findFirst.mockResolvedValue({ id: 'existing-farmer', phone: '+254700000001' });

    await expect(inviteFarmer({
      fullName: 'Test', phone: '+254700000001', region: 'Nairobi', invitedById: 'u-1',
    })).rejects.toThrow(/Phone number already registered/);
  });

  it('inviteFarmer rejects duplicate email', async () => {
    const { inviteFarmer } = await import('../modules/auth/farmer-registration.js');

    prisma.farmer.findFirst.mockResolvedValue(null); // phone unique
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'dup@test.com' });

    await expect(inviteFarmer({
      fullName: 'Test', phone: '+254700000002', email: 'dup@test.com',
      password: 'Password1', region: 'Nairobi', invitedById: 'u-1',
    })).rejects.toThrow(/Email already registered/);
  });
});

// ═══════════════════════════════════════════════════════════
//  E. EVIDENCE UPLOAD STATUS RESTRICTION
// ═══════════════════════════════════════════════════════════

describe('Evidence Upload Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects upload for nonexistent application', async () => {
    const { uploadEvidence } = await import('../modules/evidence/service.js');

    prisma.application.findUnique.mockResolvedValue(null);

    await expect(uploadEvidence('app-nonexistent', { path: '/fake', filename: 'test.jpg', originalname: 'test.jpg', mimetype: 'image/jpeg', size: 1000 }, 'photo'))
      .rejects.toThrow(/Application not found/);
  });

  it('creates evidence with photo hash for duplicate detection', async () => {
    const { uploadEvidence } = await import('../modules/evidence/service.js');

    prisma.application.findUnique.mockResolvedValue({ id: 'app-1', status: 'submitted' });
    prisma.evidenceFile.findMany.mockResolvedValue([]); // no duplicates
    prisma.evidenceFile.create.mockResolvedValue({
      id: 'ev-1', applicationId: 'app-1', type: 'photo', photoHash: 'abc123',
    });

    // Mock fs module checks - file doesn't exist on disk in test
    const result = await uploadEvidence('app-1', {
      path: null, filename: 'test.jpg', originalname: 'test.jpg',
      mimetype: 'image/jpeg', size: 1000,
    }, 'photo');

    expect(prisma.evidenceFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: 'app-1',
          type: 'photo',
        }),
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════
//  F. SEASON CREATION DUPLICATE GUARD
// ═══════════════════════════════════════════════════════════

describe('Season Creation Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects duplicate active season for same crop', async () => {
    const { createSeason } = await import('../modules/seasons/service.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', countryCode: 'KE' });
    prisma.farmSeason.findFirst.mockResolvedValue({ id: 's-existing', cropType: 'maize', status: 'active' });

    await expect(createSeason('f-1', {
      cropType: 'maize', plantingDate: new Date().toISOString(), farmSizeAcres: 5,
    })).rejects.toThrow(/active season for maize already exists/);
  });

  it('allows season for same crop after previous is completed', async () => {
    const { createSeason } = await import('../modules/seasons/service.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', countryCode: 'KE' });
    prisma.farmSeason.findFirst.mockResolvedValue(null); // no active season
    prisma.farmSeason.create.mockResolvedValue({
      id: 's-new', cropType: 'maize', status: 'active',
      farmer: { id: 'f-1', fullName: 'Test', countryCode: 'KE' },
    });

    const result = await createSeason('f-1', {
      cropType: 'maize', plantingDate: new Date().toISOString(), farmSizeAcres: 5,
    });

    expect(result.id).toBe('s-new');
  });

  it('rejects planting date too far in the future', async () => {
    const { createSeason } = await import('../modules/seasons/service.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', countryCode: 'KE' });
    prisma.farmSeason.findFirst.mockResolvedValue(null);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 400);

    await expect(createSeason('f-1', {
      cropType: 'maize', plantingDate: futureDate.toISOString(), farmSizeAcres: 5,
    })).rejects.toThrow(/more than 365 days in the future/);
  });

  it('rejects planting date too far in the past', async () => {
    const { createSeason } = await import('../modules/seasons/service.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', countryCode: 'KE' });
    prisma.farmSeason.findFirst.mockResolvedValue(null);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 800);

    await expect(createSeason('f-1', {
      cropType: 'maize', plantingDate: pastDate.toISOString(), farmSizeAcres: 5,
    })).rejects.toThrow(/more than 730 days in the past/);
  });

  it('rejects missing required fields', async () => {
    const { createSeason } = await import('../modules/seasons/service.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', countryCode: 'KE' });

    await expect(createSeason('f-1', { cropType: 'maize' }))
      .rejects.toThrow(/required/);
  });

  it('prevents editing closed seasons', async () => {
    const { updateSeason } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'completed' });

    await expect(updateSeason('s-1', { seedQuantity: 50 }))
      .rejects.toThrow(/Cannot update a season with status 'completed'/);
  });

  it('blocks direct status changes via update', async () => {
    const { updateSeason } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'active' });

    await expect(updateSeason('s-1', { status: 'completed' }))
      .rejects.toThrow(/dedicated status transition endpoints/);
  });
});

// ═══════════════════════════════════════════════════════════
//  G. PROGRESS ENTRY SAFETY
// ═══════════════════════════════════════════════════════════

describe('Progress Entry Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects progress entry on non-active season', async () => {
    const { createProgressEntry } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'harvested' });

    await expect(createProgressEntry('s-1', { entryType: 'activity', description: 'Test' }))
      .rejects.toThrow(/only add progress to active seasons/);
  });

  it('rejects invalid entry type', async () => {
    const { createProgressEntry } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'active' });

    await expect(createProgressEntry('s-1', { entryType: 'invalid_type' }))
      .rejects.toThrow(/entryType must be one of/);
  });

  it('rejects invalid imageUrl (directory traversal)', async () => {
    const { createProgressEntry } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', plantingDate: new Date(),
    });

    await expect(createProgressEntry('s-1', {
      entryType: 'activity', imageUrl: '../../../etc/passwd',
    })).rejects.toThrow(/Invalid imageUrl/);
  });

  it('accepts valid /uploads/ imageUrl', async () => {
    const { createProgressEntry } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', plantingDate: new Date(), cropType: 'maize',
    });
    prisma.seasonProgressEntry.create.mockResolvedValue({ id: 'pe-1', imageUrl: '/uploads/abc.jpg' });
    prisma.farmSeason.update.mockResolvedValue({});

    const result = await createProgressEntry('s-1', {
      entryType: 'activity', imageUrl: '/uploads/abc.jpg', imageStage: 'early_growth',
    });

    expect(result.id).toBe('pe-1');
  });
});

// ═══════════════════════════════════════════════════════════
//  H. APPLICATION WORKFLOW ATOMICITY
// ═══════════════════════════════════════════════════════════

describe('Application Workflow Atomicity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approve uses transaction for status + review note', async () => {
    const { approveApplication } = await import('../modules/applications/service.js');

    // Status check
    prisma.application.findUnique
      .mockResolvedValueOnce({ id: 'app-1', status: 'under_review' })
      .mockResolvedValueOnce({ id: 'app-1', status: 'approved', farmer: { fullName: 'Test' } });
    prisma.application.updateMany.mockResolvedValue({ count: 1 });
    prisma.reviewNote.create.mockResolvedValue({});

    const result = await approveApplication('app-1', 'u-1', { reason: 'Good candidate' });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.previousStatus).toBe('under_review');
  });

  it('reject uses transaction for status + review note', async () => {
    const { rejectApplication } = await import('../modules/applications/service.js');

    prisma.application.findUnique
      .mockResolvedValueOnce({ id: 'app-1', status: 'under_review' })
      .mockResolvedValueOnce({ id: 'app-1', status: 'rejected', farmer: { fullName: 'Test' } });
    prisma.application.updateMany.mockResolvedValue({ count: 1 });
    prisma.reviewNote.create.mockResolvedValue({});

    const result = await rejectApplication('app-1', 'u-1', 'Insufficient evidence');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.previousStatus).toBe('under_review');
  });

  it('disburse prevents double-disbursement via optimistic lock', async () => {
    const { disburseApplication } = await import('../modules/applications/service.js');

    prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'approved' });
    prisma.application.updateMany.mockResolvedValue({ count: 0 }); // concurrent change

    await expect(disburseApplication('app-1', 'u-1'))
      .rejects.toThrow(/status has changed/);
  });

  it('escalate creates internal review note atomically', async () => {
    const { escalateApplication } = await import('../modules/applications/service.js');

    prisma.application.findUnique
      .mockResolvedValueOnce({ id: 'app-1', status: 'under_review' })
      .mockResolvedValueOnce({ id: 'app-1', status: 'escalated', farmer: { fullName: 'Test' } });
    prisma.application.updateMany.mockResolvedValue({ count: 1 });
    prisma.reviewNote.create.mockResolvedValue({});

    const result = await escalateApplication('app-1', 'u-1', 'Needs senior review');

    expect(prisma.$transaction).toHaveBeenCalled();
    // Review note should be internal
    expect(prisma.reviewNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ internal: true }),
      })
    );
  });

  it('reopen rejected application requires going through under_review', async () => {
    const { reopenApplication } = await import('../modules/applications/service.js');

    prisma.application.findUnique
      .mockResolvedValueOnce({ id: 'app-1', status: 'rejected' })
      .mockResolvedValueOnce({ id: 'app-1', status: 'under_review', farmer: { fullName: 'Test' } });
    prisma.application.updateMany.mockResolvedValue({ count: 1 });
    prisma.reviewNote.create.mockResolvedValue({});

    const result = await reopenApplication('app-1', 'u-1', 'New evidence submitted');

    expect(result.previousStatus).toBe('rejected');
    expect(result.application.status).toBe('under_review');
  });

  it('requestEvidence transitions to needs_more_evidence', async () => {
    const { requestEvidence } = await import('../modules/applications/service.js');

    prisma.application.findUnique
      .mockResolvedValueOnce({ id: 'app-1', status: 'under_review' })
      .mockResolvedValueOnce({ id: 'app-1', status: 'needs_more_evidence', farmer: { fullName: 'Test' } });
    prisma.application.updateMany.mockResolvedValue({ count: 1 });
    prisma.reviewNote.create.mockResolvedValue({});

    const result = await requestEvidence('app-1', 'u-1', {
      reason: 'Need farm photos', requiredTypes: ['farm_photo', 'id_document'],
    });

    expect(result.previousStatus).toBe('under_review');
    expect(prisma.reviewNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: expect.stringContaining('farm_photo'),
        }),
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════
//  I. APPLICATION STATE MACHINE COMPLETENESS
// ═══════════════════════════════════════════════════════════

describe('Application State Machine — invalid transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cannot submit an already-submitted application', async () => {
    const { submitApplication } = await import('../modules/applications/service.js');
    prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'submitted' });
    await expect(submitApplication('app-1')).rejects.toThrow(/Cannot transition/);
  });

  it('cannot approve a draft application', async () => {
    const { approveApplication } = await import('../modules/applications/service.js');
    prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'draft' });
    await expect(approveApplication('app-1', 'u-1')).rejects.toThrow(/Cannot transition/);
  });

  it('cannot disburse a rejected application', async () => {
    const { disburseApplication } = await import('../modules/applications/service.js');
    prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'rejected' });
    await expect(disburseApplication('app-1', 'u-1')).rejects.toThrow(/Cannot transition/);
  });

  it('disbursed application has no further transitions', async () => {
    const { submitApplication } = await import('../modules/applications/service.js');
    prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'disbursed' });
    await expect(submitApplication('app-1')).rejects.toThrow(/Cannot transition/);
  });

  it('cannot double-approve', async () => {
    const { approveApplication } = await import('../modules/applications/service.js');
    prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'approved' });
    await expect(approveApplication('app-1', 'u-1')).rejects.toThrow(/Cannot transition/);
  });
});

// ═══════════════════════════════════════════════════════════
//  J. FILE REFERENCE VALIDATION
// ═══════════════════════════════════════════════════════════

describe('File Reference Validation', () => {
  let isValidFileReference;

  beforeEach(async () => {
    const mod = await import('../utils/uploadHealth.js');
    isValidFileReference = mod.isValidFileReference;
  });

  it('accepts valid /uploads/ paths', () => {
    expect(isValidFileReference('/uploads/abc-123.jpg')).toBe(true);
    expect(isValidFileReference('/uploads/photo.png')).toBe(true);
  });

  it('accepts https:// URLs', () => {
    expect(isValidFileReference('https://example.com/img.jpg')).toBe(true);
  });

  it('rejects directory traversal', () => {
    expect(isValidFileReference('../../../etc/passwd')).toBe(false);
    expect(isValidFileReference('/uploads/../secret.txt')).toBe(false);
  });

  it('rejects null bytes', () => {
    expect(isValidFileReference('/uploads/file\0.jpg')).toBe(false);
  });

  it('rejects empty/null values', () => {
    expect(isValidFileReference('')).toBe(false);
    expect(isValidFileReference(null)).toBe(false);
    expect(isValidFileReference(undefined)).toBe(false);
  });

  it('rejects paths with subdirectories', () => {
    expect(isValidFileReference('/uploads/subdir/file.jpg')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
//  K. HARVEST REPORT CORRECTION (Phase 3)
// ═══════════════════════════════════════════════════════════

describe('Harvest Report Correction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows correction on reopened (active) season with existing report', async () => {
    const { updateHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', farmSizeAcres: 5,
      harvestReport: { id: 'hr-1', totalHarvestKg: 500 },
    });
    prisma.harvestReport.update.mockResolvedValue({
      id: 'hr-1', totalHarvestKg: 600, yieldPerAcre: 120,
    });

    const result = await updateHarvestReport('s-1', { totalHarvestKg: 600 }, 'u-1');
    expect(result.totalHarvestKg).toBe(600);
    expect(prisma.harvestReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seasonId: 's-1' },
        data: expect.objectContaining({
          totalHarvestKg: 600,
          yieldPerAcre: 120, // auto-recomputed: 600 / 5
        }),
      })
    );
  });

  it('rejects correction on non-active season', async () => {
    const { updateHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'completed',
      harvestReport: { id: 'hr-1' },
    });

    await expect(updateHarvestReport('s-1', { totalHarvestKg: 600 }, 'u-1'))
      .rejects.toThrow(/only be corrected on reopened/);
  });

  it('rejects correction when no harvest report exists', async () => {
    const { updateHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', harvestReport: null,
    });

    await expect(updateHarvestReport('s-1', { totalHarvestKg: 600 }, 'u-1'))
      .rejects.toThrow(/No harvest report exists/);
  });

  it('rejects non-positive correction amount', async () => {
    const { updateHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', farmSizeAcres: 5,
      harvestReport: { id: 'hr-1' },
    });

    await expect(updateHarvestReport('s-1', { totalHarvestKg: -10 }, 'u-1'))
      .rejects.toThrow(/must be positive/);
  });
});

// ═══════════════════════════════════════════════════════════
//  L. EVIDENCE UPLOAD STATUS RESTRICTION (Phase 3)
// ═══════════════════════════════════════════════════════════

describe('Evidence Upload — Application Status Restriction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    'draft', 'submitted', 'under_review', 'needs_more_evidence', 'field_review_required',
  ])('allows upload for %s application', async (status) => {
    const { uploadEvidence } = await import('../modules/evidence/service.js');

    prisma.application.findUnique.mockResolvedValue({ id: 'app-1', status });
    prisma.evidenceFile.findMany.mockResolvedValue([]);
    prisma.evidenceFile.create.mockResolvedValue({ id: 'ev-1', type: 'photo' });

    const result = await uploadEvidence('app-1', {
      path: null, filename: 'test.jpg', originalname: 'test.jpg',
      mimetype: 'image/jpeg', size: 1000,
    }, 'photo');

    expect(result.id).toBe('ev-1');
  });

  it.each([
    'approved', 'rejected', 'disbursed', 'escalated', 'fraud_hold', 'conditional_approved',
  ])('blocks upload for %s application', async (status) => {
    const { uploadEvidence } = await import('../modules/evidence/service.js');

    prisma.application.findUnique.mockResolvedValue({ id: 'app-1', status });

    await expect(uploadEvidence('app-1', {
      path: null, filename: 'test.jpg', originalname: 'test.jpg',
      mimetype: 'image/jpeg', size: 1000,
    }, 'photo')).rejects.toThrow(/Cannot upload evidence/);
  });
});

// ═══════════════════════════════════════════════════════════
//  M. ATOMIC CROP FAILURE (Phase 3)
// ═══════════════════════════════════════════════════════════

describe('Atomic Crop Failure with extraData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitionSeasonStatus merges extraData into update', async () => {
    const { transitionSeasonStatus } = await import('../modules/seasons/statusTransitions.js');

    prisma.farmSeason.findUnique
      .mockResolvedValueOnce({ id: 's-1', status: 'active' })
      .mockResolvedValueOnce({ id: 's-1', status: 'failed', farmer: { id: 'f-1', fullName: 'Test' } });
    prisma.farmSeason.updateMany.mockResolvedValue({ count: 1 });

    await transitionSeasonStatus('s-1', 'failed', {
      userId: 'u-1', role: 'farmer', reason: 'Drought',
      extraData: { cropFailureReported: true },
    });

    expect(prisma.farmSeason.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          cropFailureReported: true,
        }),
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════
//  N. MAX IMAGES PER SEASON GUARD (Phase 4)
// ═══════════════════════════════════════════════════════════

describe('Max Images Per Season Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks image upload when max limit reached', async () => {
    const { addProgressImage, MAX_IMAGES_PER_SEASON } = await import('../modules/seasons/imageValidation.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', cropType: 'maize',
      plantingDate: new Date(Date.now() - 30 * 86400000),
      farmer: { countryCode: 'KE' },
    });
    prisma.seasonProgressEntry.count.mockResolvedValue(MAX_IMAGES_PER_SEASON);

    await expect(addProgressImage('s-1', {
      imageUrl: '/uploads/photo.jpg', imageStage: 'early_growth',
    })).rejects.toThrow(/Maximum of.*images per season reached/);
  });

  it('allows image upload when under limit', async () => {
    const { addProgressImage } = await import('../modules/seasons/imageValidation.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', cropType: 'maize',
      plantingDate: new Date(Date.now() - 30 * 86400000),
      farmer: { countryCode: 'KE' },
    });
    prisma.seasonProgressEntry.count.mockResolvedValue(5);
    prisma.seasonProgressEntry.create.mockResolvedValue({
      id: 'pe-1', imageUrl: '/uploads/photo.jpg',
    });
    prisma.farmSeason.update.mockResolvedValue({});

    const { entry } = await addProgressImage('s-1', {
      imageUrl: '/uploads/photo.jpg', imageStage: 'early_growth',
    });
    expect(entry.id).toBe('pe-1');
  });
});

// ═══════════════════════════════════════════════════════════
//  O. SEASON CLOSURE — HARVEST REPORT REQUIRED (Phase 4)
// ═══════════════════════════════════════════════════════════

describe('Season Closure Requires Harvest Report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks closing a harvested season without harvest report', async () => {
    const { transitionSeasonStatus } = await import('../modules/seasons/statusTransitions.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'harvested' });
    prisma.harvestReport.findUnique.mockResolvedValue(null); // no report

    await expect(transitionSeasonStatus('s-1', 'completed', {
      userId: 'u-1', role: 'institutional_admin', reason: 'Season review complete',
    })).rejects.toThrow(/Cannot close season without a harvest report/);
  });

  it('allows closing when harvest report exists', async () => {
    const { transitionSeasonStatus } = await import('../modules/seasons/statusTransitions.js');

    prisma.farmSeason.findUnique
      .mockResolvedValueOnce({ id: 's-1', status: 'harvested' })
      .mockResolvedValueOnce({ id: 's-1', status: 'completed', farmer: { id: 'f-1', fullName: 'Test' } });
    prisma.harvestReport.findUnique.mockResolvedValue({ id: 'hr-1', totalHarvestKg: 500 });
    prisma.farmSeason.updateMany.mockResolvedValue({ count: 1 });

    const result = await transitionSeasonStatus('s-1', 'completed', {
      userId: 'u-1', role: 'institutional_admin', reason: 'Season review complete',
    });

    expect(result.season.status).toBe('completed');
  });
});

// ═══════════════════════════════════════════════════════════
//  P. EVIDENCE DELETION STATUS RESTRICTION (Phase 4)
// ═══════════════════════════════════════════════════════════

describe('Evidence Deletion Status Restriction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks deletion from approved application', async () => {
    const { deleteEvidence } = await import('../modules/evidence/service.js');

    prisma.evidenceFile.findUnique.mockResolvedValue({
      id: 'ev-1', filename: 'test.jpg', url: '/uploads/test.jpg',
      application: { id: 'app-1', status: 'approved' },
    });

    await expect(deleteEvidence('ev-1'))
      .rejects.toThrow(/Cannot delete evidence from an application with status 'approved'/);
  });

  it('blocks deletion from disbursed application', async () => {
    const { deleteEvidence } = await import('../modules/evidence/service.js');

    prisma.evidenceFile.findUnique.mockResolvedValue({
      id: 'ev-1', filename: 'test.jpg', url: '/uploads/test.jpg',
      application: { id: 'app-1', status: 'disbursed' },
    });

    await expect(deleteEvidence('ev-1'))
      .rejects.toThrow(/Cannot delete evidence/);
  });

  it('allows deletion from under_review application', async () => {
    const { deleteEvidence } = await import('../modules/evidence/service.js');

    prisma.evidenceFile.findUnique.mockResolvedValue({
      id: 'ev-1', filename: 'test.jpg', url: '/uploads/test.jpg',
      application: { id: 'app-1', status: 'under_review' },
    });
    prisma.evidenceFile.delete.mockResolvedValue({ id: 'ev-1' });

    const result = await deleteEvidence('ev-1');
    expect(result.id).toBe('ev-1');
  });
});

// ═══════════════════════════════════════════════════════════
//  Q. SEASON LIST PAGINATION (Phase 4)
// ═══════════════════════════════════════════════════════════

describe('Season List Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated response with total', async () => {
    const { listSeasons } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findMany.mockResolvedValue([
      { id: 's-1', cropType: 'maize', status: 'active' },
    ]);
    prisma.farmSeason.count.mockResolvedValue(3);

    const result = await listSeasons('f-1', { page: '1', limit: '1' });

    expect(result).toHaveProperty('seasons');
    expect(result).toHaveProperty('total', 3);
    expect(result).toHaveProperty('page', 1);
    expect(result).toHaveProperty('totalPages', 3);
    expect(prisma.farmSeason.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 1,
      })
    );
  });

  it('defaults to page 1 and limit 50', async () => {
    const { listSeasons } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findMany.mockResolvedValue([]);
    prisma.farmSeason.count.mockResolvedValue(0);

    const result = await listSeasons('f-1');

    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(prisma.farmSeason.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 50,
      })
    );
  });
});
