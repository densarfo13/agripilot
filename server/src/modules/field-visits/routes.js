import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as fieldVisitService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Get my field visits (must be before /:applicationId routes)
router.get('/my-visits/list', authorize('field_officer', 'super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const visits = await fieldVisitService.getMyFieldVisits(req.user.sub);
  res.json(visits);
}));

// Create field visit
router.post('/:applicationId',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const visit = await fieldVisitService.createFieldVisit(req.params.applicationId, req.user.sub, req.body);
    writeAuditLog({
      applicationId: req.params.applicationId, userId: req.user.sub,
      action: 'field_visit_created', details: { visitId: visit.id }, ipAddress: req.ip,
    }).catch(() => {});
    res.status(201).json(visit);
  }));

// List field visits for an application
router.get('/:applicationId',
  validateParamUUID('applicationId'),
  asyncHandler(async (req, res) => {
    const visits = await fieldVisitService.listFieldVisits(req.params.applicationId);
    res.json(visits);
  }));

// Complete a field visit
router.patch('/visit/:visitId/complete',
  validateParamUUID('visitId'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const { findings, notes } = req.body;
    const visit = await fieldVisitService.completeFieldVisit(req.params.visitId, findings, notes);
    writeAuditLog({
      userId: req.user.sub, action: 'field_visit_completed',
      details: { visitId: req.params.visitId }, ipAddress: req.ip,
    }).catch(() => {});
    res.json(visit);
  }));

export default router;
