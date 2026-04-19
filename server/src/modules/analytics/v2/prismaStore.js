/**
 * prismaStore.js — a Prisma-backed implementation of the v2
 * analytics store contract:
 *
 *   { persistFn, loadUsers, loadFeedbackHistory, mergeFeedbackSignal }
 *
 * Assumes two tables exist in your schema (names are adjustable
 * via opts):
 *
 *   AnalyticsEventV2 {
 *     id          String   @id @default(cuid())
 *     userId      String?  @db.VarChar(64)
 *     type        String   @db.VarChar(80)
 *     timestamp   BigInt
 *     sessionId   String?  @db.VarChar(64)
 *     mode        String?  @db.VarChar(16)
 *     language    String?  @db.VarChar(8)
 *     country     String?  @db.VarChar(8)
 *     stateCode   String?  @db.VarChar(16)
 *     confidence  Json?
 *     meta        Json?
 *     clientKey   String?  @db.VarChar(128)
 *     createdAt   DateTime @default(now())
 *     @@index([userId, timestamp])
 *     @@index([type, timestamp])
 *     @@unique([userId, clientKey])
 *   }
 *
 *   RecommendationFeedback {
 *     id           String   @id @default(cuid())
 *     countryCrop  String   @unique       // lowercase "gh:maize"
 *     score        Float
 *     n            Int
 *     reasons      Json
 *     updatedAt    DateTime @updatedAt
 *   }
 *
 * If your existing schema uses different names, pass `opts.tables`
 * to remap. The caller is responsible for running prisma migrate
 * before mounting the router.
 *
 * This file is intentionally graceful: if Prisma isn't available
 * at import time, the factory throws a clear error instead of
 * crashing during route loading.
 */

import {
  applyOutcomeSignalToRecommendationHistory,
} from '../../../services/recommendations/recommendationFeedbackService.js';

const DEFAULT_TABLES = Object.freeze({
  event:    'analyticsEventV2',
  feedback: 'recommendationFeedback',
});

export function createPrismaStore({ prisma, tables = DEFAULT_TABLES, userWindowDays = 90 } = {}) {
  if (!prisma) throw new Error('createPrismaStore: prisma client is required');
  const eventTable    = prisma[tables.event];
  const feedbackTable = prisma[tables.feedback];
  if (!eventTable)    throw new Error(`Prisma model '${tables.event}' missing — run prisma migrate`);
  if (!feedbackTable) throw new Error(`Prisma model '${tables.feedback}' missing — run prisma migrate`);

  async function persistFn(accepted, { userId }) {
    if (!accepted.length) return;
    const rows = accepted.map((e) => ({
      userId:     userId || null,
      type:       e.type,
      timestamp:  BigInt(e.timestamp),
      sessionId:  e.sessionId,
      mode:       e.mode,
      language:   e.language,
      country:    e.country,
      stateCode:  e.stateCode,
      confidence: e.confidence ?? null,
      meta:       e.meta ?? {},
      clientKey:  e.clientKey || null,
    }));
    // Idempotency: createMany with skipDuplicates (needs a unique
    // composite on (userId, clientKey)). If you can't use that,
    // replace with upsert per row.
    await eventTable.createMany({ data: rows, skipDuplicates: true });
  }

  async function loadUsers({ since } = {}) {
    const sinceMs = since
      ? new Date(since).getTime()
      : Date.now() - userWindowDays * 24 * 60 * 60 * 1000;
    const rows = await eventTable.findMany({
      where: { timestamp: { gte: BigInt(sinceMs) } },
      orderBy: [{ userId: 'asc' }, { timestamp: 'asc' }],
    });
    const byUser = new Map();
    for (const r of rows) {
      const u = r.userId || 'anon';
      const arr = byUser.get(u) || [];
      arr.push(rowToEvent(r));
      byUser.set(u, arr);
    }
    return [...byUser.entries()].map(([userId, events]) => ({ userId, events }));
  }

  async function loadFeedbackHistory() {
    const rows = await feedbackTable.findMany({});
    const out = {};
    for (const r of rows) {
      out[r.countryCrop] = {
        score: Number(r.score) || 0,
        n: Number(r.n) || 0,
        reasons: Array.isArray(r.reasons) ? r.reasons : [],
      };
    }
    return out;
  }

  async function mergeFeedbackSignal(signal) {
    if (!signal || !signal.crop || !signal.country) return;
    const key  = `${signal.country}:${signal.crop}`.toLowerCase();
    const curr = await feedbackTable.findUnique({ where: { countryCrop: key } }).catch(() => null);
    const prev = curr
      ? { [key]: { score: curr.score, n: curr.n, reasons: curr.reasons || [] } }
      : {};
    const merged = applyOutcomeSignalToRecommendationHistory(prev, signal);
    const next = merged[key];
    await feedbackTable.upsert({
      where:  { countryCrop: key },
      update: { score: next.score, n: next.n, reasons: next.reasons },
      create: { countryCrop: key, score: next.score, n: next.n, reasons: next.reasons },
    });
  }

  return { persistFn, loadUsers, loadFeedbackHistory, mergeFeedbackSignal };
}

function rowToEvent(r) {
  return {
    type:       r.type,
    timestamp:  Number(r.timestamp),
    sessionId:  r.sessionId,
    mode:       r.mode,
    language:   r.language,
    country:    r.country,
    stateCode:  r.stateCode,
    confidence: r.confidence ?? null,
    meta:       r.meta ?? {},
    clientKey:  r.clientKey,
  };
}
