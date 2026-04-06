import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, requireApprovedFarmer } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);
router.use(requireApprovedFarmer);

// List reminders (supports filters: status=pending|done, type, overdue=true)
router.get('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    res.json(await svc.listReminders(req.params.farmerId, req.query));
  }));

// Reminder summary (counts: pending, overdue, completed this month, upcoming 5)
router.get('/farmer/:farmerId/summary',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    res.json(await svc.getReminderSummary(req.params.farmerId));
  }));

// Create reminder manually
router.post('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    if (!req.body.title || !req.body.message || !req.body.dueDate) {
      return res.status(400).json({ error: 'title, message, and dueDate are required' });
    }
    res.status(201).json(await svc.createReminder(req.params.farmerId, req.body));
  }));

// Generate crop lifecycle reminders
router.post('/farmer/:farmerId/generate',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    const { cropType, plantingDate } = req.body;
    if (!cropType || !plantingDate) {
      return res.status(400).json({ error: 'cropType and plantingDate are required' });
    }
    const reminders = await svc.generateCropLifecycleReminders(req.params.farmerId, cropType, plantingDate);
    res.status(201).json({ generated: reminders.length, reminders });
  }));

// Mark reminder done
router.patch('/:id/done',
  validateParamUUID('id'),
  asyncHandler(async (req, res) => {
    res.json(await svc.markDone(req.params.id));
  }));

// Dismiss reminder
router.patch('/:id/dismiss',
  validateParamUUID('id'),
  asyncHandler(async (req, res) => {
    res.json(await svc.dismissReminder(req.params.id));
  }));

export default router;
