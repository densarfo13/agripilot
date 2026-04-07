import prisma from '../../config/database.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { sanitizeFilename } from '../../middleware/validate.js';

// Statuses that allow evidence uploads
const UPLOADABLE_STATUSES = ['draft', 'submitted', 'under_review', 'needs_more_evidence', 'field_review_required'];

export async function uploadEvidence(applicationId, file, type) {
  // Verify application exists
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  // Block uploads to finalized applications
  if (!UPLOADABLE_STATUSES.includes(app.status)) {
    const err = new Error(`Cannot upload evidence to an application with status '${app.status}'. Only allowed for: ${UPLOADABLE_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Compute photo hash for duplicate detection
  let photoHash = null;
  if (file.path && fs.existsSync(file.path)) {
    const buffer = fs.readFileSync(file.path);
    photoHash = crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // Check for duplicate file uploads
  if (photoHash) {
    const duplicates = await checkDuplicateHash(photoHash);
    if (duplicates.length > 0) {
      const dupInfo = duplicates.map((d) => `app:${d.applicationId}`).join(', ');
      console.warn(`[EVIDENCE] Duplicate file hash detected. Existing in: ${dupInfo}`);
      // Allow upload but flag it in metadata
    }
  }

  // Sanitize original filename before storing
  const safeOriginalName = sanitizeFilename(file.originalname);

  return prisma.evidenceFile.create({
    data: {
      applicationId,
      type: type || 'other',
      filename: file.filename,
      originalName: safeOriginalName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      url: `/uploads/${file.filename}`,
      photoHash,
      metadata: photoHash && (await checkDuplicateHash(photoHash)).length > 1
        ? { duplicateWarning: true }
        : undefined,
    },
  });
}

export async function listEvidence(applicationId) {
  return prisma.evidenceFile.findMany({
    where: { applicationId },
    orderBy: { uploadedAt: 'desc' },
  });
}

// Statuses that block evidence deletion (finalized decisions)
const DELETION_BLOCKED_STATUSES = ['approved', 'disbursed'];

export async function deleteEvidence(evidenceId) {
  const evidence = await prisma.evidenceFile.findUnique({
    where: { id: evidenceId },
    include: { application: { select: { id: true, status: true } } },
  });
  if (!evidence) {
    const err = new Error('Evidence file not found');
    err.statusCode = 404;
    throw err;
  }

  // Block deletion of evidence from approved/disbursed applications (audit integrity)
  if (evidence.application && DELETION_BLOCKED_STATUSES.includes(evidence.application.status)) {
    const err = new Error(`Cannot delete evidence from an application with status '${evidence.application.status}'. Evidence is part of the decision record.`);
    err.statusCode = 400;
    throw err;
  }

  // Delete DB record first (authoritative), then clean up disk file
  const deleted = await prisma.evidenceFile.delete({ where: { id: evidenceId } });

  // Best-effort disk cleanup after DB deletion succeeds
  try {
    const filePath = path.join(process.cwd(), evidence.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (fsErr) {
    // Log but don't fail — orphaned file on disk is better than inconsistent DB
    console.warn(`[EVIDENCE] Disk cleanup failed for ${evidence.filename}: ${fsErr.message}. File may be orphaned.`);
  }

  return deleted;
}

export async function checkDuplicateHash(photoHash) {
  if (!photoHash) return [];
  return prisma.evidenceFile.findMany({
    where: { photoHash },
    select: { id: true, applicationId: true, type: true, uploadedAt: true },
  });
}
