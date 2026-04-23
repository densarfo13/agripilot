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
import { writeAuditLog } from '../audit/service.js';

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

// ─── Task completion event sink (offline sync target) ─────────
//
// The client's offline sync transport (src/lib/sync/transport.js)
// POSTs queued task_complete / task_skip / task_uncomplete actions
// here. Events are persisted as AuditLog rows with action codes
// 'task.completed' | 'task.uncompleted' | 'task.skipped' so the
// org pilot-metrics aggregator can read them without a new
// Prisma model.
//
// Dedup uses the Idempotency-Key header the transport sets from
// offlineQueue action.id — duplicates return 409 { error:
// 'duplicate' } which the sync engine treats as synced.

export async function findDuplicateTaskEvent(action, idempotencyKey) {
  if (!idempotencyKey || !prisma?.auditLog?.findMany) return null;
  // Can't portably filter on JSON fields across DBs; scan the
  // last 200 rows of this action within the past 14d.
  const rows = await prisma.auditLog.findMany({
    where:   { action,
               createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
    take:    200,
    select:  { id: true, details: true },
  });
  for (const r of rows) {
    const d = r.details;
    const meta = typeof d === 'string' ? (() => {
      try { return JSON.parse(d); } catch { return null; }
    })() : (d && typeof d === 'object' ? d : null);
    if (meta && meta.idempotencyKey === idempotencyKey) return r;
  }
  return null;
}

async function resolveFarmerScope(userId) {
  if (!userId || !prisma?.farmer?.findFirst) return null;
  return prisma.farmer.findFirst({
    where:  { userId },
    select: { id: true, organizationId: true },
  });
}

export async function writeTaskEvent(req, action, extraDetails = {}) {
  const { farmId, templateId } = req.body || {};
  if (!templateId) {
    return { status: 400, body: { error: 'missing_template_id' } };
  }
  const idempotencyKey = req.headers['idempotency-key']
                      || req.headers['Idempotency-Key']
                      || null;
  if (idempotencyKey) {
    const dup = await findDuplicateTaskEvent(action, idempotencyKey);
    if (dup) return { status: 409, body: { error: 'duplicate', id: dup.id } };
  }
  const farmer = await resolveFarmerScope(req.user && req.user.sub);
  const row = await writeAuditLog({
    userId:         req.user && req.user.sub,
    organizationId: (farmer && farmer.organizationId) || null,
    action,
    details: {
      farmId:     farmId || null,
      templateId,
      farmerId:   farmer ? farmer.id : null,
      source:     'offline_sync',
      idempotencyKey,
      ...extraDetails,
    },
    ipAddress: req.ip,
  });
  return { status: 200, body: { ok: true, id: row && row.id } };
}

router.post('/completed',
  authorize('farmer', 'admin', 'super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const out = await writeTaskEvent(req, 'task.completed', {
      completedAt: (req.body && req.body.completedAt) || new Date().toISOString(),
    });
    return res.status(out.status).json(out.body);
  }));

router.delete('/completed',
  authorize('farmer', 'admin', 'super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const out = await writeTaskEvent(req, 'task.uncompleted', {
      uncompletedAt: (req.body && req.body.uncompletedAt) || new Date().toISOString(),
    });
    return res.status(out.status).json(out.body);
  }));

router.post('/skipped',
  authorize('farmer', 'admin', 'super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const out = await writeTaskEvent(req, 'task.skipped', {
      skippedAt: (req.body && req.body.skippedAt) || new Date().toISOString(),
    });
    return res.status(out.status).json(out.body);
  }));

export default router;
