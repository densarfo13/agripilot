/**
 * satellite/service.js — satellite snapshot service (placeholder).
 *
 *   const snap = await getLatestSatelliteSnapshot(prisma, {
 *     userId, farmId, lat, lng,
 *   });
 *
 * Spec §8 — Satellite Data System
 *   For now: create service placeholder, allow mock satellite
 *   snapshot, do not block app if unavailable.
 *   User-facing wording: "Some crop stress may be present" —
 *   never "NDVI anomaly detected".
 *
 *   Output envelope:
 *     {
 *       stressLevel:     'low' | 'medium' | 'high',
 *       vegetationIndex: number | null,    // 0..1
 *       droughtSignal:   boolean,
 *       source:          'placeholder' | 'cached' | 'live',
 *       observedAt:      ISO string,
 *     }
 *
 * Behaviour
 *   1. If a recent `satellite_snapshot` ClientEvent exists for
 *      the user, return that (spec §15: do not re-call providers
 *      every request).
 *   2. Otherwise return null — the decision engine continues
 *      without a satellite signal.
 *   3. A test/admin can seed snapshots via
 *      `recordSatelliteSnapshot()` until the live provider lands.
 *
 * Strict-rule audit
 *   • Pure async helpers — never throw.
 *   • Always returns null on missing data; never blocks the app.
 *   • No external network calls in this placeholder.
 */

const SAT_EVENT_TYPE = 'satellite_snapshot';

// How long a recorded snapshot stays fresh. Older rows are
// treated as "no data" so the engine doesn't act on stale NDVI.
const FRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * getLatestSatelliteSnapshot(prisma, { userId, farmId, lat, lng })
 *
 * Returns the most-recent fresh snapshot for the user OR null.
 * Coordinates are accepted for forward compatibility (live
 * provider call); the placeholder ignores them.
 */
export async function getLatestSatelliteSnapshot(prisma, {
  userId, farmId, lat, lng,
} = {}) {
  if (!prisma || !userId) return null;
  // Reference unused params so future implementations don't need
  // a signature change — the placeholder doesn't call providers.
  void farmId; void lat; void lng;
  try {
    const row = await prisma.clientEvent.findFirst({
      where: {
        type: SAT_EVENT_TYPE,
        farmerId: userId,
        createdAt: { gte: new Date(Date.now() - FRESH_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true, createdAt: true },
    });
    if (!row) return null;
    return _toSnapshot(row.payload, row.createdAt);
  } catch { return null; }
}

/**
 * recordSatelliteSnapshot(prisma, { userId, farmId, stressLevel, ... })
 *
 * Admin/test hook. Persists a satellite snapshot so the engine
 * can pick it up on the next `/api/decision/today` call.
 */
export async function recordSatelliteSnapshot(prisma, {
  userId, farmId, stressLevel, vegetationIndex, droughtSignal, source,
} = {}) {
  if (!prisma || !userId) return null;
  const level = (stressLevel === 'low' || stressLevel === 'medium' || stressLevel === 'high')
    ? stressLevel : 'low';
  const ndvi = (typeof vegetationIndex === 'number'
    && vegetationIndex >= 0 && vegetationIndex <= 1)
    ? vegetationIndex : null;
  const observedAt = new Date();
  const payload = {
    farmId:          farmId ? String(farmId) : null,
    stressLevel:     level,
    vegetationIndex: ndvi,
    droughtSignal:   droughtSignal === true,
    source:          (source === 'live' || source === 'cached') ? source : 'placeholder',
    observedAt:      observedAt.toISOString(),
  };
  try {
    await prisma.clientEvent.create({
      data: {
        id:        _eventId('sat'),
        type:      SAT_EVENT_TYPE,
        payload,
        createdAt: observedAt,
        farmerId:  userId,
        offline:   false,
      },
    });
    return _toSnapshot(payload, observedAt);
  } catch { return null; }
}

// ─── Internal helpers ────────────────────────────────────────

function _toSnapshot(p, createdAt) {
  if (!p || typeof p !== 'object') return null;
  const stressLevel = (p.stressLevel === 'low'
    || p.stressLevel === 'medium'
    || p.stressLevel === 'high')
    ? p.stressLevel : 'low';
  const vegetationIndex = (typeof p.vegetationIndex === 'number'
    && p.vegetationIndex >= 0 && p.vegetationIndex <= 1)
    ? p.vegetationIndex : null;
  const source = (p.source === 'live' || p.source === 'cached')
    ? p.source : 'placeholder';
  return {
    stressLevel,
    vegetationIndex,
    droughtSignal: p.droughtSignal === true,
    source,
    observedAt: (p.observedAt && typeof p.observedAt === 'string')
      ? p.observedAt
      : (createdAt instanceof Date ? createdAt.toISOString() : new Date().toISOString()),
  };
}

function _eventId(prefix) {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const _internal = Object.freeze({
  SAT_EVENT_TYPE,
  FRESH_WINDOW_MS,
  _toSnapshot,
});

export default {
  getLatestSatelliteSnapshot,
  recordSatelliteSnapshot,
};
