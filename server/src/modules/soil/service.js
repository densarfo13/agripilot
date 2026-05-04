/**
 * soil/service.js — soil snapshot read/write helpers.
 *
 *   const snap = await getLatestSoilSnapshot(prisma, { userId, farmId });
 *   await recordManualSoilSnapshot(prisma, {
 *     userId, farmId, moistureLabel: 'dry', notes: 'topsoil cracked',
 *   });
 *
 * Spec §7 — Soil Data System
 *   Manual user input first. Future: sensor / API data later.
 *   Mapping: dry → low, moist → normal, wet → high, unknown → null.
 *   Output envelope:
 *     {
 *       moistureLevel:  'low' | 'normal' | 'high' | null,
 *       soilType:       string | null,
 *       riskLevel:      'low' | 'medium' | 'high',
 *       source:         'manual' | 'sensor' | 'api',
 *       observedAt:     ISO string,
 *     }
 *
 * Persistence
 *   We use the ClientEvent table — same trick the AI Task engine
 *   uses — so the deploy never has to migrate Prisma. Type:
 *   `soil_snapshot`. Payload carries the snapshot envelope.
 *
 * Strict-rule audit
 *   • Pure async helpers; never throw — return null on failure.
 *   • No external network calls.
 *   • Caller injects `prisma` so tests can stub.
 *   • Inputs are lightly sanitised; downstream Zod handles the
 *     strict validation in routes.
 */

const SOIL_EVENT_TYPE = 'soil_snapshot';

// Manual labels the UI surfaces.
const MOISTURE_LABELS = Object.freeze(['dry', 'moist', 'wet', 'unknown']);

const MOISTURE_LABEL_TO_LEVEL = Object.freeze({
  dry:     'low',
  moist:   'normal',
  wet:     'high',
  unknown: null,
});

/**
 * getLatestSoilSnapshot(prisma, { userId, farmId })
 *
 * Returns the most-recent SoilSnapshot envelope for the user
 * (preferring farm-scoped rows when farmId is known). Returns
 * null when nothing has been recorded yet OR on any error.
 */
export async function getLatestSoilSnapshot(prisma, { userId, farmId } = {}) {
  if (!prisma || !userId) return null;
  try {
    const where = { type: SOIL_EVENT_TYPE, farmerId: userId };
    const row = await prisma.clientEvent.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      select: { payload: true, createdAt: true },
    });
    if (!row) return null;
    const p = row.payload || {};

    // Prefer the farm-scoped row when one exists. We do this in
    // a SECOND read only when the caller passed farmId AND the
    // first row didn't match — keeps the common case to a single
    // index hit.
    if (farmId && p.farmId && String(p.farmId) !== String(farmId)) {
      try {
        const scoped = await prisma.clientEvent.findFirst({
          where: { ...where, payload: { path: ['farmId'], equals: String(farmId) } },
          orderBy: { createdAt: 'desc' },
          select: { payload: true, createdAt: true },
        });
        if (scoped) return _toSnapshot(scoped.payload, scoped.createdAt);
      } catch { /* JSON-path filter not supported on all Postgres versions — fall through */ }
    }

    return _toSnapshot(p, row.createdAt);
  } catch { return null; }
}

/**
 * recordManualSoilSnapshot(prisma, { userId, farmId, moistureLabel, soilType, notes })
 *
 * Persists a manual snapshot as a `soil_snapshot` ClientEvent.
 * Returns the resulting envelope on success, null on failure.
 */
export async function recordManualSoilSnapshot(prisma, {
  userId, farmId, moistureLabel, soilType, notes,
} = {}) {
  if (!prisma || !userId) return null;
  const label = MOISTURE_LABELS.includes(moistureLabel) ? moistureLabel : 'unknown';
  const moistureLevel = MOISTURE_LABEL_TO_LEVEL[label];
  const observedAt = new Date();
  const riskLevel = _deriveRiskLevel(moistureLevel);

  const payload = {
    farmId:        farmId ? String(farmId) : null,
    moistureLabel: label,
    moistureLevel,
    soilType:      typeof soilType === 'string' && soilType.length > 0
      ? soilType.slice(0, 32) : null,
    riskLevel,
    source:        'manual',
    notes:         typeof notes === 'string' && notes.length > 0
      ? notes.slice(0, 200) : null,
    observedAt:    observedAt.toISOString(),
  };

  try {
    await prisma.clientEvent.create({
      data: {
        id:        _eventId('soil'),
        type:      SOIL_EVENT_TYPE,
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
  const moistureLevel = (p.moistureLevel === 'low'
    || p.moistureLevel === 'normal'
    || p.moistureLevel === 'high')
    ? p.moistureLevel : null;
  const source = (p.source === 'sensor' || p.source === 'api')
    ? p.source : 'manual';
  return {
    moistureLevel,
    soilType:   typeof p.soilType === 'string' ? p.soilType : null,
    riskLevel:  _deriveRiskLevel(moistureLevel, p.riskLevel),
    source,
    observedAt: (p.observedAt && typeof p.observedAt === 'string')
      ? p.observedAt
      : (createdAt instanceof Date ? createdAt.toISOString() : new Date().toISOString()),
  };
}

function _deriveRiskLevel(moistureLevel, recordedRisk) {
  // Honour an explicit risk override when the recorded payload
  // already carries one (e.g. from a future sensor pipeline).
  if (recordedRisk === 'low' || recordedRisk === 'medium' || recordedRisk === 'high') {
    return recordedRisk;
  }
  if (moistureLevel === 'low')  return 'high';
  if (moistureLevel === 'high') return 'medium';
  if (moistureLevel === 'normal') return 'low';
  return 'low';
}

function _eventId(prefix) {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const _internal = Object.freeze({
  SOIL_EVENT_TYPE,
  MOISTURE_LABELS,
  MOISTURE_LABEL_TO_LEVEL,
  _toSnapshot,
  _deriveRiskLevel,
});

export default {
  getLatestSoilSnapshot,
  recordManualSoilSnapshot,
};
