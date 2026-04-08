import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { validateParamUUID, isValidUUID } from '../../middleware/validate.js';
import { writeAuditLog } from '../audit/service.js';
import * as service from './service.js';
import prisma from '../../config/database.js';

const router = Router();
router.use(authenticate);

// ─── Ownership guard ───────────────────────────────────
async function verifyFarmProfileOwnership(req, farmProfileId) {
  if (req.user.role !== 'farmer') return;
  const profile = await prisma.farmProfile.findUnique({
    where: { id: farmProfileId },
    select: { farmer: { select: { userId: true } } },
  });
  if (!profile || profile.farmer.userId !== req.user.sub) {
    const err = new Error('Farm profile not found');
    err.statusCode = 404;
    throw err;
  }
}

// GET /api/v1/farms/:farmId/finance-score — get latest (or auto-compute)
router.get('/:farmId/finance-score', validateParamUUID('farmId'), asyncHandler(async (req, res) => {
  await verifyFarmProfileOwnership(req, req.params.farmId);
  const data = await service.getFinanceScore(req.params.farmId);
  res.json(data);
}));

// GET /api/v1/farms/:farmId/finance-summary — score + profile context
router.get('/:farmId/finance-summary', validateParamUUID('farmId'), asyncHandler(async (req, res) => {
  await verifyFarmProfileOwnership(req, req.params.farmId);
  const data = await service.getFinanceSummary(req.params.farmId);
  res.json(data);
}));

// POST /api/v1/farms/:farmId/finance-score/recalculate — force fresh computation
router.post('/:farmId/finance-score/recalculate', validateParamUUID('farmId'), asyncHandler(async (req, res) => {
  await verifyFarmProfileOwnership(req, req.params.farmId);
  const data = await service.computeFinanceScore(req.params.farmId);
  writeAuditLog({ userId: req.user.sub, action: 'finance_score_recalculated', details: { farmProfileId: req.params.farmId, score: data.score } }).catch(() => {});
  res.json(data);
}));

export default router;
