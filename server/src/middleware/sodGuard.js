/**
 * SoD / JIT enforcement middleware.
 *
 * Usage:
 *   router.post('/:id/reopen',
 *     authorize('super_admin', 'institutional_admin'),
 *     sodGuard({ requestType: 'season_reopen', getTargetId: req => req.params.id }),
 *     asyncHandler(async (req, res) => { ... })
 *   );
 *
 * Reads `approvalRequestId` from req.body.
 * On success, attaches `req.approvalRequest` for the handler to use.
 * The handler must call `markExecuted(req.approvalRequest.id)` after acting.
 */
import prisma from '../config/database.js';

// Maps requestType → which field on ApprovalRequest holds the target resource ID
const TARGET_FIELD = {
  season_reopen: 'targetSeasonId',
  farmer_disable: 'targetFarmerId',
  role_escalation: 'targetUserId',
  user_org_transfer: 'targetUserId',
  privileged_reset: 'targetUserId',
};

export function sodGuard({ requestType, getTargetId }) {
  return async (req, res, next) => {
    const { approvalRequestId } = req.body;

    if (!approvalRequestId) {
      return res.status(400).json({
        error: 'approvalRequestId is required for this protected action',
        sodRequired: true,
        requestType,
        hint: 'Submit a request via POST /api/security/requests and have it approved before executing',
      });
    }

    let ar;
    try {
      ar = await prisma.approvalRequest.findUnique({ where: { id: approvalRequestId } });
    } catch {
      return res.status(500).json({ error: 'Failed to validate approval request' });
    }

    if (!ar) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    // Type must match the protected action
    if (ar.requestType !== requestType) {
      return res.status(400).json({
        error: `Approval request type mismatch. Expected '${requestType}', got '${ar.requestType}'`,
      });
    }

    // Already used
    if (ar.status === 'executed') {
      return res.status(409).json({ error: 'This approval request has already been executed' });
    }

    // Revoked or rejected
    if (ar.status === 'revoked' || ar.status === 'rejected') {
      return res.status(409).json({ error: `Approval request was ${ar.status}` });
    }

    // Expiry (lazy enforcement — also checked at list/get time)
    if (ar.status === 'approved' && ar.expiresAt && new Date() > ar.expiresAt) {
      // Mark expired in DB non-blocking
      prisma.approvalRequest.update({ where: { id: ar.id }, data: { status: 'expired' } }).catch(() => {});
      return res.status(410).json({
        error: 'Approval request has expired',
        expiredAt: ar.expiresAt,
        hint: 'Submit a new request',
      });
    }

    // Must be approved
    if (ar.status !== 'approved') {
      return res.status(400).json({
        error: `Approval request is not yet approved (current status: ${ar.status})`,
      });
    }

    // Only the original requester may execute
    if (ar.requestedById !== req.user.sub) {
      return res.status(403).json({
        error: 'Only the original requester may execute this approved action',
      });
    }

    // Target resource must match
    const targetField = TARGET_FIELD[requestType];
    if (targetField) {
      const expectedId = getTargetId(req);
      if (ar[targetField] !== expectedId) {
        return res.status(400).json({
          error: 'Approval request does not match this resource',
          expected: expectedId,
          requestApprovedFor: ar[targetField],
        });
      }
    }

    // Attach for handler use
    req.approvalRequest = ar;
    next();
  };
}
