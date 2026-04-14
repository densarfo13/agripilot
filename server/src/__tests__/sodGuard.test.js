/**
 * Tests for sodGuard middleware.
 *
 * sodGuard reads approvalRequestId from req.body, validates the ApprovalRequest
 * against the protected action's requestType and target resource, and either
 * returns an error response or calls next() with req.approvalRequest attached.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    approvalRequest: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
    officerValidation: { count: vi.fn().mockResolvedValue(0) },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { default: mockPrisma };
});

import prisma from '../config/database.js';
import { sodGuard } from '../middleware/sodGuard.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    body:   { approvalRequestId: 'ar-1', ...overrides.body },
    params: { id: 'target-1',            ...overrides.params },
    user:   { sub: 'user-requester',     ...overrides.user },
    ...overrides,
  };
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json:   vi.fn().mockReturnThis(),
  };
  return res;
}

function makeApprovalRequest(overrides = {}) {
  const futureExpiry = new Date(Date.now() + 4 * 3600000); // 4h from now
  return {
    id:              'ar-1',
    requestType:     'farmer_disable',
    status:          'approved',
    requestedById:   'user-requester',
    targetFarmerId:  'target-1',
    targetUserId:    null,
    targetSeasonId:  null,
    expiresAt:       futureExpiry,
    ...overrides,
  };
}

const GUARD = sodGuard({ requestType: 'farmer_disable', getTargetId: req => req.params.id });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sodGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.approvalRequest.findUnique.mockResolvedValue(makeApprovalRequest());
    prisma.approvalRequest.update.mockResolvedValue({});
  });

  // ── Happy path ──────────────────────────────────────────

  it('calls next() and attaches req.approvalRequest when all conditions pass', async () => {
    const req  = makeReq();
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.approvalRequest).toBeDefined();
    expect(req.approvalRequest.id).toBe('ar-1');
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── Missing approvalRequestId ───────────────────────────

  it('returns 400 with sodRequired flag when approvalRequestId is missing', async () => {
    const req  = makeReq({ body: {} }); // no approvalRequestId
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ sodRequired: true, requestType: 'farmer_disable' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── Request not found ───────────────────────────────────

  it('returns 404 when the ApprovalRequest does not exist', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(null);
    const req  = makeReq();
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  // ── DB failure ──────────────────────────────────────────

  it('returns 500 when the DB lookup throws', async () => {
    prisma.approvalRequest.findUnique.mockRejectedValue(new Error('connection lost'));
    const req  = makeReq();
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Type mismatch ───────────────────────────────────────

  it('returns 400 when the request type does not match the protected action', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeApprovalRequest({ requestType: 'season_reopen' }));
    const req  = makeReq();
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toMatch(/mismatch/i);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Already executed ────────────────────────────────────

  it('returns 409 when the request has already been executed', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeApprovalRequest({ status: 'executed' }));
    const req  = makeReq();
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('already been executed') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── Revoked / rejected ──────────────────────────────────

  it('returns 409 when the request was revoked', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeApprovalRequest({ status: 'revoked' }));
    const req  = makeReq();
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 409 when the request was rejected', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeApprovalRequest({ status: 'rejected' }));
    const req  = makeReq();
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Expired ─────────────────────────────────────────────

  it('returns 410 when an approved request has expired', async () => {
    const pastExpiry = new Date(Date.now() - 3600000); // 1h ago
    prisma.approvalRequest.findUnique.mockResolvedValue(makeApprovalRequest({ status: 'approved', expiresAt: pastExpiry }));
    const req  = makeReq();
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('expired'), hint: expect.any(String) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('marks the expired request in the DB non-blocking when returning 410', async () => {
    const pastExpiry = new Date(Date.now() - 1000);
    prisma.approvalRequest.findUnique.mockResolvedValue(makeApprovalRequest({ status: 'approved', expiresAt: pastExpiry }));
    const req  = makeReq();
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ar-1' }, data: { status: 'expired' } })
    );
  });

  // ── Not yet approved ────────────────────────────────────

  it('returns 400 when the request is still pending', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeApprovalRequest({ status: 'pending' }));
    const req  = makeReq();
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('pending') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when the request is expired (status field)', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeApprovalRequest({ status: 'expired', expiresAt: new Date(Date.now() + 999999) }));
    const req  = makeReq();
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Wrong actor ─────────────────────────────────────────

  it('returns 403 when a different user tries to execute an approval they did not request', async () => {
    // ApprovalRequest was made by 'user-requester', but actor is 'user-other'
    const req  = makeReq({ user: { sub: 'user-other' } });
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('original requester') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── Target resource mismatch ────────────────────────────

  it('returns 400 when the approved request is for a different target resource', async () => {
    // Request was approved for farmer 'target-1', but route param is 'target-DIFFERENT'
    const req  = makeReq({ params: { id: 'target-DIFFERENT' } });
    const res  = makeRes();
    const next = vi.fn();
    await GUARD(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        expected:           'target-DIFFERENT',
        requestApprovedFor: 'target-1',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── Request type variants ───────────────────────────────

  it('uses targetSeasonId for season_reopen', async () => {
    const guard = sodGuard({ requestType: 'season_reopen', getTargetId: req => req.params.id });
    prisma.approvalRequest.findUnique.mockResolvedValue({
      ...makeApprovalRequest({ requestType: 'season_reopen' }),
      targetFarmerId: null,
      targetSeasonId: 'season-1',
    });
    const req  = makeReq({ params: { id: 'season-1' } });
    const res  = makeRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('uses targetUserId for role_escalation', async () => {
    const guard = sodGuard({ requestType: 'role_escalation', getTargetId: req => req.params.id });
    prisma.approvalRequest.findUnique.mockResolvedValue({
      ...makeApprovalRequest({ requestType: 'role_escalation' }),
      targetFarmerId: null,
      targetUserId:   'user-42',
    });
    const req  = makeReq({ params: { id: 'user-42' } });
    const res  = makeRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('uses targetUserId for user_org_transfer', async () => {
    const guard = sodGuard({ requestType: 'user_org_transfer', getTargetId: req => req.params.id });
    prisma.approvalRequest.findUnique.mockResolvedValue({
      ...makeApprovalRequest({ requestType: 'user_org_transfer' }),
      targetFarmerId: null,
      targetUserId:   'user-77',
    });
    const req  = makeReq({ params: { id: 'user-77' } });
    const res  = makeRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('uses targetUserId for privileged_reset', async () => {
    const guard = sodGuard({ requestType: 'privileged_reset', getTargetId: req => req.params.id });
    prisma.approvalRequest.findUnique.mockResolvedValue({
      ...makeApprovalRequest({ requestType: 'privileged_reset' }),
      targetFarmerId: null,
      targetUserId:   'privileged-user',
    });
    const req  = makeReq({ params: { id: 'privileged-user' } });
    const res  = makeRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
