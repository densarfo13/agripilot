import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Permission & Role Enforcement Tests
 *
 * Tests that role-based access control is correctly enforced at the route level.
 * Verifies: farmer restrictions, admin-only endpoints, field officer limits, reviewer scoping.
 */

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../config/index.js', () => ({
  config: { jwt: { secret: 'test-secret' } },
}));

vi.mock('../config/database.js', () => ({
  default: {
    user: { findUnique: vi.fn() },
    farmer: { findUnique: vi.fn() },
    application: { findUnique: vi.fn() },
    officerValidation: { count: vi.fn().mockResolvedValue(0) },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { authenticate, authorize, clearAuthCache } from '../middleware/auth.js';

function createMocks(overrides = {}) {
  const req = {
    headers: { authorization: 'Bearer valid-token' },
    params: {},
    query: {},
    body: {},
    user: null,
    ip: '127.0.0.1',
    ...overrides,
  };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

// Simulate a full auth + authorize chain
async function simulateAuth(role, userId = 'user-1') {
  jwt.verify.mockReturnValue({ sub: userId, role });
  prisma.user.findUnique.mockResolvedValue({ id: userId, active: true, role });
}

describe('Permission Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthCache();
  });

  describe('Farmer role restrictions', () => {
    it('farmer cannot access authorize(super_admin) endpoints', async () => {
      await simulateAuth('farmer', 'farmer-user-1');

      const { req, res, next } = createMocks();
      authenticate(req, res, next);

      await vi.waitFor(() => { expect(next).toHaveBeenCalled(); });

      // Now test authorize
      const adminOnly = authorize('super_admin', 'institutional_admin');
      const res2 = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      const next2 = vi.fn();
      adminOnly(req, res2, next2);

      expect(res2.status).toHaveBeenCalledWith(403);
      expect(next2).not.toHaveBeenCalled();
    });

    it('farmer cannot access reviewer endpoints', async () => {
      await simulateAuth('farmer', 'farmer-user-1');

      const { req, res, next } = createMocks();
      authenticate(req, res, next);
      await vi.waitFor(() => { expect(next).toHaveBeenCalled(); });

      const reviewerOnly = authorize('super_admin', 'institutional_admin', 'reviewer');
      const res2 = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      const next2 = vi.fn();
      reviewerOnly(req, res2, next2);

      expect(res2.status).toHaveBeenCalledWith(403);
    });

    it('farmer cannot access field_officer endpoints', async () => {
      await simulateAuth('farmer', 'farmer-user-1');

      const { req, res, next } = createMocks();
      authenticate(req, res, next);
      await vi.waitFor(() => { expect(next).toHaveBeenCalled(); });

      const creatorOnly = authorize('super_admin', 'institutional_admin', 'field_officer');
      const res2 = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      const next2 = vi.fn();
      creatorOnly(req, res2, next2);

      expect(res2.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Admin-only access', () => {
    it('super_admin passes all authorization checks', async () => {
      await simulateAuth('super_admin', 'admin-1');

      const { req, res, next } = createMocks();
      authenticate(req, res, next);
      await vi.waitFor(() => { expect(next).toHaveBeenCalled(); });

      const adminCheck = authorize('super_admin', 'institutional_admin');
      const next2 = vi.fn();
      adminCheck(req, { status: vi.fn().mockReturnThis(), json: vi.fn() }, next2);
      expect(next2).toHaveBeenCalled();
    });

    it('institutional_admin passes admin checks', async () => {
      await simulateAuth('institutional_admin', 'admin-2');

      const { req, res, next } = createMocks();
      authenticate(req, res, next);
      await vi.waitFor(() => { expect(next).toHaveBeenCalled(); });

      const adminCheck = authorize('super_admin', 'institutional_admin');
      const next2 = vi.fn();
      adminCheck(req, { status: vi.fn().mockReturnThis(), json: vi.fn() }, next2);
      expect(next2).toHaveBeenCalled();
    });

    it('reviewer cannot access admin-only endpoints', async () => {
      await simulateAuth('reviewer', 'reviewer-1');

      const { req, res, next } = createMocks();
      authenticate(req, res, next);
      await vi.waitFor(() => { expect(next).toHaveBeenCalled(); });

      const adminCheck = authorize('super_admin', 'institutional_admin');
      const res2 = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      const next2 = vi.fn();
      adminCheck(req, res2, next2);
      expect(res2.status).toHaveBeenCalledWith(403);
    });

    it('field_officer cannot access admin-only endpoints', async () => {
      await simulateAuth('field_officer', 'officer-1');

      const { req, res, next } = createMocks();
      authenticate(req, res, next);
      await vi.waitFor(() => { expect(next).toHaveBeenCalled(); });

      const adminCheck = authorize('super_admin', 'institutional_admin');
      const res2 = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      const next2 = vi.fn();
      adminCheck(req, res2, next2);
      expect(res2.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Disabled user enforcement', () => {
    it('disabled user gets 403 even with valid JWT', async () => {
      jwt.verify.mockReturnValue({ sub: 'disabled-user', role: 'farmer' });
      prisma.user.findUnique.mockResolvedValue({ id: 'disabled-user', active: false, role: 'farmer' });

      const { req, res, next } = createMocks();
      authenticate(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(403);
      });
      expect(res.json).toHaveBeenCalledWith({ error: 'Account deactivated' });
      expect(next).not.toHaveBeenCalled();
    });

    it('deleted user gets 401', async () => {
      jwt.verify.mockReturnValue({ sub: 'deleted-user', role: 'super_admin' });
      prisma.user.findUnique.mockResolvedValue(null);

      const { req, res, next } = createMocks();
      authenticate(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(401);
      });
    });
  });

  describe('Field officer scope', () => {
    it('field_officer can access creator endpoints', async () => {
      await simulateAuth('field_officer', 'officer-1');

      const { req, res, next } = createMocks();
      authenticate(req, res, next);
      await vi.waitFor(() => { expect(next).toHaveBeenCalled(); });

      const creatorCheck = authorize('super_admin', 'institutional_admin', 'field_officer');
      const next2 = vi.fn();
      creatorCheck(req, { status: vi.fn().mockReturnThis(), json: vi.fn() }, next2);
      expect(next2).toHaveBeenCalled();
    });

    it('investor_viewer cannot access creator endpoints', async () => {
      await simulateAuth('investor_viewer', 'investor-1');

      const { req, res, next } = createMocks();
      authenticate(req, res, next);
      await vi.waitFor(() => { expect(next).toHaveBeenCalled(); });

      const creatorCheck = authorize('super_admin', 'institutional_admin', 'field_officer');
      const res2 = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      const next2 = vi.fn();
      creatorCheck(req, res2, next2);
      expect(res2.status).toHaveBeenCalledWith(403);
    });
  });

  describe('No token scenarios', () => {
    it('request without Authorization header gets 401', () => {
      const { req, res, next } = createMocks({ headers: {} });
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('request with malformed token gets 401', () => {
      jwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      const { req, res, next } = createMocks();
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
