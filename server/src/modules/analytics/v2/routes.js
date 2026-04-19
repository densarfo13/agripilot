/**
 * routes.js (v2 analytics) — Express router that exposes the
 * product-intelligence ingest and reports endpoints.
 *
 * Exposed routes:
 *   POST /events                      — batch ingest (auth required)
 *   GET  /reports/product-intelligence — full PI report (admin)
 *   GET  /reports/onboarding          — onboarding report (admin)
 *   GET  /reports/recommendations     — recommendation report (admin)
 *   GET  /reports/trust               — trust report (admin)
 *   GET  /health                      — cheap liveness probe
 *
 * Factory pattern so the caller passes persistence functions:
 *
 *   import { createV2AnalyticsRouter } from
 *     './modules/analytics/v2/routes.js';
 *   import { inMemoryStore } from
 *     './modules/analytics/v2/reportsService.js';
 *
 *   const store = inMemoryStore();
 *   app.use('/api/v2/analytics',
 *     createV2AnalyticsRouter({ store, authMiddleware, adminMiddleware }));
 *
 * Swap `store` for your Prisma-backed version in production.
 */

import { Router } from 'express';
import { ingestAnalyticsBatch } from './ingestService.js';
import {
  generateOnboardingReport,
  generateRecommendationReport,
  generateTrustReport,
  generateFullProductReport,
} from './reportsService.js';

function asyncWrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function noop(_req, _res, next) { next(); }

/**
 * @param {object} opts
 * @param {{ persistFn, loadUsers, loadFeedbackHistory }} opts.store
 * @param {import('express').RequestHandler} [opts.authMiddleware]
 * @param {import('express').RequestHandler} [opts.adminMiddleware]
 * @param {number} [opts.maxBatchSize]
 */
export function createV2AnalyticsRouter({
  store,
  authMiddleware  = null,
  adminMiddleware = null,
  maxBatchSize    = 200,
} = {}) {
  if (!store || typeof store.persistFn !== 'function') {
    throw new Error('createV2AnalyticsRouter: store.persistFn is required');
  }
  const router = Router();
  const auth  = authMiddleware  || noop;
  const admin = adminMiddleware || noop;

  router.get('/health', (_req, res) => res.json({ ok: true, layer: 'v2-analytics' }));

  // ─── INGEST ──────────────────────────────────────────
  router.post('/events', auth, asyncWrap(async (req, res) => {
    const body = req.body || {};
    const events = Array.isArray(body.events) ? body.events
                 : Array.isArray(body)        ? body
                 : null;
    if (!events) {
      return res.status(400).json({ error: 'events array required (body.events or bare array)' });
    }
    if (events.length > maxBatchSize) {
      return res.status(413).json({ error: `batch too large (max ${maxBatchSize})` });
    }
    const userId = req.user?.sub || req.user?.id || null;

    const result = await ingestAnalyticsBatch({
      events,
      userId,
      persistFn: store.persistFn,
    });
    res.json(result);
  }));

  // ─── REPORTS ─────────────────────────────────────────
  router.get('/reports/product-intelligence', auth, admin, asyncWrap(async (req, res) => {
    const report = await generateFullProductReport({
      loadUsers: store.loadUsers,
      loadFeedbackHistory: store.loadFeedbackHistory,
      options: req.query || {},
    });
    res.json(report);
  }));

  router.get('/reports/onboarding', auth, admin, asyncWrap(async (req, res) => {
    const report = await generateOnboardingReport({
      loadUsers: store.loadUsers,
      options: req.query || {},
    });
    res.json(report);
  }));

  router.get('/reports/recommendations', auth, admin, asyncWrap(async (req, res) => {
    const report = await generateRecommendationReport({
      loadUsers: store.loadUsers,
      loadFeedbackHistory: store.loadFeedbackHistory,
      options: req.query || {},
    });
    res.json(report);
  }));

  router.get('/reports/trust', auth, admin, asyncWrap(async (req, res) => {
    const report = await generateTrustReport({
      loadUsers: store.loadUsers,
      options: req.query || {},
    });
    res.json(report);
  }));

  return router;
}

export default createV2AnalyticsRouter;
