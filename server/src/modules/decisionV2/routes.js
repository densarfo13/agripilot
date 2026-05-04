/**
 * decisionV2/routes.js — REST endpoints for Decision Engine v2.
 *
 *   GET  /api/decision/today            — primary daily decision
 *   POST /api/decision/complete         — record completion + outcome
 *   GET  /api/soil/latest               — most-recent soil snapshot
 *   POST /api/soil/manual               — record manual soil reading
 *   GET  /api/satellite/latest          — most-recent satellite snapshot
 *   GET  /api/region/insights           — regional risk envelope
 *
 * Spec rules honoured
 *   §5  Priority ladder selects ONE primary action.
 *   §10 Completion feeds back into the learning loop.
 *   §11 Auth required on every route. Ownership: a user only ever
 *       sees / writes their own data.
 *   §13 No external scan / AI provider keys leak — we run pure
 *       rules + persisted snapshots.
 *   §15 Missing soil/satellite/region never blocks the response.
 *
 * Persistence strategy
 *   We re-use the ClientEvent table as the event store for
 *   `daily_decision` and `decision_completed` rows. This avoids
 *   any Prisma migration risk on the deploy and keeps a clean
 *   audit trail in one place.
 *
 * Strict-rule audit
 *   • Every route is `authenticate` + rate-limited.
 *   • Zod parses every payload before the engine runs.
 *   • The engine is pure — never throws — and the route adds
 *     defensive try/catch around persistence so a DB blip can
 *     never block a daily decision.
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
  decisionQuerySchema, decisionCompleteSchema, soilManualSchema,
} from './schemas.js';
import {
  getLatestSoilSnapshot, recordManualSoilSnapshot,
} from '../soil/service.js';
import { getLatestSatelliteSnapshot } from '../satellite/service.js';
import { getRegionInsight } from '../region/service.js';
import { getWeatherForFarm } from '../../services/weather/weatherProvider.js';

const DECISION_EVENT_TYPE  = 'daily_decision';
const COMPLETED_EVENT_TYPE = 'decision_completed';

// ─── Router factory pattern: one router per mount path ────────
//
// app.js mounts each at the appropriate /api/<segment>. Keeping
// them separate avoids any path-collision with the legacy
// `decisionRoutes` mounted on /api/decision.

export const decisionRouter   = Router();
export const soilRouter       = Router();
export const satelliteRouter  = Router();
export const regionRouter     = Router();

// ─── GET /api/decision/today ─────────────────────────────────
decisionRouter.get('/today',
  submissionLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = decisionQuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({
        error:  'Invalid decision query',
        field:  (parsed.error.issues[0] && parsed.error.issues[0].path
                && parsed.error.issues[0].path.join('.')) || null,
        reason: (parsed.error.issues[0] && parsed.error.issues[0].message)
                || 'Validation failed',
      });
    }

    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'no_subject' });
    }

    const query = { ...parsed.data };

    // Build context (pulls profile + soil/satellite/region/scan/lastActions
    // in parallel; any source failure leaves that slice null).
    let ctx = null;
    try {
      ctx = await buildDecisionContext({ prisma, userId, query });
    } catch {
      // Defensive: even though buildDecisionContext never throws,
      // an unexpected exception here must still result in a fallback
      // decision rather than an error response.
      ctx = null;
    }

    // Best-effort weather pre-fetch when ctx has coordinates and
    // the request didn't supply a weather summary directly.
    if (ctx && (ctx.lat != null) && (ctx.lng != null) && !ctx.weather) {
      try {
        const wx = await getWeatherForFarm({ latitude: ctx.lat, longitude: ctx.lng });
        if (wx) {
          ctx.weather = {
            condition:  null,
            temperature: typeof wx.tempHighC === 'number' ? wx.tempHighC : null,
            humidity:    typeof wx.humidityPct === 'number' ? wx.humidityPct : null,
            rainfallMm:  typeof wx.rainMmNext24h === 'number' ? wx.rainMmNext24h : null,
            summary:     _summariseWeather(wx),
          };
        }
      } catch { /* leave weather null */ }
    }

    const decision = decideToday(ctx || { userType: query.userType || 'farmer' });

    // Synthesise a decisionId so the client can pair the
    // following /api/decision/complete callback. Same id we
    // persist below.
    const decisionId = _eventId('decision');
    decision.decisionId = decisionId;
    decision.userId     = userId;

    // Persist as a `daily_decision` ClientEvent — never blocks
    // the response.
    try {
      await prisma.clientEvent.create({
        data: {
          id:        decisionId,
          type:      DECISION_EVENT_TYPE,
          payload: {
            ruleId:        decision.ruleId,
            priority:      decision.priority,
            confidence:    decision.confidence,
            sourceSignals: decision.sourceSignals,
            primaryAction: String(decision.primaryAction || '').slice(0, 120),
            userType:      decision.userType,
            language:      decision.language || query.language || 'en',
            crop:          (ctx && ctx.cropOrPlant) || null,
            stage:         (ctx && ctx.growthStage) || null,
            country:       (ctx && ctx.locationCountry) || null,
            region:        (ctx && ctx.locationRegion) || null,
          },
          createdAt: new Date(),
          farmerId:  userId,
          orgId:     (req.user && req.user.organizationId) || null,
          appVersion: typeof req.headers['x-app-version'] === 'string'
            ? req.headers['x-app-version'].slice(0, 32)
            : null,
          offline:   false,
        },
      });
    } catch { /* never block the response */ }

    try {
      opsEvent('decisionV2', 'today_generated', 'info', {
        userId,
        ruleId:        decision.ruleId,
        priority:      decision.priority,
        confidence:    decision.confidence,
        sourceSignals: decision.sourceSignals,
      });
    } catch { /* swallow */ }

    return res.json(decision);
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
        field:  (parsed.error.issues[0] && parsed.error.issues[0].path
                && parsed.error.issues[0].path.join('.')) || null,
        reason: (parsed.error.issues[0] && parsed.error.issues[0].message)
                || 'Validation failed',
      });
    }

    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'no_subject' });
    }

    const { decisionId, ruleId, outcome, comment, completedAt } = parsed.data;

    // Ownership check — make sure the decisionId belongs to this
    // user. Spec §11. Missing decisionId rows are tolerated (the
    // user may be on an older client that didn't get one).
    let owned = true;
    try {
      const row = await prisma.clientEvent.findUnique({
        where: { id: decisionId },
        select: { farmerId: true },
      });
      if (row && row.farmerId && String(row.farmerId) !== String(userId)) {
        owned = false;
      }
    } catch { /* tolerate */ }

    if (!owned) {
      return res.status(403).json({ error: 'Forbidden', code: 'decision_not_owned' });
    }

    const eventId = _eventId('decisionDone');
    const at = completedAt ? new Date(completedAt) : new Date();

    try {
      await prisma.clientEvent.upsert({
        where: { id: eventId },
        create: {
          id:        eventId,
          type:      COMPLETED_EVENT_TYPE,
          payload: {
            decisionId,
            ruleId:  ruleId || null,
            outcome,
            comment: comment ? String(comment).slice(0, 280) : null,
          },
          createdAt: at,
          farmerId:  userId,
          orgId:     (req.user && req.user.organizationId) || null,
          appVersion: typeof req.headers['x-app-version'] === 'string'
            ? req.headers['x-app-version'].slice(0, 32)
            : null,
          offline:   false,
        },
        update: {},
      });
    } catch { /* never block the response */ }

    try {
      opsEvent('decisionV2', 'completed', 'info', {
        userId, decisionId, ruleId, outcome,
      });
    } catch { /* swallow */ }

    return res.json({ ok: true, decisionId, outcome });
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
        field:  (parsed.error.issues[0] && parsed.error.issues[0].path
                && parsed.error.issues[0].path.join('.')) || null,
        reason: (parsed.error.issues[0] && parsed.error.issues[0].message)
                || 'Validation failed',
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

    // Fall back to the user's farm profile when query params are
    // missing — keeps the frontend payload small.
    let scope = { region: region || null, country: country || null, cropOrPlant: cropOrPlant || null };
    if (!scope.region || !scope.country || !scope.cropOrPlant) {
      try {
        const profile = await prisma.farmProfile.findFirst({
          where: { userId, status: 'active' },
          orderBy: { createdAt: 'desc' },
          select: { crop: true, country: true, locationName: true },
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
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return profile && profile.id ? profile.id : null;
  } catch { return null; }
}

function _eventId(prefix) {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
  DECISION_EVENT_TYPE,
  COMPLETED_EVENT_TYPE,
  _resolveFarmId,
  _summariseWeather,
});

// Default export aggregates the four routers so app.js can do
// `import decisionV2Routers from './modules/decisionV2/routes.js'`.
export default {
  decisionRouter,
  soilRouter,
  satelliteRouter,
  regionRouter,
};
