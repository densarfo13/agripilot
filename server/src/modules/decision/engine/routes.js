/**
 * routes.js (decision engine) — Express router factory for the
 * decision-engine surface. Mounted at /api/v2/decision.
 *
 *   GET  /health           — cheap probe
 *   GET  /rules            — list actionability rules (admin)
 *   POST /extract-signals  — turn events[] into signal shapes (admin)
 *   POST /snapshot         — full DecisionEngineSnapshot for a user
 *   POST /journey          — just the JourneyHealthSnapshot
 *   POST /pipeline/recommend — run applyRecommendationDecisionPipeline
 *                              (admin debug tool)
 *   POST /reasons/append   — persist a reason snapshot
 *   GET  /reasons          — read-back (admin)
 *
 * Factory dependencies:
 *   reasonStore         — from reasonHistoryStore.js
 *   loadUserEvents      — (userId, opts) ⇒ Promise<Event[]>
 *   baseRecommendFn     — optional, used by /pipeline/recommend
 *   authMiddleware      — optional (default no-op)
 *   adminMiddleware     — optional (default no-op)
 */

import { Router } from 'express';

import { extractSignalsFromEvents } from '../signalExtractor.js';
import {
  buildDecisionEngineSnapshot,
  buildPipelineTraceReport,
} from '../../../services/decision/decisionReportingService.js';
import { applyRecommendationDecisionPipeline } from '../../../services/decision/decisionPipeline.js';
import { listActionabilityRules } from '../../../services/decision/actionabilityService.js';
import { buildJourneyHealthSnapshot } from '../../../services/decision/journeyHealthService.js';

function asyncWrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
function noop(_req, _res, next) { next(); }

export function createDecisionEngineRouter({
  reasonStore = null,
  loadUserEvents = null,
  baseRecommendFn = null,
  authMiddleware = null,
  adminMiddleware = null,
} = {}) {
  const router = Router();
  const auth  = authMiddleware  || noop;
  const admin = adminMiddleware || noop;

  router.get('/health', (_req, res) =>
    res.json({ ok: true, layer: 'decision-engine' }));

  router.get('/rules', auth, admin, (_req, res) => {
    res.json({ rules: listActionabilityRules() });
  });

  router.post('/extract-signals', auth, admin, asyncWrap(async (req, res) => {
    const events = Array.isArray(req.body?.events) ? req.body.events : null;
    if (!events) return res.status(400).json({ error: 'events[] required' });
    const out = extractSignalsFromEvents(events, {
      userId: req.body?.userId || null,
      now:    req.body?.now || Date.now(),
    });
    res.json(out);
  }));

  router.post('/snapshot', auth, asyncWrap(async (req, res) => {
    const body = req.body || {};
    const now  = Number(body.now) || Date.now();
    const userId = body.userId || req.user?.sub || req.user?.id || null;

    let events = Array.isArray(body.events) ? body.events : null;
    if (!events && userId && typeof loadUserEvents === 'function') {
      events = (await loadUserEvents(userId, { since: body.since })) || [];
    }
    events = events || [];

    const { signalsByType, signalsByContext } =
      extractSignalsFromEvents(events, { userId, now });

    let reasonHistory = [];
    if (reasonStore && typeof reasonStore.loadFor === 'function') {
      const ctxKey = userId ? `user:${userId}` : (body.contextKey || null);
      reasonHistory = await reasonStore.loadFor(ctxKey, { lookbackMs: body.lookbackMs });
    }

    const snapshot = buildDecisionEngineSnapshot({
      events,
      signalsByType,
      signalsByContext,
      reasonHistory,
      confidences: body.confidences || {},
      contextKey: body.contextKey || (userId ? `user:${userId}` : null),
      now,
    });
    res.json(snapshot);
  }));

  router.post('/journey', auth, asyncWrap(async (req, res) => {
    const events = Array.isArray(req.body?.events) ? req.body.events : null;
    if (!events) return res.status(400).json({ error: 'events[] required' });
    res.json(buildJourneyHealthSnapshot(events, { now: req.body?.now }));
  }));

  router.post('/pipeline/recommend', auth, admin, asyncWrap(async (req, res) => {
    const engine = baseRecommendFn || ((ctx) => ctx.baseScores || {});
    const result = await applyRecommendationDecisionPipeline({
      ...req.body,
      baseEngine: async () => {
        if (req.body?.baseScores) return req.body.baseScores;
        return await engine(req.body || {});
      },
    });
    res.json(buildPipelineTraceReport(result));
  }));

  router.post('/reasons/append', auth, asyncWrap(async (req, res) => {
    if (!reasonStore) return res.status(501).json({ error: 'no reason store configured' });
    const body = req.body || {};
    if (!body.reason) return res.status(400).json({ error: 'reason required' });
    await reasonStore.append({
      ...body,
      timestamp: Number(body.timestamp) || Date.now(),
    });
    res.json({ appended: true });
  }));

  router.get('/reasons', auth, admin, asyncWrap(async (req, res) => {
    if (!reasonStore) return res.status(501).json({ error: 'no reason store configured' });
    const rows = await reasonStore.loadFor(req.query.contextKey || null, {
      lookbackMs: Number(req.query.lookbackMs) || undefined,
      since:      Number(req.query.since) || undefined,
    });
    res.json({ rows });
  }));

  return router;
}

export default createDecisionEngineRouter;
