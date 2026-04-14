import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../config/index.js', () => ({
  config: { jwt: { secret: 'test-secret' } },
}));

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    user: { findUnique: vi.fn() },
    farmer: { findUnique: vi.fn() },
    application: { findUnique: vi.fn() },
    officerValidation: { count: vi.fn().mockResolvedValue(0) },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { default: mockPrisma };
});

import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { authenticate, authorize, requireApprovedFarmer, requireFarmerOwnership, requireApplicationAccess, clearAuthCache } from '../middleware/auth.js';

// Helper to create mock req/res/next
function createMocks(overrides = {}) {
  const req = {
    headers: { authorization: 'Bearer valid-token' },
    params: {},
    user: null,
    ...overrides,
  };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthCache();
  });

  describe('authorize', () => {
    it('passes through when user has allowed role', () => {
      const middleware = authorize('super_admin', 'reviewer');
      const { req, res, next } = createMocks();
      req.user = { sub: '123', role: 'super_admin' };

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 403 when user role is not in allowed list', () => {
      const middleware = authorize('super_admin', 'reviewer');
      const { req, res, next } = createMocks();
      req.user = { sub: '123', role: 'farmer' };

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when no user on request', () => {
      const middleware = authorize('super_admin');
      const { req, res, next } = createMocks();
      req.user = null;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('passes through when no roles specified (any authenticated user)', () => {
      const middleware = authorize();
      const { req, res, next } = createMocks();
      req.user = { sub: '123', role: 'farmer' };

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('checks all 6 roles correctly', () => {
      const allRoles = ['super_admin', 'institutional_admin', 'reviewer', 'field_officer', 'investor_viewer', 'farmer'];
      for (const role of allRoles) {
        const middleware = authorize(role);
        const { req, res, next } = createMocks();
        req.user = { sub: '123', role };
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });
  });

  describe('authenticate', () => {
    it('returns 401 when no Authorization header', () => {
      const { req, res, next } = createMocks({ headers: {} });
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('returns 401 when Authorization header lacks Bearer prefix', () => {
      const { req, res, next } = createMocks({ headers: { authorization: 'Basic abc' } });
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when JWT verification fails', () => {
      jwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      const { req, res, next } = createMocks();
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });

    it('checks DB for user after JWT verification', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-123', role: 'farmer' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-123', active: true, role: 'farmer' });

      const { req, res, next } = createMocks();
      authenticate(req, res, next);

      // Wait for async DB call
      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { id: true, active: true, role: true, organizationId: true, tokenVersion: true },
      });
      expect(req.user.role).toBe('farmer');
    });

    it('returns 403 for deactivated users', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-123', role: 'farmer' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-123', active: false, role: 'farmer' });

      const { req, res, next } = createMocks();
      authenticate(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(403);
      });

      expect(res.json).toHaveBeenCalledWith({ error: 'Account deactivated' });
    });

    it('returns 401 when user not found in DB', async () => {
      jwt.verify.mockReturnValue({ sub: 'deleted-user', role: 'farmer' });
      prisma.user.findUnique.mockResolvedValue(null);

      const { req, res, next } = createMocks();
      authenticate(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(401);
      });
    });

    it('uses DB role instead of JWT role (role refresh)', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-123', role: 'farmer' });
      // User was promoted to reviewer in DB
      prisma.user.findUnique.mockResolvedValue({ id: 'user-123', active: true, role: 'reviewer' });

      const { req, res, next } = createMocks();
      authenticate(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });

      expect(req.user.role).toBe('reviewer');
    });
  });

  describe('requireApprovedFarmer', () => {
    it('passes non-farmer roles through without DB check', () => {
      const { req, res, next } = createMocks();
      req.user = { sub: '123', role: 'super_admin' };

      requireApprovedFarmer(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(prisma.farmer.findUnique).not.toHaveBeenCalled();
    });

    it('checks DB for farmer registration status', async () => {
      prisma.farmer.findUnique.mockResolvedValue({ registrationStatus: 'approved' });

      const { req, res, next } = createMocks();
      req.user = { sub: 'farmer-123', role: 'farmer' };

      requireApprovedFarmer(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });
    });

    it('returns 403 for pending farmers', async () => {
      prisma.farmer.findUnique.mockResolvedValue({ registrationStatus: 'pending' });

      const { req, res, next } = createMocks();
      req.user = { sub: 'farmer-123', role: 'farmer' };

      requireApprovedFarmer(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(403);
      });

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Account pending approval',
      }));
    });

    it('returns 403 when farmer profile not found', async () => {
      prisma.farmer.findUnique.mockResolvedValue(null);

      const { req, res, next } = createMocks();
      req.user = { sub: 'orphan-user', role: 'farmer' };

      requireApprovedFarmer(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(403);
      });
    });
  });

  describe('requireFarmerOwnership', () => {
    it('passes staff roles through without check', () => {
      const { req, res, next } = createMocks();
      req.user = { sub: 'admin-1', role: 'super_admin' };
      req.params = { farmerId: 'any-farmer' };

      requireFarmerOwnership(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(prisma.farmer.findUnique).not.toHaveBeenCalled();
    });

    it('allows farmer to access own data', async () => {
      prisma.farmer.findUnique.mockResolvedValue({ userId: 'farmer-user-1' });

      const { req, res, next } = createMocks();
      req.user = { sub: 'farmer-user-1', role: 'farmer' };
      req.params = { farmerId: 'farmer-record-1' };

      requireFarmerOwnership(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });
    });

    it('blocks farmer from accessing other farmers data', async () => {
      prisma.farmer.findUnique.mockResolvedValue({ userId: 'other-user' });

      const { req, res, next } = createMocks();
      req.user = { sub: 'farmer-user-1', role: 'farmer' };
      req.params = { farmerId: 'other-farmer-record' };

      requireFarmerOwnership(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(403);
      });

      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied — you can only access your own data' });
    });

    it('returns 404 when farmer record not found', async () => {
      prisma.farmer.findUnique.mockResolvedValue(null);

      const { req, res, next } = createMocks();
      req.user = { sub: 'farmer-user-1', role: 'farmer' };
      req.params = { farmerId: 'nonexistent' };

      requireFarmerOwnership(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(404);
      });
    });

    it('skips check when no farmerId param', () => {
      const { req, res, next } = createMocks();
      req.user = { sub: 'farmer-user-1', role: 'farmer' };
      req.params = {};

      requireFarmerOwnership(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireApplicationAccess', () => {
    it('passes admin roles through without check', () => {
      const { req, res, next } = createMocks();
      req.user = { sub: 'admin-1', role: 'super_admin' };
      req.params = { id: 'app-1' };

      requireApplicationAccess(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('passes institutional_admin through without check', () => {
      const { req, res, next } = createMocks();
      req.user = { sub: 'admin-2', role: 'institutional_admin' };
      req.params = { id: 'app-1' };

      requireApplicationAccess(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('allows field officer access to assigned application', async () => {
      prisma.application.findUnique.mockResolvedValue({
        assignedFieldOfficerId: 'officer-1',
        assignedReviewerId: null,
      });

      const { req, res, next } = createMocks();
      req.user = { sub: 'officer-1', role: 'field_officer' };
      req.params = { id: 'app-1' };

      requireApplicationAccess(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });
    });

    it('blocks field officer from unassigned application', async () => {
      prisma.application.findUnique.mockResolvedValue({
        assignedFieldOfficerId: 'other-officer',
        assignedReviewerId: null,
      });

      const { req, res, next } = createMocks();
      req.user = { sub: 'officer-1', role: 'field_officer' };
      req.params = { id: 'app-1' };

      requireApplicationAccess(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(403);
      });
    });

    it('allows reviewer access to assigned application', async () => {
      prisma.application.findUnique.mockResolvedValue({
        assignedFieldOfficerId: null,
        assignedReviewerId: 'reviewer-1',
      });

      const { req, res, next } = createMocks();
      req.user = { sub: 'reviewer-1', role: 'reviewer' };
      req.params = { id: 'app-1' };

      requireApplicationAccess(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });
    });

    it('blocks reviewer from unassigned application', async () => {
      prisma.application.findUnique.mockResolvedValue({
        assignedFieldOfficerId: null,
        assignedReviewerId: 'other-reviewer',
      });

      const { req, res, next } = createMocks();
      req.user = { sub: 'reviewer-1', role: 'reviewer' };
      req.params = { id: 'app-1' };

      requireApplicationAccess(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(403);
      });
    });

    it('returns 404 when application not found', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      const { req, res, next } = createMocks();
      req.user = { sub: 'officer-1', role: 'field_officer' };
      req.params = { id: 'nonexistent' };

      requireApplicationAccess(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(404);
      });
    });
  });
});
