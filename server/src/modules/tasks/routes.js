/**
 * Task System Routes
 *
 * GET /api/tasks            — tasks for current user (role-scoped)
 * GET /api/tasks/summary    — task counts and high-priority list
 *
 * Permission matrix:
 *   farmer           — own tasks only (via farmerId from farmerProfile)
 *   field_officer    — assigned-farmer tasks
 *   reviewer         — assigned-application tasks
 *   institutional_admin — org-scoped admin tasks
 *   super_admin      — full admin tasks (cross-org or scoped)
 *   investor_viewer  — BLOCKED (no tasks exposed)
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import { getTasksForUser, getTaskSummary } from './service.js';
import prisma from '../../config/database.js';

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

// Helper: resolve farmerId for farmer-role users
async function resolveFarmerId(userId) {
  const farmer = await prisma.farmer.findFirst({
    where: { userId },
    select: { id: true },
  });
  return farmer?.id || null;
}

// ─── GET /api/tasks ────────────────────────────────────────

router.get('/',
  authorize('farmer', 'field_officer', 'reviewer', 'institutional_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { role, sub: userId } = req.user;
    const organizationId = req.organizationId || null;

    let farmerId = null;
    if (role === 'farmer') {
      farmerId = await resolveFarmerId(userId);
      if (!farmerId) {
        return res.json([]); // no farmer profile yet
      }
    }

    const tasks = await getTasksForUser({ userId, role, organizationId, farmerId });
    res.json(tasks);
  }));

// ─── GET /api/tasks/summary ────────────────────────────────

router.get('/summary',
  authorize('farmer', 'field_officer', 'reviewer', 'institutional_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { role, sub: userId } = req.user;
    const organizationId = req.organizationId || null;

    let farmerId = null;
    if (role === 'farmer') {
      farmerId = await resolveFarmerId(userId);
    }

    const summary = await getTaskSummary({ userId, role, organizationId, farmerId });
    res.json(summary);
  }));

export default router;
