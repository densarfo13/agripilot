/**
 * SoD / JIT Security Service
 *
 * Manages ApprovalRequest lifecycle:
 *   create → approve/reject → execute (action runs) → [expire | revoke]
 *
 * SoD rule: approvedById must never equal requestedById.
 * JIT rule:  approved requests carry an expiresAt window; backend enforces expiry before execution.
 */
import prisma from '../../config/database.js';
import { writeAuditLog } from '../audit/service.js';

// ─── JIT expiry windows by request type ──────────────────
// Pure SoD types get a 24-hour execution window (generous — approver + executor are different people).
// JIT-sensitive types get shorter windows.
const EXPIRY_HOURS = {
  season_reopen: 4,        // 4-hour correction window
  farmer_disable: 24,      // SoD only — 24h to execute after approval
  role_escalation: 24,     // SoD only — 24h to execute after approval
  user_org_transfer: 24,   // SoD only — 24h to execute after approval
  privileged_reset: 1,     // 1-hour JIT window — shortest
};

// Which request types require the approver to be super_admin (cross-org authority)
const REQUIRES_SUPER_ADMIN_APPROVER = new Set([
  'role_escalation',
  'user_org_transfer',
  'privileged_reset',
]);

// ─── Helpers ─────────────────────────────────────────────

function hoursFromNow(hours) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}

function isExpired(request) {
  return request.expiresAt && new Date() > request.expiresAt;
}

// ─── Create ──────────────────────────────────────────────

/**
 * Submit a new approval request.
 * The requester cannot approve their own request (enforced at approval time).
 */
export async function createApprovalRequest({
  requestType,
  requestedById,
  organizationId,
  targetUserId = null,
  targetFarmerId = null,
  targetSeasonId = null,
  targetData = null,
  reason,
}) {
  if (!reason || reason.trim().length < 5) {
    const err = new Error('A meaningful reason (min 5 characters) is required');
    err.statusCode = 400;
    throw err;
  }

  // Validate requestType
  const validTypes = Object.keys(EXPIRY_HOURS);
  if (!validTypes.includes(requestType)) {
    const err = new Error(`Invalid requestType. Must be one of: ${validTypes.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Prevent duplicate pending requests for the same resource + type by the same user
  const existing = await prisma.approvalRequest.findFirst({
    where: {
      requestedById,
      requestType,
      status: 'pending',
      ...(targetSeasonId ? { targetSeasonId } : {}),
      ...(targetFarmerId ? { targetFarmerId } : {}),
      ...(targetUserId ? { targetUserId } : {}),
    },
  });
  if (existing) {
    const err = new Error('You already have a pending approval request for this action and resource');
    err.statusCode = 409;
    throw err;
  }

  const request = await prisma.approvalRequest.create({
    data: {
      requestType,
      requestedById,
      organizationId: organizationId || null,
      targetUserId,
      targetFarmerId,
      targetSeasonId,
      targetData,
      reason: reason.trim(),
    },
    include: {
      requestedBy: { select: { id: true, fullName: true, email: true, role: true } },
      organization: { select: { id: true, name: true } },
    },
  });

  writeAuditLog({
    userId: requestedById,
    organizationId,
    action: 'approval_requested',
    details: { requestId: request.id, requestType, targetUserId, targetFarmerId, targetSeasonId },
  }).catch(() => {});

  return request;
}

// ─── Approve ─────────────────────────────────────────────

/**
 * Approve a pending request.
 *
 * SoD enforcement:
 *   - Approver ≠ Requester (always)
 *   - For privileged types: approver must be super_admin
 *   - For org-scoped types: approver must be in same org OR be super_admin
 */
export async function approveRequest({
  requestId,
  approverId,
  approverRole,
  approverOrgId,
}) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: { requestedBy: { select: { id: true, fullName: true, role: true, organizationId: true } } },
  });

  if (!request) {
    const err = new Error('Approval request not found');
    err.statusCode = 404;
    throw err;
  }
  if (request.status !== 'pending') {
    const err = new Error(`Cannot approve a request with status: ${request.status}`);
    err.statusCode = 409;
    throw err;
  }

  // ── SoD: self-approval block ──
  if (request.requestedById === approverId) {
    const err = new Error('Separation of duties violation: you cannot approve your own request');
    err.statusCode = 403;
    throw err;
  }

  // ── Role authority check ──
  if (REQUIRES_SUPER_ADMIN_APPROVER.has(request.requestType)) {
    if (approverRole !== 'super_admin') {
      const err = new Error(`Only super_admin can approve ${request.requestType} requests`);
      err.statusCode = 403;
      throw err;
    }
  } else {
    // For org-scoped types (season_reopen, farmer_disable):
    // approver must be super_admin OR institutional_admin in same org
    if (approverRole !== 'super_admin') {
      if (approverRole !== 'institutional_admin') {
        const err = new Error('Only super_admin or institutional_admin can approve requests');
        err.statusCode = 403;
        throw err;
      }
      // institutional_admin must be in same org as the request
      if (request.organizationId && approverOrgId !== request.organizationId) {
        const err = new Error('Cannot approve requests outside your organization');
        err.statusCode = 403;
        throw err;
      }
    }
  }

  const expiresAt = hoursFromNow(EXPIRY_HOURS[request.requestType]);

  const updated = await prisma.approvalRequest.update({
    where: { id: requestId },
    data: {
      status: 'approved',
      approvedById: approverId,
      expiresAt,
    },
    include: {
      requestedBy: { select: { id: true, fullName: true, email: true, role: true } },
      approvedBy: { select: { id: true, fullName: true, email: true, role: true } },
      organization: { select: { id: true, name: true } },
    },
  });

  writeAuditLog({
    userId: approverId,
    organizationId: request.organizationId,
    action: 'approval_granted',
    details: {
      requestId,
      requestType: request.requestType,
      requestedById: request.requestedById,
      expiresAt: expiresAt.toISOString(),
    },
  }).catch(() => {});

  return updated;
}

// ─── Reject ──────────────────────────────────────────────

export async function rejectRequest({ requestId, rejecterId, rejectionReason }) {
  if (!rejectionReason || rejectionReason.trim().length < 3) {
    const err = new Error('A rejection reason is required');
    err.statusCode = 400;
    throw err;
  }

  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    const err = new Error('Approval request not found');
    err.statusCode = 404;
    throw err;
  }
  if (request.status !== 'pending') {
    const err = new Error(`Cannot reject a request with status: ${request.status}`);
    err.statusCode = 409;
    throw err;
  }

  // SoD: cannot reject own request (prevents self-rejection to re-submit faster)
  if (request.requestedById === rejecterId) {
    const err = new Error('You cannot reject your own request — use cancel/revoke instead');
    err.statusCode = 403;
    throw err;
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: requestId },
    data: { status: 'rejected', approvedById: rejecterId, rejectionReason: rejectionReason.trim() },
  });

  writeAuditLog({
    userId: rejecterId,
    organizationId: request.organizationId,
    action: 'approval_rejected',
    details: { requestId, requestType: request.requestType, rejectionReason },
  }).catch(() => {});

  return updated;
}

// ─── Revoke (cancel approved request before execution) ────

export async function revokeRequest({ requestId, revokerId, revokerRole }) {
  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    const err = new Error('Approval request not found');
    err.statusCode = 404;
    throw err;
  }
  if (!['pending', 'approved'].includes(request.status)) {
    const err = new Error(`Cannot revoke a request with status: ${request.status}`);
    err.statusCode = 409;
    throw err;
  }

  // Only super_admin or the original requester can revoke
  if (revokerId !== request.requestedById && revokerRole !== 'super_admin') {
    const err = new Error('Only the original requester or a super_admin can revoke this request');
    err.statusCode = 403;
    throw err;
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: requestId },
    data: { status: 'revoked', revokedById: revokerId, revokedAt: new Date() },
  });

  writeAuditLog({
    userId: revokerId,
    organizationId: request.organizationId,
    action: 'approval_revoked',
    details: { requestId, requestType: request.requestType },
  }).catch(() => {});

  return updated;
}

// ─── Mark executed (called by the protected action handler) ──

export async function markExecuted(requestId) {
  return prisma.approvalRequest.update({
    where: { id: requestId },
    data: { status: 'executed', executedAt: new Date() },
  });
}

// ─── List ────────────────────────────────────────────────

export async function listRequests({ actorRole, actorOrgId, status, requestType, page = 1, limit = 50 }) {
  const where = {};

  // Org scope: institutional_admin sees only own-org requests
  if (actorRole !== 'super_admin') {
    where.organizationId = actorOrgId;
  }
  if (status) where.status = status;
  if (requestType) where.requestType = requestType;

  const [requests, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, fullName: true, email: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, email: true, role: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.approvalRequest.count({ where }),
  ]);

  // Auto-mark expired requests (lazy expiry)
  const now = new Date();
  const toExpire = requests.filter(r => r.status === 'approved' && r.expiresAt && r.expiresAt < now);
  if (toExpire.length > 0) {
    prisma.approvalRequest.updateMany({
      where: { id: { in: toExpire.map(r => r.id) }, status: 'approved' },
      data: { status: 'expired' },
    }).catch(() => {});
    toExpire.forEach(r => { r.status = 'expired'; });
  }

  return { requests, total, page, limit };
}

// ─── Get single ──────────────────────────────────────────

export async function getRequest(id, { actorRole, actorOrgId }) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id },
    include: {
      requestedBy: { select: { id: true, fullName: true, email: true, role: true } },
      approvedBy: { select: { id: true, fullName: true, email: true, role: true } },
      revokedBy: { select: { id: true, fullName: true, email: true, role: true } },
      organization: { select: { id: true, name: true } },
    },
  });
  if (!request) {
    const err = new Error('Approval request not found');
    err.statusCode = 404;
    throw err;
  }

  // Org scope enforcement
  if (actorRole !== 'super_admin' && request.organizationId && request.organizationId !== actorOrgId) {
    const err = new Error('Access denied — request belongs to a different organization');
    err.statusCode = 403;
    throw err;
  }

  // Lazy expiry check
  if (request.status === 'approved' && isExpired(request)) {
    await prisma.approvalRequest.update({ where: { id }, data: { status: 'expired' } }).catch(() => {});
    request.status = 'expired';
  }

  return request;
}

// ─── My active grants (JIT) ──────────────────────────────

export async function getMyActiveGrants(userId) {
  const now = new Date();
  return prisma.approvalRequest.findMany({
    where: {
      requestedById: userId,
      status: 'approved',
      expiresAt: { gt: now },
    },
    include: { organization: { select: { id: true, name: true } } },
    orderBy: { expiresAt: 'asc' },
  });
}
