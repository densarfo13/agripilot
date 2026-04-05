import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);

// List notifications (supports filters: read=true|false, type, limit)
router.get('/farmer/:farmerId', async (req, res, next) => {
  try { res.json(await svc.listNotifications(req.params.farmerId, req.query)); } catch (e) { next(e); }
});

// Unread count
router.get('/farmer/:farmerId/unread-count', async (req, res, next) => {
  try { res.json({ unread: await svc.getUnreadCount(req.params.farmerId) }); } catch (e) { next(e); }
});

// Mark single notification read
router.patch('/:id/read', async (req, res, next) => {
  try { res.json(await svc.markRead(req.params.id)); } catch (e) { next(e); }
});

// Mark all read
router.post('/farmer/:farmerId/mark-all-read', async (req, res, next) => {
  try {
    const r = await svc.markAllRead(req.params.farmerId);
    res.json({ updated: r.count });
  } catch (e) { next(e); }
});

export default router;
