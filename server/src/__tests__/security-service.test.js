/**
 * Tests for the SoD/JIT security service.
 * Covers the full ApprovalRequest lifecycle:
 *   create → approve/reject → execute → [expire | revoke]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    approvalRequest: {
      findFirst:   vi.fn(),
      findUnique:  vi.fn(),
      findMany:    vi.fn(),
      create:      vi.fn(),
      update:      vi.fn(),
      updateMany:  vi.fn(),
      count:       vi.fn(),
    },
  };
  return { default: mockPrisma };
});

vi.mock('../modules/audit/service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import prisma from '../config/database.js';
import { writeAuditLog } from '../modules/audit/service.js';
import {
  createApprovalRequest,
  approveRequest,
  rejectRequest,
  revokeRequest,
  markExecuted,
  listRequests,
  getRequest,
  getMyActiveGrants,
} from '../modules/security/service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(overrides = {}) {
  return {
    id:             'req-1',
    requestType:    'farmer_disable',
    status:         'pending',
    requestedById:  'user-requester',
    approvedById:   null,
    organizationId: 'org-1',
    targetFarmerId: 'farmer-1',
    targetUserId:   null,
    targetSeasonId: null,
    reason:         'Test reason for disabling',
    rejectionReason: null,
    expiresAt:      null,
    createdAt:      new Date(),
    requestedBy:    { id: 'user-requester', fullName: 'Alice', email: 'alice@test.com', role: 'institutional_admin' },
    ...overrides,
  };
}

function hoursAgo(h) {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d;
}

function hoursFromNow(h) {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d;
}

// ─── createApprovalRequest ────────────────────────────────────────────────────

describe('createApprovalRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.approvalRequest.findFirst.mockResolvedValue(null); // no duplicate
    prisma.approvalRequest.create.mockResolvedValue(makeRequest({ status: 'pending' }));
  });

  it('creates a request with valid inputs', async () => {
    const result = await createApprovalRequest({
      requestType:    'farmer_disable',
      requestedById:  'user-1',
      organizationId: 'org-1',
      targetFarmerId: 'farmer-1',
      reason:         'Suspected fraud activity',
    });
    expect(prisma.approvalRequest.create).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ requestType: 'farmer_disable' });
  });

  it('writes an audit log on creation', async () => {
    await createApprovalRequest({
      requestType:    'farmer_disable',
      requestedById:  'user-1',
      organizationId: 'org-1',
      targetFarmerId: 'farmer-1',
      reason:         'Suspected fraud activity',
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approval_requested' })
    );
  });

  it('throws 400 if reason is empty', async () => {
    await expect(
      createApprovalRequest({ requestType: 'farmer_disable', requestedById: 'u1', reason: '' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 if reason is fewer than 5 characters', async () => {
    await expect(
      createApprovalRequest({ requestType: 'farmer_disable', requestedById: 'u1', reason: 'ab' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 for an invalid requestType', async () => {
    await expect(
      createApprovalRequest({ requestType: 'delete_everything', requestedById: 'u1', reason: 'Valid reason here' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts all 5 valid request types', async () => {
    const types = ['season_reopen', 'farmer_disable', 'role_escalation', 'user_org_transfer', 'privileged_reset'];
    for (const requestType of types) {
      prisma.approvalRequest.findFirst.mockResolvedValue(null);
      prisma.approvalRequest.create.mockResolvedValue(makeRequest({ requestType }));
      await expect(
        createApprovalRequest({ requestType, requestedById: 'u1', reason: 'A valid reason' })
      ).resolves.toBeDefined();
    }
  });

  it('throws 409 if a duplicate pending request exists for same user+type+target', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(makeRequest()); // existing found
    await expect(
      createApprovalRequest({
        requestType:    'farmer_disable',
        requestedById:  'user-1',
        targetFarmerId: 'farmer-1',
        reason:         'Duplicate attempt',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.approvalRequest.create).not.toHaveBeenCalled();
  });

  it('trims the reason before saving', async () => {
    await createApprovalRequest({
      requestType:    'farmer_disable',
      requestedById:  'u1',
      targetFarmerId: 'f1',
      reason:         '   Padded reason here   ',
    });
    expect(prisma.approvalRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reason: 'Padded reason here' }) })
    );
  });
});

// ─── approveRequest ───────────────────────────────────────────────────────────

describe('approveRequest', () => {
  const pendingRequest = makeRequest({ status: 'pending' });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.approvalRequest.findUnique.mockResolvedValue(pendingRequest);
    prisma.approvalRequest.update.mockResolvedValue({ ...pendingRequest, status: 'approved', expiresAt: hoursFromNow(24) });
  });

  it('approves a pending request and sets status to approved', async () => {
    const result = await approveRequest({
      requestId:    'req-1',
      approverId:   'user-approver',
      approverRole: 'super_admin',
      approverOrgId: 'org-1',
    });
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'approved', approvedById: 'user-approver' }),
      })
    );
    expect(result.status).toBe('approved');
  });

  it('sets expiresAt based on requestType (farmer_disable = 24h)', async () => {
    await approveRequest({ requestId: 'req-1', approverId: 'user-approver', approverRole: 'super_admin', approverOrgId: 'org-1' });
    const { data } = prisma.approvalRequest.update.mock.calls[0][0];
    const diffHours = (data.expiresAt - Date.now()) / 3600000;
    expect(diffHours).toBeGreaterThan(23);
    expect(diffHours).toBeLessThan(25);
  });

  it('sets expiresAt to ~1 hour for privileged_reset', async () => {
    const privilegedReq = makeRequest({ requestType: 'privileged_reset' });
    prisma.approvalRequest.findUnique.mockResolvedValue(privilegedReq);
    prisma.approvalRequest.update.mockResolvedValue({ ...privilegedReq, status: 'approved' });
    await approveRequest({ requestId: 'req-1', approverId: 'approver', approverRole: 'super_admin', approverOrgId: 'org-1' });
    const { data } = prisma.approvalRequest.update.mock.calls[0][0];
    const diffHours = (data.expiresAt - Date.now()) / 3600000;
    expect(diffHours).toBeGreaterThan(0.9);
    expect(diffHours).toBeLessThan(1.1);
  });

  it('sets expiresAt to ~4 hours for season_reopen', async () => {
    const reopenReq = makeRequest({ requestType: 'season_reopen', targetSeasonId: 's-1', targetFarmerId: null });
    prisma.approvalRequest.findUnique.mockResolvedValue(reopenReq);
    prisma.approvalRequest.update.mockResolvedValue({ ...reopenReq, status: 'approved' });
    await approveRequest({ requestId: 'req-1', approverId: 'approver', approverRole: 'super_admin', approverOrgId: 'org-1' });
    const { data } = prisma.approvalRequest.update.mock.calls[0][0];
    const diffHours = (data.expiresAt - Date.now()) / 3600000;
    expect(diffHours).toBeGreaterThan(3.9);
    expect(diffHours).toBeLessThan(4.1);
  });

  it('writes an audit log on approval', async () => {
    await approveRequest({ requestId: 'req-1', approverId: 'approver', approverRole: 'super_admin', approverOrgId: 'org-1' });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approval_granted' })
    );
  });

  it('throws 404 if request does not exist', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(null);
    await expect(
      approveRequest({ requestId: 'no-such', approverId: 'a', approverRole: 'super_admin', approverOrgId: 'org-1' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 409 if request is not pending', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ status: 'approved' }));
    await expect(
      approveRequest({ requestId: 'req-1', approverId: 'a', approverRole: 'super_admin', approverOrgId: 'org-1' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 403 when approver === requester (self-approval block)', async () => {
    await expect(
      approveRequest({
        requestId:    'req-1',
        approverId:   'user-requester', // same as requestedById in makeRequest()
        approverRole: 'super_admin',
        approverOrgId: 'org-1',
      })
    ).rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('Separation of duties') });
  });

  it('throws 403 when institutional_admin tries to approve role_escalation (requires super_admin)', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ requestType: 'role_escalation', requestedById: 'other-user' }));
    await expect(
      approveRequest({
        requestId:    'req-1',
        approverId:   'inst-admin',
        approverRole: 'institutional_admin',
        approverOrgId: 'org-1',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when institutional_admin tries to approve user_org_transfer', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ requestType: 'user_org_transfer', requestedById: 'other-user' }));
    await expect(
      approveRequest({ requestId: 'req-1', approverId: 'inst-admin', approverRole: 'institutional_admin', approverOrgId: 'org-1' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when institutional_admin tries to approve privileged_reset', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ requestType: 'privileged_reset', requestedById: 'other-user' }));
    await expect(
      approveRequest({ requestId: 'req-1', approverId: 'inst-admin', approverRole: 'institutional_admin', approverOrgId: 'org-1' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when institutional_admin tries to approve request from a different org', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ requestType: 'farmer_disable', organizationId: 'org-OTHER', requestedById: 'other-user' }));
    await expect(
      approveRequest({ requestId: 'req-1', approverId: 'inst-admin', approverRole: 'institutional_admin', approverOrgId: 'org-1' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows institutional_admin to approve farmer_disable within own org', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ requestType: 'farmer_disable', organizationId: 'org-1', requestedById: 'other-user' }));
    prisma.approvalRequest.update.mockResolvedValue({ ...pendingRequest, status: 'approved' });
    await expect(
      approveRequest({ requestId: 'req-1', approverId: 'inst-admin', approverRole: 'institutional_admin', approverOrgId: 'org-1' })
    ).resolves.toBeDefined();
  });

  it('allows institutional_admin to approve season_reopen within own org', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ requestType: 'season_reopen', targetSeasonId: 's-1', targetFarmerId: null, organizationId: 'org-1', requestedById: 'other-user' }));
    prisma.approvalRequest.update.mockResolvedValue({ status: 'approved' });
    await expect(
      approveRequest({ requestId: 'req-1', approverId: 'inst-admin', approverRole: 'institutional_admin', approverOrgId: 'org-1' })
    ).resolves.toBeDefined();
  });
});

// ─── rejectRequest ────────────────────────────────────────────────────────────

describe('rejectRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ status: 'pending' }));
    prisma.approvalRequest.update.mockResolvedValue(makeRequest({ status: 'rejected', rejectionReason: 'Not justified' }));
  });

  it('rejects a pending request', async () => {
    await rejectRequest({ requestId: 'req-1', rejecterId: 'approver', rejectionReason: 'Not justified' });
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'rejected' }) })
    );
  });

  it('writes an audit log on rejection', async () => {
    await rejectRequest({ requestId: 'req-1', rejecterId: 'approver', rejectionReason: 'Not justified' });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'approval_rejected' }));
  });

  it('throws 400 if rejectionReason is empty', async () => {
    await expect(
      rejectRequest({ requestId: 'req-1', rejecterId: 'approver', rejectionReason: '' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 if rejectionReason is too short (< 3 chars)', async () => {
    await expect(
      rejectRequest({ requestId: 'req-1', rejecterId: 'approver', rejectionReason: 'no' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 if request does not exist', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(null);
    await expect(
      rejectRequest({ requestId: 'no-such', rejecterId: 'a', rejectionReason: 'Not valid' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 409 if request is not pending', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ status: 'approved' }));
    await expect(
      rejectRequest({ requestId: 'req-1', rejecterId: 'a', rejectionReason: 'Not valid' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 403 if rejecter is the original requester (self-rejection block)', async () => {
    await expect(
      rejectRequest({ requestId: 'req-1', rejecterId: 'user-requester', rejectionReason: 'I changed my mind' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─── revokeRequest ────────────────────────────────────────────────────────────

describe('revokeRequest', () => {
  const approvedRequest = makeRequest({ status: 'approved', approvedById: 'approver' });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.approvalRequest.findUnique.mockResolvedValue(approvedRequest);
    prisma.approvalRequest.update.mockResolvedValue({ ...approvedRequest, status: 'revoked' });
  });

  it('allows the original requester to revoke their own request', async () => {
    await revokeRequest({ requestId: 'req-1', revokerId: 'user-requester', revokerRole: 'institutional_admin' });
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'revoked' }) })
    );
  });

  it('allows super_admin to revoke any request', async () => {
    await revokeRequest({ requestId: 'req-1', revokerId: 'super-user', revokerRole: 'super_admin' });
    expect(prisma.approvalRequest.update).toHaveBeenCalledOnce();
  });

  it('writes an audit log on revocation', async () => {
    await revokeRequest({ requestId: 'req-1', revokerId: 'user-requester', revokerRole: 'institutional_admin' });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'approval_revoked' }));
  });

  it('throws 404 if request does not exist', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(null);
    await expect(
      revokeRequest({ requestId: 'no-such', revokerId: 'user-requester', revokerRole: 'super_admin' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 409 if request is in a terminal status (executed)', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ status: 'executed' }));
    await expect(
      revokeRequest({ requestId: 'req-1', revokerId: 'user-requester', revokerRole: 'super_admin' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 409 if request is in a terminal status (rejected)', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ status: 'rejected' }));
    await expect(
      revokeRequest({ requestId: 'req-1', revokerId: 'user-requester', revokerRole: 'super_admin' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 409 if request is in a terminal status (expired)', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ status: 'expired' }));
    await expect(
      revokeRequest({ requestId: 'req-1', revokerId: 'user-requester', revokerRole: 'super_admin' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 403 if a non-super_admin non-requester tries to revoke', async () => {
    await expect(
      revokeRequest({ requestId: 'req-1', revokerId: 'some-other-admin', revokerRole: 'institutional_admin' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows revoking a pending request (not yet approved)', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(makeRequest({ status: 'pending' }));
    prisma.approvalRequest.update.mockResolvedValue({ status: 'revoked' });
    await expect(
      revokeRequest({ requestId: 'req-1', revokerId: 'user-requester', revokerRole: 'institutional_admin' })
    ).resolves.toBeDefined();
  });
});

// ─── markExecuted ─────────────────────────────────────────────────────────────

describe('markExecuted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.approvalRequest.update.mockResolvedValue({ id: 'req-1', status: 'executed' });
  });

  it('sets status to executed and records executedAt', async () => {
    await markExecuted('req-1');
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        data: expect.objectContaining({ status: 'executed', executedAt: expect.any(Date) }),
      })
    );
  });
});

// ─── listRequests ─────────────────────────────────────────────────────────────

describe('listRequests', () => {
  const activeRequest  = makeRequest({ status: 'approved', expiresAt: hoursFromNow(10) });
  const expiredRequest = makeRequest({ id: 'req-exp', status: 'approved', expiresAt: hoursAgo(2) });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.approvalRequest.findMany.mockResolvedValue([]);
    prisma.approvalRequest.count.mockResolvedValue(0);
    prisma.approvalRequest.updateMany.mockResolvedValue({ count: 0 });
  });

  it('returns paginated results', async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([activeRequest]);
    prisma.approvalRequest.count.mockResolvedValue(1);
    const result = await listRequests({ actorRole: 'super_admin', actorOrgId: 'org-1' });
    expect(result).toMatchObject({ requests: expect.any(Array), total: 1, page: 1, limit: 50 });
  });

  it('super_admin sees all requests (no org filter applied)', async () => {
    await listRequests({ actorRole: 'super_admin', actorOrgId: 'org-1' });
    const whereArg = prisma.approvalRequest.findMany.mock.calls[0][0].where;
    expect(whereArg.organizationId).toBeUndefined();
  });

  it('institutional_admin is scoped to own org', async () => {
    await listRequests({ actorRole: 'institutional_admin', actorOrgId: 'org-A' });
    const whereArg = prisma.approvalRequest.findMany.mock.calls[0][0].where;
    expect(whereArg.organizationId).toBe('org-A');
  });

  it('filters by status when provided', async () => {
    await listRequests({ actorRole: 'super_admin', actorOrgId: 'org-1', status: 'pending' });
    const whereArg = prisma.approvalRequest.findMany.mock.calls[0][0].where;
    expect(whereArg.status).toBe('pending');
  });

  it('filters by requestType when provided', async () => {
    await listRequests({ actorRole: 'super_admin', actorOrgId: 'org-1', requestType: 'farmer_disable' });
    const whereArg = prisma.approvalRequest.findMany.mock.calls[0][0].where;
    expect(whereArg.requestType).toBe('farmer_disable');
  });

  it('lazy-expires approved requests whose expiresAt is in the past', async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([expiredRequest]);
    prisma.approvalRequest.count.mockResolvedValue(1);
    const result = await listRequests({ actorRole: 'super_admin', actorOrgId: 'org-1' });
    // Status is mutated in-place on the returned object
    expect(result.requests[0].status).toBe('expired');
    // updateMany called to persist the lazy expiry
    expect(prisma.approvalRequest.updateMany).toHaveBeenCalled();
  });

  it('does not expire requests that are still within their window', async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([activeRequest]);
    prisma.approvalRequest.count.mockResolvedValue(1);
    const result = await listRequests({ actorRole: 'super_admin', actorOrgId: 'org-1' });
    expect(result.requests[0].status).toBe('approved');
    expect(prisma.approvalRequest.updateMany).not.toHaveBeenCalled();
  });
});

// ─── getRequest ───────────────────────────────────────────────────────────────

describe('getRequest', () => {
  const sameOrgRequest    = makeRequest({ status: 'pending', organizationId: 'org-1' });
  const differentOrgRequest = makeRequest({ status: 'pending', organizationId: 'org-OTHER' });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.approvalRequest.findUnique.mockResolvedValue(sameOrgRequest);
    prisma.approvalRequest.update.mockResolvedValue({ ...sameOrgRequest, status: 'expired' });
  });

  it('returns request for super_admin regardless of org', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(differentOrgRequest);
    await expect(
      getRequest('req-1', { actorRole: 'super_admin', actorOrgId: 'org-1' })
    ).resolves.toBeDefined();
  });

  it('returns request for institutional_admin in same org', async () => {
    await expect(
      getRequest('req-1', { actorRole: 'institutional_admin', actorOrgId: 'org-1' })
    ).resolves.toBeDefined();
  });

  it('throws 403 for institutional_admin requesting a different org resource', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(differentOrgRequest);
    await expect(
      getRequest('req-1', { actorRole: 'institutional_admin', actorOrgId: 'org-1' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 404 if request does not exist', async () => {
    prisma.approvalRequest.findUnique.mockResolvedValue(null);
    await expect(
      getRequest('no-such', { actorRole: 'super_admin', actorOrgId: 'org-1' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('marks an approved+expired request as expired (lazy expiry)', async () => {
    const expiredRequest = makeRequest({ status: 'approved', expiresAt: new Date(Date.now() - 60000) });
    prisma.approvalRequest.findUnique.mockResolvedValue(expiredRequest);
    const result = await getRequest('req-1', { actorRole: 'super_admin', actorOrgId: 'org-1' });
    expect(result.status).toBe('expired');
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'req-1' }, data: { status: 'expired' } })
    );
  });

  it('does not touch status for approved requests still within their window', async () => {
    const activeRequest = makeRequest({ status: 'approved', expiresAt: new Date(Date.now() + 3600000) });
    prisma.approvalRequest.findUnique.mockResolvedValue(activeRequest);
    const result = await getRequest('req-1', { actorRole: 'super_admin', actorOrgId: 'org-1' });
    expect(result.status).toBe('approved');
    expect(prisma.approvalRequest.update).not.toHaveBeenCalled();
  });
});

// ─── getMyActiveGrants ────────────────────────────────────────────────────────

describe('getMyActiveGrants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.approvalRequest.findMany.mockResolvedValue([]);
  });

  it('queries only approved, non-expired requests for the given user', async () => {
    await getMyActiveGrants('user-1');
    const whereArg = prisma.approvalRequest.findMany.mock.calls[0][0].where;
    expect(whereArg).toMatchObject({
      requestedById: 'user-1',
      status: 'approved',
      expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
    });
  });

  it('returns the results ordered by expiresAt ascending', async () => {
    await getMyActiveGrants('user-1');
    const orderByArg = prisma.approvalRequest.findMany.mock.calls[0][0].orderBy;
    expect(orderByArg).toEqual({ expiresAt: 'asc' });
  });

  it('returns empty array when user has no active grants', async () => {
    const result = await getMyActiveGrants('user-1');
    expect(result).toEqual([]);
  });

  it('returns active grants when they exist', async () => {
    const grant = makeRequest({ status: 'approved', expiresAt: hoursFromNow(2), requestedById: 'user-1' });
    prisma.approvalRequest.findMany.mockResolvedValue([grant]);
    const result = await getMyActiveGrants('user-1');
    expect(result).toHaveLength(1);
  });
});
