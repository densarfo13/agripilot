/**
 * verification.js — append-only verification ledger.
 *
 *   POST  /api/v2/verification          — admin/reviewer records a verification
 *   GET   /api/v2/verification/subject  — look up records for a subject
 *   GET   /api/v2/verification/farm/:id — all verifications for a farm
 */
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';

const prisma = new PrismaClient();
const router = express.Router();

const REVIEWER_SCOPE = [authenticate, requireAuth, requireRole('reviewer')];
const READ_SCOPE     = [authenticate, requireAuth];

const VALID_SUBJECT_TYPES = new Set(['planting', 'harvest', 'issue', 'task', 'profile']);
const VALID_METHODS = new Set(['field_visit', 'photo', 'peer', 'automated', 'document']);
const VALID_OUTCOMES = new Set(['confirmed', 'rejected', 'inconclusive']);

router.post('/', ...REVIEWER_SCOPE, express.json(), async (req, res) => {
  const body = req.body || {};
  const subjectType = String(body.subjectType || '').toLowerCase();
  const method = String(body.method || '').toLowerCase();
  const outcome = body.outcome ? String(body.outcome).toLowerCase() : 'confirmed';

  if (!VALID_SUBJECT_TYPES.has(subjectType)) return res.status(400).json({ error: 'invalid_subject_type' });
  if (!VALID_METHODS.has(method)) return res.status(400).json({ error: 'invalid_method' });
  if (!VALID_OUTCOMES.has(outcome)) return res.status(400).json({ error: 'invalid_outcome' });
  if (!body.farmProfileId) return res.status(400).json({ error: 'missing_farm' });

  const record = await prisma.verificationRecord.create({
    data: {
      farmProfileId: body.farmProfileId,
      cropCycleId: body.cropCycleId || null,
      subjectType,
      subjectId: body.subjectId || null,
      method,
      verifiedBy: req.user.id,
      outcome,
      confidence: Number.isFinite(body.confidence) ? body.confidence : null,
      evidenceUrl: typeof body.evidenceUrl === 'string' ? body.evidenceUrl.trim() || null : null,
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 1000) : null,
    },
  });
  res.status(201).json({ record });
});

router.get('/subject', ...READ_SCOPE, async (req, res) => {
  const subjectType = String(req.query.subjectType || '').toLowerCase();
  const subjectId = String(req.query.subjectId || '');
  if (!VALID_SUBJECT_TYPES.has(subjectType) || !subjectId) {
    return res.status(400).json({ error: 'invalid_params' });
  }
  const records = await prisma.verificationRecord.findMany({
    where: { subjectType, subjectId },
    orderBy: { verifiedAt: 'desc' },
  });
  res.json({ records });
});

router.get('/farm/:id', ...READ_SCOPE, async (req, res) => {
  const records = await prisma.verificationRecord.findMany({
    where: { farmProfileId: req.params.id },
    orderBy: { verifiedAt: 'desc' },
    take: 100,
  });
  res.json({ records });
});

export default router;
