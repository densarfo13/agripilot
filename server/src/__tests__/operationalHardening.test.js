import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Idempotency Middleware Tests ────────────────────────

describe('Idempotency Middleware', () => {
  let idempotencyCheck, clearIdempotencyCache;

  beforeEach(async () => {
    const mod = await import('../middleware/idempotency.js');
    idempotencyCheck = mod.idempotencyCheck;
    clearIdempotencyCache = mod.clearIdempotencyCache;
    clearIdempotencyCache();
  });

  function mockReq(method = 'POST', key = null, userId = 'user-1') {
    return {
      method,
      headers: key ? { 'x-idempotency-key': key } : {},
      user: { sub: userId },
    };
  }

  function mockRes() {
    const res = {
      statusCode: 200,
      _headers: {},
      _jsonCalled: false,
      _jsonBody: null,
      _statusSet: null,
      _finishCallbacks: [],
      set(key, value) { res._headers[key] = value; return res; },
      status(code) { res._statusSet = code; res.statusCode = code; return res; },
      json(body) { res._jsonCalled = true; res._jsonBody = body; return res; },
      on(event, cb) { if (event === 'close') res._finishCallbacks.push(cb); },
    };
    return res;
  }

  it('passes through when no idempotency key is present', () => {
    const req = mockReq('POST', null);
    const res = mockRes();
    let nextCalled = false;
    idempotencyCheck(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res._jsonCalled).toBe(false);
  });

  it('passes through for GET requests even with key', () => {
    const req = mockReq('GET', 'key-1');
    const res = mockRes();
    let nextCalled = false;
    idempotencyCheck(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('allows first request with new key', () => {
    const req = mockReq('POST', 'key-1');
    const res = mockRes();
    let nextCalled = false;
    idempotencyCheck(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('caches successful response and replays it', () => {
    // First request
    const req1 = mockReq('POST', 'key-2');
    const res1 = mockRes();
    let nextCalled = false;
    idempotencyCheck(req1, res1, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);

    // Simulate successful response
    res1.statusCode = 201;
    res1.json({ id: 'created-123' });

    // Retry with same key
    const req2 = mockReq('POST', 'key-2');
    const res2 = mockRes();
    let nextCalled2 = false;
    idempotencyCheck(req2, res2, () => { nextCalled2 = true; });

    // Should NOT call next — should return cached response
    expect(nextCalled2).toBe(false);
    expect(res2._jsonBody).toEqual({ id: 'created-123' });
    expect(res2._statusSet).toBe(201);
    expect(res2._headers['X-Idempotency-Replayed']).toBe('true');
  });

  it('does not cache error responses', () => {
    // First request — will produce an error
    const req1 = mockReq('POST', 'key-err');
    const res1 = mockRes();
    idempotencyCheck(req1, res1, () => {});

    // Simulate error response
    res1.statusCode = 400;
    res1.json({ error: 'bad request' });

    // Retry — should go through again (not cached)
    const req2 = mockReq('POST', 'key-err');
    const res2 = mockRes();
    let nextCalled = false;
    idempotencyCheck(req2, res2, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('scopes keys per user', () => {
    // User A
    const reqA = mockReq('POST', 'shared-key', 'user-a');
    const resA = mockRes();
    idempotencyCheck(reqA, resA, () => {});
    resA.statusCode = 200;
    resA.json({ result: 'A' });

    // User B with same key — should not get A's result
    const reqB = mockReq('POST', 'shared-key', 'user-b');
    const resB = mockRes();
    let nextCalled = false;
    idempotencyCheck(reqB, resB, () => { nextCalled = true; });
    expect(nextCalled).toBe(true); // New request, not cached for this user
  });

  it('rejects concurrent in-flight request with same key', () => {
    // First request — in flight (no json response yet)
    const req1 = mockReq('POST', 'key-inflight');
    const res1 = mockRes();
    idempotencyCheck(req1, res1, () => {});

    // Second request with same key while first is still in flight
    const req2 = mockReq('POST', 'key-inflight');
    const res2 = mockRes();
    let nextCalled = false;
    idempotencyCheck(req2, res2, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res2._statusSet).toBe(409);
  });
});

// ─── Dedup Guard Tests ───────────────────────────────────

describe('Dedup Guard', () => {
  let dedupGuard, clearDedupCache;

  beforeEach(async () => {
    const mod = await import('../middleware/dedup.js');
    dedupGuard = mod.dedupGuard;
    clearDedupCache = mod.clearDedupCache;
    clearDedupCache();
  });

  it('allows first request', () => {
    const guard = dedupGuard('test-action');
    const req = { user: { sub: 'u1' }, params: { id: 'r1' } };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json() {},
      on() {},
    };
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('blocks duplicate rapid request', () => {
    const guard = dedupGuard('test-action');
    const req = { user: { sub: 'u1' }, params: { id: 'r1' } };
    const res1 = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json() {},
      on() {},
    };

    // First request
    guard(req, res1, () => {});

    // Immediate duplicate
    let blocked = false;
    const res2 = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json() { blocked = true; },
      on() {},
    };
    guard(req, res2, () => {});
    expect(blocked).toBe(true);
    expect(res2.statusCode).toBe(409);
  });
});

// ─── Transaction Integrity Tests ─────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    farmer: { findUnique: vi.fn() },
    farmSeason: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    seasonProgressEntry: { findMany: vi.fn(), create: vi.fn() },
    stageConfirmation: { findMany: vi.fn() },
    officerValidation: { findMany: vi.fn() },
    credibilityAssessment: { findUnique: vi.fn(), upsert: vi.fn() },
    progressScore: { findUnique: vi.fn() },
    harvestReport: { findUnique: vi.fn(), create: vi.fn() },
    application: { findUnique: vi.fn(), updateMany: vi.fn() },
    reviewAssignment: { create: vi.fn() },
    reviewNote: { create: vi.fn() },
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

import prisma from '../config/database.js';

describe('Transaction Integrity — Progress Entry', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates entry and updates lastActivityDate in a transaction', async () => {
    const { createProgressEntry } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', farmerId: 'f-1', cropType: 'maize', status: 'active',
      plantingDate: new Date(Date.now() - 30 * 86400000),
      farmer: { countryCode: 'KE' },
    });

    const mockEntry = { id: 'e-1', seasonId: 's-1', entryType: 'activity' };
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        seasonProgressEntry: { create: vi.fn().mockResolvedValue(mockEntry) },
        farmSeason: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const result = await createProgressEntry('s-1', { entryType: 'activity', activityType: 'weeding' });
    expect(result.id).toBe('e-1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('Transaction Integrity — Image Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates image entry and updates lastActivityDate in a transaction', async () => {
    const { addProgressImage } = await import('../modules/seasons/imageValidation.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', farmerId: 'f-1', cropType: 'maize', status: 'active',
      plantingDate: new Date(Date.now() - 30 * 86400000),
      farmer: { countryCode: 'KE' },
    });

    const mockEntry = { id: 'e-img', seasonId: 's-1', imageUrl: 'http://img.test/1.jpg' };
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        seasonProgressEntry: { create: vi.fn().mockResolvedValue(mockEntry) },
        farmSeason: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const { entry } = await addProgressImage('s-1', { imageUrl: 'http://img.test/1.jpg', imageStage: 'early_growth' });
    expect(entry.id).toBe('e-img');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('Transaction Integrity — Application Workflow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('approve wraps status change + review note in transaction', async () => {
    const { approveApplication } = await import('../modules/applications/service.js');

    // getApplicationStatus
    prisma.application.findUnique.mockResolvedValueOnce({ id: 'a-1', status: 'under_review' });

    const mockUpdated = { id: 'a-1', status: 'approved' };
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        application: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue(mockUpdated),
        },
        reviewNote: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const { application, previousStatus } = await approveApplication('a-1', 'u-1', { reason: 'Looks good' });
    expect(application.status).toBe('approved');
    expect(previousStatus).toBe('under_review');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('reject wraps status change + review note in transaction', async () => {
    const { rejectApplication } = await import('../modules/applications/service.js');

    prisma.application.findUnique.mockResolvedValueOnce({ id: 'a-1', status: 'under_review' });

    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        application: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({ id: 'a-1', status: 'rejected' }),
        },
        reviewNote: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const { application } = await rejectApplication('a-1', 'u-1', 'Incomplete');
    expect(application.status).toBe('rejected');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('assignReviewer wraps assignment + status update in transaction', async () => {
    const { assignReviewer } = await import('../modules/applications/service.js');

    prisma.user.findUnique.mockResolvedValue({ id: 'r-1', role: 'reviewer' });
    // getApplicationById — needs full include
    prisma.application.findUnique.mockResolvedValueOnce({
      id: 'a-1', status: 'submitted',
      farmer: {}, createdBy: {}, reviewAssignments: [], reviewNotes: [],
      evidenceFiles: [], fieldVisits: [],
    });

    const mockResult = { id: 'a-1', status: 'under_review', assignedReviewerId: 'r-1' };
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        reviewAssignment: { create: vi.fn().mockResolvedValue({}) },
        application: { update: vi.fn().mockResolvedValue(mockResult) },
      };
      return fn(tx);
    });

    const result = await assignReviewer('a-1', 'r-1');
    expect(result.assignedReviewerId).toBe('r-1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ─── Rate Limiter Configuration Tests ────────────────────

describe('Rate Limiter Configuration', () => {
  it('exports all expected limiters', async () => {
    const mod = await import('../middleware/rateLimiters.js');
    expect(mod.workflowLimiter).toBeDefined();
    expect(mod.registrationLimiter).toBeDefined();
    expect(mod.uploadLimiter).toBeDefined();
    expect(mod.submissionLimiter).toBeDefined();
  });
});
