import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Top-level mocks ───────────────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    farmer: { findUnique: vi.fn() },
    farmSeason: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    seasonProgressEntry: { findMany: vi.fn(), create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    stageConfirmation: { findMany: vi.fn() },
    officerValidation: { findMany: vi.fn() },
    credibilityAssessment: { findUnique: vi.fn(), upsert: vi.fn() },
    progressScore: { findUnique: vi.fn() },
    harvestReport: { findUnique: vi.fn(), create: vi.fn() },
    application: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
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

// Spy-compatible mock for opsLogger — returns real structure but is spyable
vi.mock('../utils/opsLogger.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    logPermissionEvent: vi.fn(original.logPermissionEvent),
    logAuthEvent: vi.fn(original.logAuthEvent),
    logWorkflowEvent: vi.fn(original.logWorkflowEvent),
    logUploadEvent: vi.fn(original.logUploadEvent),
    logSystemEvent: vi.fn(original.logSystemEvent),
    opsEvent: vi.fn(original.opsEvent),
  };
});

import prisma from '../config/database.js';
import { verifyOrgAccess, orgWhereFarmer, orgWhereApplication, orgWhereUser } from '../middleware/orgScope.js';
import { logPermissionEvent, opsEvent, logAuthEvent, logWorkflowEvent } from '../utils/opsLogger.js';

// ─── Org Scope — verifyOrgAccess logging ────────────────

describe('Org Scope — verifyOrgAccess logging', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns true for cross-org (super_admin)', () => {
    const req = { isCrossOrg: true, user: { sub: 'u-1', role: 'super_admin' } };
    expect(verifyOrgAccess(req, 'org-other')).toBe(true);
  });

  it('returns true when orgs match', () => {
    const req = {
      isCrossOrg: false,
      organizationId: 'org-1',
      user: { sub: 'u-1', role: 'reviewer' },
      originalUrl: '/api/test',
      method: 'GET',
    };
    expect(verifyOrgAccess(req, 'org-1')).toBe(true);
  });

  it('returns false and logs when orgs do not match', () => {
    const req = {
      isCrossOrg: false,
      organizationId: 'org-1',
      user: { sub: 'u-1', role: 'reviewer' },
      originalUrl: '/api/seasons/farmer/f-99/performance-profile',
      method: 'GET',
    };
    expect(verifyOrgAccess(req, 'org-2')).toBe(false);
    expect(logPermissionEvent).toHaveBeenCalledWith('cross_org_access_denied', expect.objectContaining({
      userId: 'u-1',
      userOrgId: 'org-1',
      recordOrgId: 'org-2',
    }));
  });

  it('does not log when no org enforcement', () => {
    const req = {
      isCrossOrg: false,
      organizationId: null,
      user: { sub: 'u-1', role: 'farmer' },
    };
    expect(verifyOrgAccess(req, 'org-1')).toBe(true);
    expect(logPermissionEvent).not.toHaveBeenCalled();
  });
});

// ─── Stale Seasons Org Scoping Tests ────────────────────

describe('getStaleSeasons — org scoping', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('queries without org filter when no organizationId provided', async () => {
    const { getStaleSeasons } = await import('../modules/seasons/statusTransitions.js');
    prisma.farmSeason.findMany.mockResolvedValue([]);

    await getStaleSeasons();

    const call = prisma.farmSeason.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('active');
    // Should NOT have a farmer filter in where
    expect(call.where.farmer).toBeUndefined();
  });

  it('adds farmer.organizationId filter when organizationId provided', async () => {
    const { getStaleSeasons } = await import('../modules/seasons/statusTransitions.js');
    prisma.farmSeason.findMany.mockResolvedValue([]);

    await getStaleSeasons({ organizationId: 'org-1' });

    const call = prisma.farmSeason.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('active');
    expect(call.where.farmer).toEqual({ organizationId: 'org-1' });
  });

  it('includes farmer.organizationId in include select', async () => {
    const { getStaleSeasons } = await import('../modules/seasons/statusTransitions.js');
    prisma.farmSeason.findMany.mockResolvedValue([]);

    await getStaleSeasons();

    const call = prisma.farmSeason.findMany.mock.calls[0][0];
    expect(call.include.farmer.select.organizationId).toBe(true);
  });
});

// ─── Rate Limiter Exports ───────────────────────────────

describe('Rate Limiter Configuration', () => {
  it('exports all expected limiters', async () => {
    const mod = await import('../middleware/rateLimiters.js');
    expect(mod.workflowLimiter).toBeDefined();
    expect(mod.registrationLimiter).toBeDefined();
    expect(mod.uploadLimiter).toBeDefined();
    expect(mod.submissionLimiter).toBeDefined();
  });
});

// ─── Org Scope Helpers ──────────────────────────────────

describe('Org Scope — query helpers', () => {
  it('orgWhereFarmer returns empty for cross-org', () => {
    expect(orgWhereFarmer({ isCrossOrg: true })).toEqual({});
  });

  it('orgWhereFarmer returns org filter for scoped user', () => {
    expect(orgWhereFarmer({ isCrossOrg: false, organizationId: 'org-1' }))
      .toEqual({ organizationId: 'org-1' });
  });

  it('orgWhereApplication returns nested farmer filter', () => {
    expect(orgWhereApplication({ isCrossOrg: false, organizationId: 'org-1' }))
      .toEqual({ farmer: { organizationId: 'org-1' } });
  });

  it('orgWhereUser returns org filter for scoped user', () => {
    expect(orgWhereUser({ isCrossOrg: false, organizationId: 'org-1' }))
      .toEqual({ organizationId: 'org-1' });
  });
});

// ─── Ops Logger Tests ───────────────────────────────────

describe('Ops Logger', () => {
  it('opsEvent returns structured entry', () => {
    const entry = opsEvent('auth', 'login_failed', 'warn', { userId: 'u-1' });
    expect(entry.type).toBe('ops_event');
    expect(entry.category).toBe('auth');
    expect(entry.event).toBe('login_failed');
    expect(entry.severity).toBe('warn');
    expect(entry.userId).toBe('u-1');
    expect(entry.timestamp).toBeDefined();
  });

  it('logAuthEvent sets warn for login_failed', () => {
    const entry = logAuthEvent('login_failed', { ip: '1.2.3.4' });
    expect(entry.severity).toBe('warn');
  });

  it('logAuthEvent sets info for login_success', () => {
    const entry = logAuthEvent('login_success', { userId: 'u-1' });
    expect(entry.severity).toBe('info');
  });

  it('logPermissionEvent always uses warn severity', () => {
    const entry = logPermissionEvent('cross_org_access_denied', { userId: 'u-1' });
    expect(entry.severity).toBe('warn');
    expect(entry.category).toBe('permission');
  });

  it('logWorkflowEvent sets error for transition_failed', () => {
    const entry = logWorkflowEvent('transition_failed', { seasonId: 's-1' });
    expect(entry.severity).toBe('error');
  });

  it('logWorkflowEvent sets info for normal events', () => {
    const entry = logWorkflowEvent('season_status_changed', { seasonId: 's-1' });
    expect(entry.severity).toBe('info');
  });
});
