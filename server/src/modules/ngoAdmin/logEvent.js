/**
 * logEvent.js — thin helper callable from anywhere in the
 * server when a farm-affecting action happens. Writes one row
 * to farm_events via Prisma.
 *
 * Never throws — a logging failure should not break the
 * original request. Errors are caught and logged to console.
 *
 * Usage:
 *   await logFarmEvent(prisma, {
 *     userId, farmId, eventType: 'task_completed',
 *     payload: { taskId, code },
 *     country, region, crop,
 *   });
 */

const ALLOWED_EVENT_TYPES = Object.freeze(new Set([
  'task_seen',
  'task_completed',
  'task_skipped',
  'task_feedback',
  'state_feedback',
  'crop_changed',
  'farm_updated',
  'farm_created',
  'farm_switched',
  'onboarding_completed',
  'onboarding_language_selected',
  'recommendation_applied',
]));

async function logFarmEvent(prisma, input = {}) {
  if (!prisma || typeof prisma.farmEvent?.create !== 'function') {
    return { ok: false, reason: 'no_prisma' };
  }
  const {
    userId  = null,
    farmId  = null,
    eventType,
    payload = null,
    country = null,
    region  = null,
    crop    = null,
  } = input;

  if (!eventType || typeof eventType !== 'string') {
    return { ok: false, reason: 'missing_event_type' };
  }
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return { ok: false, reason: 'unknown_event_type', eventType };
  }

  try {
    const created = await prisma.farmEvent.create({
      data: {
        userId, farmId, eventType,
        payload: payload || undefined,
        country, region, crop,
      },
    });
    return { ok: true, id: created.id };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[farmEvent.log] failed', err?.message || err);
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}

module.exports = {
  logFarmEvent,
  ALLOWED_EVENT_TYPES,
};
