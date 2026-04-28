/**
 * ingest/routes.js — POST /ingest + GET /health for the
 * client-event ingestion path.
 *
 *   POST /api/ingest        — batch upload (idempotent)
 *   GET  /api/ingest/health — { status: 'ok' }
 *
 * Strict-rule audit
 *   * Auth: requires `authenticate` so only logged-in farmers
 *     (or NGO operators batch-pushing on their behalf) can
 *     ingest. The route surface treats the request user as
 *     the source-of-truth for `appVersion` / context — the
 *     event payload itself can carry farmerId for batches a
 *     field agent is uploading.
 *   * Rate-limit: re-uses the global apiLimiter mounted in
 *     app.js so we don't burn battery on a buggy client
 *     hammering the server.
 *   * Idempotent: per-event upserts via the service layer.
 *   * Observable: logs batch size + accepted / duplicates /
 *     rejected counts via opsEvent so ops can grep ingest
 *     traffic without DB queries.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { ingestLimiter } from '../../middleware/rateLimiters.js';
import prisma from '../../config/database.js';
import { opsEvent } from '../../utils/opsLogger.js';
import { ingestEvents, MAX_BATCH_SIZE } from './service.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', layer: 'ingest', serverTime: new Date().toISOString() });
});

/**
 * POST /api/ingest
 *
 * Body:
 *   {
 *     events:     Array<{ id, type, createdAt, payload?, farmerId?, farmId?, offline? }>,
 *     clientTime: '<ISO timestamp>',
 *     appVersion: '<semver>',
 *   }
 *
 * Response:
 *   {
 *     accepted:   <count>,
 *     duplicates: <count>,
 *     rejected:   <count>,
 *     serverTime: '<ISO>',
 *   }
 */
router.post('/', ingestLimiter, authenticate, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const events = Array.isArray(body.events) ? body.events : [];
  const appVersion = typeof body.appVersion === 'string'
    ? body.appVersion.slice(0, 32)   // hard cap on the column
    : null;
  // Org scoping: the value persisted to the DB ALWAYS comes
  // from the authenticated user. The client cannot smuggle a
  // different org via payload.orgId (the validator
  // hard-rejects mismatches; the route never reads body.orgId).
  const orgId = req.user && req.user.organizationId
    ? String(req.user.organizationId)
    : null;

  if (events.length === 0) {
    return res.json({
      accepted: 0, duplicates: 0, skipped: 0, rejected: 0,
      serverTime: new Date().toISOString(),
    });
  }
  if (events.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      error: `Batch too large; max ${MAX_BATCH_SIZE} events per request.`,
      code:  'batch_too_large',
    });
  }

  const result = await ingestEvents({
    events,
    appVersion,
    orgId,
    prismaClient: prisma,
  });

  // Observability: structured ops event so a Railway log search
  // for "ingest_batch" surfaces every ingest call with its
  // accepted/duplicate/rejected breakdown. orgId tagged so
  // per-org ingest patterns are queryable.
  try {
    opsEvent('ingest', 'ingest_batch',
      result.rejected > 0 ? 'warn' : 'info', {
        userId:     req.user && req.user.sub ? req.user.sub : null,
        orgId,
        appVersion,
        size:       events.length,
        accepted:   result.accepted,
        duplicates: result.duplicates,
        rejected:   result.rejected,
      });
  } catch { /* logger never blocks the response */ }

  // The brief defines the response as { accepted, duplicates,
  // skipped, serverTime }. We expose `rejected` (= the original
  // term we used) AS `skipped` per the spec wording so
  // dashboards reading this field see the spec's name.
  res.json({
    accepted:   result.accepted,
    duplicates: result.duplicates,
    skipped:    result.rejected,
    rejected:   result.rejected,   // alias, kept for back-compat
    serverTime: new Date().toISOString(),
  });
}));

export default router;
