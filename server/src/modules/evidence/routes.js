import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { config } from '../../config/index.js';
import * as evidenceService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.upload.dir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSizeMB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'), false);
  },
});

const router = Router();
router.use(authenticate);

// Upload evidence
router.post('/:applicationId', authorize('super_admin', 'institutional_admin', 'field_officer'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });
  const type = req.body.type || 'other';
  const evidence = await evidenceService.uploadEvidence(req.params.applicationId, req.file, type);
  await writeAuditLog({
    applicationId: req.params.applicationId, userId: req.user.sub,
    action: 'evidence_uploaded', details: { evidenceId: evidence.id, type }, ipAddress: req.ip,
  });
  res.status(201).json(evidence);
}));

// List evidence for application
router.get('/:applicationId', asyncHandler(async (req, res) => {
  const files = await evidenceService.listEvidence(req.params.applicationId);
  res.json(files);
}));

// Delete evidence
router.delete('/file/:evidenceId', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  await evidenceService.deleteEvidence(req.params.evidenceId);
  await writeAuditLog({
    userId: req.user.sub, action: 'evidence_deleted',
    details: { evidenceId: req.params.evidenceId }, ipAddress: req.ip,
  });
  res.json({ message: 'Evidence deleted' });
}));

export default router;
