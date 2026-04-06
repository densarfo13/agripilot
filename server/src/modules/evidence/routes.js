import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import { uploadLimiter } from '../../middleware/rateLimiters.js';
import { dedupGuard } from '../../middleware/dedup.js';
import { uploadCleanup } from '../../middleware/uploadCleanup.js';
import { config } from '../../config/index.js';
import * as evidenceService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.upload.dir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSizeMB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed. Accepted: JPEG, PNG, WebP, PDF'), false);
  },
});

const router = Router();
router.use(authenticate);

// Upload evidence
router.post('/:applicationId',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  uploadLimiter,
  upload.single('file'),
  uploadCleanup,
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const VALID_EVIDENCE_TYPES = ['farm_photo', 'id_document', 'land_title', 'crop_photo', 'receipt', 'boundary_photo', 'other'];
    const type = req.body.type || 'other';
    if (!VALID_EVIDENCE_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid evidence type. Must be one of: ${VALID_EVIDENCE_TYPES.join(', ')}` });
    }
    const evidence = await evidenceService.uploadEvidence(req.params.applicationId, req.file, type);
    writeAuditLog({
      applicationId: req.params.applicationId, userId: req.user.sub,
      action: 'evidence_uploaded', details: { evidenceId: evidence.id, type }, ipAddress: req.ip,
    }).catch(() => {});
    res.status(201).json(evidence);
  }));

// List evidence for application
router.get('/:applicationId',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'),
  asyncHandler(async (req, res) => {
    const files = await evidenceService.listEvidence(req.params.applicationId);
    res.json(files);
  }));

// Delete evidence
router.delete('/file/:evidenceId',
  validateParamUUID('evidenceId'),
  authorize('super_admin', 'institutional_admin'),
  dedupGuard('evidence-delete'),
  asyncHandler(async (req, res) => {
    const evidence = await evidenceService.deleteEvidence(req.params.evidenceId);
    writeAuditLog({
      userId: req.user.sub, action: 'evidence_deleted',
      details: { evidenceId: req.params.evidenceId, applicationId: evidence?.applicationId }, ipAddress: req.ip,
    }).catch(() => {});
    res.json({ message: 'Evidence deleted' });
  }));

export default router;
