/**
 * scaleInfra.test.js — cacheClient + queueClient + farmMetrics +
 * farmProcessingCron. The BullMQ / ioredis packages aren't
 * installed in CI, so every test exercises the in-process fallback
 * paths that make this feature ship safely on day one.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import * as cache from '../cache/cacheClient.js';
import {
  getOrCompute, getFarmSummary, invalidateFarmSummary,
  getNgoDashboard, invalidateNgoDashboard, getImpactReport,
} from '../cache/farmSummaryCache.js';

import {
  enqueue, registerProcessor, getQueueInfo, closeAll,
  QUEUES, _internal as queueInternal,
} from '../queue/queueClient.js';

import {
  recordMetric, recordMetrics, getLatest, getHistory,
  getProgramAverage, pruneOlderThan, _internal as metricsInternal,
} from '../modules/farmMetrics/service.js';

import { runSweepOnce } from '../queue/farmProcessingCron.js';

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

beforeEach(() => {
  cache._internal.clearAll();
  cache._internal.resetRedis();
  queueInternal.resetAll();
  metricsInternal.clear();
});

// ─── cacheClient ─────────────────────────────────────────────────
describe('cacheClient memory fallback', () => {
  it('get returns null for missing keys', async () => {
    expect(await cache.get('nope')).toBeNull();
  });

  it('set → get round-trip', async () => {
    await cache.set('k1', { hello: 'world' }, { ttlSec: 60 });
    expect(await cache.get('k1')).toEqual({ hello: 'world' });
  });

  it('ttl expiry returns null', async () => {
    await cache.set('k2', 'value', { ttlSec: 0 });
    // ttlSec <= 0 → default TTL; we validate the mechanism via manual expiry.
    const entry = cache._internal.memStore.get(`${cache._internal.KEY_PREFIX}k2`);
    if (entry) entry.expiresAt = Date.now() - 1;
    expect(await cache.get('k2')).toBeNull();
  });

  it('del removes the key', async () => {
    await cache.set('k3', 1);
    await cache.del('k3');
    expect(await cache.get('k3')).toBeNull();
  });

  it('delByPrefix removes everything under a prefix', async () => {
    await cache.set('farm:1:summary', 1);
    await cache.set('farm:2:summary', 2);
    await cache.set('other:x', 3);
    const removed = await cache.delByPrefix('farm:');
    expect(removed).toBe(2);
    expect(await cache.get('farm:1:summary')).toBeNull();
    expect(await cache.get('other:x')).toBe(3);
  });

  it('ping returns "disabled" when no REDIS_URL', async () => {
    delete process.env.REDIS_URL;
    expect(await cache.ping()).toBe('disabled');
  });
});

describe('farmSummaryCache.getOrCompute', () => {
  it('serves cached value on hit', async () => {
    const loader = vi.fn(async () => 42);
    const a = await getOrCompute('dash:test', loader, { ttlSec: 60 });
    const b = await getOrCompute('dash:test', loader, { ttlSec: 60 });
    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('loader throw caches a short-lived negative marker', async () => {
    const loader = vi.fn(async () => { throw new Error('DB down'); });
    const first  = await getOrCompute('dash:err', loader, { ttlSec: 60 });
    const second = await getOrCompute('dash:err', loader, { ttlSec: 60 });
    expect(first).toBeNull();
    expect(second).toBeNull();
    // Second call should not invoke the loader again within the
    // negative-cache window.
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('getFarmSummary uses per-farm key', async () => {
    let called = 0;
    const summary = await getFarmSummary('f_1', async () => { called += 1; return { ok: true }; });
    expect(summary.ok).toBe(true);
    await getFarmSummary('f_1', async () => { called += 1; return { ok: true }; });
    expect(called).toBe(1);
    await invalidateFarmSummary('f_1');
    await getFarmSummary('f_1', async () => { called += 1; return { ok: true }; });
    expect(called).toBe(2);
  });

  it('invalidateNgoDashboard with no scope clears all dashboard keys', async () => {
    await getNgoDashboard('p1', async () => ({ p: 1 }));
    await getImpactReport('p1', async () => ({ i: 1 }));
    await invalidateNgoDashboard();
    const cached1 = await cache.get('dashboard:p1:ngo');
    const cached2 = await cache.get('dashboard:p1:impact');
    expect(cached1).toBeNull();
    expect(cached2).toBeNull();
  });
});

// ─── queueClient ─────────────────────────────────────────────────
describe('queueClient fallback behaviour', () => {
  it('enqueue with unknown queue rejects', async () => {
    const r = await enqueue('ghost', { x: 1 });
    expect(r.queued).toBe(false);
    expect(r.error).toBe('unknown_queue');
  });

  it('enqueue with no processor defers the job', async () => {
    const r = await enqueue(QUEUES.RISK_SCORING, { farmIds: ['a'] });
    expect(r.queued).toBe(true);
    expect(r.mode).toBe('deferred');
    const info = await getQueueInfo();
    expect(info.queues[QUEUES.RISK_SCORING].deferredBacklog).toBe(1);
  });

  it('registerProcessor drains the deferred backlog', async () => {
    const jobs = [];
    await enqueue(QUEUES.RISK_SCORING, { farmIds: ['a'] });
    await enqueue(QUEUES.RISK_SCORING, { farmIds: ['b'] });
    const { registered } = await registerProcessor(QUEUES.RISK_SCORING, async (job) => {
      jobs.push(job.data);
    });
    expect(registered).toBe(true);
    expect(jobs).toHaveLength(2);
    const info = await getQueueInfo();
    expect(info.queues[QUEUES.RISK_SCORING].deferredBacklog).toBe(0);
  });

  it('enqueue after processor registration runs inline', async () => {
    const seen = [];
    await registerProcessor(QUEUES.NOTIFICATIONS, async (job) => { seen.push(job.data); });
    const r = await enqueue(QUEUES.NOTIFICATIONS, { to: '+1', message: 'hi' });
    expect(r.queued).toBe(true);
    expect(r.mode).toBe('inline');
    expect(seen[0]).toEqual({ to: '+1', message: 'hi' });
  });

  it('inline processor throwing returns queued:false with error', async () => {
    await registerProcessor(QUEUES.AUTONOMOUS_ACTIONS, async () => { throw new Error('boom'); });
    const r = await enqueue(QUEUES.AUTONOMOUS_ACTIONS, { anything: true });
    expect(r.queued).toBe(false);
    expect(r.error).toBe('processor_threw');
  });

  it('invalid payload rejected cleanly', async () => {
    const r = await enqueue(QUEUES.RISK_SCORING, null);
    expect(r.queued).toBe(false);
    expect(r.error).toBe('invalid_payload');
  });

  it('getQueueInfo reports REDIS_URL state', async () => {
    const before = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    const info = await getQueueInfo();
    expect(info.redisConfigured).toBe(false);
    if (before) process.env.REDIS_URL = before;
  });

  it('closeAll drops every handle', async () => {
    await registerProcessor(QUEUES.RISK_SCORING, async () => {});
    await enqueue(QUEUES.RISK_SCORING, { farmIds: ['x'] });
    await closeAll();
    const info = await getQueueInfo();
    expect(info.queues[QUEUES.RISK_SCORING].processorRegistered).toBe(false);
    expect(info.queues[QUEUES.RISK_SCORING].deferredBacklog).toBe(0);
  });
});

// ─── FarmMetrics ─────────────────────────────────────────────────
function makePrisma() {
  const rows = [];
  return {
    _rows: rows,
    farmMetrics: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `fm_${rows.length + 1}`, ...data };
        rows.push(row);
        return row;
      }),
      createMany: vi.fn(async ({ data }) => {
        for (const d of data) rows.push({ id: `fm_${rows.length + 1}`, ...d });
        return { count: data.length };
      }),
      findFirst: vi.fn(async ({ where, orderBy }) => {
        const out = rows
          .filter((r) => r.farmId === where.farmId && r.metric === where.metric)
          .sort((a, b) => (b.capturedAt.getTime()) - (a.capturedAt.getTime()));
        return out[0] || null;
      }),
      findMany: vi.fn(async ({ where, orderBy, take }) => {
        const since = where.capturedAt && where.capturedAt.gte;
        return rows
          .filter((r) =>
            r.farmId === where.farmId
            && r.metric === where.metric
            && (!since || r.capturedAt.getTime() >= since.getTime()),
          )
          .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())
          .slice(0, take);
      }),
      aggregate: vi.fn(async ({ where }) => {
        const since = where.capturedAt && where.capturedAt.gte;
        const matches = rows.filter((r) =>
          r.program === where.program
          && r.metric === where.metric
          && (!since || r.capturedAt.getTime() >= since.getTime()),
        );
        const avg = matches.length
          ? matches.reduce((s, r) => s + r.value, 0) / matches.length
          : null;
        return { _avg: { value: avg } };
      }),
      deleteMany: vi.fn(async ({ where }) => {
        const cutoff = where.capturedAt && where.capturedAt.lt;
        const before = rows.length;
        const kept = rows.filter((r) => !cutoff || r.capturedAt.getTime() >= cutoff.getTime());
        rows.length = 0;
        rows.push(...kept);
        return { count: before - kept.length };
      }),
    },
  };
}

describe('farmMetrics', () => {
  it('recordMetric writes with prisma when available', async () => {
    const prisma = makePrisma();
    const row = await recordMetric({
      farmId: 'f1', metric: 'risk_score', value: 42,
      unit: 'score', source: 'worker',
    }, { prisma });
    expect(row.id).toMatch(/^fm_/);
    expect(prisma._rows).toHaveLength(1);
  });

  it('recordMetric rejects bad input', async () => {
    expect(await recordMetric({ metric: 'risk_score', value: 1 })).toBeNull();
    expect(await recordMetric({ farmId: 'f1', value: 1 })).toBeNull();
    expect(await recordMetric({ farmId: 'f1', metric: 'x', value: NaN })).toBeNull();
  });

  it('falls back to memory when prisma.farmMetrics is missing', async () => {
    const row = await recordMetric({
      farmId: 'f1', metric: 'risk_score', value: 42,
    }, { prisma: {} });
    expect(row).toBeTruthy();
    expect(metricsInternal.MEMORY_BUFFER).toHaveLength(1);
  });

  it('recordMetrics bulk writes', async () => {
    const prisma = makePrisma();
    const count = await recordMetrics([
      { farmId: 'a', metric: 'risk_score', value: 10 },
      { farmId: 'b', metric: 'risk_score', value: 20 },
      { farmId: 'c', metric: 'risk_score', value: 30 },
    ], { prisma });
    expect(count).toBe(3);
    expect(prisma._rows).toHaveLength(3);
  });

  it('getLatest returns newest row', async () => {
    const prisma = makePrisma();
    await recordMetric({ farmId: 'f1', metric: 'r', value: 10, capturedAt: new Date(NOW - DAY) }, { prisma });
    await recordMetric({ farmId: 'f1', metric: 'r', value: 20, capturedAt: new Date(NOW) }, { prisma });
    const latest = await getLatest({ farmId: 'f1', metric: 'r' }, { prisma });
    expect(latest.value).toBe(20);
  });

  it('getHistory filters by window', async () => {
    const prisma = makePrisma();
    await recordMetric({ farmId: 'f1', metric: 'r', value: 10, capturedAt: new Date(NOW - 40 * DAY) }, { prisma });
    await recordMetric({ farmId: 'f1', metric: 'r', value: 20, capturedAt: new Date(NOW - DAY) }, { prisma });
    const rows = await getHistory({ farmId: 'f1', metric: 'r', windowDays: 30 }, { prisma });
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(20);
  });

  it('getProgramAverage computes _avg', async () => {
    const prisma = makePrisma();
    await recordMetric({ farmId: 'f1', program: 'p1', metric: 'r', value: 10 }, { prisma });
    await recordMetric({ farmId: 'f2', program: 'p1', metric: 'r', value: 30 }, { prisma });
    const avg = await getProgramAverage({ program: 'p1', metric: 'r', windowDays: 7 }, { prisma });
    expect(avg).toBe(20);
  });

  it('pruneOlderThan removes stale rows', async () => {
    const prisma = makePrisma();
    await recordMetric({ farmId: 'f1', metric: 'r', value: 1, capturedAt: new Date(NOW - 120 * DAY) }, { prisma });
    await recordMetric({ farmId: 'f1', metric: 'r', value: 2, capturedAt: new Date(NOW) }, { prisma });
    const removed = await pruneOlderThan({ days: 90 }, { prisma });
    expect(removed).toBe(1);
    expect(prisma._rows).toHaveLength(1);
  });
});

// ─── farmProcessingCron sweep ────────────────────────────────────
describe('runSweepOnce', () => {
  it('pages the farmer roster and enqueues one job per batch', async () => {
    const farms = Array.from({ length: 1200 }, (_, i) => ({ id: `f_${String(i + 1).padStart(5, '0')}` }));
    const prismaClient = {
      farmer: {
        findMany: vi.fn(async ({ where, take, orderBy }) => {
          const cursor = where && where.id && where.id.gt;
          const startIdx = cursor
            ? farms.findIndex((f) => f.id > cursor)
            : 0;
          if (startIdx < 0) return [];
          return farms.slice(startIdx, startIdx + take);
        }),
      },
    };
    const seen = [];
    await registerProcessor(QUEUES.RISK_SCORING, async (job) => { seen.push(job.data); });
    const res = await runSweepOnce({ prismaClient, batchSize: 300, now: NOW });
    expect(res.cycle).toBe('ok');
    expect(res.batches).toBe(4);
    expect(res.enqueued).toBe(1200);
    expect(seen).toHaveLength(4);
    const allFarmIds = seen.flatMap((d) => d.farmIds);
    expect(new Set(allFarmIds).size).toBe(1200);
  });

  it('no farmers → cycle still OK, zero enqueued', async () => {
    const prismaClient = { farmer: { findMany: vi.fn(async () => []) } };
    const res = await runSweepOnce({ prismaClient, batchSize: 100 });
    expect(res.enqueued).toBe(0);
    expect(res.batches).toBe(0);
  });

  it('honours maxBatches cap', async () => {
    const prismaClient = {
      farmer: {
        findMany: vi.fn(async ({ take }) =>
          Array.from({ length: take }, (_, i) => ({ id: `f_${Date.now()}_${i}` })),
        ),
      },
    };
    const res = await runSweepOnce({ prismaClient, batchSize: 50, maxBatches: 3 });
    expect(res.batches).toBe(3);
  });

  it('missing prisma handled gracefully', async () => {
    const res = await runSweepOnce({ prismaClient: {} });
    expect(res.cycle).toBe('skipped');
  });
});
