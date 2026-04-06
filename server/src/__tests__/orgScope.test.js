import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock prisma ────────────────────────────────────────
vi.mock('../config/database.js', () => ({
  default: {
    user: { findUnique: vi.fn() },
  },
}));

import prisma from '../config/database.js';
import {
  extractOrganization,
  orgWhereFarmer,
  orgWhereApplication,
  orgWhereUser,
  verifyOrgAccess,
  clearOrgCache,
  invalidateOrgCache,
} from '../middleware/orgScope.js';

// ─── Helpers ────────────────────────────────────────────

function mockReq(overrides = {}) {
  return { user: { sub: 'u-1', role: 'institutional_admin' }, query: {}, ...overrides };
}

function mockRes() {
  const res = { statusCode: 200, _json: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res._json = data; return res; };
  return res;
}

// ─── Tests ──────────────────────────────────────────────

describe('Organization Scoping Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOrgCache();
  });

  // ═══════════════════════════════════════════════════════
  //  extractOrganization middleware
  // ═══════════════════════════════════════════════════════

  describe('extractOrganization', () => {
    it('returns 401 if no user on request', () => {
      const req = { user: null, query: {} };
      const res = mockRes();
      const next = vi.fn();
      extractOrganization(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('sets req.organizationId from DB for institutional_admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      await extractOrganization(req, res, next);
      // Wait for async DB lookup
      await new Promise((r) => setTimeout(r, 10));

      expect(next).toHaveBeenCalled();
      expect(req.organizationId).toBe('org-1');
      expect(req.isCrossOrg).toBe(false);
    });

    it('caches org lookup — second call skips DB', async () => {
      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      const req1 = mockReq();
      const res1 = mockRes();
      const next1 = vi.fn();

      await extractOrganization(req1, res1, next1);
      await new Promise((r) => setTimeout(r, 10));
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

      // Second call — should use cache
      const req2 = mockReq();
      const res2 = mockRes();
      const next2 = vi.fn();
      extractOrganization(req2, res2, next2);
      // Cache hit is synchronous
      expect(next2).toHaveBeenCalled();
      expect(req2.organizationId).toBe('org-1');
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1); // no second call
    });

    it('invalidateOrgCache forces DB re-lookup', async () => {
      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      const req1 = mockReq();
      await extractOrganization(req1, mockRes(), vi.fn());
      await new Promise((r) => setTimeout(r, 10));

      invalidateOrgCache('u-1');

      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-2' });
      const req2 = mockReq();
      const next2 = vi.fn();
      await extractOrganization(req2, mockRes(), next2);
      await new Promise((r) => setTimeout(r, 10));
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
      expect(req2.organizationId).toBe('org-2');
    });

    it('super_admin gets cross-org access by default (orgId = null)', async () => {
      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      const req = mockReq({ user: { sub: 'u-admin', role: 'super_admin' }, query: {} });
      const res = mockRes();
      const next = vi.fn();

      await extractOrganization(req, res, next);
      await new Promise((r) => setTimeout(r, 10));

      expect(next).toHaveBeenCalled();
      expect(req.organizationId).toBeNull();
      expect(req.isCrossOrg).toBe(true);
    });

    it('super_admin can scope to specific org via ?orgId', async () => {
      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      const req = mockReq({
        user: { sub: 'u-admin', role: 'super_admin' },
        query: { orgId: 'org-specific' },
      });
      const res = mockRes();
      const next = vi.fn();

      await extractOrganization(req, res, next);
      await new Promise((r) => setTimeout(r, 10));

      expect(req.organizationId).toBe('org-specific');
      expect(req.isCrossOrg).toBe(false);
    });

    it('non-super_admin cannot override org via ?orgId', async () => {
      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      const req = mockReq({
        user: { sub: 'u-2', role: 'institutional_admin' },
        query: { orgId: 'org-attack' },
      });
      const res = mockRes();
      const next = vi.fn();

      await extractOrganization(req, res, next);
      await new Promise((r) => setTimeout(r, 10));

      expect(req.organizationId).toBe('org-1'); // enforced from DB, not query
      expect(req.isCrossOrg).toBe(false);
    });

    it('returns 403 for non-farmer user with no org assigned', async () => {
      prisma.user.findUnique.mockResolvedValue({ organizationId: null });
      const req = mockReq({ user: { sub: 'u-orphan', role: 'field_officer' } });
      const res = mockRes();
      const next = vi.fn();

      await extractOrganization(req, res, next);
      await new Promise((r) => setTimeout(r, 10));

      expect(res.statusCode).toBe(403);
      expect(res._json.error).toMatch(/No organization assigned/);
      expect(next).not.toHaveBeenCalled();
    });

    it('allows farmer with no org (backward compat)', async () => {
      prisma.user.findUnique.mockResolvedValue({ organizationId: null });
      const req = mockReq({ user: { sub: 'u-farmer', role: 'farmer' } });
      const res = mockRes();
      const next = vi.fn();

      await extractOrganization(req, res, next);
      await new Promise((r) => setTimeout(r, 10));

      expect(next).toHaveBeenCalled();
      expect(req.organizationId).toBeNull();
    });

    it('returns 401 if user not found in DB', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const req = mockReq({ user: { sub: 'u-deleted', role: 'reviewer' } });
      const res = mockRes();
      const next = vi.fn();

      await extractOrganization(req, res, next);
      await new Promise((r) => setTimeout(r, 10));

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════
  //  Query helpers
  // ═══════════════════════════════════════════════════════

  describe('orgWhereFarmer', () => {
    it('returns { organizationId } for scoped user', () => {
      const req = { organizationId: 'org-1', isCrossOrg: false };
      expect(orgWhereFarmer(req)).toEqual({ organizationId: 'org-1' });
    });

    it('returns {} for super_admin cross-org', () => {
      const req = { organizationId: null, isCrossOrg: true };
      expect(orgWhereFarmer(req)).toEqual({});
    });

    it('returns {} when orgId is null (backward compat)', () => {
      const req = { organizationId: null, isCrossOrg: false };
      expect(orgWhereFarmer(req)).toEqual({});
    });
  });

  describe('orgWhereApplication', () => {
    it('returns nested { farmer: { organizationId } } for scoped user', () => {
      const req = { organizationId: 'org-1', isCrossOrg: false };
      expect(orgWhereApplication(req)).toEqual({ farmer: { organizationId: 'org-1' } });
    });

    it('returns {} for super_admin cross-org', () => {
      const req = { organizationId: null, isCrossOrg: true };
      expect(orgWhereApplication(req)).toEqual({});
    });
  });

  describe('orgWhereUser', () => {
    it('returns { organizationId } for scoped user', () => {
      const req = { organizationId: 'org-1', isCrossOrg: false };
      expect(orgWhereUser(req)).toEqual({ organizationId: 'org-1' });
    });

    it('returns {} for super_admin cross-org', () => {
      const req = { organizationId: null, isCrossOrg: true };
      expect(orgWhereUser(req)).toEqual({});
    });
  });

  // ═══════════════════════════════════════════════════════
  //  verifyOrgAccess — single-record access check
  // ═══════════════════════════════════════════════════════

  describe('verifyOrgAccess', () => {
    it('allows access when org matches', () => {
      const req = { organizationId: 'org-1', isCrossOrg: false };
      expect(verifyOrgAccess(req, 'org-1')).toBe(true);
    });

    it('denies access when org does not match', () => {
      const req = { organizationId: 'org-1', isCrossOrg: false };
      expect(verifyOrgAccess(req, 'org-2')).toBe(false);
    });

    it('allows super_admin cross-org access regardless of record org', () => {
      const req = { organizationId: null, isCrossOrg: true };
      expect(verifyOrgAccess(req, 'org-any')).toBe(true);
    });

    it('allows access when no org enforcement (null orgId, backward compat)', () => {
      const req = { organizationId: null, isCrossOrg: false };
      expect(verifyOrgAccess(req, 'org-1')).toBe(true);
    });

    it('denies cross-org access for non-super_admin', () => {
      const req = { organizationId: 'org-1', isCrossOrg: false };
      // Record belongs to org-2, user belongs to org-1 → DENIED
      expect(verifyOrgAccess(req, 'org-2')).toBe(false);
    });

    it('super_admin scoped to specific org — denies mismatched record', () => {
      // super_admin used ?orgId=org-1, so they are NOT cross-org
      const req = { organizationId: 'org-1', isCrossOrg: false };
      expect(verifyOrgAccess(req, 'org-2')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════
  //  Security regression: org bypass attempts
  // ═══════════════════════════════════════════════════════

  describe('Security — org bypass prevention', () => {
    it('reviewer cannot access data from another org', () => {
      const req = { organizationId: 'org-A', isCrossOrg: false };
      expect(verifyOrgAccess(req, 'org-B')).toBe(false);
      expect(orgWhereFarmer(req)).toEqual({ organizationId: 'org-A' });
    });

    it('field_officer cannot override org via query manipulation', async () => {
      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-real' });
      const req = mockReq({
        user: { sub: 'u-officer', role: 'field_officer' },
        query: { orgId: 'org-hacked' },
      });
      const res = mockRes();
      const next = vi.fn();

      await extractOrganization(req, res, next);
      await new Promise((r) => setTimeout(r, 10));

      // Should use DB org, NOT query param
      expect(req.organizationId).toBe('org-real');
    });

    it('investor_viewer is org-scoped, cannot see other orgs', async () => {
      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-investor' });
      const req = mockReq({
        user: { sub: 'u-investor', role: 'investor_viewer' },
        query: {},
      });
      const res = mockRes();
      const next = vi.fn();

      await extractOrganization(req, res, next);
      await new Promise((r) => setTimeout(r, 10));

      expect(req.organizationId).toBe('org-investor');
      expect(req.isCrossOrg).toBe(false);
      expect(orgWhereFarmer(req)).toEqual({ organizationId: 'org-investor' });
    });

    it('empty string orgId in query param treated as null for super_admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      const req = mockReq({
        user: { sub: 'u-admin', role: 'super_admin' },
        query: { orgId: '' },
      });
      const res = mockRes();
      const next = vi.fn();

      await extractOrganization(req, res, next);
      await new Promise((r) => setTimeout(r, 10));

      // Empty string is falsy → null → cross-org
      expect(req.organizationId).toBeNull();
      expect(req.isCrossOrg).toBe(true);
    });
  });
});
