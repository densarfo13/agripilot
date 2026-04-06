import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);

// List notifications (supports filters: read=true|false, type, limit)
router.get('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    res.json(await svc.listNotifications(req.params.farmerId, req.query));
  }));

// Unread count
router.get('/farmer/:farmerId/unread-count',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    res.json({ unread: await svc.getUnreadCount(req.params.farmerId) });
  }));

// Mark single notification read
router.patch('/:id/read',
  validateParamUUID('id'),
  asyncHandler(async (req, res) => {
    res.json(await svc.markRead(req.params.id));
  }));

// Mark all read
router.post('/farmer/:farmerId/mark-all-read',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    const r = await svc.markAllRead(req.params.farmerId);
    res.json({ updated: r.count });
  }));

export default router;
