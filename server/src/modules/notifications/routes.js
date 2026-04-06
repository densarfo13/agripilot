import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, requireApprovedFarmer, requireFarmerOwnership } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as svc from './service.js';

const STAFF_ROLES = ['super_admin', 'institutional_admin', 'field_officer', 'reviewer'];

const router = Router();
router.use(authenticate);
router.use(requireApprovedFarmer);

// List notifications (supports filters: read=true|false, type, limit)
router.get('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    res.json(await svc.listNotifications(req.params.farmerId, req.query));
  }));

// Unread count
router.get('/farmer/:farmerId/unread-count',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    res.json({ unread: await svc.getUnreadCount(req.params.farmerId) });
  }));

// Mark single notification read (staff or own — ownership checked via farmerId on the notification)
router.patch('/:id/read',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  asyncHandler(async (req, res) => {
    // Farmers can only mark their own notifications
    if (req.user.role === 'farmer') {
      const prisma = (await import('../../config/database.js')).default;
      const notification = await prisma.farmerNotification.findUnique({
        where: { id: req.params.id },
        select: { farmerId: true },
      });
      if (!notification) return res.status(404).json({ error: 'Notification not found' });
      const farmer = await prisma.farmer.findUnique({ where: { id: notification.farmerId }, select: { userId: true } });
      if (!farmer || farmer.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Access denied — you can only access your own notifications' });
      }
    }
    res.json(await svc.markRead(req.params.id));
  }));

// Mark all read
router.post('/farmer/:farmerId/mark-all-read',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    const r = await svc.markAllRead(req.params.farmerId);
    res.json({ updated: r.count });
  }));

export default router;
