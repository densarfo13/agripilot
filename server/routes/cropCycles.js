/**
 * cropCycles.js — farmer-facing crop cycle + task plan endpoints.
 *
 *   POST   /api/v2/crop-cycles                  — start a cycle from a recommendation
 *   GET    /api/v2/crop-cycles                  — list the farmer's cycles
 *   GET    /api/v2/crop-cycles/:id              — single cycle detail + tasks
 *   POST   /api/v2/crop-cycles/:id/status       — update lifecycle status
 *   POST   /api/v2/crop-cycles/tasks/:taskId/complete  — mark task done
 *   GET    /api/v2/farmer/today                 — Today feed
 */
import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireAuth, blockRoles } from '../middleware/rbac.js';
import {
  createCycleFromRecommendation,
  listCyclesForUser,
  getCycleDetail,
  completeTask,
  updateCycleStatus,
  getTodayFeedForUser,
} from '../src/services/cropCycles/cropCycleService.js';

// Crop-cycle routes are farmer-authored. Buyers and investors are
// role-disabled here until their flows are built so we don't leak
// the wrong surface area when those roles are provisioned later.
const FARMER_SCOPE = [authenticate, requireAuth, blockRoles('buyer', 'investor')];

const router = express.Router();

function handleErr(res, err) {
  const status = err?.status || 500;
  const code = err?.code || 'internal_error';
  if (status >= 500) console.error('[cropCycles]', err);
  res.status(status).json({ error: code });
}

// ─── POST /api/v2/crop-cycles ───────────────────────────────
router.post('/', ...FARMER_SCOPE, express.json(), async (req, res) => {
  try {
    const { farmProfileId, recommendation, plantedDate } = req.body || {};
    const detail = await createCycleFromRecommendation({
      user: req.user, farmProfileId, recommendation, plantedDate,
    });
    res.status(201).json(detail);
  } catch (err) { handleErr(res, err); }
});

// ─── GET /api/v2/crop-cycles ───────────────────────────────
router.get('/', ...FARMER_SCOPE, async (req, res) => {
  try { res.json(await listCyclesForUser({ user: req.user })); }
  catch (err) { handleErr(res, err); }
});

// ─── GET /api/v2/crop-cycles/:id ───────────────────────────
router.get('/:id', ...FARMER_SCOPE, async (req, res) => {
  try { res.json(await getCycleDetail({ user: req.user, cycleId: req.params.id })); }
  catch (err) { handleErr(res, err); }
});

// ─── POST /api/v2/crop-cycles/:id/status ───────────────────
router.post('/:id/status', ...FARMER_SCOPE, express.json(), async (req, res) => {
  try {
    res.json(await updateCycleStatus({
      user: req.user,
      cycleId: req.params.id,
      status: (req.body?.status || '').toLowerCase(),
      reason: req.body?.reason,
    }));
  } catch (err) { handleErr(res, err); }
});

// ─── POST /api/v2/crop-cycles/tasks/:taskId/complete ───────
router.post('/tasks/:taskId/complete', ...FARMER_SCOPE, express.json(), async (req, res) => {
  try {
    res.json(await completeTask({
      user: req.user, taskId: req.params.taskId, note: req.body?.note,
    }));
  } catch (err) { handleErr(res, err); }
});

export default router;

// ─── Companion Today-feed router (mounted at /api/v2/farmer) ──
export function createFarmerTodayRouter() {
  const r = express.Router();
  r.get('/today', ...FARMER_SCOPE, async (req, res) => {
    try { res.json(await getTodayFeedForUser({ user: req.user })); }
    catch (err) { handleErr(res, err); }
  });
  return r;
}
