/**
 * Tests for Impact Dashboard service — Phase 1.
 *
 * Coverage:
 *   - Summary metric calculations
 *   - Demographic grouping (gender, age)
 *   - Participation rates by demographic
 *   - Needs-attention classification
 *   - Filters (gender, ageGroup, crop, date range)
 *   - CSV export structure
 *   - Response shape
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma ────────────────────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    farmer: { findMany: vi.fn() },
    organization: { findMany: vi.fn() },
    officerValidation: { count: vi.fn().mockResolvedValue(0) },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { default: mockPrisma };
});

import prisma from '../config/database.js';
import {
  getImpactDashboard,
  getImpactExportCSV,
  getImpactFilterOptions,
} from '../modules/impact/service.js';

// ─── Helpers ────────────────────────────────────────────

function farmer(o = {}) {
  return {
    id: o.id || 'f-1',
    fullName: o.fullName || 'Test Farmer',
    gender: o.gender ?? null,
    dateOfBirth: o.dateOfBirth ?? null,
    registrationStatus: o.registrationStatus || 'approved',
    region: o.region || 'Central',
    primaryCrop: o.primaryCrop || 'maize',
    createdAt: o.createdAt || new Date('2025-01-15'),
    farmSeasons: o.farmSeasons || [],
  };
}

function season(o = {}) {
  return {
    id: o.id || 's-1',
    status: o.status || 'active',
    lastActivityDate: o.lastActivityDate ?? new Date(),
    progressScore: o.progressScore || null,
    credibilityAssessment: o.credibilityAssessment || null,
    progressEntries: o.progressEntries || [],
    officerValidations: o.officerValidations || [],
  };
}

const OLD = new Date(Date.now() - 60 * 24 * 3600_000); // 60 days ago

// ─── Tests ──────────────────────────────────────────────

describe('Impact Dashboard Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.farmer.findMany.mockResolvedValue([]);
  });

  // ── Summary ───────────────────────────────────────────

  describe('Summary metrics', () => {
    it('returns zeros when no farmers', async () => {
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.summary).toEqual({
        totalFarmers: 0,
        womenFarmers: 0,
        youthFarmers: 0,
        activeFarmers: 0,
        validatedRecords: 0,
        needsAttention: 0,
      });
    });

    it('counts total, women, youth correctly', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: '1', gender: 'female', dateOfBirth: new Date('2000-05-10') }),
        farmer({ id: '2', gender: 'male', dateOfBirth: new Date('1985-03-20') }),
        farmer({ id: '3', gender: 'female', dateOfBirth: new Date('1995-01-01') }),
        farmer({ id: '4', gender: 'male', dateOfBirth: new Date('1960-12-01') }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.summary.totalFarmers).toBe(4);
      expect(r.summary.womenFarmers).toBe(2);
      expect(r.summary.youthFarmers).toBe(2); // ages ~26 and ~31
    });

    it('counts active from active seasons', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: '1', farmSeasons: [season({ status: 'active' })] }),
        farmer({ id: '2', farmSeasons: [season({ status: 'completed', lastActivityDate: OLD })] }),
        farmer({ id: '3', farmSeasons: [] }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.summary.activeFarmers).toBe(1);
    });

    it('counts active from recent activity on completed season', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: '1', farmSeasons: [season({ status: 'completed', lastActivityDate: new Date() })] }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.summary.activeFarmers).toBe(1);
    });

    it('counts validated records', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: '1', farmSeasons: [season({ officerValidations: [{ id: 'v1' }] })] }),
        farmer({ id: '2', farmSeasons: [season({ officerValidations: [] })] }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.summary.validatedRecords).toBe(1);
    });

    it('counts needsAttention for farmers needing action', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        // has season but no update + no validation
        farmer({ id: '1', fullName: 'A', farmSeasons: [season({ progressEntries: [], officerValidations: [] })] }),
        // fully updated + validated = does NOT need attention
        farmer({ id: '2', fullName: 'B', farmSeasons: [season({ progressEntries: [{ id: 'e1' }], officerValidations: [{ id: 'v1' }] })] }),
        // no seasons = does NOT need attention (nothing to flag)
        farmer({ id: '3', fullName: 'C', farmSeasons: [] }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.summary.needsAttention).toBe(1);
    });
  });

  // ── Demographics ──────────────────────────────────────

  describe('Demographic grouping', () => {
    it('groups by gender', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: '1', gender: 'male' }),
        farmer({ id: '2', gender: 'female' }),
        farmer({ id: '3', gender: 'female' }),
        farmer({ id: '4', gender: null }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.demographics.gender.male).toBe(1);
      expect(r.demographics.gender.female).toBe(2);
      expect(r.demographics.gender.unknown).toBe(1);
    });

    it('groups by age', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: '1', dateOfBirth: new Date('2005-01-01') }), // ~21
        farmer({ id: '2', dateOfBirth: new Date('1995-01-01') }), // ~31
        farmer({ id: '3', dateOfBirth: new Date('1975-01-01') }), // ~51
        farmer({ id: '4', dateOfBirth: null }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.demographics.ageGroup['18-24']).toBe(1);
      expect(r.demographics.ageGroup['25-34']).toBe(1);
      expect(r.demographics.ageGroup['45-54']).toBe(1);
      expect(r.demographics.ageGroup.unknown).toBe(1);
    });
  });

  // ── Participation ─────────────────────────────────────

  describe('Participation rates', () => {
    it('computes active rate by gender', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: '1', gender: 'female', farmSeasons: [season({ status: 'active' })] }),
        farmer({ id: '2', gender: 'female', farmSeasons: [] }),
        farmer({ id: '3', gender: 'male', farmSeasons: [season({ status: 'active' })] }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.participation.activeRateByGender.female).toEqual({ count: 1, total: 2, rate: 50 });
      expect(r.participation.activeRateByGender.male.rate).toBe(100);
    });

    it('computes active rate by age group', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: '1', dateOfBirth: new Date('2000-01-01'), farmSeasons: [season({ status: 'active' })] }),
        farmer({ id: '2', dateOfBirth: new Date('2000-06-01'), farmSeasons: [] }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.participation.activeRateByAge['25-34'].rate).toBe(50);
    });
  });

  // ── Needs Attention ───────────────────────────────────

  describe('Needs attention lists', () => {
    it('includes farmers with no updates in noUpdate list', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: 'f-no-update', fullName: 'No Updates', farmSeasons: [season({ progressEntries: [] })] }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.needsAttention.noUpdate).toHaveLength(1);
      expect(r.needsAttention.noUpdate[0].id).toBe('f-no-update');
      expect(r.needsAttention.noUpdate[0].name).toBe('No Updates');
    });

    it('includes unvalidated farmers in notValidated list', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({
          id: 'f-unval', fullName: 'Unvalidated',
          farmSeasons: [season({ progressEntries: [{ id: 'e1' }], officerValidations: [] })],
        }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.needsAttention.notValidated).toHaveLength(1);
      expect(r.needsAttention.notValidated[0].id).toBe('f-unval');
    });

    it('includes stale farmers in inactive list', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({
          id: 'f-stale', fullName: 'Stale Farmer',
          farmSeasons: [season({ status: 'active', lastActivityDate: OLD })],
        }),
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.needsAttention.inactive).toHaveLength(1);
      expect(r.needsAttention.inactive[0].id).toBe('f-stale');
    });

    it('caps each list at 20 items but reports true count', async () => {
      const many = Array.from({ length: 30 }, (_, i) =>
        farmer({
          id: `f-${i}`, fullName: `F${i}`,
          farmSeasons: [season({ progressEntries: [], officerValidations: [] })],
        })
      );
      prisma.farmer.findMany.mockResolvedValue(many);
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.needsAttention.noUpdate.length).toBe(20);
      expect(r.needsAttention.noUpdateCount).toBe(30);
      expect(r.needsAttention.notValidated.length).toBe(20);
      expect(r.needsAttention.notValidatedCount).toBe(30);
    });
  });

  // ── Filters ───────────────────────────────────────────

  describe('Filters', () => {
    it('passes org filter to prisma', async () => {
      await getImpactDashboard({ organizationId: 'org-x' });
      expect(prisma.farmer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-x' }) })
      );
    });

    it('passes gender filter to prisma', async () => {
      await getImpactDashboard({ organizationId: 'org-1', filters: { gender: 'female' } });
      expect(prisma.farmer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ gender: 'female' }) })
      );
    });

    it('rejects invalid gender', async () => {
      await getImpactDashboard({ organizationId: 'org-1', filters: { gender: 'INVALID' } });
      const call = prisma.farmer.findMany.mock.calls[0][0];
      expect(call.where.gender).toBeUndefined();
    });

    it('passes crop filter', async () => {
      await getImpactDashboard({ organizationId: 'org-1', filters: { crop: 'maize' } });
      expect(prisma.farmer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ primaryCrop: 'maize' }) })
      );
    });

    it('passes date range', async () => {
      await getImpactDashboard({ organizationId: 'org-1', filters: { dateFrom: '2025-01-01', dateTo: '2025-06-30' } });
      const w = prisma.farmer.findMany.mock.calls[0][0].where;
      expect(w.createdAt.gte).toEqual(new Date('2025-01-01'));
      expect(w.createdAt.lte).toEqual(new Date('2025-06-30'));
    });

    it('applies ageGroup filter in-memory', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: '1', dateOfBirth: new Date('2000-01-01') }), // ~26 = 25-34
        farmer({ id: '2', dateOfBirth: new Date('1970-01-01') }), // ~56 = 55+
      ]);
      const r = await getImpactDashboard({ organizationId: 'org-1', filters: { ageGroup: '25-34' } });
      expect(r.summary.totalFarmers).toBe(1);
    });

    it('passes region filter to prisma', async () => {
      await getImpactDashboard({ organizationId: 'org-1', filters: { region: 'Central' } });
      expect(prisma.farmer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ region: 'Central' }) })
      );
    });

    it('passes registrationStatus filter to prisma', async () => {
      await getImpactDashboard({ organizationId: 'org-1', filters: { registrationStatus: 'approved' } });
      expect(prisma.farmer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ registrationStatus: 'approved' }) })
      );
    });

    it('rejects invalid registrationStatus', async () => {
      await getImpactDashboard({ organizationId: 'org-1', filters: { registrationStatus: 'BOGUS' } });
      const call = prisma.farmer.findMany.mock.calls[0][0];
      expect(call.where.registrationStatus).toBeUndefined();
    });

    it('returns applied filters in response', async () => {
      const r = await getImpactDashboard({ organizationId: 'org-1', filters: { gender: 'female', ageGroup: '25-34' } });
      expect(r.appliedFilters).toEqual({ gender: 'female', ageGroup: '25-34' });
    });
  });

  // ── CSV Export ────────────────────────────────────────

  describe('CSV export', () => {
    it('produces CSV with all required sections', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: '1', gender: 'female', fullName: 'Jane', farmSeasons: [season({ progressEntries: [] })] }),
        farmer({ id: '2', gender: 'male', fullName: 'John' }),
      ]);
      const csv = await getImpactExportCSV({ organizationId: 'org-1' });
      expect(typeof csv).toBe('string');
      expect(csv).toContain('IMPACT SUMMARY');
      expect(csv).toContain('GENDER DISTRIBUTION');
      expect(csv).toContain('AGE GROUP DISTRIBUTION');
      expect(csv).toContain('ACTIVE RATE BY GENDER');
      expect(csv).toContain('ACTIVE RATE BY AGE GROUP');
      expect(csv).toContain('NEEDS ATTENTION');
      expect(csv).toContain('"Total Farmers","2"');
    });

    it('includes needs-attention farmer names', async () => {
      prisma.farmer.findMany.mockResolvedValue([
        farmer({ id: '1', fullName: 'Alice Test', farmSeasons: [season({ progressEntries: [], officerValidations: [] })] }),
      ]);
      const csv = await getImpactExportCSV({ organizationId: 'org-1' });
      expect(csv).toContain('Alice Test');
    });

    it('escapes quotes in CSV', async () => {
      prisma.farmer.findMany.mockResolvedValue([]);
      const csv = await getImpactExportCSV({ organizationId: 'org-1' });
      expect(csv).toContain('"Total Farmers"');
    });
  });

  // ── Filter Options ────────────────────────────────────

  describe('Filter options', () => {
    it('returns genders, ageGroups, registrationStatuses, regions, crops', async () => {
      // findMany is called twice: once for crops, once for regions
      prisma.farmer.findMany
        .mockResolvedValueOnce([{ primaryCrop: 'maize' }])   // crops query
        .mockResolvedValueOnce([{ region: 'Central' }, { region: 'Northern' }]); // regions query
      const r = await getImpactFilterOptions({ organizationId: 'org-1' });
      expect(r.genders).toContain('male');
      expect(r.genders).toContain('female');
      expect(r.ageGroups).toContain('18-24');
      expect(r.ageGroups).toContain('55+');
      expect(r.registrationStatuses).toContain('approved');
      expect(r.registrationStatuses).toContain('pending_approval');
      expect(r.regions).toContain('Central');
      expect(r.regions).toContain('Northern');
      expect(r.crops).toContain('maize');
    });
  });

  // ── Response Shape ────────────────────────────────────

  describe('Response structure', () => {
    it('has all top-level keys', async () => {
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r).toHaveProperty('summary');
      expect(r).toHaveProperty('demographics');
      expect(r).toHaveProperty('participation');
      expect(r).toHaveProperty('needsAttention');
      expect(r).toHaveProperty('appliedFilters');
    });

    it('demographics has gender + ageGroup', async () => {
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.demographics).toHaveProperty('gender');
      expect(r.demographics).toHaveProperty('ageGroup');
    });

    it('participation has rate maps', async () => {
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.participation).toHaveProperty('activeRateByGender');
      expect(r.participation).toHaveProperty('activeRateByAge');
    });

    it('needsAttention has three lists with counts', async () => {
      const r = await getImpactDashboard({ organizationId: 'org-1' });
      expect(r.needsAttention).toHaveProperty('noUpdate');
      expect(r.needsAttention).toHaveProperty('noUpdateCount');
      expect(r.needsAttention).toHaveProperty('notValidated');
      expect(r.needsAttention).toHaveProperty('notValidatedCount');
      expect(r.needsAttention).toHaveProperty('inactive');
      expect(r.needsAttention).toHaveProperty('inactiveCount');
      expect(Array.isArray(r.needsAttention.noUpdate)).toBe(true);
    });
  });
});
