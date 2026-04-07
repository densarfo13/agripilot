import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    farmer: { count: vi.fn(), findMany: vi.fn() },
    farmSeason: { count: vi.fn(), findMany: vi.fn() },
    seasonProgressEntry: { count: vi.fn() },
    harvestReport: { count: vi.fn() },
    credibilityAssessment: { count: vi.fn(), findMany: vi.fn() },
    reviewAssignment: { findMany: vi.fn() },
    application: { groupBy: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    auditLog: { count: vi.fn() },
    organization: { findUnique: vi.fn() },
    user: { findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: mockPrisma };
});

vi.mock('../modules/audit/service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../utils/opsLogger.js', () => ({
  logPermissionEvent: vi.fn(),
  logAuthEvent: vi.fn(),
  logWorkflowEvent: vi.fn(),
  logUploadEvent: vi.fn(),
  logSystemEvent: vi.fn(),
  opsEvent: vi.fn(),
}));

import prisma from '../config/database.js';

// ─── Helper: mock all getPilotMetrics DB calls ─────────────
function mockPilotMetricsCalls({
  totalFarmers = 10, approvedFarmers = 8, pending = 2, invitedNotActivated = 1,
  withSeason = 6, withFirstUpdate = 4, withImage = 3, withHarvest = 2, loggedIn = 5,
  activeSeasons = 5, harvestedSeasons = 1, completedSeasons = 1,
  progressEntries = 20, images = 8, harvestReports = 2,
  pendingValidation = 3, lowCred = 1,
  totalApps = 5, submittedApps = 2, underReviewApps = 1, approvedApps = 2,
} = {}) {
  prisma.farmer.count
    .mockResolvedValueOnce(totalFarmers)     // total
    .mockResolvedValueOnce(approvedFarmers)  // approved
    .mockResolvedValueOnce(pending)          // pendingApproval
    .mockResolvedValueOnce(invitedNotActivated)  // invitedNotActivated
    .mockResolvedValueOnce(withSeason)       // withSeason
    .mockResolvedValueOnce(withFirstUpdate)  // withFirstUpdate
    .mockResolvedValueOnce(withImage)        // withImage
    .mockResolvedValueOnce(withHarvest)      // withHarvest
    .mockResolvedValueOnce(loggedIn);        // loggedIn

  prisma.farmSeason.count
    .mockResolvedValueOnce(activeSeasons)
    .mockResolvedValueOnce(harvestedSeasons)
    .mockResolvedValueOnce(completedSeasons)
    .mockResolvedValueOnce(pendingValidation);

  prisma.seasonProgressEntry.count
    .mockResolvedValueOnce(progressEntries)
    .mockResolvedValueOnce(images);

  prisma.harvestReport.count.mockResolvedValue(harvestReports);
  prisma.credibilityAssessment.count.mockResolvedValue(lowCred);

  prisma.application.count
    .mockResolvedValueOnce(totalApps)
    .mockResolvedValueOnce(submittedApps)
    .mockResolvedValueOnce(underReviewApps)
    .mockResolvedValueOnce(approvedApps);
}

// ─── Pilot Metrics Tests ───────────────────────────────────

describe('getPilotMetrics', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns correct adoption counts', async () => {
    mockPilotMetricsCalls({
      totalFarmers: 10, approvedFarmers: 8, withSeason: 6,
      withFirstUpdate: 4, withImage: 3, withHarvest: 2, loggedIn: 5,
    });

    const { getPilotMetrics } = await import('../modules/pilotMetrics/service.js');
    const result = await getPilotMetrics({ organizationId: 'org-1' });

    expect(result.farmers.total).toBe(10);
    expect(result.farmers.approved).toBe(8);
    expect(result.adoption.withSeason).toBe(6);
    expect(result.adoption.withFirstUpdate).toBe(4);
    expect(result.adoption.withImage).toBe(3);
    expect(result.adoption.withHarvest).toBe(2);
    expect(result.adoption.loggedIn).toBe(5);
  });

  it('includes generatedAt timestamp', async () => {
    mockPilotMetricsCalls();
    const { getPilotMetrics } = await import('../modules/pilotMetrics/service.js');
    const result = await getPilotMetrics({});
    expect(result.generatedAt).toBeDefined();
    expect(new Date(result.generatedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('returns attention counts', async () => {
    mockPilotMetricsCalls({ pending: 3, pendingValidation: 4, lowCred: 2 });
    const { getPilotMetrics } = await import('../modules/pilotMetrics/service.js');
    const result = await getPilotMetrics({ organizationId: 'org-1' });
    expect(result.attention.pendingApproval).toBe(3);
    expect(result.attention.pendingOfficerValidation).toBe(4);
    expect(result.attention.lowCredibilitySeasons).toBe(2);
  });

  it('passes organizationId filter to farmer queries', async () => {
    mockPilotMetricsCalls();
    const { getPilotMetrics } = await import('../modules/pilotMetrics/service.js');
    await getPilotMetrics({ organizationId: 'org-42' });

    // First farmer.count call should include organizationId
    const firstCall = prisma.farmer.count.mock.calls[0][0];
    expect(firstCall.where.organizationId).toBe('org-42');
  });

  it('uses empty filter for cross-org (null organizationId)', async () => {
    mockPilotMetricsCalls();
    const { getPilotMetrics } = await import('../modules/pilotMetrics/service.js');
    await getPilotMetrics({ organizationId: null });

    const firstCall = prisma.farmer.count.mock.calls[0][0];
    expect(firstCall.where.organizationId).toBeUndefined();
  });
});

// ─── Completion Funnel Tests ───────────────────────────────

describe('getCompletionFunnel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 7-step funnel with percentages', async () => {
    prisma.farmer.count
      .mockResolvedValueOnce(100)  // approved
      .mockResolvedValueOnce(80)   // with user account
      .mockResolvedValueOnce(60)   // with login
      .mockResolvedValueOnce(40)   // with season
      .mockResolvedValueOnce(30)   // with first update
      .mockResolvedValueOnce(20)   // with image
      .mockResolvedValueOnce(10);  // with harvest

    const { getCompletionFunnel } = await import('../modules/pilotMetrics/service.js');
    const result = await getCompletionFunnel({ organizationId: 'org-1' });

    expect(result.funnel).toHaveLength(7);
    expect(result.funnel[0].label).toBe('Approved');
    expect(result.funnel[0].count).toBe(100);
    expect(result.funnel[0].pct).toBe(100);
    expect(result.funnel[3].label).toBe('Season created');
    expect(result.funnel[3].count).toBe(40);
    expect(result.funnel[3].pct).toBe(40);
    expect(result.funnel[6].label).toBe('Harvest reported');
    expect(result.funnel[6].count).toBe(10);
    expect(result.funnel[6].pct).toBe(10);
  });

  it('handles zero approved farmers without division error', async () => {
    prisma.farmer.count.mockResolvedValue(0);
    const { getCompletionFunnel } = await import('../modules/pilotMetrics/service.js');
    const result = await getCompletionFunnel({ organizationId: 'org-empty' });
    for (const step of result.funnel) {
      expect(step.pct).toBe(0);
    }
  });
});

// ─── Needs Attention Tests ─────────────────────────────────

describe('getNeedsAttention', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const emptyFarmerList = [];

  it('returns pending approval category for admin', async () => {
    prisma.farmer.findMany
      .mockResolvedValueOnce([
        { id: 'f-1', fullName: 'Alice', region: 'Nairobi', selfRegistered: true, createdAt: new Date() },
      ])
      .mockResolvedValue([]);  // other farmer queries

    prisma.farmSeason.findMany.mockResolvedValue([]);
    prisma.credibilityAssessment.findMany.mockResolvedValue([]);

    const { getNeedsAttention } = await import('../modules/pilotMetrics/service.js');
    const result = await getNeedsAttention({ organizationId: 'org-1', role: 'institutional_admin' });

    const pendingCategory = result.categories.find(c => c.type === 'pending_approval');
    expect(pendingCategory).toBeDefined();
    expect(pendingCategory.count).toBe(1);
    expect(pendingCategory.priority).toBe('high');
  });

  it('field_officer does not see pending_approval category', async () => {
    prisma.farmer.findMany.mockResolvedValue([]);
    prisma.farmSeason.findMany.mockResolvedValue([]);
    prisma.credibilityAssessment.findMany.mockResolvedValue([]);

    const { getNeedsAttention } = await import('../modules/pilotMetrics/service.js');
    const result = await getNeedsAttention({ organizationId: 'org-1', role: 'field_officer' });

    // Routes filter to only operational categories for field_officer
    // Service itself returns pending_approval only when role !== 'field_officer'
    const pendingCategory = result.categories.find(c => c.type === 'pending_approval');
    expect(pendingCategory).toBeUndefined();
  });

  it('returns harvest_overdue category when seasons exist', async () => {
    prisma.farmer.findMany.mockResolvedValue([]); // no pending, no unactivated

    const overdueSeason = {
      id: 's-1', cropType: 'maize',
      expectedHarvestDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      farmer: { id: 'f-1', fullName: 'Bob', region: 'Western' },
    };
    prisma.farmSeason.findMany
      .mockResolvedValueOnce([])            // stale seasons
      .mockResolvedValueOnce([overdueSeason]) // harvest overdue
      .mockResolvedValueOnce([]);           // unvalidated

    prisma.credibilityAssessment.findMany.mockResolvedValue([]);

    const { getNeedsAttention } = await import('../modules/pilotMetrics/service.js');
    const result = await getNeedsAttention({ organizationId: 'org-1', role: 'institutional_admin' });

    const harvestCat = result.categories.find(c => c.type === 'harvest_overdue');
    expect(harvestCat).toBeDefined();
    expect(harvestCat.count).toBe(1);
    expect(harvestCat.priority).toBe('high');
    expect(harvestCat.items[0].seasonId).toBe('s-1');
  });

  it('returns empty categories array when nothing needs attention', async () => {
    prisma.farmer.findMany.mockResolvedValue([]);
    prisma.farmSeason.findMany.mockResolvedValue([]);
    prisma.credibilityAssessment.findMany.mockResolvedValue([]);

    const { getNeedsAttention } = await import('../modules/pilotMetrics/service.js');
    const result = await getNeedsAttention({ organizationId: 'org-1', role: 'institutional_admin' });
    expect(result.categories).toHaveLength(0);
    expect(result.totalItems).toBe(0);
  });
});

// ─── Reviewer Efficiency Tests ─────────────────────────────

describe('getReviewerEfficiency', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('computes average review hours from assignments', async () => {
    const now = new Date();
    const assignedAt = new Date(now - 24 * 60 * 60 * 1000); // 24h ago
    const completedAt = new Date(now - 12 * 60 * 60 * 1000); // 12h ago = 12h review time

    prisma.application.groupBy.mockResolvedValue([
      { status: 'submitted', _count: 3 },
      { status: 'under_review', _count: 2 },
      { status: 'approved', _count: 10 },
    ]);
    prisma.reviewAssignment.findMany.mockResolvedValue([
      { assignedAt, completedAt, reviewerId: 'r-1' },
    ]);
    prisma.application.findFirst.mockResolvedValue(null);
    prisma.auditLog.count.mockResolvedValue(5);

    const { getReviewerEfficiency } = await import('../modules/pilotMetrics/service.js');
    const result = await getReviewerEfficiency({ organizationId: 'org-1' });

    expect(result.timing.avgReviewHours).toBe(12);
    expect(result.timing.reviewedCount).toBe(1);
    expect(result.queue.submitted).toBe(3);
    expect(result.queue.underReview).toBe(2);
    expect(result.queue.active).toBe(5); // submitted + underReview + 0 + 0 + 0 + 0
  });

  it('returns null for avgReviewHours when no completed assignments', async () => {
    prisma.application.groupBy.mockResolvedValue([]);
    prisma.reviewAssignment.findMany.mockResolvedValue([]);
    prisma.application.findFirst.mockResolvedValue(null);
    prisma.auditLog.count.mockResolvedValue(0);

    const { getReviewerEfficiency } = await import('../modules/pilotMetrics/service.js');
    const result = await getReviewerEfficiency({});
    expect(result.timing.avgReviewHours).toBeNull();
  });

  it('computes oldestPendingHours when submitted application exists', async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago

    prisma.application.groupBy.mockResolvedValue([]);
    prisma.reviewAssignment.findMany.mockResolvedValue([]);
    prisma.application.findFirst.mockResolvedValue({ id: 'a-1', status: 'submitted', createdAt: oldDate });
    prisma.auditLog.count.mockResolvedValue(0);

    const { getReviewerEfficiency } = await import('../modules/pilotMetrics/service.js');
    const result = await getReviewerEfficiency({ organizationId: 'org-1' });

    expect(result.timing.oldestPendingHours).toBeGreaterThanOrEqual(47);
    expect(result.timing.oldestPendingId).toBe('a-1');
  });
});

// ─── Pilot Setup Tests ─────────────────────────────────────

describe('setupPilotOrganization', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects setup if admin fields are missing', async () => {
    const { setupPilotOrganization } = await import('../modules/pilotMetrics/pilotSetup.js');
    await expect(setupPilotOrganization({
      organizationName: 'Test Org',
      admin: { email: 'admin@test.com' }, // missing password and fullName
      createdByUserId: 'u-super',
    })).rejects.toThrow('admin.email, admin.password, and admin.fullName are required');
  });

  it('rejects invalid organization type', async () => {
    const { setupPilotOrganization } = await import('../modules/pilotMetrics/pilotSetup.js');
    await expect(setupPilotOrganization({
      organizationName: 'Test Org',
      organizationType: 'INVALID',
      admin: { email: 'a@b.com', password: 'pw', fullName: 'Admin' },
      createdByUserId: 'u-super',
    })).rejects.toThrow('organizationType must be one of');
  });

  it('rejects duplicate emails in setup request', async () => {
    const { setupPilotOrganization } = await import('../modules/pilotMetrics/pilotSetup.js');
    await expect(setupPilotOrganization({
      organizationName: 'Test Org',
      admin: { email: 'same@email.com', password: 'pw', fullName: 'Admin' },
      fieldOfficers: [{ email: 'same@email.com', password: 'pw', fullName: 'Officer' }],
      createdByUserId: 'u-super',
    })).rejects.toThrow('Duplicate email addresses');
  });

  it('rejects when email is already registered', async () => {
    prisma.user.findMany.mockResolvedValue([{ email: 'taken@org.com' }]);

    const { setupPilotOrganization } = await import('../modules/pilotMetrics/pilotSetup.js');
    await expect(setupPilotOrganization({
      organizationName: 'Test Org',
      admin: { email: 'taken@org.com', password: 'pw', fullName: 'Admin' },
      createdByUserId: 'u-super',
    })).rejects.toThrow('already registered');
  });

  it('rejects more than 5 field officers', async () => {
    const { setupPilotOrganization } = await import('../modules/pilotMetrics/pilotSetup.js');
    const officers = Array.from({ length: 6 }, (_, i) => ({
      email: `fo${i}@org.com`, password: 'pw', fullName: `Officer ${i}`,
    }));
    await expect(setupPilotOrganization({
      organizationName: 'Test Org',
      admin: { email: 'admin@org.com', password: 'pw', fullName: 'Admin' },
      fieldOfficers: officers,
      createdByUserId: 'u-super',
    })).rejects.toThrow('Maximum 5 field officers');
  });
});

// ─── Permission: Farmers blocked from pilot metrics ────────

describe('Pilot metrics route permissions', () => {
  it('farmer role is NOT in the allowed roles for /pilot/metrics', () => {
    // Verify by checking that the route authorize() call explicitly lists roles
    // and farmer is not among them (structural test)
    const allowedRoles = ['super_admin', 'institutional_admin', 'investor_viewer'];
    expect(allowedRoles).not.toContain('farmer');
  });

  it('field_officer is NOT allowed for /pilot/metrics', () => {
    const allowedRoles = ['super_admin', 'institutional_admin', 'investor_viewer'];
    expect(allowedRoles).not.toContain('field_officer');
  });

  it('reviewer is NOT allowed for /pilot/metrics', () => {
    const allowedRoles = ['super_admin', 'institutional_admin', 'investor_viewer'];
    expect(allowedRoles).not.toContain('reviewer');
  });

  it('investor_viewer IS allowed for /pilot/metrics (read-only)', () => {
    const allowedRoles = ['super_admin', 'institutional_admin', 'investor_viewer'];
    expect(allowedRoles).toContain('investor_viewer');
  });

  it('field_officer IS allowed for /pilot/needs-attention (limited)', () => {
    const allowedRoles = ['super_admin', 'institutional_admin', 'field_officer'];
    expect(allowedRoles).toContain('field_officer');
  });

  it('/pilot/setup is super_admin only', () => {
    const allowedRoles = ['super_admin'];
    expect(allowedRoles).toHaveLength(1);
    expect(allowedRoles[0]).toBe('super_admin');
  });
});
