/**
 * Auto-Notification Routes
 * Mounted at /api/auto-notifications
 *
 * GET  /                   — list notifications (admin)
 * GET  /stats              — summary stats (admin)
 * POST /run                — manually trigger a cycle (super_admin only)
 * POST /:id/retry          — retry a failed notification (admin)
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import { validateParamUUID } from '../../middleware/validate.js';
import { requireMfa } from '../../middleware/requireMfa.js';
import { writeAuditLog } from '../audit/service.js';
import {
  listNotifications,
  retryNotification,
  runNotificationCycle,
  getStats,
} from './service.js';

const router = Router();
router.use(authenticate);
router.use(requireMfa);
router.use(extractOrganization);

const ADMIN_ROLES = ['super_admin', 'institutional_admin'];

// ─── GET /api/auto-notifications ──────────────────────────

router.get('/',
  authorize(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { status, type, farmerId, page, limit } = req.query;
    const result = await listNotifications({
      actorRole:  req.user.role,
      actorOrgId: req.organizationId,
      status,
      type,
      farmerId,
      page:  parseInt(page)  || 1,
      limit: Math.min(parseInt(limit) || 50, 100),
    });
    res.json(result);
  }));

// ─── GET /api/auto-notifications/stats ────────────────────

router.get('/stats',
  authorize(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const stats = await getStats({
      actorRole:  req.user.role,
      actorOrgId: req.organizationId,
    });
    res.json(stats);
  }));

// ─── POST /api/auto-notifications/run ─────────────────────

router.post('/run',
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    const result = await runNotificationCycle();
    writeAuditLog({ userId: req.user.sub, action: 'notification_cycle_triggered', details: { sent: result.sent, failed: result.failed } }).catch(() => {});
    res.json(result);
  }));

// ─── POST /api/auto-notifications/:id/retry ───────────────

router.post('/:id/retry',
  validateParamUUID('id'),
  authorize(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const notification = await retryNotification({
      id:         req.params.id,
      actorRole:  req.user.role,
      actorOrgId: req.organizationId,
    });
    writeAuditLog({ userId: req.user.sub, action: 'notification_retry', details: { notificationId: req.params.id } }).catch(() => {});
    res.json(notification);
  }));

export default router;
