import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, requireApprovedFarmer, requireFarmerOwnership } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as svc from './service.js';
import { writeAuditLog } from '../audit/service.js';

const STAFF_ROLES = ['super_admin', 'institutional_admin', 'field_officer', 'reviewer'];

const router = Router();
router.use(authenticate);
router.use(requireApprovedFarmer);

// List reminders (supports filters: status=pending|done, type, overdue=true)
router.get('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    res.json(await svc.listReminders(req.params.farmerId, req.query));
  }));

// Reminder summary (counts: pending, overdue, completed this month, upcoming 5)
router.get('/farmer/:farmerId/summary',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    res.json(await svc.getReminderSummary(req.params.farmerId));
  }));

// Create reminder manually (staff only — farmers don't self-assign reminders)
router.post('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    if (!req.body.title || !req.body.message || !req.body.dueDate) {
      return res.status(400).json({ error: 'title, message, and dueDate are required' });
    }
    const reminder = await svc.createReminder(req.params.farmerId, req.body);
    writeAuditLog({ userId: req.user.sub, action: 'reminder_created', details: { farmerId: req.params.farmerId } }).catch(() => {});
    res.status(201).json(reminder);
  }));

// Generate crop lifecycle reminders (staff only)
router.post('/farmer/:farmerId/generate',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const { cropType, plantingDate } = req.body;
    if (!cropType || !plantingDate) {
      return res.status(400).json({ error: 'cropType and plantingDate are required' });
    }
    const reminders = await svc.generateCropLifecycleReminders(req.params.farmerId, cropType, plantingDate);
    writeAuditLog({ userId: req.user.sub, action: 'lifecycle_reminders_generated', details: { farmerId: req.params.farmerId, cropType, count: reminders.length } }).catch(() => {});
    res.status(201).json({ generated: reminders.length, reminders });
  }));

// Mark reminder done (staff or farmer for own data)
router.patch('/:id/done',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  asyncHandler(async (req, res) => {
    res.json(await svc.markDone(req.params.id));
  }));

// Dismiss reminder (staff or farmer for own data)
router.patch('/:id/dismiss',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  asyncHandler(async (req, res) => {
    res.json(await svc.dismissReminder(req.params.id));
  }));

export default router;
