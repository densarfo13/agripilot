// server/src/modules/farmers/partnerImportRoutes.js
//
// Wave 27 — Honest 503 stub for the partner-import HTTP surface.
//
// The Admin "Import Farmers" CSV page (src/pages/AdminImportFarmersPage.jsx)
// posts to:
//
//   POST   /api/v2/farmers/partner-import
//   PATCH  /api/v2/farmers/:id/partner-import
//
// Neither endpoint existed pre-wave-27 — the client received a
// generic "Route not found" error and surfaced "save_failed" to
// the NGO operator. The founder-readiness audit (Part 1 N2) flagged
// this as a critical NGO-adoption blocker.
//
// The real implementation depends on the supervised Prisma
// migration at server/prisma/_pending-migrations/bulk_onboarding_batches/
// that introduces EnrollmentBatch + EnrollmentBatchRow. Until that
// deploys, both endpoints return HTTP 503 with the same machine-
// readable envelope the bulk-onboarding writes use — so the
// frontend can render a single "deploy required" banner regardless
// of which path the operator chose.
//
// Strict-rule audit
//   • No PII (phone / email / fullName) in any log line.
//   • Honest failure: 503 + machine-readable reason. NOT a
//     generic 404 or 500.
//   • Authentication enforced before any read.
//   • Role allowlist matches the bulk-onboarding pipeline.
//   • Idempotent: this file replaces nothing; it adds two routes.

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

// Same allowlist as server/src/modules/organization/onboarding/routes.js
// — partner-import is a write surface and farmers/gardeners/buyers
// must not even be able to call it.
const ALLOWED_ROLES = [
  'ngo_admin',
  'organization_admin',
  'field_officer',
  'admin',
  'super_admin',
];

const PENDING_REASON = 'partner_import_migration_pending';

const PENDING_PAYLOAD = Object.freeze({
  ok: false,
  reason: PENDING_REASON,
  detail:
    'Partner-import writes are disabled until the supervised ' +
    'Prisma migration at server/prisma/_pending-migrations/' +
    'bulk_onboarding_batches/ is applied. Contact platform ops.',
});

function sendPending(res) {
  res.status(503).json(PENDING_PAYLOAD);
}

router.use(authenticate);

// POST /api/v2/farmers/partner-import — create row from CSV adapter.
router.post('/partner-import',
  authorize(...ALLOWED_ROLES),
  (req, res) => {
    // We deliberately do NOT log the request body — CSV rows carry
    // farmer phone + name fields that count as PII. The frontend
    // will surface PENDING_REASON to the operator.
    sendPending(res);
  });

// PATCH /api/v2/farmers/:id/partner-import — update existing row.
router.patch('/:id/partner-import',
  authorize(...ALLOWED_ROLES),
  (req, res) => {
    sendPending(res);
  });

export default router;
export { PENDING_REASON };
