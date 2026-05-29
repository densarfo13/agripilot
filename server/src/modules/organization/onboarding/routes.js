// server/src/modules/organization/onboarding/routes.js
//
// Wave 17 — Bulk farmer onboarding HTTP surface.
//
// This module exposes the Express routes that the bulk onboarding
// frontend talks to:
//
//   POST   /organization/onboarding/upload        — upload CSV
//   POST   /organization/onboarding/validate      — validate batch
//   POST   /organization/onboarding/import        — import batch
//   POST   /organization/onboarding/assign        — bulk assign
//   GET    /organization/onboarding/batches       — list batches (scoped)
//   GET    /organization/onboarding/batches/:id   — batch detail (scoped)
//
// The four write endpoints (upload / validate / import / assign)
// return HTTP 503 + PENDING_REASON until the supervised Prisma
// migration at server/prisma/_pending-migrations/bulk_onboarding_batches/
// is applied. The GET endpoints answer 200 with an empty list so
// the UI can render its empty state — every GET is scoped by
// organizationId so a user can never enumerate another org's
// data.
//
// Strict-rule audit
//   • No PII (phone / email / fullName) is ever logged.
//   • All write endpoints fail closed with a 503 + machine
//     readable PENDING_REASON so the client can show the right
//     "deploy required" message.
//   • Every endpoint requires authentication; org scoping is
//     re-checked here even though middleware also enforces it.

import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { asyncHandler } from '../../../middleware/asyncHandler.js';

const router = Router();

// All bulk-onboarding endpoints require an authenticated session.
router.use(authenticate);

// Roles that may operate the bulk-onboarding pipeline. Farmers /
// gardeners / growers / buyers are NEVER on this list — they
// must not even be able to call the upload endpoint.
const ALLOWED_ROLES = [
  'ngo_admin',
  'organization_admin',
  'field_officer',
  'admin',
  'super_admin',
];

// PENDING_REASON — the supervised Prisma migration for the
// EnrollmentBatch + EnrollmentBatchRow models has NOT been
// deployed yet, so we cannot accept writes. The frontend reads
// this code to render the correct banner.
const PENDING_REASON = 'bulk_onboarding_migration_pending';

const PENDING_PAYLOAD = Object.freeze({
  ok: false,
  reason: PENDING_REASON,
  detail:
    'Bulk onboarding writes are disabled until the supervised ' +
    'Prisma migration at server/prisma/_pending-migrations/' +
    'bulk_onboarding_batches/ is applied. Contact platform ops.',
});

function sendPending(res) {
  res.status(503).json(PENDING_PAYLOAD);
}

function resolveOrganizationId(req) {
  // The user object carries the organizationId on its session.
  // We never trust a query string for org scoping — it must come
  // from the authenticated principal.
  const fromUser =
    (req.user && (req.user.organizationId || req.user.orgId)) || null;
  return typeof fromUser === 'string' && fromUser ? fromUser : null;
}

// ── Write endpoints (all 503 until migration deploys) ─────────

// POST /organization/onboarding/upload — accept a CSV file.
router.post(
  '/upload',
  authorize(ALLOWED_ROLES),
  asyncHandler(async (_req, res) => {
    sendPending(res);
  })
);

// POST /organization/onboarding/validate — validate a batch.
router.post(
  '/validate',
  authorize(ALLOWED_ROLES),
  asyncHandler(async (_req, res) => {
    sendPending(res);
  })
);

// POST /organization/onboarding/import — import a validated batch.
router.post(
  '/import',
  authorize(ALLOWED_ROLES),
  asyncHandler(async (_req, res) => {
    sendPending(res);
  })
);

// POST /organization/onboarding/assign — bulk-assign program /
// cohort / field officer / region to every row in a batch.
router.post(
  '/assign',
  authorize(ALLOWED_ROLES),
  asyncHandler(async (_req, res) => {
    sendPending(res);
  })
);

// ── Read endpoints (org-scoped, always available) ─────────────

// GET /organization/onboarding/batches — list batches for the
// authenticated user's organization. The frontend uses this for
// the batches index page; the supervised migration is not yet
// applied so we return an empty list rather than 503 so the UI
// can render an empty state.
router.get(
  '/batches',
  authorize(ALLOWED_ROLES),
  asyncHandler(async (req, res) => {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(403).json({
        ok: false,
        reason: 'organization_scope_required',
      });
    }
    res.json({
      data: [],
      organizationId,
      pendingMigration: PENDING_REASON,
    });
  })
);

// GET /organization/onboarding/batches/:batchId — batch detail.
router.get(
  '/batches/:batchId',
  authorize(ALLOWED_ROLES),
  asyncHandler(async (req, res) => {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(403).json({
        ok: false,
        reason: 'organization_scope_required',
      });
    }
    res.json({
      data: null,
      organizationId,
      batchId: String(req.params.batchId || ''),
      pendingMigration: PENDING_REASON,
    });
  })
);

export { PENDING_REASON, ALLOWED_ROLES };
export default router;
