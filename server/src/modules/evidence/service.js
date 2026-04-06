import prisma from '../../config/database.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { sanitizeFilename } from '../../middleware/validate.js';

export async function uploadEvidence(applicationId, file, type) {
  // Verify application exists
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
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

export async function deleteEvidence(evidenceId) {
  const evidence = await prisma.evidenceFile.findUnique({ where: { id: evidenceId } });
  if (!evidence) {
    const err = new Error('Evidence file not found');
    err.statusCode = 404;
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
