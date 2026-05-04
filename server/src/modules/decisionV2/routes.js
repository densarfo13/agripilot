/**
 * decisionV2/routes.js — REST endpoints for Decision Engine v2.
 *
 *   GET  /api/decision/today            — primary daily decision
 *   POST /api/decision/complete         — record completion
 *   POST /api/decision/outcome          — outcome feedback (D+2/D+3)
 *   GET  /api/decision/history          — recent decisions for Progress
 *   GET  /api/soil/latest               — most-recent soil snapshot
 *   POST /api/soil/manual               — record manual soil reading
 *   GET  /api/satellite/latest          — most-recent satellite snapshot
 *   GET  /api/region/insights           — regional risk envelope
 *
 * Persistence
 *   First-class Prisma tables (added by 20260503_decision_engine_v2):
 *     • DecisionContext  — every signal slice at decision time
 *     • DailyDecision    — the action surfaced to the user
 *     • ActionCompletion — completed-action ledger
 *     • OutcomeFeedback  — D+2/D+3 result feedback
 *
 * Spec rules honoured
 *   §3  User-facing wording never claims certainty / NDVI / dosage.
 *   §4  /complete contract: { decisionId, actionType }.
 *   §5  /outcome enums: healthy | needs_attention | not_sure.
 *   §7  Priority ladder lives in engine.js.
 *   §8  Safe fallbacks for backyard / farmer when DB or services
 *       fail — app must NEVER crash.
 *   §9  Auth + ownership on every route. No cross-user reads.
 *  §10  sourceSignals are NEVER returned to normal users; only
 *       platform_admin/super_admin with `?debug=1` see them.
 *
 * Strict-rule audit
 *   • Every route is `authenticate` + rate-limited.
 *   • Zod parses every payload before the engine runs.
 *   • Persistence failures NEVER block the response — the user
 *     still gets a fallback envelope so the UI keeps moving.
 *   • Ownership check on every read/write that takes a decisionId.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { submissionLimiter, workflowLimiter } from '../../middleware/rateLimiters.js';
import { opsEvent } from '../../utils/opsLogger.js';
import prisma from '../../config/database.js';

import { buildDecisionContext } from './contextBuilder.js';
import { decideToday } from './engine.js';
import {
  decisionQuerySchema,
  decisionCompleteSchema,
  decisionOutcomeSchema,
  decisionHistoryQuerySchema,
  soilManualSchema,
} from './schemas.js';
import {
  getLatestSoilSnapshot, recordManualSoilSnapshot,
} from '../soil/service.js';
import { getLatestSatelliteSnapshot } from '../satellite/service.js';
import { getRegionInsight } from '../region/service.js';
import { getWeatherForFarm } from '../../services/weather/weatherProvider.js';

// ─── Router factory pattern: one router per mount path ────────
//
// app.js mounts each at the appropriate /api/<segment>. Keeping
// them separate avoids any path-collision with the legacy
// `decisionRoutes` mounted on /api/decision.

export const decisionRouter   = Router();
export const soilRouter       = Router();
export const satelliteRouter  = Router();
export const regionRouter     = Router();

// Roles allowed to receive raw debug data (sourceSignals, ruleId).
// Normal farmers never see these per spec §10.
const DEBUG_ROLES = new Set(['platform_admin', 'super_admin']);

// ─── GET /api/decision/today ─────────────────────────────────
decisionRouter.get('/today',
  submissionLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = decisionQuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({
        error:  'Invalid decision query',
        field:  _firstField(parsed),
        reason: _firstReason(parsed) || 'Validation failed',
      });
    }

    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'no_subject' });
    }

    const role = (req.user && req.user.role) || null;
    const debugRequested = (parsed.data.debug === '1' || parsed.data.debug === 'true')
      && DEBUG_ROLES.has(role);

    const query = { ...parsed.data };

    // Build context — every external source wrapped in _safe(); a
    // failure in one slice leaves that slice null, never throws.
    let ctx = null;
    try {
      ctx = await buildDecisionContext({ prisma, userId, query });
    } catch { ctx = null; }

    // Best-effort weather pre-fetch when ctx has coordinates and
    // the request didn't supply a weather summary directly.
    if (ctx && (ctx.lat != null) && (ctx.lng != null) && !ctx.weather) {
      try {
        const wx = await getWeatherForFarm({ latitude: ctx.lat, longitude: ctx.lng });
        if (wx) {
          ctx.weather = {
            condition:   null,
            temperature: typeof wx.tempHighC === 'number' ? wx.tempHighC : null,
            humidity:    typeof wx.humidityPct === 'number' ? wx.humidityPct : null,
            rainfallMm:  typeof wx.rainMmNext24h === 'number' ? wx.rainMmNext24h : null,
            rainProb:    typeof wx.rainChancePct === 'number' ? wx.rainChancePct : null,
            summary:     _summariseWeather(wx),
          };
        }
      } catch { /* leave weather null */ }
    }

    // Run the engine. Engine is pure and never throws — bad input
    // falls through to step 8 (general fallback).
    const decision = decideToday(ctx || { userType: query.userType || 'farmer' });

    // ── Persist context + decision ───────────────────────────
    // BOTH writes are best-effort. If either fails we still
    // return a usable response — the user must NEVER hit a 500.
    let contextRow = null;
    try {
      contextRow = await prisma.decisionContext.create({
        data: {
          userId,
          farmId:               (ctx && ctx.farmId) || null,
          gardenId:             null,
          userType:             decision.userType,
          cropOrPlant:          (ctx && ctx.cropOrPlant) || null,
          growthStage:          (ctx && ctx.growthStage) || null,
          weatherCondition:     (ctx && ctx.weather && ctx.weather.summary) || null,
          temperature:          _num(ctx && ctx.weather && ctx.weather.temperature),
          humidity:             _num(ctx && ctx.weather && ctx.weather.humidity),
          rainfallProbability:  _num(ctx && ctx.weather && ctx.weather.rainProb),
          soilMoistureLevel:    (ctx && ctx.soil && ctx.soil.moistureLevel) || null,
          soilType:             (ctx && ctx.soil && ctx.soil.soilType) || null,
          satelliteStressLevel: (ctx && ctx.satellite && ctx.satellite.stressLevel) || null,
          vegetationIndex:      _num(ctx && ctx.satellite && ctx.satellite.vegetationIndex),
          regionPestRisk:       (ctx && ctx.region && ctx.region.pestRisk) || null,
          regionDiseaseRisk:    (ctx && ctx.region && ctx.region.diseaseRisk) || null,
          recentScanStatus:     (ctx && ctx.scan && ctx.scan.lastStatus) || null,
          recentScanIssueType:  (ctx && ctx.scan && ctx.scan.lastIssueType) || null,
          lastWateredAt:        _date(ctx && ctx.lastActions && ctx.lastActions.lastWateredAt),
          lastInspectedAt:      _date(ctx && ctx.lastActions && ctx.lastActions.lastInspectedAt),
        },
        select: { id: true },
      });
    } catch { contextRow = null; }

    let decisionRow = null;
    try {
      decisionRow = await prisma.dailyDecision.create({
        data: {
          userId,
          farmId:        (ctx && ctx.farmId) || null,
          gardenId:      null,
          contextId:     contextRow ? contextRow.id : null,
          primaryAction: String(decision.primaryAction || '').slice(0, 200),
          primaryCta:    String(decision.primaryCta   || '').slice(0, 80),
          reason:        String(decision.reason       || '').slice(0, 500),
          priority:      Number.isFinite(decision.priority) ? decision.priority : 8,
          confidence:    decision.confidence === 'high' || decision.confidence === 'medium'
            ? decision.confidence : 'low',
          ruleId:        decision.ruleId || null,
          sourceSignals: Array.isArray(decision.sourceSignals)
            ? decision.sourceSignals : [],
          tomorrowHook:  decision.tomorrowHook || null,
          language:      decision.language || query.language || 'en',
        },
        select: {
          id: true, createdAt: true,
        },
      });
    } catch { decisionRow = null; }

    try {
      opsEvent('decisionV2', 'today_generated', 'info', {
        userId,
        ruleId:        decision.ruleId,
        priority:      decision.priority,
        confidence:    decision.confidence,
        sourceSignals: decision.sourceSignals,
        persisted:     !!decisionRow,
      });
    } catch { /* swallow */ }

    // ── Build the response ──────────────────────────────────
    // Spec §3 + §10: raw sourceSignals + ruleId are NEVER
    // returned to normal users. Admin debug mode bypasses this.
    const response = {
      decisionId:    decisionRow ? decisionRow.id : null,
      primaryAction: decision.primaryAction,
      primaryCta:    decision.primaryCta,
      reason:        decision.reason,
      priority:      decision.priority,
      confidence:    decision.confidence,
      tomorrowHook:  decision.tomorrowHook || 'Check again tomorrow morning',
    };

    if (debugRequested) {
      response.ruleId        = decision.ruleId;
      response.sourceSignals = decision.sourceSignals || [];
      response.userType      = decision.userType;
    }

    return res.json(response);
  }),
);

// ─── POST /api/decision/complete ─────────────────────────────
decisionRouter.post('/complete',
  workflowLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = decisionCompleteSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error:  'Invalid completion payload',
        field:  _firstField(parsed),
        reason: _firstReason(parsed) || 'Validation failed',
      });
    }

    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'no_subject' });
    }

    const { decisionId, actionType } = parsed.data;

    // ── Ownership check ─────────────────────────────────────
    let decisionRow = null;
    try {
      decisionRow = await prisma.dailyDecision.findUnique({
        where:  { id: decisionId },
        select: { id: true, userId: true, completed: true, ruleId: true,
                  primaryAction: true, contextId: true, tomorrowHook: true },
      });
    } catch { decisionRow = null; }

    if (!decisionRow) {
      return res.status(404).json({ error: 'Decision not found', code: 'decision_not_found' });
    }
    if (String(decisionRow.userId) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'decision_not_owned' });
    }

    // ── Mark complete + record ActionCompletion (idempotent)
    try {
      await prisma.dailyDecision.update({
        where: { id: decisionId },
        data:  { completed: true, completedAt: new Date() },
      });
    } catch { /* never block the response */ }

    try {
      // Snapshot the context if we still have it — this
      // de-couples the learning-loop ledger from any future
      // pruning of decision_contexts.
      let contextSnapshot = null;
      if (decisionRow.contextId) {
        try {
          contextSnapshot = await prisma.decisionContext.findUnique({
            where:  { id: decisionRow.contextId },
            select: {
              userType: true, cropOrPlant: true, growthStage: true,
              weatherCondition: true, temperature: true, humidity: true,
              soilMoistureLevel: true, satelliteStressLevel: true,
              regionPestRisk: true, regionDiseaseRisk: true,
              recentScanStatus: true, recentScanIssueType: true,
            },
          });
        } catch { contextSnapshot = null; }
      }
      await prisma.actionCompletion.create({
        data: {
          userId,
          decisionId,
          actionType:      actionType || decisionRow.ruleId || null,
          contextSnapshot: contextSnapshot || undefined,
        },
      });
    } catch { /* never block the response */ }

    try {
      opsEvent('decisionV2', 'completed', 'info', {
        userId, decisionId, actionType: actionType || decisionRow.ruleId,
      });
    } catch { /* swallow */ }

    // Spec §4 — friendly success message.
    return res.json({
      success:      true,
      message:      'Nice \u2014 you stayed ahead today \uD83C\uDF31',
      tomorrowHook: decisionRow.tomorrowHook || 'Check again tomorrow morning',
    });
  }),
);

// ─── POST /api/decision/outcome ──────────────────────────────
decisionRouter.post('/outcome',
  workflowLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = decisionOutcomeSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error:  'Invalid outcome payload',
        field:  _firstField(parsed),
        reason: _firstReason(parsed) || 'Validation failed',
      });
    }

    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'no_subject' });
    }

    const { decisionId, result, notes } = parsed.data;

    // Ownership check.
    let decisionRow = null;
    try {
      decisionRow = await prisma.dailyDecision.findUnique({
        where:  { id: decisionId },
        select: { id: true, userId: true },
      });
    } catch { decisionRow = null; }

    if (!decisionRow) {
      return res.status(404).json({ error: 'Decision not found', code: 'decision_not_found' });
    }
    if (String(decisionRow.userId) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'decision_not_owned' });
    }

    try {
      await prisma.outcomeFeedback.create({
        data: {
          userId,
          decisionId,
          result,
          notes: notes ? String(notes).slice(0, 500) : null,
        },
      });
    } catch {
      // Never crash on persistence failure — return ok=false so
      // the client can retry, but don't 500 the user surface.
      return res.json({ ok: false, message: 'Saved locally — we\u2019ll retry shortly.' });
    }

    try {
      opsEvent('decisionV2', 'outcome_recorded', 'info', {
        userId, decisionId, result,
      });
    } catch { /* swallow */ }

    return res.json({ ok: true, decisionId, result });
  }),
);

// ─── GET /api/decision/history ───────────────────────────────
decisionRouter.get('/history',
  submissionLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = decisionHistoryQuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({
        error:  'Invalid history query',
        field:  _firstField(parsed),
        reason: _firstReason(parsed) || 'Validation failed',
      });
    }
    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'no_subject' });
    }

    const role = (req.user && req.user.role) || null;
    const debugRequested = (parsed.data.debug === '1' || parsed.data.debug === 'true')
      && DEBUG_ROLES.has(role);
    const limit = parsed.data.limit || 14;

    let rows = [];
    try {
      rows = await prisma.dailyDecision.findMany({
        // Ownership enforced at the where clause — a different
        // userId can never appear in another user's history.
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        take:    limit,
        select: {
          id: true, createdAt: true, primaryAction: true, primaryCta: true,
          reason: true, priority: true, confidence: true,
          completed: true, completedAt: true, tomorrowHook: true,
          ruleId: debugRequested,
          sourceSignals: debugRequested,
        },
      });
    } catch { rows = []; }

    // Hydrate each row with its latest outcome (one query, mapped).
    let outcomeMap = new Map();
    if (rows.length > 0) {
      try {
        const outcomes = await prisma.outcomeFeedback.findMany({
          where: {
            userId,
            decisionId: { in: rows.map((r) => r.id) },
          },
          orderBy: { createdAt: 'desc' },
          select: { decisionId: true, result: true, createdAt: true },
        });
        for (const o of outcomes) {
          if (!outcomeMap.has(o.decisionId)) outcomeMap.set(o.decisionId, o);
        }
      } catch { outcomeMap = new Map(); }
    }

    const items = rows.map((r) => {
      const outcome = outcomeMap.get(r.id);
      const item = {
        decisionId:    r.id,
        date:          r.createdAt,
        primaryAction: r.primaryAction,
        primaryCta:    r.primaryCta,
        reason:        r.reason,
        priority:      r.priority,
        confidence:    r.confidence,
        completed:     r.completed,
        completedAt:   r.completedAt,
        tomorrowHook:  r.tomorrowHook,
        outcome:       outcome ? { result: outcome.result, at: outcome.createdAt } : null,
      };
      if (debugRequested) {
        item.ruleId        = r.ruleId;
        item.sourceSignals = r.sourceSignals || [];
      }
      return item;
    });

    return res.json({ ok: true, items });
  }),
);

// ─── GET /api/soil/latest ────────────────────────────────────
soilRouter.get('/latest',
  submissionLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'no_subject' });
    }
    const farmId = await _resolveFarmId(userId);
    const snap = await getLatestSoilSnapshot(prisma, { userId, farmId });
    return res.json({ ok: true, snapshot: snap || null });
  }),
);

// ─── POST /api/soil/manual ───────────────────────────────────
soilRouter.post('/manual',
  submissionLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = soilManualSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error:  'Invalid soil reading',
        field:  _firstField(parsed),
        reason: _firstReason(parsed) || 'Validation failed',
      });
    }
    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'no_subject' });
    }

    const farmId = parsed.data.farmId || (await _resolveFarmId(userId));
    const snap = await recordManualSoilSnapshot(prisma, {
      userId,
      farmId,
      moistureLabel: parsed.data.moistureLabel,
      soilType:      parsed.data.soilType,
      notes:         parsed.data.notes,
    });

    if (!snap) {
      return res.status(503).json({
        error: 'Could not save soil reading. Please try again.',
        code:  'soil_save_failed',
      });
    }
    return res.json({ ok: true, snapshot: snap });
  }),
);

// ─── GET /api/satellite/latest ───────────────────────────────
satelliteRouter.get('/latest',
  submissionLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'no_subject' });
    }
    const farmId = await _resolveFarmId(userId);
    const snap = await getLatestSatelliteSnapshot(prisma, {
      userId, farmId,
      lat: undefined, lng: undefined,
    });
    return res.json({ ok: true, snapshot: snap || null });
  }),
);

// ─── GET /api/region/insights ────────────────────────────────
regionRouter.get('/insights',
  submissionLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'no_subject' });
    }
    const region = (typeof req.query.region === 'string' ? req.query.region : '').slice(0, 64);
    const country = (typeof req.query.country === 'string' ? req.query.country : '').slice(0, 56);
    const cropOrPlant = (typeof req.query.crop === 'string' ? req.query.crop : '').slice(0, 48);

    let scope = { region: region || null, country: country || null, cropOrPlant: cropOrPlant || null };
    if (!scope.region || !scope.country || !scope.cropOrPlant) {
      try {
        const profile = await prisma.farmProfile.findFirst({
          where:   { userId, status: 'active' },
          orderBy: { createdAt: 'desc' },
          select:  { crop: true, country: true, locationName: true },
        });
        if (profile) {
          scope = {
            region:      scope.region      || profile.locationName || null,
            country:     scope.country     || profile.country || null,
            cropOrPlant: scope.cropOrPlant || profile.crop || null,
          };
        }
      } catch { /* tolerate — service handles null fine */ }
    }

    const insight = await getRegionInsight(prisma, scope);
    return res.json({ ok: true, insight: insight || null });
  }),
);

// ─── Helpers ────────────────────────────────────────────────

async function _resolveFarmId(userId) {
  if (!userId) return null;
  try {
    const profile = await prisma.farmProfile.findFirst({
      where:   { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select:  { id: true },
    });
    return profile && profile.id ? profile.id : null;
  } catch { return null; }
}

function _firstField(parsed) {
  return (parsed.error.issues[0]
       && parsed.error.issues[0].path
       && parsed.error.issues[0].path.join('.')) || null;
}

function _firstReason(parsed) {
  return (parsed.error.issues[0] && parsed.error.issues[0].message) || null;
}

function _num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function _date(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

function _summariseWeather(wx) {
  if (!wx) return null;
  const rain = typeof wx.rainMmNext24h === 'number' ? wx.rainMmNext24h : null;
  const temp = typeof wx.tempHighC === 'number' ? wx.tempHighC : null;
  if (rain != null && rain >= 10) return 'rainy';
  if (temp != null && temp >= 32) return 'hot';
  if (temp != null && temp <= 10) return 'cold';
  if (rain != null && rain < 1 && temp != null && temp >= 25) return 'dry';
  return 'unknown';
}

export const _internal = Object.freeze({
  DEBUG_ROLES,
  _resolveFarmId,
  _summariseWeather,
  _num, _date,
});

// Default export aggregates the four routers so app.js can do
// `import decisionV2Routers from './modules/decisionV2/routes.js'`.
export default {
  decisionRouter,
  soilRouter,
  satelliteRouter,
  regionRouter,
};
