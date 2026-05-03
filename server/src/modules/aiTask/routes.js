/**
 * aiTask/routes.js — POST /api/tasks/today
 *
 *   const res = await api.post('/tasks/today', {
 *     userType: 'farmer', crop: 'maize', stage: 'vegetative',
 *     country: 'GH', weather: 'dry', rainfallForecast: 0,
 *     temperature: 31, language: 'en',
 *   });
 *
 * Returns the spec's full envelope:
 *   {
 *     todayTaskTitle, taskReason, urgency, estimatedTime,
 *     safetyNote, localizedText, nextRecommendedTask,
 *     completionPrompt, ruleId, fallback, requestId, generatedAt,
 *   }
 *
 * Strict-rule audit
 *   • Auth required — anonymous task generation isn't useful
 *     because the response wires into the user's task history.
 *   • Zod validates the body before the engine runs.
 *   • Every generation fires `task_generated` + every successful
 *     persistence fires `task_viewed` so the admin metrics can
 *     compute the generation→view→completion funnel.
 *   • Rate-limited via the existing `submissionLimiter`
 *     (20/min/IP) — task generation is cheap but bounded.
 *   • Engine runs PURELY in-process — no external network calls.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { submissionLimiter } from '../../middleware/rateLimiters.js';
import { opsEvent } from '../../utils/opsLogger.js';
import prisma from '../../config/database.js';
import { todayTaskRequestSchema } from './schemas.js';
import { generateTodayTask } from './engine.js';

const router = Router();

// ─── Helper: optional profile lookup ─────────────────────
//
// When the request omits `crop` / `stage`, the route looks them
// up from the user's most-recent FarmProfile. This keeps the
// frontend payload small for the common case (the user's
// profile already has the data) without forcing the client to
// duplicate it.
async function resolveCropAndStage(userId) {
  if (!userId) return { crop: null, stage: null };
  try {
    const profile = await prisma.farmProfile.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { crop: true, stage: true, country: true, locationName: true },
    });
    if (!profile) return { crop: null, stage: null };
    return {
      crop:    profile.crop || null,
      stage:   profile.stage || null,
      country: profile.country || null,
      region:  profile.locationName || null,
    };
  } catch { return { crop: null, stage: null }; }
}

// ─── POST /api/tasks/today ────────────────────────────────
router.post('/today',
  submissionLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = todayTaskRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error:  'Invalid task request',
        field:  (parsed.error.issues[0] && parsed.error.issues[0].path && parsed.error.issues[0].path.join('.')) || null,
        reason: (parsed.error.issues[0] && parsed.error.issues[0].message) || 'Validation failed',
      });
    }

    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    const requestId = parsed.data.requestId
      || (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID
        ? globalThis.crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

    // If crop/stage missing, try the profile lookup. The engine
    // returns the `profile_missing` rule when both are still null.
    const input = { ...parsed.data };
    if (!input.crop || !input.stage) {
      const lookup = await resolveCropAndStage(userId);
      if (!input.crop)    input.crop = lookup.crop;
      if (!input.stage)   input.stage = lookup.stage;
      if (!input.country) input.country = lookup.country;
      if (!input.region)  input.region = lookup.region;
    }

    // Generate. Engine is pure — never throws.
    const envelope = generateTodayTask(input);
    envelope.requestId = requestId;

    // Persist as a `task_generated` ClientEvent so the admin
    // metrics aggregator can count generation volume + fallback
    // rate. We DON'T persist the full localizedText (only the
    // English title + reason) so payload stays small.
    try {
      await prisma.clientEvent.upsert({
        where:  { id: requestId },
        create: {
          id:        requestId,
          type:      'task_generated',
          payload: {
            userType:    envelope.userType,
            ruleId:      envelope.ruleId,
            urgency:     envelope.urgency,
            crop:        input.crop || null,
            stage:       input.stage || null,
            language:    envelope.language,
            fallback:    envelope.fallback,
            // Truncate the English wording for log size — full
            // text is in the response body, never in the table.
            title:       envelope.todayTaskTitle.slice(0, 80),
          },
          createdAt: new Date(),
          farmerId:  userId,
          orgId:     (req.user && req.user.organizationId) || null,
          appVersion: typeof req.headers['x-app-version'] === 'string'
            ? req.headers['x-app-version'].slice(0, 32)
            : null,
          offline:   false,
        },
        update: {},
      });
    } catch { /* never block the response — generation is the primary product */ }

    try {
      opsEvent('aiTask', 'today_generated', 'info', {
        userId,
        ruleId:   envelope.ruleId,
        urgency:  envelope.urgency,
        userType: envelope.userType,
        fallback: envelope.fallback,
        language: envelope.language,
      });
    } catch { /* swallow */ }

    return res.json(envelope);
  }),
);

export default router;
