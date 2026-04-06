import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as locationService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Capture GPS for an application
router.post('/:applicationId/gps', authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'latitude and longitude are required' });
  }
  const location = await locationService.captureGPS(req.params.applicationId, req.body);
  writeAuditLog({
    applicationId: req.params.applicationId, userId: req.user.sub,
    action: 'gps_captured', details: { latitude, longitude }, ipAddress: req.ip,
  }).catch(() => {});
  res.status(201).json(location);
}));

// Get GPS for an application
router.get('/:applicationId/gps', asyncHandler(async (req, res) => {
  const location = await locationService.getLocation(req.params.applicationId);
  if (!location) return res.status(404).json({ error: 'No GPS data found' });
  res.json(location);
}));

// Capture boundary for an application
router.post('/:applicationId/boundary', authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const boundary = await locationService.captureBoundary(req.params.applicationId, req.body);
  writeAuditLog({
    applicationId: req.params.applicationId, userId: req.user.sub,
    action: 'boundary_captured', details: { pointCount: boundary.points.length }, ipAddress: req.ip,
  }).catch(() => {});
  res.status(201).json(boundary);
}));

// Get boundary for an application
router.get('/:applicationId/boundary', asyncHandler(async (req, res) => {
  const boundary = await locationService.getBoundary(req.params.applicationId);
  if (!boundary) return res.status(404).json({ error: 'No boundary data found' });
  res.json(boundary);
}));

export default router;
