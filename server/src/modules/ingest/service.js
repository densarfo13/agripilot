/**
 * ingest/service.js — stateless validation + idempotent persist
 * for the client-event batch ingestion endpoint.
 *
 *   ingestEvents({ events, appVersion, prismaClient })
 *     -> { accepted, duplicates, rejected }
 *
 * Contract
 *   * Hard-cap: events.length must be <= MAX_BATCH_SIZE (200).
 *     Exceeding the cap is the caller's bug; the route returns
 *     400 before this service runs.
 *   * Per-event validation: each row needs id + type + createdAt;
 *     anything else is dropped (counted as `rejected`) so a
 *     malformed entry never blocks the rest of the batch.
 *   * Idempotency: every accepted row goes through
 *     prisma.clientEvent.upsert with `where: { id }` and an
 *     empty `update` block — the second insert of the same
 *     id is a no-op. The brief asks for "ON CONFLICT DO
 *     NOTHING"; Prisma's `upsert(create, update={})` produces
 *     the same effect.
 *   * Never throws on per-row failure: a single Prisma error
 *     (constraint violation, payload too big) is logged + the
 *     row is counted as rejected; the rest of the batch
 *     continues.
 *
 * Strict-rule audit
 *   * Stateless — caller passes the prisma client so tests can
 *     inject a stub.
 *   * Pure validation: validateEvent doesn't touch the DB.
 *   * Observable: returns { accepted, duplicates, rejected }
 *     so the route + ops dashboards can count drift.
 */

export const MAX_BATCH_SIZE = 200;

const VALID_EVENT_TYPES = new Set([
  'AUTH_LOGIN', 'APP_OPENED',
  'TODAY_VIEWED', 'TASK_VIEWED', 'TASK_GENERATED',
  'TASK_LISTENED', 'TASK_COMPLETED', 'TASK_SKIPPED',
  'LABEL_SUBMITTED', 'OUTCOME_SUBMITTED',
  'LOCATION_CAPTURED', 'LOCATION_DENIED',
  'WEATHER_ALERT_SHOWN', 'RISK_ALERT_SHOWN',
  'PEST_REPORTED', 'DROUGHT_REPORTED',
  'DROUGHT_ALERT_SHOWN', 'WEATHER_FETCHED', 'RISK_COMPUTED',
  'OFFLINE_ACTION_QUEUED', 'SYNC_SUCCESS', 'SYNC_FAILED',
  'LANGUAGE_CHANGED', 'SIMPLE_MODE_ENABLED', 'SIMPLE_MODE_DISABLED',
  'FARM_INACTIVE',
]);

const UUID_RE  = /^[0-9a-f-]{8,64}$/i;       // permissive — client mint format may vary
const ISO_RE   = /^\d{4}-\d{2}-\d{2}/;

function _isValidId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 128
    && UUID_RE.test(id);
}

function _isValidType(t) {
  return typeof t === 'string' && VALID_EVENT_TYPES.has(t);
}

function _coerceCreatedAt(raw) {
  if (raw == null) return null;
  // Accept ISO string OR ms epoch number — the client logs
  // both depending on how the event was minted.
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < 1_000_000_000_000) return null;          // pre-2001 sanity floor
    if (raw > Date.now() + 60_000) return null;         // > 1min in the future
    return new Date(raw);
  }
  if (typeof raw === 'string' && ISO_RE.test(raw)) {
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return null;
    if (d.getTime() > Date.now() + 60_000) return null;
    return d;
  }
  return null;
}

/**
 * Per-event validator. Returns the normalised row when valid,
 * null when the row should be dropped.
 *
 * orgId is set from the AUTHENTICATED REQUEST, never the
 * client payload. The validator additionally rejects rows
 * whose embedded orgId mismatches the authenticated value
 * (a hard-stop guard against a captured token replaying a
 * batch into a different org).
 */
export function validateEvent(raw, appVersion = null, orgId = null) {
  if (!raw || typeof raw !== 'object') return null;
  if (!_isValidId(raw.id))                       return null;
  if (!_isValidType(raw.type))                   return null;
  const createdAt = _coerceCreatedAt(raw.createdAt || raw.timestamp);
  if (!createdAt) return null;

  const payload = raw.payload && typeof raw.payload === 'object'
    ? raw.payload
    : null;

  // Hard-stop on client-supplied orgId mismatch so a malicious
  // client can't smuggle events into another org by stuffing
  // payload.orgId. The service still always WRITES the request
  // user's orgId (parameter `orgId` here) — this guard catches
  // the rare case where a client tries to mix orgs in a batch.
  if (orgId && payload && payload.orgId
      && String(payload.orgId) !== String(orgId)) {
    return null;
  }
  if (orgId && raw.orgId && String(raw.orgId) !== String(orgId)) {
    return null;
  }

  // farmerId / farmId are pulled from payload OR top-level so
  // older clients (which only put them in payload) still index
  // correctly. Both are nullable per schema — events like
  // LANGUAGE_CHANGED don't carry a farm.
  const farmerId = (payload && payload.farmerId) || raw.farmerId || null;
  const farmId   = (payload && payload.farmId)   || raw.farmId   || null;

  return {
    id:         raw.id,
    orgId:      orgId ? String(orgId) : null,
    farmerId:   farmerId ? String(farmerId) : null,
    farmId:     farmId ? String(farmId) : null,
    type:       raw.type,
    payload,
    createdAt,
    appVersion: appVersion || null,
    offline:    raw.offline === true,
  };
}

/**
 * ingestEvents — main service entry point.
 *
 * @param events           Array of raw client events
 * @param appVersion       optional version tag from the batch
 * @param orgId            ORG ID FROM THE AUTHENTICATED REQUEST.
 *                         Never trust client-supplied org_id —
 *                         the route handler MUST pass the value
 *                         from req.user.organizationId here.
 *                         null is acceptable for legacy callers
 *                         that haven't migrated, but every NGO
 *                         read filters on org_id so unscoped
 *                         events become invisible to dashboards
 *                         until they're re-attributed.
 * @param prismaClient     prisma client (or stub in tests)
 * @param logger           optional ops logger; defaults to console
 */
export async function ingestEvents({
  events,
  appVersion = null,
  orgId = null,
  prismaClient,
  logger = console,
} = {}) {
  if (!Array.isArray(events)) {
    return { accepted: 0, duplicates: 0, rejected: 0 };
  }
  if (events.length > MAX_BATCH_SIZE) {
    return { accepted: 0, duplicates: 0, rejected: events.length,
             reason: 'batch_too_large' };
  }

  let accepted   = 0;
  let duplicates = 0;
  let rejected   = 0;

  // ── Phase 1: validate every row (in-process) ──────────────
  // Drops malformed entries before any DB work so a bad row
  // can't fail the whole batch.
  const valid = [];
  for (const raw of events) {
    const normalised = validateEvent(raw, appVersion, orgId);
    if (!normalised) rejected += 1;
    else valid.push(normalised);
  }
  if (valid.length === 0) {
    return { accepted, duplicates, rejected };
  }

  // ── Phase 2: prefetch existing ids in ONE query ───────────
  // Reduces N findUnique roundtrips to a single SELECT IN.
  // The N can never exceed MAX_BATCH_SIZE (200) so the
  // parameter list stays well under Postgres's 32k limit.
  // Matched rows are counted as duplicates and dropped from
  // the insert set.
  let existingIds = new Set();
  let prefetchOk = true;
  try {
    const ids = valid.map((v) => v.id);
    const found = await prismaClient.clientEvent.findMany({
      where:  { id: { in: ids } },
      select: { id: true },
    });
    existingIds = new Set(found.map((r) => r.id));
  } catch (err) {
    prefetchOk = false;
    try {
      logger.warn('[ingest] prefetch failed; per-row fallback:',
        err && err.message ? String(err.message).slice(0, 200) : 'unknown');
    } catch { /* swallow */ }
  }
  if (prefetchOk) duplicates += existingIds.size;
  const toInsert = prefetchOk
    ? valid.filter((v) => !existingIds.has(v.id))
    : valid;

  if (toInsert.length === 0) {
    return { accepted, duplicates, rejected };
  }

  // ── Phase 3: bulk insert via createMany ───────────────────
  // skipDuplicates handles the race: if a concurrent batch
  // wrote one of our ids between the prefetch and this call,
  // Prisma silently drops it instead of throwing P2002. The
  // returned `count` tells us exactly how many landed; the
  // shortfall is folded into duplicates so the response
  // counts stay consistent.
  try {
    const result = await prismaClient.clientEvent.createMany({
      data:           toInsert,
      skipDuplicates: true,
    });
    const inserted = Number(result && result.count) || 0;
    accepted += inserted;
    if (inserted < toInsert.length) {
      duplicates += (toInsert.length - inserted);
    }
  } catch (err) {
    // createMany failed entirely (e.g. one row's payload too
    // large). Fall back to per-row writes so the rest of the
    // batch still lands. The fallback path also catches the
    // P2002 race (covered when the prefetch failed too).
    try {
      logger.warn('[ingest] createMany failed; per-row fallback:',
        err && err.message ? String(err.message).slice(0, 200) : 'unknown');
    } catch { /* swallow */ }
    for (const row of toInsert) {
      try {
        await prismaClient.clientEvent.create({ data: row });
        accepted += 1;
      } catch (innerErr) {
        if (innerErr && innerErr.code === 'P2002') {
          duplicates += 1;
        } else {
          rejected += 1;
          try {
            logger.warn('[ingest] row rejected:',
              innerErr && innerErr.message
                ? String(innerErr.message).slice(0, 200) : 'unknown');
          } catch { /* swallow */ }
        }
      }
    }
  }

  return { accepted, duplicates, rejected };
}

export default ingestEvents;
