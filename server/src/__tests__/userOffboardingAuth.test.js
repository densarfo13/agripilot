import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    user: { findUnique: vi.fn() },
    officerValidation: { count: vi.fn().mockResolvedValue(0) },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { default: mockPrisma };
});

vi.mock('../config/index.js', () => ({
  config: { jwt: { secret: 'test-secret', expiresIn: '1h' } },
}));

vi.mock('../utils/opsLogger.js', () => ({
  logAuthEvent: vi.fn(),
  logPermissionEvent: vi.fn(),
}));

import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { authenticate, authorize, clearAuthCache, invalidateAuthCache } from '../middleware/auth.js';

// ─── Helpers ──────────────────────────────────────────────

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'user-1', email: 'user@example.com', role: 'field_officer', ...payload },
    'test-secret',
    { expiresIn: '1h' },
  );
}

function makeReq(token, extra = {}) {
  return {
    headers: { authorization: `Bearer ${token}` },
    ip: '127.0.0.1',
    originalUrl: '/api/test',
    ...extra,
  };
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAuthCache();
});

// ═══════════════════════════════════════════════════════════
// authenticate — disabled user blocked
// ═══════════════════════════════════════════════════════════

describe('authenticate — disabled user (active: false)', () => {
  it('returns 403 Account deactivated when DB user has active: false (cache miss)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1', active: false, role: 'field_officer', organizationId: null,
    });

    const token = makeToken({ sub: 'user-1' });
    const req = makeReq(token);
    const res = makeRes();
    const next = vi.fn();

    // Flush the internal .then() chain by awaiting a tick after authenticate starts
    authenticate(req, res, next);
    await Promise.resolve(); // let the DB promise queue flush
    await Promise.resolve(); // second tick for .then() resolution

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account deactivated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when cached user has active: false (cache hit)', async () => {
    // Prime the cache with an active user first, then simulate the cache holding active:false
    // We do this by calling authenticate once so the user is cached active:false
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2', active: false, role: 'reviewer', organizationId: null,
    });

    const token = makeToken({ sub: 'user-2', role: 'reviewer' });
    const req = makeReq(token);
    const res = makeRes();
    const next = vi.fn();

    // First call — populates cache with active: false
    await new Promise((resolve) => {
      const r = makeRes();
      r.json = vi.fn(() => resolve());
      authenticate(makeReq(token), r, resolve);
    });

    // Second call — should hit cache, still 403
    const res2 = makeRes();
    const next2 = vi.fn();
    authenticate(makeReq(token), res2, next2);

    expect(res2.status).toHaveBeenCalledWith(403);
    expect(res2.json).toHaveBeenCalledWith({ error: 'Account deactivated' });
    expect(next2).not.toHaveBeenCalled();
    // DB should only be called once (cache hit on second call)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('re-enabled user (active: true after invalidation) is allowed through', async () => {
    const userId = 'user-3';
    const token = makeToken({ sub: userId });

    // Step 1: user is disabled — DB returns active: false
    prisma.user.findUnique.mockResolvedValueOnce({
      id: userId, active: false, role: 'field_officer', organizationId: null,
    });

    await new Promise((resolve) => {
      const r = makeRes();
      r.json = vi.fn(() => resolve());
      authenticate(makeReq(token), r, resolve);
    });

    // Step 2: admin re-enables — invalidate cache
    invalidateAuthCache(userId);

    // Step 3: DB now returns active: true
    prisma.user.findUnique.mockResolvedValueOnce({
      id: userId, active: true, role: 'field_officer', organizationId: null,
    });

    const req = makeReq(token);
    const res = makeRes();
    const next = vi.fn();

    await new Promise((resolve) => {
      authenticate(req, res, () => { next(); resolve(); });
    });

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════
// authenticate — active user passes through
// ═══════════════════════════════════════════════════════════

describe('authenticate — active user', () => {
  it('calls next() and sets req.user for active user (cache miss)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-4', active: true, role: 'reviewer', organizationId: 'org-x',
    });

    const token = makeToken({ sub: 'user-4', role: 'reviewer' });
    const req = makeReq(token);
    const res = makeRes();
    const next = vi.fn();

    await new Promise((resolve) => {
      authenticate(req, res, () => { next(); resolve(); });
    });

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.sub).toBe('user-4');
    expect(req.user.role).toBe('reviewer');
    expect(req.user.organizationId).toBe('org-x');
  });

  it('calls next() for active cached user without hitting DB again', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-5', active: true, role: 'field_officer', organizationId: null,
    });

    const token = makeToken({ sub: 'user-5' });

    // First call — populates cache
    await new Promise((resolve) => {
      authenticate(makeReq(token), makeRes(), resolve);
    });

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

    // Second call — should use cache
    const req2 = makeReq(token);
    const next2 = vi.fn();
    authenticate(req2, makeRes(), next2);

    expect(next2).toHaveBeenCalled();
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1); // no additional DB call
  });

  it('uses DB role (not JWT role) in case role was changed', async () => {
    // JWT was issued with old role, DB has new role
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-6', active: true, role: 'reviewer', organizationId: null,
    });

    const token = makeToken({ sub: 'user-6', role: 'field_officer' }); // old role in token
    const req = makeReq(token);

    await new Promise((resolve) => {
      authenticate(req, makeRes(), resolve);
    });

    expect(req.user.role).toBe('reviewer'); // DB role wins
  });
});

// ═══════════════════════════════════════════════════════════
// authenticate — missing / invalid token
// ═══════════════════════════════════════════════════════════

describe('authenticate — token errors', () => {
  it('returns 401 if no Authorization header', () => {
    const req = { headers: {}, ip: '127.0.0.1', originalUrl: '/' };
    const res = makeRes();
    authenticate(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('returns 401 for invalid/tampered token', () => {
    const req = makeReq('bad.token.here');
    const res = makeRes();
    authenticate(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  it('returns 401 if user no longer exists in DB', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const token = makeToken({ sub: 'deleted-user' });
    const req = makeReq(token);
    const res = makeRes();

    await new Promise((resolve) => {
      res.json = vi.fn(() => resolve());
      authenticate(req, res, resolve);
    });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'User account no longer exists' });
  });
});

// ═══════════════════════════════════════════════════════════
// authorize — role-based gate
// ═══════════════════════════════════════════════════════════

describe('authorize — role gate', () => {
  function reqWithRole(role) {
    return { user: { sub: 'u', role, organizationId: null }, ip: '127.0.0.1', originalUrl: '/' };
  }

  it('allows super_admin through super_admin+institutional_admin gate', () => {
    const next = vi.fn();
    authorize('super_admin', 'institutional_admin')(reqWithRole('super_admin'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('allows institutional_admin through super_admin+institutional_admin gate', () => {
    const next = vi.fn();
    authorize('super_admin', 'institutional_admin')(reqWithRole('institutional_admin'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks field_officer from disable/enable route (super_admin+institutional_admin gate)', () => {
    const res = makeRes();
    authorize('super_admin', 'institutional_admin')(reqWithRole('field_officer'), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
  });

  it('blocks reviewer from disable/enable route', () => {
    const res = makeRes();
    authorize('super_admin', 'institutional_admin')(reqWithRole('reviewer'), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('blocks farmer from disable/enable route', () => {
    const res = makeRes();
    authorize('super_admin', 'institutional_admin')(reqWithRole('farmer'), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('blocks investor_viewer from disable/enable route', () => {
    const res = makeRes();
    authorize('super_admin', 'institutional_admin')(reqWithRole('investor_viewer'), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('blocks field_officer from archive route (super_admin only)', () => {
    const res = makeRes();
    authorize('super_admin')(reqWithRole('field_officer'), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('blocks institutional_admin from archive route (super_admin only)', () => {
    const res = makeRes();
    authorize('super_admin')(reqWithRole('institutional_admin'), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows super_admin through super_admin-only archive gate', () => {
    const next = vi.fn();
    authorize('super_admin')(reqWithRole('super_admin'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 if req.user is not set', () => {
    const res = makeRes();
    authorize('super_admin')({ ip: '127.0.0.1', originalUrl: '/' }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('no-arg authorize() allows any authenticated user through', () => {
    const next = vi.fn();
    authorize()(reqWithRole('farmer'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════
// invalidateAuthCache — cache eviction semantics
// ═══════════════════════════════════════════════════════════

describe('invalidateAuthCache', () => {
  it('forces DB lookup on next authenticate call after invalidation', async () => {
    const userId = 'user-cache-test';
    const token = makeToken({ sub: userId });

    // Populate cache
    prisma.user.findUnique.mockResolvedValue({
      id: userId, active: true, role: 'field_officer', organizationId: null,
    });

    await new Promise((resolve) => {
      authenticate(makeReq(token), makeRes(), resolve);
    });

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

    // Invalidate
    invalidateAuthCache(userId);

    // Next call must hit DB again
    prisma.user.findUnique.mockResolvedValue({
      id: userId, active: true, role: 'field_officer', organizationId: null,
    });

    await new Promise((resolve) => {
      authenticate(makeReq(token), makeRes(), resolve);
    });

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it('no-op when userId is null or undefined', () => {
    expect(() => invalidateAuthCache(null)).not.toThrow();
    expect(() => invalidateAuthCache(undefined)).not.toThrow();
  });

  it('clearAuthCache removes all entries', async () => {
    // Populate two users into cache
    for (const id of ['ca-1', 'ca-2']) {
      prisma.user.findUnique.mockResolvedValue({
        id, active: true, role: 'field_officer', organizationId: null,
      });
      await new Promise((resolve) => {
        authenticate(makeReq(makeToken({ sub: id })), makeRes(), resolve);
      });
    }

    clearAuthCache();

    // Both should trigger DB calls now
    let dbCalls = 0;
    for (const id of ['ca-1', 'ca-2']) {
      prisma.user.findUnique.mockResolvedValue({
        id, active: true, role: 'field_officer', organizationId: null,
      });
      await new Promise((resolve) => {
        authenticate(makeReq(makeToken({ sub: id })), makeRes(), resolve);
      });
      dbCalls++;
    }

    expect(dbCalls).toBe(2);
  });
});
