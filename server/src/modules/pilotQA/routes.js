/**
 * Pilot QA Checklist Routes
 *
 * Internal pilot readiness + field validation tracking.
 * Accessible only to super_admin and institutional_admin.
 * institutional_admin is org-scoped — cannot access other orgs' data.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import * as service from './service.js';

const router = Router();

// All routes: require authentication + org context
router.use(authenticate);
router.use(extractOrganization);

const QA_ROLES = ['super_admin', 'institutional_admin'];

// Helper: resolve org scope from request.
// super_admin may optionally pass ?orgId= to scope to a specific org; otherwise unscoped.
// institutional_admin is always forced to their own org.
function resolveOrgId(req, queryOrBodyOrgId) {
  if (req.user.role === 'institutional_admin') {
    return req.organizationId ?? null;
  }
  // super_admin: use provided org ID or null (global view)
  // Guard against duplicate query params sending an array
  const val = Array.isArray(queryOrBodyOrgId) ? queryOrBodyOrgId[0] : queryOrBodyOrgId;
  return val ?? null;
}

// ─── GET /api/pilot-qa/checklist ──────────────────────────
// Returns all 51 checklist items with stored + auto-derived status.
router.get('/checklist', authorize(...QA_ROLES), asyncHandler(async (req, res) => {
  const organizationId = resolveOrgId(req, req.query.orgId);
  const items = await service.getChecklist({ organizationId });
  res.json(items);
}));

// ─── PATCH /api/pilot-qa/checklist/:itemKey ───────────────
// Upsert a checklist item's status and/or notes.
router.patch('/checklist/:itemKey', authorize(...QA_ROLES), asyncHandler(async (req, res) => {
  const { status, notes } = req.body;

  // Validate status if provided
  const VALID_STATUSES = ['not_started', 'pass', 'fail', 'blocked', 'not_applicable'];
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const organizationId = resolveOrgId(req, req.body.organizationId);

  const item = await service.upsertChecklistItem({
    itemKey: decodeURIComponent(req.params.itemKey),
    organizationId,
    status,
    notes,
    updatedById: req.user.sub,
  });

  res.json(item);
}));

// ─── GET /api/pilot-qa/health ─────────────────────────────
// Live org-scoped health indicators from real system data.
router.get('/health', authorize(...QA_ROLES), asyncHandler(async (req, res) => {
  const organizationId = resolveOrgId(req, req.query.orgId);
  const data = await service.getHealthIndicators({ organizationId });
  res.json(data);
}));

// ─── GET /api/pilot-qa/report ─────────────────────────────
// Pilot validation report summary (stats, risks, top failures).
router.get('/report', authorize(...QA_ROLES), asyncHandler(async (req, res) => {
  const organizationId = resolveOrgId(req, req.query.orgId);
  const data = await service.getReport({ organizationId });
  res.json(data);
}));

export default router;
