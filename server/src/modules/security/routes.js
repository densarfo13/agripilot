/**
 * Security routes — SoD / JIT approval request management
 * Mounted at /api/security
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import { validateParamUUID } from '../../middleware/validate.js';
import { workflowLimiter } from '../../middleware/rateLimiters.js';
import { requireStepUp } from '../../middleware/requireStepUp.js';
import { requireMfa } from '../../middleware/requireMfa.js';
import { dedupGuard } from '../../middleware/dedup.js';
import {
  createApprovalRequest,
  approveRequest,
  rejectRequest,
  revokeRequest,
  listRequests,
  getRequest,
  getMyActiveGrants,
} from './service.js';

const router = Router();
router.use(authenticate);
router.use(requireMfa);
router.use(extractOrganization);

// Only admins can manage the security queue
const SECURITY_ADMIN_ROLES = ['super_admin', 'institutional_admin'];

// ─── List approval requests ───────────────────────────────

router.get('/requests',
  authorize(...SECURITY_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { status, requestType, page, limit } = req.query;
    const result = await listRequests({
      actorRole: req.user.role,
      actorOrgId: req.organizationId,
      status,
      requestType,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 50, 100),
    });
    res.json(result);
  }));

// ─── Create approval request ──────────────────────────────

router.post('/requests',
  authorize(...SECURITY_ADMIN_ROLES),
  workflowLimiter,
  dedupGuard('security-request'),
  asyncHandler(async (req, res) => {
    const {
      requestType,
      targetUserId,
      targetFarmerId,
      targetSeasonId,
      targetData,
      reason,
    } = req.body;

    if (!requestType) {
      return res.status(400).json({ error: 'requestType is required' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const request = await createApprovalRequest({
      requestType,
      requestedById: req.user.sub,
      organizationId: req.organizationId,
      targetUserId,
      targetFarmerId,
      targetSeasonId,
      targetData,
      reason,
    });

    res.status(201).json(request);
  }));

// ─── Get single request ───────────────────────────────────

router.get('/requests/:id',
  validateParamUUID('id'),
  authorize(...SECURITY_ADMIN_ROLES, 'reviewer', 'field_officer'),
  asyncHandler(async (req, res) => {
    const request = await getRequest(req.params.id, {
      actorRole: req.user.role,
      actorOrgId: req.organizationId,
    });
    res.json(request);
  }));

// ─── Approve request ─────────────────────────────────────

router.post('/requests/:id/approve',
  validateParamUUID('id'),
  authorize(...SECURITY_ADMIN_ROLES),
  workflowLimiter,
  requireStepUp(15),  // SoD approval: tighter 15-min window
  dedupGuard('security-approve'),
  asyncHandler(async (req, res) => {
    const request = await approveRequest({
      requestId: req.params.id,
      approverId: req.user.sub,
      approverRole: req.user.role,
      approverOrgId: req.organizationId,
    });
    res.json(request);
  }));

// ─── Reject request ──────────────────────────────────────

router.post('/requests/:id/reject',
  validateParamUUID('id'),
  authorize(...SECURITY_ADMIN_ROLES),
  workflowLimiter,
  dedupGuard('security-reject'),
  asyncHandler(async (req, res) => {
    const { rejectionReason } = req.body;
    if (!rejectionReason) {
      return res.status(400).json({ error: 'rejectionReason is required' });
    }
    const request = await rejectRequest({
      requestId: req.params.id,
      rejecterId: req.user.sub,
      rejectionReason,
    });
    res.json(request);
  }));

// ─── Revoke request ───────────────────────────────────────

router.post('/requests/:id/revoke',
  validateParamUUID('id'),
  authorize(...SECURITY_ADMIN_ROLES),
  workflowLimiter,
  asyncHandler(async (req, res) => {
    const request = await revokeRequest({
      requestId: req.params.id,
      revokerId: req.user.sub,
      revokerRole: req.user.role,
    });
    res.json(request);
  }));

// ─── My active JIT grants ─────────────────────────────────

router.get('/my-active-grants',
  asyncHandler(async (req, res) => {
    const grants = await getMyActiveGrants(req.user.sub);
    res.json(grants);
  }));

export default router;
