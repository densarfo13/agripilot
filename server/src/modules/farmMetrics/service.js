/**
 * farmMetrics/service.js — time-series helpers for FarmMetrics.
 *
 *   recordMetric({ farmId, metric, value, unit, program, source,
 *                  metadata, capturedAt }) → row | null
 *   recordMetrics(rows)                                → count
 *   getLatest({ farmId, metric })                      → row | null
 *   getHistory({ farmId, metric, windowDays, limit })  → row[]
 *   getProgramAverage({ program, metric, windowDays }) → number | null
 *   pruneOlderThan({ days })                           → count
 *
 * Contract:
 *   • Tolerates `prisma.farmMetrics` being absent — in that case
 *     writes land in an in-memory buffer + opsEvent so the
 *     pipeline never blocks on a pending migration.
 *   • Every function accepts an optional `prisma` override so tests
 *     can inject a stub without monkey-patching the default client.
 *   • Never throws — failures log via opsEvent and return null/0.
 */

import defaultPrisma from '../../config/database.js';
import { opsEvent }  from '../../utils/opsLogger.js';

const MEMORY_BUFFER = [];
const MAX_MEMORY    = 10_000;
const DAY_MS        = 24 * 3600 * 1000;

function rememberInMemory(row) {
  MEMORY_BUFFER.push({ ...row, id: row.id || `mem_${MEMORY_BUFFER.length + 1}` });
  if (MEMORY_BUFFER.length > MAX_MEMORY) {
    MEMORY_BUFFER.splice(0, MEMORY_BUFFER.length - MAX_MEMORY);
  }
}

function hasFarmMetricsTable(prisma) {
  return !!(prisma && prisma.farmMetrics
    && typeof prisma.farmMetrics.create === 'function');
}

function ensureRow(input) {
  if (!input || typeof input !== 'object') return null;
  const farmId = input.farmId ? String(input.farmId) : null;
  const metric = input.metric ? String(input.metric) : null;
  const valueNum = Number(input.value);
  if (!farmId || !metric || !Number.isFinite(valueNum)) return null;
  return {
    farmId,
    metric,
    value:      valueNum,
    unit:       input.unit ? String(input.unit) : null,
    program:    input.program ? String(input.program) : null,
    source:     input.source ? String(input.source) : null,
    metadata:   input.metadata && typeof input.metadata === 'object' ? input.metadata : null,
    capturedAt: input.capturedAt instanceof Date
      ? input.capturedAt
      : (Number.isFinite(input.capturedAt) ? new Date(input.capturedAt) : new Date()),
  };
}

// ─── Record ──────────────────────────────────────────────────────

export async function recordMetric(input, { prisma = defaultPrisma } = {}) {
  const row = ensureRow(input);
  if (!row) return null;
  if (hasFarmMetricsTable(prisma)) {
    try {
      const created = await prisma.farmMetrics.create({ data: row });
      return created;
    } catch (err) {
      opsEvent('farmMetrics', 'write_failed_memory_fallback', 'warn', {
        metric: row.metric, error: err && err.message,
      });
    }
  }
  rememberInMemory(row);
  return { ...row, id: `mem_${MEMORY_BUFFER.length}` };
}

export async function recordMetrics(rows = [], { prisma = defaultPrisma } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const clean = rows.map(ensureRow).filter(Boolean);
  if (clean.length === 0) return 0;
  if (hasFarmMetricsTable(prisma) && typeof prisma.farmMetrics.createMany === 'function') {
    try {
      const res = await prisma.farmMetrics.createMany({ data: clean, skipDuplicates: true });
      return Number(res.count) || clean.length;
    } catch (err) {
      opsEvent('farmMetrics', 'bulk_write_failed', 'warn', {
        count: clean.length, error: err && err.message,
      });
    }
  }
  for (const row of clean) rememberInMemory(row);
  return clean.length;
}

// ─── Read ────────────────────────────────────────────────────────

export async function getLatest({ farmId, metric }, { prisma = defaultPrisma } = {}) {
  if (!farmId || !metric) return null;
  if (hasFarmMetricsTable(prisma)) {
    try {
      const row = await prisma.farmMetrics.findFirst({
        where:   { farmId: String(farmId), metric: String(metric) },
        orderBy: { capturedAt: 'desc' },
      });
      return row || null;
    } catch (err) {
      opsEvent('farmMetrics', 'latest_read_failed', 'warn', {
        metric, error: err && err.message,
      });
    }
  }
  const matches = MEMORY_BUFFER
    .filter((r) => r.farmId === String(farmId) && r.metric === String(metric))
    .sort((a, b) => (b.capturedAt?.getTime?.() || 0) - (a.capturedAt?.getTime?.() || 0));
  return matches[0] || null;
}

export async function getHistory({
  farmId, metric, windowDays = 30, limit = 500,
}, { prisma = defaultPrisma } = {}) {
  if (!farmId || !metric) return [];
  const since = new Date(Date.now() - Math.max(1, windowDays) * DAY_MS);
  if (hasFarmMetricsTable(prisma)) {
    try {
      const rows = await prisma.farmMetrics.findMany({
        where:   { farmId: String(farmId), metric: String(metric), capturedAt: { gte: since } },
        orderBy: { capturedAt: 'desc' },
        take:    Math.max(1, Math.min(5_000, Number(limit) || 500)),
      });
      return rows;
    } catch (err) {
      opsEvent('farmMetrics', 'history_read_failed', 'warn', {
        metric, error: err && err.message,
      });
    }
  }
  return MEMORY_BUFFER
    .filter((r) =>
      r.farmId === String(farmId)
      && r.metric === String(metric)
      && (r.capturedAt?.getTime?.() || 0) >= since.getTime(),
    )
    .sort((a, b) => (b.capturedAt?.getTime?.() || 0) - (a.capturedAt?.getTime?.() || 0))
    .slice(0, limit);
}

export async function getProgramAverage({
  program, metric, windowDays = 7,
}, { prisma = defaultPrisma } = {}) {
  if (!program || !metric) return null;
  const since = new Date(Date.now() - Math.max(1, windowDays) * DAY_MS);
  if (hasFarmMetricsTable(prisma) && typeof prisma.farmMetrics.aggregate === 'function') {
    try {
      const result = await prisma.farmMetrics.aggregate({
        where: { program: String(program), metric: String(metric), capturedAt: { gte: since } },
        _avg: { value: true },
      });
      const avg = result && result._avg && result._avg.value;
      return Number.isFinite(avg) ? avg : null;
    } catch (err) {
      opsEvent('farmMetrics', 'average_read_failed', 'warn', {
        metric, program, error: err && err.message,
      });
    }
  }
  const matches = MEMORY_BUFFER.filter((r) =>
    r.program === String(program)
    && r.metric === String(metric)
    && (r.capturedAt?.getTime?.() || 0) >= since.getTime(),
  );
  if (matches.length === 0) return null;
  const sum = matches.reduce((s, r) => s + (r.value || 0), 0);
  return sum / matches.length;
}

export async function pruneOlderThan({ days = 90 } = {}, { prisma = defaultPrisma } = {}) {
  const cutoff = new Date(Date.now() - Math.max(1, days) * DAY_MS);
  if (hasFarmMetricsTable(prisma) && typeof prisma.farmMetrics.deleteMany === 'function') {
    try {
      const res = await prisma.farmMetrics.deleteMany({
        where: { capturedAt: { lt: cutoff } },
      });
      return Number(res.count) || 0;
    } catch (err) {
      opsEvent('farmMetrics', 'prune_failed', 'error', { error: err && err.message });
      return 0;
    }
  }
  // Memory mode — splice out old rows.
  const before = MEMORY_BUFFER.length;
  const kept = MEMORY_BUFFER.filter((r) =>
    (r.capturedAt?.getTime?.() || 0) >= cutoff.getTime(),
  );
  MEMORY_BUFFER.length = 0;
  MEMORY_BUFFER.push(...kept);
  return before - kept.length;
}

export const _internal = Object.freeze({
  MEMORY_BUFFER, MAX_MEMORY, DAY_MS,
  ensureRow, hasFarmMetricsTable,
  clear: () => { MEMORY_BUFFER.length = 0; },
});
