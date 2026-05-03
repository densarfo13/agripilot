import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * requireOwnership middleware tests.
 * Merged-blocker spec §1: every sensitive query must include a
 * DB-level ownership constraint, and miss-or-not-owned must
 * return 404 (never 403, which leaks existence).
 */

// Use vi.hoisted so the mock-factory (which is hoisted) can
// reference these shared mocks. Otherwise a TDZ ReferenceError
// fires because vi.mock runs before the const declarations.
const { findFirstMock, findUniqueMock } = vi.hoisted(() => ({
  findFirstMock:  vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  default: {
    farmProfile:       { findFirst: findFirstMock, findUnique: findUniqueMock },
    scanTrainingEvent: { findFirst: findFirstMock, findUnique: findUniqueMock },
    farmTask:          { findFirst: findFirstMock, findUnique: findUniqueMock },
    buyerInquiry:      { findFirst: findFirstMock, findUnique: findUniqueMock },
  },
}));

vi.mock('../utils/opsLogger.js', () => ({
  opsEvent: vi.fn(),
  logAuthEvent: vi.fn(),
  logPermissionEvent: vi.fn(),
}));

import { requireOwnership, RESOURCE_REGISTRY } from '../middleware/requireOwnership.js';
import { logPermissionEvent } from '../utils/opsLogger.js';

function makeReqRes({ params = {}, user = null } = {}) {
  const req = {
    params,
    user,
    originalUrl: '/api/test',
    path: '/api/test',
    ip: '127.0.0.1',
  };
  let statusCode = 200;
  const json = vi.fn();
  const status = vi.fn((c) => { statusCode = c; return res; });
  const next = vi.fn();
  const res = { status, json, get statusCode() { return statusCode; } };
  return { req, res, next, json, status };
}

beforeEach(() => {
  findFirstMock.mockReset();
  findUniqueMock.mockReset();
  vi.mocked(logPermissionEvent).mockClear();
});

describe('requireOwnership — boot-time validation', () => {
  it('throws on unknown resource type', () => {
    expect(() => requireOwnership('frobnicate')).toThrow(/unknown resource type/);
  });

  it('exports a registry covering the spec resources', () => {
    expect(RESOURCE_REGISTRY.farm).toBeDefined();
    expect(RESOURCE_REGISTRY.garden).toBeDefined();
    expect(RESOURCE_REGISTRY.scan).toBeDefined();
    expect(RESOURCE_REGISTRY.task).toBeDefined();
    expect(RESOURCE_REGISTRY.buyerInquiry).toBeDefined();
  });
});

describe('requireOwnership — auth gate', () => {
  it('returns 401 when req.user is missing', async () => {
    const mw = requireOwnership('farm');
    const { req, res, next, status, json } = makeReqRes({ params: { farmId: 'f1' } });
    await mw(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Not authorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user has no id/sub', async () => {
    const mw = requireOwnership('farm');
    const { req, res, next, status } = makeReqRes({
      params: { farmId: 'f1' },
      user:   { role: 'farmer' },
    });
    await mw(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('skips the check when the route has no id param (list endpoints)', async () => {
    const mw = requireOwnership('farm');
    const { req, res, next } = makeReqRes({
      params: {},
      user:   { id: 'u1', role: 'farmer' },
    });
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(findFirstMock).not.toHaveBeenCalled();
  });
});

describe('requireOwnership — DB-constrained ownership pattern', () => {
  it('issues findFirst with both id AND ownership constraint in where', async () => {
    findFirstMock.mockResolvedValue({ id: 'f1', userId: 'u1', name: 'Farm A' });
    const mw = requireOwnership('farm');
    const { req, res, next } = makeReqRes({
      params: { farmId: 'f1' },
      user:   { id: 'u1', role: 'farmer' },
    });
    await mw(req, res, next);
    // The `farm` resource uses an OR-shaped where so both the
    // direct-userId column and the legacy farmer.userId nested
    // path both grant access. Either shape is sufficient.
    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 'f1',
        OR: [
          { userId: 'u1' },
          { farmer: { is: { userId: 'u1' } } },
        ],
      },
    });
    expect(next).toHaveBeenCalled();
    expect(req.ownedResource).toEqual({ id: 'f1', userId: 'u1', name: 'Farm A' });
  });

  it('returns 404 (never 403) when row not owned', async () => {
    findFirstMock.mockResolvedValue(null);
    const mw = requireOwnership('farm');
    const { req, res, next, status, json } = makeReqRes({
      params: { farmId: 'f-other' },
      user:   { id: 'u1', role: 'farmer' },
    });
    await mw(req, res, next);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: 'Not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('logs a denial via opsLogger on miss', async () => {
    findFirstMock.mockResolvedValue(null);
    const mw = requireOwnership('scan');
    const { req, res, next } = makeReqRes({
      params: { scanId: 's-other' },
      user:   { id: 'u1', role: 'farmer' },
    });
    await mw(req, res, next);
    expect(logPermissionEvent).toHaveBeenCalledWith(
      'ownership_denied',
      expect.objectContaining({
        userId:       'u1',
        role:         'farmer',
        resourceType: 'scan',
        resourceId:   's-other',
      }),
    );
  });

  it('passes through when the owner matches', async () => {
    findFirstMock.mockResolvedValue({ id: 's1', userId: 'u1' });
    const mw = requireOwnership('scan');
    const { req, res, next } = makeReqRes({
      params: { scanId: 's1' },
      user:   { id: 'u1', role: 'farmer' },
    });
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('reads userId from req.user.sub when req.user.id is absent', async () => {
    findFirstMock.mockResolvedValue({ id: 't1', userId: 'u-sub' });
    const mw = requireOwnership('task');
    const { req, res, next } = makeReqRes({
      params: { taskId: 't1' },
      user:   { sub: 'u-sub', role: 'farmer' },
    });
    await mw(req, res, next);
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: 't1', userId: 'u-sub' },
    });
    expect(next).toHaveBeenCalled();
  });
});

describe('requireOwnership — admin bypass', () => {
  it('platform_admin bypasses ownership but the row is fetched', async () => {
    findUniqueMock.mockResolvedValue({ id: 'f1', userId: 'someone-else' });
    const mw = requireOwnership('farm');
    const { req, res, next } = makeReqRes({
      params: { farmId: 'f1' },
      user:   { id: 'admin-1', role: 'platform_admin' },
    });
    await mw(req, res, next);
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'f1' } });
    expect(next).toHaveBeenCalled();
  });

  it('super_admin admin-bypass is logged for audit visibility', async () => {
    findUniqueMock.mockResolvedValue({ id: 'f1', userId: 'someone-else' });
    const mw = requireOwnership('farm');
    const { req, res, next } = makeReqRes({
      params: { farmId: 'f1' },
      user:   { id: 'admin-1', role: 'super_admin' },
    });
    await mw(req, res, next);
    expect(logPermissionEvent).toHaveBeenCalledWith(
      'ownership_admin_bypass',
      expect.objectContaining({
        userId: 'admin-1',
        role:   'super_admin',
        resourceType: 'farm',
        resourceId:   'f1',
      }),
    );
  });

  it('admin bypass returns 404 when the row genuinely does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);
    const mw = requireOwnership('farm');
    const { req, res, next, status } = makeReqRes({
      params: { farmId: 'gone' },
      user:   { id: 'admin-1', role: 'platform_admin' },
    });
    await mw(req, res, next);
    expect(status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('opts.allowAdmin=false disables the bypass', async () => {
    findFirstMock.mockResolvedValue(null);
    const mw = requireOwnership('farm', { allowAdmin: false });
    const { req, res, next, status } = makeReqRes({
      params: { farmId: 'f1' },
      user:   { id: 'admin-1', role: 'platform_admin' },
    });
    await mw(req, res, next);
    // With admin bypass off, an admin missing the ownership
    // gets the same 404 a regular non-owner would.
    expect(status).toHaveBeenCalledWith(404);
    expect(findFirstMock).toHaveBeenCalled();
  });
});

describe('requireOwnership — error path', () => {
  it('passes Prisma errors to next() (so errorHandler can scrub them)', async () => {
    const err = new Error('boom');
    findFirstMock.mockRejectedValue(err);
    const mw = requireOwnership('farm');
    const { req, res, next } = makeReqRes({
      params: { farmId: 'f1' },
      user:   { id: 'u1', role: 'farmer' },
    });
    await mw(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
