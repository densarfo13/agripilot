/**
 * System Monitoring Routes
 *
 * Lightweight real-time operational monitoring using the in-memory event store.
 * All events are published by opsLogger automatically — no extra instrumentation needed.
 *
 * Routes:
 *   GET /api/system/health  — extended health (DB latency, upload dir, active counts)
 *   GET /api/system/errors  — recent error/warn events + lifetime counters
 *
 * Permission: super_admin only (monitoring data must not leak to org-scoped roles).
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import prisma from '../../config/database.js';
import { checkUploadDirHealth } from '../../utils/uploadHealth.js';
import { getRecentEvents, getCounters, getMonitoringSummary } from '../../utils/eventStore.js';
import { isEmailConfigured, isSmsConfigured } from '../notifications/deliveryService.js';

const router = Router();
router.use(authenticate);
router.use(authorize('super_admin'));

// ─── GET /api/system/health ──────────────────────────────────
// Full system health: DB, uploads, event store summary, provider status

router.get('/health', asyncHandler(async (req, res) => {
  const dbStart = Date.now();
  let dbOk = true;
  let dbLatencyMs = null;
  let dbError = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (err) {
    dbOk = false;
    dbError = err.message;
  }

  const uploadHealth = checkUploadDirHealth();

  const [activeSeasons, farmerCount, userCount, pendingApprovals, failedNotifCount, recentFailedNotifs] = await Promise.all([
    prisma.farmSeason.count({ where: { status: 'active' } }).catch(() => null),
    prisma.farmer.count().catch(() => null),
    prisma.user.count({ where: { active: true } }).catch(() => null),
    prisma.farmer.count({ where: { registrationStatus: 'pending_approval' } }).catch(() => null),
    prisma.autoNotification.count({ where: { status: 'failed' } }).catch(() => null),
    prisma.autoNotification.groupBy({
      by: ['type'],
      where: { status: 'failed' },
      _count: { id: true },
    }).catch(() => []),
  ]);

  const monitoring = getMonitoringSummary();

  res.json({
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: {
      connected: dbOk,
      latencyMs: dbLatencyMs,
      error: dbError || undefined,
    },
    uploads: uploadHealth,
    providers: {
      email: isEmailConfigured() ? 'configured' : 'not_configured',
      sms: isSmsConfigured() ? 'configured' : 'not_configured',
    },
    platform: {
      activeSeasons,
      farmerCount,
      activeUsers: userCount,
      pendingApprovals,
    },
    notifications: {
      totalFailed: failedNotifCount,
      failedByType: recentFailedNotifs.map(r => ({ type: r.type, count: r._count.id })),
    },
    monitoring: {
      uptimeHours: monitoring.uptimeHours,
      startedAt: monitoring.startedAt,
      errorsLastHour: monitoring.lastHour.errors,
      warningsLastHour: monitoring.lastHour.warnings,
      errorsLast24h: monitoring.last24h.errors,
    },
  });
}));

// ─── GET /api/system/errors ──────────────────────────────────
// Recent error/warn events + lifetime counters
// Query params: ?limit=100&severity=error&category=auth

router.get('/errors', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const category = req.query.category || undefined;
  const severity = req.query.severity || undefined;
  // Default: show warn and above
  const minSeverity = req.query.minSeverity || (severity ? undefined : 'warn');

  const events = getRecentEvents({ limit, category, severity, minSeverity });
  const counters = getCounters();
  const summary = getMonitoringSummary();

  res.json({
    generatedAt: new Date().toISOString(),
    filters: { limit, category, severity, minSeverity },
    summary: {
      uptimeHours: summary.uptimeHours,
      errorsLastHour: summary.lastHour.errors,
      warningsLastHour: summary.lastHour.warnings,
      errorsLast24h: summary.last24h.errors,
      categoryCounts: summary.categoryCounts,
    },
    lifetimeCounters: counters,
    events,
  });
}));

export default router;
