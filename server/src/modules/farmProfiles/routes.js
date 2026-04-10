import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID, parsePositiveInt, isValidUUID } from '../../middleware/validate.js';
import { idempotencyCheck } from '../../middleware/idempotency.js';
import { writeAuditLog } from '../audit/service.js';
import * as service from './service.js';
import prisma from '../../config/database.js';
import { opsEvent } from '../../utils/opsLogger.js';

const router = Router();
router.use(authenticate);

// ─── Resolve farmerId from authenticated user ──────────
// Farmers use their own farmerId; staff can pass ?farmerId= query param.
async function resolveFarmerId(req) {
  if (req.user.role === 'farmer') {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user.sub }, select: { id: true } });
    if (!farmer) {
      const err = new Error('Farmer profile not found for this user');
      err.statusCode = 404;
      throw err;
    }
    return farmer.id;
  }
  // Staff: require farmerId query param
  const farmerId = req.query.farmerId || req.body?.farmerId;
  if (!farmerId || !isValidUUID(farmerId)) {
    const err = new Error('farmerId is required (valid UUID)');
    err.statusCode = 400;
    throw err;
  }
  return farmerId;
}

// ─── Ownership guard ───────────────────────────────────
// Ensures farmer-role users can only access their own farm profiles.
async function verifyFarmProfileOwnership(req, farmProfileId) {
  if (req.user.role !== 'farmer') return; // staff can access any
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

// ─── Farm Profile endpoints ────────────────────────────

// POST /api/v1/farms — create farm profile (atomic setup)
router.post('/', idempotencyCheck, asyncHandler(async (req, res) => {
  const farmerId = await resolveFarmerId(req);

  // Use atomic setup for farmer-role users (onboarding flow) — validates all
  // required fields and creates profile + updates farmer in a single transaction.
  if (req.user.role === 'farmer') {
    // Inject farmerName if not provided — the onboarding sends it but guard anyway
    const body = { ...req.body };
    if (!body.farmerName) {
      const farmer = await prisma.farmer.findUnique({ where: { id: farmerId }, select: { fullName: true } });
      body.farmerName = farmer?.fullName || 'Farmer';
    }

    const { profile, farmProfileComplete } = await service.atomicFarmSetup(body, farmerId, req.user.sub);
    writeAuditLog({ userId: req.user.sub, action: 'farm_profile_created', details: { farmProfileId: profile.id, atomic: true } }).catch(() => {});
    opsEvent('workflow', 'atomic_farm_setup_completed', 'info', { farmerId, farmProfileId: profile.id, farmProfileComplete });

    return res.status(201).json({
      success: true,
      farmProfileComplete,
      nextRoute: '/home',
      profile,
    });
  }

  // Non-farmer (staff) — use standard createFarmProfile without atomic setup
  const profile = await service.createFarmProfile(req.body, farmerId);
  writeAuditLog({ userId: req.user.sub, action: 'farm_profile_created', details: { farmProfileId: profile.id } }).catch(() => {});
  res.status(201).json(profile);
}));

// GET /api/v1/farms — list farm profiles for farmer
router.get('/', asyncHandler(async (req, res) => {
  const farmerId = await resolveFarmerId(req);
  const page = parsePositiveInt(req.query.page, 1, 100);
  const limit = parsePositiveInt(req.query.limit, 20, 100);
  const result = await service.listFarmProfiles(farmerId, { page, limit });
  res.json(result);
}));

// GET /api/v1/farms/:farmId — get single farm profile
router.get('/:farmId', validateParamUUID('farmId'), asyncHandler(async (req, res) => {
  await verifyFarmProfileOwnership(req, req.params.farmId);
  const profile = await service.getFarmProfile(req.params.farmId);
  res.json(profile);
}));

// PATCH /api/v1/farms/:farmId — update farm profile
router.patch('/:farmId', validateParamUUID('farmId'), asyncHandler(async (req, res) => {
  await verifyFarmProfileOwnership(req, req.params.farmId);
  const profile = await service.updateFarmProfile(req.params.farmId, req.body);
  writeAuditLog({ userId: req.user.sub, action: 'farm_profile_updated', details: { farmProfileId: profile.id } }).catch(() => {});
  res.json(profile);
}));

// GET /api/v1/farms/:farmId/dashboard-summary
router.get('/:farmId/dashboard-summary', validateParamUUID('farmId'), asyncHandler(async (req, res) => {
  await verifyFarmProfileOwnership(req, req.params.farmId);
  const summary = await service.getDashboardSummary(req.params.farmId);
  res.json(summary);
}));

// ─── Recommendation History endpoints ──────────────────

// POST /api/v1/farms/:farmId/recommendations — save recommendation
router.post('/:farmId/recommendations', validateParamUUID('farmId'), idempotencyCheck, asyncHandler(async (req, res) => {
  await verifyFarmProfileOwnership(req, req.params.farmId);
  const rec = await service.createRecommendation(req.params.farmId, req.body);
  writeAuditLog({ userId: req.user.sub, action: 'recommendation_saved', details: { recommendationId: rec.id, farmProfileId: req.params.farmId } }).catch(() => {});
  res.status(201).json(rec);
}));

// GET /api/v1/farms/:farmId/recommendations — list recommendation history
router.get('/:farmId/recommendations', validateParamUUID('farmId'), asyncHandler(async (req, res) => {
  await verifyFarmProfileOwnership(req, req.params.farmId);
  const page = parsePositiveInt(req.query.page, 1, 100);
  const limit = parsePositiveInt(req.query.limit, 20, 100);
  const result = await service.listRecommendations(req.params.farmId, { page, limit });
  res.json(result);
}));

// PATCH /api/v1/farms/:farmId/recommendations/:recId — update status/note
router.patch('/:farmId/recommendations/:recId', validateParamUUID('farmId'), validateParamUUID('recId'), asyncHandler(async (req, res) => {
  await verifyFarmProfileOwnership(req, req.params.farmId);
  const rec = await service.updateRecommendation(req.params.recId, req.body);
  writeAuditLog({ userId: req.user.sub, action: 'recommendation_updated', details: { recommendationId: rec.id, status: rec.status } }).catch(() => {});
  res.json(rec);
}));

// POST /api/v1/farms/:farmId/recommendations/:recId/feedback — submit feedback on a recommendation
router.post('/:farmId/recommendations/:recId/feedback', validateParamUUID('farmId'), validateParamUUID('recId'), asyncHandler(async (req, res) => {
  await verifyFarmProfileOwnership(req, req.params.farmId);
  const { helpful, note } = req.body;
  if (typeof helpful !== 'boolean') {
    return res.status(400).json({ error: 'helpful (boolean) is required' });
  }
  // Verify rec belongs to this farm
  const rec = await prisma.recommendationRecord.findFirst({
    where: { id: req.params.recId, farmProfileId: req.params.farmId },
    select: { id: true },
  });
  if (!rec) return res.status(404).json({ error: 'Recommendation not found' });

  const feedback = await prisma.recommendationFeedback.create({
    data: {
      recommendationId: req.params.recId,
      userId: req.user.sub,
      helpful,
      note: note || null,
    },
  });
  res.status(201).json({ id: feedback.id, helpful: feedback.helpful });
}));

export default router;
