/**
 * farmStateService.js — FARM_PERSISTENCE_V1 server side.
 *
 * Durable source of truth for farmer state (plants / scanHistory / tasks
 * / outcomes / timeline) that used to live only in localStorage. The
 * client mirrors every write here and recovers from here on login.
 *
 *   syncRecords(prisma, userId, records)  — batch upsert (last-write-wins)
 *   getRecords(prisma, userId, opts)       — recovery read
 *
 * Strict: never throws to the caller's response path (routes catch);
 * validates domain + caps batch/payload size; stores only what the client
 * already held locally (no new PII).
 */

export const FARM_STATE_DOMAINS = Object.freeze([
  'plants', 'scanHistory', 'tasks', 'outcomes', 'timeline',
]);
const _DOMAIN_SET = new Set(FARM_STATE_DOMAINS);

const MAX_BATCH = 300;
const MAX_PAYLOAD_BYTES = 100 * 1024; // 100 KB per record

function _num(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Upsert a batch of client records. Last-write-wins by clientUpdatedAt:
 * an incoming record older than the stored one is skipped (so a stale
 * offline write can't clobber a newer value synced from another device).
 */
export async function syncRecords(prisma, userId, records) {
  if (!prisma || !userId || !Array.isArray(records)) {
    return { ok: false, applied: 0, skipped: 0, error: 'bad_input' };
  }
  const batch = records.slice(0, MAX_BATCH);
  let applied = 0, skipped = 0;
  for (const r of batch) {
    try {
      const domain = String(r && r.domain || '');
      const recordId = String(r && r.recordId || '');
      if (!_DOMAIN_SET.has(domain) || !recordId) { skipped++; continue; }
      const payload = (r && typeof r.payload === 'object' && r.payload !== null) ? r.payload : null;
      if (payload == null) { skipped++; continue; }
      if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) { skipped++; continue; }
      const clientUpdatedAt = _num(r.clientUpdatedAt);
      const deleted = r.deleted === true;

      const key = { userId_domain_recordId: { userId, domain, recordId } };
      const existing = await prisma.farmStateRecord.findUnique({ where: key });
      if (existing && existing.clientUpdatedAt != null && clientUpdatedAt != null
          && existing.clientUpdatedAt > clientUpdatedAt) {
        skipped++; continue; // stored value is newer — keep it
      }
      await prisma.farmStateRecord.upsert({
        where: key,
        update: { payload, deleted, clientUpdatedAt },
        create: { userId, domain, recordId, payload, deleted, clientUpdatedAt },
      });
      applied++;
    } catch { skipped++; }
  }
  return { ok: true, applied, skipped };
}

/** Recovery read — non-deleted records for the user, by domain. */
export async function getRecords(prisma, userId, opts = {}) {
  if (!prisma || !userId) return { ok: false, records: [] };
  const domains = Array.isArray(opts.domains)
    ? opts.domains.filter((d) => _DOMAIN_SET.has(d))
    : FARM_STATE_DOMAINS;
  const since = _num(opts.since);
  const where = { userId, domain: { in: domains }, deleted: false };
  if (since) where.updatedAt = { gte: new Date(since) };
  let rows = [];
  try {
    rows = await prisma.farmStateRecord.findMany({
      where, orderBy: { updatedAt: 'desc' }, take: 5000,
    });
  } catch { rows = []; }
  return {
    ok: true,
    serverTime: Date.now(),
    records: rows.map((r) => ({
      domain: r.domain,
      recordId: r.recordId,
      payload: r.payload,
      clientUpdatedAt: r.clientUpdatedAt,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    })),
  };
}

export const _internal = Object.freeze({ MAX_BATCH, MAX_PAYLOAD_BYTES });
