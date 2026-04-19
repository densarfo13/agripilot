/**
 * optimizationAuditService.js — capped, in-memory audit log of
 * every adjustment the loop emits. Replaceable with a
 * Prisma-backed implementation in production (same interface).
 *
 * Contract every store must honor:
 *   append(record)               → sync void
 *   appendMany(records)          → sync void
 *   getOptimizationAuditTrail(q) → sync Record[]
 *   clear()                      → sync void
 *   size()                       → sync number
 *
 * Why in-memory by default?
 *   • dev + tests don't need a DB
 *   • production callers wire in their own store
 *   • the cap (1000 default) keeps memory use bounded even in
 *     long-running processes
 *
 * Shape of a record (same as buildOptimizationExplanation's
 * output plus an `id`):
 *   {
 *     id, contextKey, scope, explanation,
 *     sourceSignalCount, deltas, reasons, counts, createdAt,
 *   }
 */

const DEFAULT_CAP = 1000;

function mintId(createdAt = Date.now()) {
  return `opt_${createdAt.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * createInMemoryAuditStore — the default implementation.
 * Keeps a capped ring buffer of the most recent records.
 */
export function createInMemoryAuditStore({ cap = DEFAULT_CAP } = {}) {
  const entries = [];

  function append(record) {
    if (!record || typeof record !== 'object') return;
    const stamped = { id: mintId(record.createdAt), ...record };
    entries.push(stamped);
    while (entries.length > cap) entries.shift();
  }

  function appendMany(records) {
    if (!Array.isArray(records)) return;
    for (const r of records) append(r);
  }

  function getOptimizationAuditTrail(q = {}) {
    const {
      contextKey = null, scope = null,
      since = null, limit = 100,
      minDelta = 0,
    } = q || {};
    let out = entries;
    if (contextKey) out = out.filter((e) => e.contextKey === contextKey);
    if (scope)      out = out.filter((e) => e.scope === scope);
    if (Number.isFinite(since)) out = out.filter((e) => e.createdAt >= since);
    if (minDelta > 0) {
      out = out.filter((e) => {
        const d = e.deltas || {};
        return Math.abs(d.recommendation || 0) >= minDelta
            || Math.abs(d.confidence     || 0) >= minDelta
            || Math.abs(d.urgency        || 0) >= minDelta
            || Math.abs(d.listingQuality || 0) >= minDelta;
      });
    }
    // Newest first, capped at `limit`.
    return out.slice(-limit).reverse();
  }

  function clear() { entries.length = 0; }
  function size()  { return entries.length; }

  return Object.freeze({
    append, appendMany, getOptimizationAuditTrail, clear, size,
    // Internal peek for tests that want the raw array.
    _debug: () => entries.slice(),
  });
}

/**
 * wrapStore — adapter so a caller-supplied Prisma-like store can
 * fulfil the same interface as the in-memory store. Callers pass
 * the four CRUD-ish callbacks; we return the same shape.
 */
export function wrapStore({ persist, query, clear = null, size = null } = {}) {
  if (typeof persist !== 'function' || typeof query !== 'function') {
    throw new Error('wrapStore: persist + query callbacks required');
  }
  return Object.freeze({
    append: (r) => { if (r) persist({ id: mintId(r.createdAt), ...r }); },
    appendMany: (rs) => { for (const r of rs || []) if (r) persist({ id: mintId(r.createdAt), ...r }); },
    getOptimizationAuditTrail: (q) => query(q || {}),
    clear: () => { if (clear) clear(); },
    size:  () => (size ? size() : 0),
  });
}

/**
 * buildAuditSummary — small rollup for dashboards. Counts entries
 * per scope + per delta family. Does NOT return the full trail.
 */
export function buildAuditSummary(store) {
  if (!store || typeof store.getOptimizationAuditTrail !== 'function') {
    return { total: 0, byScope: {}, byFamily: {} };
  }
  const rows = store.getOptimizationAuditTrail({ limit: 1_000_000 });
  const byScope  = {};
  const byFamily = { recommendation: 0, confidence: 0, urgency: 0, listingQuality: 0 };
  for (const r of rows) {
    byScope[r.scope] = (byScope[r.scope] || 0) + 1;
    for (const k of Object.keys(byFamily)) {
      if (Math.abs((r.deltas || {})[k] || 0) > 0) byFamily[k] += 1;
    }
  }
  return { total: rows.length, byScope, byFamily };
}

export const _internal = { DEFAULT_CAP, mintId };
