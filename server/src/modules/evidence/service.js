import prisma from '../../config/database.js';
import crypto from 'crypto';
import fs from 'fs';

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

  return prisma.evidenceFile.create({
    data: {
      applicationId,
      type: type || 'other',
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      url: `/uploads/${file.filename}`,
      photoHash,
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
  return prisma.evidenceFile.delete({ where: { id: evidenceId } });
}

export async function checkDuplicateHash(photoHash) {
  if (!photoHash) return [];
  return prisma.evidenceFile.findMany({
    where: { photoHash },
    select: { id: true, applicationId: true, type: true, uploadedAt: true },
  });
}
