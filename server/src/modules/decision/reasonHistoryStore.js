/**
 * reasonHistoryStore.js — persistence contract for reason
 * snapshots. The decision engine's reasonHistoryService is pure;
 * this module is where snapshots actually land.
 *
 * Two implementations:
 *
 *   createInMemoryReasonStore()   — default for dev and tests
 *   createPrismaReasonStore({ prisma }) — expects a `ReasonSnapshot`
 *     model:
 *
 *       model ReasonSnapshot {
 *         id          String   @id @default(cuid())
 *         contextKey  String?  @db.VarChar(128)
 *         reason      String   @db.VarChar(128)
 *         signalType  String   @db.VarChar(80)
 *         direction   String   @db.VarChar(12)
 *         weight      Float
 *         confidence  Float?
 *         timestamp   BigInt
 *         createdAt   DateTime @default(now())
 *         @@index([contextKey, timestamp])
 *         @@index([signalType, timestamp])
 *       }
 *
 * Both implementations expose the same surface:
 *   append(snap)         → Promise<void>
 *   appendMany(snaps)    → Promise<void>
 *   loadFor(contextKey?, opts?) → Promise<ReasonSnapshot[]>
 *   clear()              → Promise<void>  (in-memory only useful; prisma throws)
 */

const DEFAULT_LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000; // 6 months

// ─── In-memory store ─────────────────────────────────────
export function createInMemoryReasonStore({ maxRows = 5000 } = {}) {
  const rows = [];

  function append(snap) {
    if (!snap || !snap.reason) return Promise.resolve();
    rows.push(normalize(snap));
    while (rows.length > maxRows) rows.shift();
    return Promise.resolve();
  }

  function appendMany(snaps) {
    for (const s of Array.isArray(snaps) ? snaps : []) {
      if (!s || !s.reason) continue;
      rows.push(normalize(s));
    }
    while (rows.length > maxRows) rows.shift();
    return Promise.resolve();
  }

  function loadFor(contextKey = null, opts = {}) {
    const since = Number.isFinite(opts.since)
      ? opts.since
      : Date.now() - (opts.lookbackMs || DEFAULT_LOOKBACK_MS);
    return Promise.resolve(
      rows
        .filter((r) => r.timestamp >= since)
        .filter((r) => contextKey == null || r.contextKey === contextKey)
        .sort((a, b) => a.timestamp - b.timestamp),
    );
  }

  function clear() { rows.length = 0; return Promise.resolve(); }

  return { append, appendMany, loadFor, clear, _debug: { rows } };
}

// ─── Prisma-backed store ─────────────────────────────────
export function createPrismaReasonStore({ prisma, tableName = 'reasonSnapshot' } = {}) {
  if (!prisma) throw new Error('createPrismaReasonStore: prisma required');
  const table = prisma[tableName];
  if (!table) throw new Error(`Prisma model '${tableName}' missing — run prisma migrate`);

  async function append(snap) {
    if (!snap || !snap.reason) return;
    await table.create({ data: rowFromSnap(normalize(snap)) });
  }

  async function appendMany(snaps) {
    const rows = (Array.isArray(snaps) ? snaps : [])
      .filter((s) => s && s.reason)
      .map((s) => rowFromSnap(normalize(s)));
    if (!rows.length) return;
    await table.createMany({ data: rows });
  }

  async function loadFor(contextKey = null, opts = {}) {
    const since = Number.isFinite(opts.since)
      ? opts.since
      : Date.now() - (opts.lookbackMs || DEFAULT_LOOKBACK_MS);
    const where = { timestamp: { gte: BigInt(since) } };
    if (contextKey != null) where.contextKey = contextKey;
    const rows = await table.findMany({ where, orderBy: [{ timestamp: 'asc' }] });
    return rows.map(rowToSnap);
  }

  async function clear() {
    throw new Error('clear() is not supported on the Prisma store');
  }

  return { append, appendMany, loadFor, clear };
}

// ─── shared helpers ──────────────────────────────────────
function normalize(s) {
  return {
    contextKey: s.contextKey ?? null,
    reason:     String(s.reason),
    signalType: String(s.signalType || 'unknown'),
    direction:  normalizeDirection(s.direction),
    weight:     clamp01(Number(s.weight ?? 1)),
    confidence: s.confidence == null ? null : clamp01(Number(s.confidence)),
    timestamp:  Number(s.timestamp) || Date.now(),
  };
}

function rowFromSnap(s) {
  return {
    contextKey: s.contextKey,
    reason:     s.reason,
    signalType: s.signalType,
    direction:  s.direction,
    weight:     s.weight,
    confidence: s.confidence,
    timestamp:  BigInt(s.timestamp),
  };
}

function rowToSnap(r) {
  return {
    contextKey: r.contextKey,
    reason:     r.reason,
    signalType: r.signalType,
    direction:  r.direction,
    weight:     Number(r.weight),
    confidence: r.confidence == null ? null : Number(r.confidence),
    timestamp:  Number(r.timestamp),
  };
}

function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

function normalizeDirection(d) {
  if (d === 'positive' || d === 'negative' || d === 'neutral') return d;
  if (typeof d === 'number') {
    if (d > 0) return 'positive';
    if (d < 0) return 'negative';
    return 'neutral';
  }
  return 'neutral';
}
