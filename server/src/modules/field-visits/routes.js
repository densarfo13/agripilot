import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as fieldVisitService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Create field visit
router.post('/:applicationId', authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const visit = await fieldVisitService.createFieldVisit(req.params.applicationId, req.user.sub, req.body);
  await writeAuditLog({
    applicationId: req.params.applicationId, userId: req.user.sub,
    action: 'field_visit_created', details: { visitId: visit.id }, ipAddress: req.ip,
  });
  res.status(201).json(visit);
}));

// List field visits for an application
router.get('/:applicationId', asyncHandler(async (req, res) => {
  const visits = await fieldVisitService.listFieldVisits(req.params.applicationId);
  res.json(visits);
}));

// Complete a field visit
router.patch('/visit/:visitId/complete', authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const { findings, notes } = req.body;
  const visit = await fieldVisitService.completeFieldVisit(req.params.visitId, findings, notes);
  await writeAuditLog({
    userId: req.user.sub, action: 'field_visit_completed',
    details: { visitId: req.params.visitId }, ipAddress: req.ip,
  });
  res.json(visit);
}));

// Get my field visits
router.get('/my-visits/list', authorize('field_officer', 'super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const visits = await fieldVisitService.getMyFieldVisits(req.user.sub);
  res.json(visits);
}));

export default router;
