/**
 * dedupStore.test.js — locks the persistent dedup helper that
 * Fix 5 of the production-stability sprint added. The live cron
 * already uses AutoNotification + rateLimiter for persistent dedup;
 * this helper is the bridge for the day someone migrates the cron
 * to consume insightNotificationAdapter.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/database.js', () => {
  const rows = [];
  return {
    default: {
      autoNotification: {
        async findMany({ where, take, orderBy, select } = {}) {
          // Return rows whose createdAt is within the gte filter and
          // optional userId/farmerId filters match.
          let out = rows.slice();
          if (where && where.createdAt && where.createdAt.gte) {
            out = out.filter((r) => new Date(r.createdAt) >= where.createdAt.gte);
          }
          if (where && where.farmerId) out = out.filter((r) => r.farmerId === where.farmerId);
          if (where && where.userId)   out = out.filter((r) => r.userId   === where.userId);
          out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (take) out = out.slice(0, take);
          return out.map((r) => ({ metadata: r.metadata }));
        },
        async count({ where } = {}) {
          let out = rows.slice();
          if (where && where.metadata && where.metadata.equals) {
            out = out.filter((r) => r.metadata
              && r.metadata.dedupKey === where.metadata.equals);
          }
          if (where && where.userId)   out = out.filter((r) => r.userId   === where.userId);
          if (where && where.farmerId) out = out.filter((r) => r.farmerId === where.farmerId);
          if (where && where.type)     out = out.filter((r) => r.type     === where.type);
          return out.length;
        },
        async create({ data }) {
          rows.push({ ...data, createdAt: new Date() });
          return data;
        },
      },
      _seed: rows,
    },
  };
});

import prisma from '../config/database.js';
import {
  getRecentDedupKeys, recordDedupKey,
} from '../modules/notifications/dedupStore.js';

describe('dedupStore', () => {
  it('returns an empty Set on a fresh database', async () => {
    prisma._seed.length = 0;
    const out = await getRecentDedupKeys({ windowHours: 24 });
    expect(out).toBeInstanceOf(Set);
    expect(out.size).toBe(0);
  });

  it('records a dedup key and reads it back', async () => {
    prisma._seed.length = 0;
    await recordDedupKey({
      key: 'whatsapp:insight:farm-1:insight.water.stress:2026-04-23',
      userId: 'u1', farmerId: 'farm-1', type: 'insight_alert',
    });
    const keys = await getRecentDedupKeys({ windowHours: 24 });
    expect(keys.has('whatsapp:insight:farm-1:insight.water.stress:2026-04-23')).toBe(true);
  });

  it('survives a missing key safely (no-op)', async () => {
    prisma._seed.length = 0;
    await expect(recordDedupKey({ key: null })).resolves.toBeUndefined();
    expect(prisma._seed.length).toBe(0);
  });

  it('scopes the read to a specific farmer when supplied', async () => {
    prisma._seed.length = 0;
    await recordDedupKey({ key: 'k1', farmerId: 'farm-A', type: 't' });
    await recordDedupKey({ key: 'k2', farmerId: 'farm-B', type: 't' });
    const ofA = await getRecentDedupKeys({ farmerId: 'farm-A' });
    expect(ofA.has('k1')).toBe(true);
    expect(ofA.has('k2')).toBe(false);
  });

  it('does not duplicate when the same key is re-recorded within the window', async () => {
    prisma._seed.length = 0;
    await recordDedupKey({ key: 'dup', farmerId: 'f', type: 't' });
    await recordDedupKey({ key: 'dup', farmerId: 'f', type: 't' });
    expect(prisma._seed.length).toBe(1);
  });
});
