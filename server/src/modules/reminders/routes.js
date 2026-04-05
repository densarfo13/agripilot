import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);

// List reminders (supports filters: status=pending|done, type, overdue=true)
router.get('/farmer/:farmerId', async (req, res, next) => {
  try { res.json(await svc.listReminders(req.params.farmerId, req.query)); } catch (e) { next(e); }
});

// Reminder summary (counts: pending, overdue, completed this month, upcoming 5)
router.get('/farmer/:farmerId/summary', async (req, res, next) => {
  try { res.json(await svc.getReminderSummary(req.params.farmerId)); } catch (e) { next(e); }
});

// Create reminder manually
router.post('/farmer/:farmerId', async (req, res, next) => {
  try {
    if (!req.body.title || !req.body.message || !req.body.dueDate) {
      return res.status(400).json({ error: 'title, message, and dueDate are required' });
    }
    res.status(201).json(await svc.createReminder(req.params.farmerId, req.body));
  } catch (e) { next(e); }
});

// Generate crop lifecycle reminders
router.post('/farmer/:farmerId/generate', async (req, res, next) => {
  try {
    const { cropType, plantingDate } = req.body;
    if (!cropType || !plantingDate) {
      return res.status(400).json({ error: 'cropType and plantingDate are required' });
    }
    const reminders = await svc.generateCropLifecycleReminders(req.params.farmerId, cropType, plantingDate);
    res.status(201).json({ generated: reminders.length, reminders });
  } catch (e) { next(e); }
});

// Mark reminder done
router.patch('/:id/done', async (req, res, next) => {
  try { res.json(await svc.markDone(req.params.id)); } catch (e) { next(e); }
});

// Dismiss reminder
router.patch('/:id/dismiss', async (req, res, next) => {
  try { res.json(await svc.dismissReminder(req.params.id)); } catch (e) { next(e); }
});

export default router;
