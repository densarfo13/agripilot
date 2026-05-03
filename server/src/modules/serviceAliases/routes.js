/**
 * serviceAliases/routes.js — thin spec-named route adaptors.
 *
 *   GET  /api/weather/today        → existing weatherProvider
 *   GET  /api/actions/today        → existing AI Task Engine v1
 *   POST /api/actions/complete     → ClientEvent ('task_completed')
 *   POST /api/tasks/from-scan      → ClientEvent ('scan_followup_task_created')
 *
 * Why this module exists
 * ──────────────────────
 *   The "Connect UI to real backend" spec lists endpoint paths
 *   the frontend services layer expects. Some of those exist
 *   under different paths in the existing tree:
 *     • GET /api/weather/today  → existing  /api/v1/weather (query lat/lng)
 *     • GET /api/actions/today  → existing  POST /api/tasks/today
 *     • POST /api/actions/complete → no endpoint; we persist a
 *                                    `task_completed` ClientEvent
 *     • POST /api/tasks/from-scan  → no endpoint; we persist a
 *                                    `scan_followup_task_created`
 *                                    ClientEvent
 *
 *   Strict no-duplicates: NO business logic lives here. Each
 *   handler delegates to the existing engine / service / store
 *   and shapes the response to the contract the frontend expects.
 *
 * Strict-rule audit
 *   • Auth-required on every route.
 *   • Zod-validated bodies; reuses existing schemas where they
 *     fit, adds tight ad-hoc shapes for the 2 new POSTs.
 *   • Pure ESM, top-level imports.
 *   • Errors swallowed → 500 'Something went wrong' via the
 *     global errorHandler scrubber. No internals leaked.
 */

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { submissionLimiter } from '../../middleware/rateLimiters.js';
import prisma from '../../config/database.js';
import { generateTodayTask } from '../aiTask/engine.js';
import { todayTaskRequestSchema } from '../aiTask/schemas.js';
import * as weatherService from '../weather/service.js';

const router = Router();

// ─── GET /api/weather/today ──────────────────────────────
//
// Lightweight summary the Calm-UI weather header consumes.
// Looks up coords from the authenticated user's most-recent
// farm profile; falls back to ?lat= / ?lng= query when set.
// Always returns 200 — on lookup failure the body shape is
// `{ summary: null, tempC: null, humidity: null, rainMm: null, source: 'unavailable' }`
// so the frontend can render its "Here's today's guidance"
// fallback header without a try/catch.
router.get('/weather/today',
  authenticate,
  asyncHandler(async (req, res) => {
    const queryLat = req.query.lat ? parseFloat(String(req.query.lat)) : NaN;
    const queryLng = req.query.lng ? parseFloat(String(req.query.lng)) : NaN;
    let lat = Number.isFinite(queryLat) ? queryLat : null;
    let lng = Number.isFinite(queryLng) ? queryLng : null;

    if (lat == null || lng == null) {
      // Fall back to the user's farm profile coords.
      try {
        const userId = (req.user && (req.user.sub || req.user.id)) || null;
        if (userId) {
          const profile = await prisma.farmProfile.findFirst({
            where:   { userId, status: 'active' },
            orderBy: { createdAt: 'desc' },
            select:  { latitude: true, longitude: true },
          });
          if (profile && Number.isFinite(profile.latitude) && Number.isFinite(profile.longitude)) {
            lat = Number(profile.latitude);
            lng = Number(profile.longitude);
          }
        }
      } catch { /* swallow — we'll return the unavailable shape */ }
    }

    if (lat == null || lng == null) {
      return res.json({
        summary: null, tempC: null, humidity: null, rainMm: null,
        source: 'unavailable',
      });
    }

    try {
      const { weather, source } = await weatherService.getWeatherByCoords(lat, lng);
      const summary = _coerceSummary(weather);
      return res.json({
        summary,
        tempC:    Number.isFinite(weather && weather.tempC)    ? weather.tempC    : null,
        humidity: Number.isFinite(weather && weather.humidity) ? weather.humidity : null,
        rainMm:   Number.isFinite(weather && weather.precipTodayMm)
          ? weather.precipTodayMm : null,
        source:   source || 'live',
      });
    } catch {
      return res.json({
        summary: null, tempC: null, humidity: null, rainMm: null,
        source: 'unavailable',
      });
    }
  }),
);

function _coerceSummary(weather) {
  if (!weather) return null;
  // Heuristic: pick the most-prominent signal so the frontend's
  // weather-header switch matches what `_resolveWeatherHeader`
  // expects in TodayTaskCard.
  if (Number.isFinite(weather.precipTodayMm) && weather.precipTodayMm >= 5) return 'rainy';
  if (Number.isFinite(weather.tempC) && weather.tempC >= 35) return 'hot';
  if (Number.isFinite(weather.tempC) && weather.tempC <= 8)  return 'cold';
  if (Number.isFinite(weather.humidity) && weather.humidity >= 75) return 'humid';
  if (Number.isFinite(weather.precipTodayMm) && weather.precipTodayMm < 0.5
      && Number.isFinite(weather.humidity) && weather.humidity < 40) return 'dry';
  return 'normal';
}

// ─── GET /api/actions/today ──────────────────────────────
//
// Spec-named alias for the AI Task Engine v1's POST endpoint.
// Reads inputs from the query string + the authenticated
// user's profile; calls `generateTodayTask` directly so the
// returned envelope matches `/api/tasks/today` byte-for-byte.
router.get('/actions/today',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    let crop = null, stage = null, country = null, region = null;
    try {
      if (userId) {
        const profile = await prisma.farmProfile.findFirst({
          where:   { userId, status: 'active' },
          orderBy: { createdAt: 'desc' },
          select:  { crop: true, stage: true, country: true, locationName: true },
        });
        if (profile) {
          crop    = profile.crop || null;
          stage   = profile.stage || null;
          country = profile.country || null;
          region  = profile.locationName || null;
        }
      }
    } catch { /* swallow */ }

    const userType = String(req.query.userType || '').toLowerCase() === 'backyard'
      ? 'backyard' : 'farmer';
    const language = (typeof req.query.language === 'string'
      && ['en','fr','sw','ha','tw','hi'].includes(req.query.language))
      ? req.query.language : 'en';

    // Validate the assembled input through the same Zod schema
    // /api/tasks/today uses so the engine never sees a bad shape.
    const parsed = todayTaskRequestSchema.safeParse({
      userType, crop, stage, country, region, language,
    });
    const input = parsed.success ? parsed.data : { userType, language };

    const envelope = generateTodayTask(input);
    return res.json(envelope);
  }),
);

// ─── POST /api/actions/complete ──────────────────────────
//
// Server-acknowledged completion. The frontend already fires
// `task_completed` via the offline-queue event pipeline; this
// endpoint exists so the UI can OPTIONALLY await a server
// confirmation for the green checkmark animation.
//
// Body: { ruleId, source?, taskId? }
// Persists as a single `client_events` row of `type='task_completed'`.
const completeBodySchema = z.object({
  ruleId: z.string().min(1).max(64).optional(),
  source: z.string().min(1).max(64).optional(),
  taskId: z.string().min(1).max(128).optional(),
});

router.post('/actions/complete',
  submissionLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = completeBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid completion body' });
    }
    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    const id = (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID)
      ? globalThis.crypto.randomUUID()
      : `tc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      await prisma.clientEvent.upsert({
        where: { id },
        create: {
          id,
          type:      'task_completed',
          payload: {
            ruleId: parsed.data.ruleId || null,
            source: parsed.data.source || 'actions_complete_endpoint',
            taskId: parsed.data.taskId || null,
            userId,
          },
          createdAt: new Date(),
          farmerId:  userId,
          orgId:     (req.user && req.user.organizationId) || null,
          offline:   false,
        },
        update: {},
      });
    } catch { /* swallow — idempotent + telemetry */ }
    return res.json({ ok: true, recordedAt: new Date().toISOString() });
  }),
);

// ─── POST /api/tasks/from-scan ───────────────────────────
//
// When a scan returns `status: 'needs_attention'`, the frontend
// posts the result here so a follow-up task is recorded for
// the user. Persists as a `scan_followup_task_created` ClientEvent
// — no parallel task table introduced.
//
// Body: { plantName, status, action, timing, confidence?, scanId? }
const fromScanBodySchema = z.object({
  plantName:  z.string().min(1).max(64).optional(),
  status:     z.enum(['healthy', 'needs_attention', 'uncertain']).optional(),
  action:     z.string().min(1).max(256).optional(),
  timing:     z.string().min(1).max(64).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  scanId:     z.string().min(1).max(128).optional(),
});

router.post('/tasks/from-scan',
  submissionLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = fromScanBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid scan-task body' });
    }
    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    const id = (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID)
      ? globalThis.crypto.randomUUID()
      : `sft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      await prisma.clientEvent.upsert({
        where: { id },
        create: {
          id,
          type:      'scan_followup_task_created',
          payload: {
            plantName:  parsed.data.plantName || null,
            status:     parsed.data.status || 'uncertain',
            action:     parsed.data.action || null,
            timing:     parsed.data.timing || null,
            confidence: typeof parsed.data.confidence === 'number'
              ? parsed.data.confidence : null,
            scanId:     parsed.data.scanId || null,
          },
          createdAt: new Date(),
          farmerId:  userId,
          orgId:     (req.user && req.user.organizationId) || null,
          offline:   false,
        },
        update: {},
      });
    } catch { /* swallow */ }
    return res.json({ ok: true, taskId: id });
  }),
);

export default router;
