import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import { dedupGuard } from '../../middleware/dedup.js';
import * as locationService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Capture GPS for an application
router.post('/:applicationId/gps',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  dedupGuard('gps-capture'),
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }
    // Validate GPS coordinate ranges
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'latitude must be between -90 and 90' });
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'longitude must be between -180 and 180' });
    }
    const location = await locationService.captureGPS(req.params.applicationId, req.body);
    writeAuditLog({
      applicationId: req.params.applicationId, userId: req.user.sub,
      action: 'gps_captured', details: { latitude: lat, longitude: lng }, ipAddress: req.ip,
    }).catch(() => {});
    res.status(201).json(location);
  }));

// Get GPS for an application
router.get('/:applicationId/gps',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'),
  asyncHandler(async (req, res) => {
    const location = await locationService.getLocation(req.params.applicationId);
    if (!location) return res.status(404).json({ error: 'No GPS data found' });
    res.json(location);
  }));

// Capture boundary for an application
router.post('/:applicationId/boundary',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  dedupGuard('boundary-capture'),
  asyncHandler(async (req, res) => {
    const boundary = await locationService.captureBoundary(req.params.applicationId, req.body);
    writeAuditLog({
      applicationId: req.params.applicationId, userId: req.user.sub,
      action: 'boundary_captured', details: { pointCount: boundary.points.length }, ipAddress: req.ip,
    }).catch(() => {});
    res.status(201).json(boundary);
  }));

// Get boundary for an application
router.get('/:applicationId/boundary',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'),
  asyncHandler(async (req, res) => {
    const boundary = await locationService.getBoundary(req.params.applicationId);
    if (!boundary) return res.status(404).json({ error: 'No boundary data found' });
    res.json(boundary);
  }));

export default router;
