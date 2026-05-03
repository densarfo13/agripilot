/**
 * events/routes.js — soft-launch monitoring endpoints.
 *
 *   POST /api/events            — single OR batched event ingest
 *   POST /api/errors            — crash / app_error ingest
 *   GET  /api/admin/metrics     — admin-only aggregation view
 *
 * Request shape (POST /api/events)
 *   Single:
 *     { name: 'task_completed', payload: { taskId, … }, timestamp? }
 *   Batched:
 *     { events: [{name, payload}, …] }    (max 100 per batch)
 *
 * Request shape (POST /api/errors)
 *   { message, stack?, surface?, componentStack?, route?, userAgent?, context? }
 *
 * Response shapes
 *   POST /api/events   → { accepted, duplicates, rejected, serverTime }
 *   POST /api/errors   → { accepted, id, serverTime }
 *   GET  /api/admin/metrics → { …metrics }, see service.buildMetrics
 *
 * Strict-rule audit
 *   • Every body validated through Zod before persistence.
 *   • POST /api/events accepts an OPTIONAL token (anonymous
 *     events ARE allowed because the boot-time `app_open` /
 *     `language_changed` events fire before login). The route
 *     persists `farmerId: null` for anonymous events; admin
 *     metrics see them in the WAU bucket but not the user-id
 *     set.
 *   • POST /api/errors REQUIRES auth — crash payloads carry
 *     enough fingerprint that an unauthenticated flood would
 *     poison the metrics.
 *   • GET /api/admin/metrics is gated by authenticate +
 *     authorize(admin / super_admin / institutional_admin /
 *     platform_admin). Cross-org filter applied implicitly via
 *     the existing extractOrganization middleware.
 *   • Rate-limited via the existing `ingestLimiter` (events) +
 *     a tighter cap on errors so a renderloop crash bombarding
 *     the endpoint can't take the table down.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ingestLimiter } from '../../middleware/rateLimiters.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import { opsEvent } from '../../utils/opsLogger.js';
import prisma from '../../config/database.js';
import {
  eventSchema, eventBatchSchema, errorSchema, metricsQuerySchema,
  toClientEventRow,
} from './schemas.js';
import { persistEvents, persistError, buildMetrics } from './service.js';

const router = Router();

// Tighter limiter for /errors — a crash loop can fire many
// times per second. 60/min/IP is enough for real users while
// still bounding a runaway client.
const errorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many errors reported. Please slow down.' },
});

// Optional-auth helper — populates req.user when a valid JWT is
// present, but does NOT fail-closed when it's missing. Used by
// the events endpoint so anonymous boot-time events still land.
function optionalAuthenticate(req, res, next) {
  const hasHeader = !!(req.headers && req.headers.authorization);
  const hasCookie = !!(req.cookies && req.cookies.access_token);
  if (!hasHeader && !hasCookie) return next();
  return authenticate(req, res, (err) => {
    // If authenticate failed, do NOT block the request — just
    // proceed without req.user. The route still ingests the
    // event but persists farmerId: null.
    if (err) return next();
    next();
  });
}

// ─── POST /api/events ────────────────────────────────────
//
// Accepts a single event OR a batch. Both shapes route to
// `persistEvents`.
router.post('/events',
  ingestLimiter,
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    // Try batch shape first; if it fails, try single. Either
    // success path produces a normalized rows[] array.
    let rows = [];
    let validatedShape = null;

    const batchTry = eventBatchSchema.safeParse(body);
    if (batchTry.success) {
      validatedShape = 'batch';
      rows = batchTry.data.events;
    } else {
      const singleTry = eventSchema.safeParse(body);
      if (!singleTry.success) {
        return res.status(400).json({
          error: 'Invalid event payload',
          // Surface only the first issue path so we don't leak
          // the entire schema shape.
          field: (singleTry.error.issues[0] && singleTry.error.issues[0].path && singleTry.error.issues[0].path.join('.')) || null,
          reason: (singleTry.error.issues[0] && singleTry.error.issues[0].message) || 'Validation failed',
        });
      }
      validatedShape = 'single';
      rows = [singleTry.data];
    }

    const ctx = {
      userId:     (req.user && (req.user.sub || req.user.id)) || null,
      orgId:      (req.user && req.user.organizationId) || null,
      ip:         req.ip,
      appVersion: typeof req.headers['x-app-version'] === 'string'
        ? req.headers['x-app-version'].slice(0, 32)
        : null,
    };
    const persistRows = rows.map((r) => toClientEventRow(r, ctx));

    const result = await persistEvents(prisma, persistRows);

    try {
      opsEvent('events', 'ingest_batch', 'info', {
        shape:      validatedShape,
        accepted:   result.accepted,
        duplicates: result.duplicates,
        rejected:   result.rejected,
        userId:     ctx.userId || null,
      });
    } catch { /* never block the response on telemetry */ }

    return res.json({
      accepted:   result.accepted,
      duplicates: result.duplicates,
      rejected:   result.rejected,
      serverTime: new Date().toISOString(),
    });
  }),
);

// ─── POST /api/errors ────────────────────────────────────
//
// Auth-required. Persists as `type='app_error'` in the same
// client_events table so the metrics aggregator picks it up.
router.post('/errors',
  errorLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = errorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error:  'Invalid error payload',
        field:  (parsed.error.issues[0] && parsed.error.issues[0].path && parsed.error.issues[0].path.join('.')) || null,
        reason: (parsed.error.issues[0] && parsed.error.issues[0].message) || 'Validation failed',
      });
    }
    const ctx = {
      userId:     (req.user && (req.user.sub || req.user.id)) || null,
      orgId:      (req.user && req.user.organizationId) || null,
      appVersion: typeof req.headers['x-app-version'] === 'string'
        ? req.headers['x-app-version'].slice(0, 32)
        : null,
    };
    const result = await persistError(prisma, parsed.data, ctx);

    try {
      opsEvent('events', 'error_logged', result.accepted > 0 ? 'warn' : 'error', {
        accepted:  result.accepted,
        rejected:  result.rejected,
        message:   parsed.data.message.slice(0, 80),
        surface:   parsed.data.surface || null,
        route:     parsed.data.route || null,
        userId:    ctx.userId || null,
      });
    } catch { /* never block */ }

    return res.json({
      accepted:   result.accepted,
      id:         result.id,
      serverTime: new Date().toISOString(),
    });
  }),
);

// ─── GET /api/admin/metrics ──────────────────────────────
//
// Admin-only aggregation view. Reads the client_events table
// directly; output mirrors the frontend's MonitoringDashboardPage
// shape so admins see consistent numbers across surfaces.
router.get('/admin/metrics',
  authenticate,
  authorize('super_admin', 'institutional_admin', 'admin', 'platform_admin'),
  extractOrganization,
  asyncHandler(async (req, res) => {
    const parsed = metricsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid metrics query' });
    }
    const metrics = await buildMetrics(prisma, { windowDays: parsed.data.windowDays });
    return res.json(metrics);
  }),
);

export default router;
