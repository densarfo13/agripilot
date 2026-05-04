/**
 * decisionV2Routes.test.js — integration tests for the v2
 * decision API: persistence, ownership, outcome feedback,
 * history, and safe fallback.
 *
 * Pattern: vi.mock the prisma client + auth middleware so the
 * routes run against an in-memory fake. We mount the routers
 * on a tiny Express app and make real HTTP calls via fetch.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import http from 'node:http';
import express from 'express';

// ─── Mocks (must run before importing routes) ────────────────

const mocks = vi.hoisted(() => {
  const fakeUser = { id: 'u-1', sub: 'u-1', role: 'farmer', organizationId: null };
  return {
    fakeUser,
    decisionContexts:  [],
    dailyDecisions:    [],
    actionCompletions: [],
    outcomeFeedback:   [],
    farmProfiles:      [{ id: 'farm-1', userId: 'u-1', status: 'active',
                          crop: 'tomato', stage: 'vegetative',
                          country: 'GH', locationName: 'Ashanti',
                          latitude: null, longitude: null }],
    clientEvents:      [],
  };
});

vi.mock('../middleware/auth.js', () => ({
  authenticate: (req, _res, next) => {
    req.user = mocks.fakeUser;
    next();
  },
}));

// Disable the rate-limit middleware in the test env — it would
// otherwise count test requests against the IP cap and 429 us
// after the second hit. Keep the export shape identical.
vi.mock('../middleware/rateLimiters.js', () => {
  const passthrough = (_req, _res, next) => next();
  return {
    submissionLimiter: passthrough,
    workflowLimiter:   passthrough,
    uploadLimiter:     passthrough,
    securityLimiter:   passthrough,
    inviteLimiter:     passthrough,
    resendInviteLimiter: passthrough,
    registrationLimiter: passthrough,
  };
});

vi.mock('../utils/opsLogger.js', () => ({
  opsEvent: vi.fn(),
  logPermissionEvent: vi.fn(),
  logAuthEvent: vi.fn(),
  logWorkflowEvent: vi.fn(),
  logUploadEvent: vi.fn(),
  logSystemEvent: vi.fn(),
}));

// Suppress live network calls.
vi.mock('../services/weather/weatherProvider.js', () => ({
  getWeatherForFarm: vi.fn(async () => null),
  normalizeForecast: () => null,
  _internal: {},
  _clearCache: () => {},
}));

vi.mock('../config/database.js', () => {
  function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
  const prisma = {
    decisionContext: {
      create: vi.fn(async ({ data, select }) => {
        const row = { id: makeId('ctx'), createdAt: new Date(), ...data };
        mocks.decisionContexts.push(row);
        return select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row;
      }),
      findUnique: vi.fn(async ({ where, select }) => {
        const row = mocks.decisionContexts.find((r) => r.id === where.id);
        if (!row) return null;
        return select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row;
      }),
    },
    dailyDecision: {
      create: vi.fn(async ({ data, select }) => {
        const row = { id: makeId('dec'), createdAt: new Date(), completed: false, completedAt: null, ...data };
        mocks.dailyDecisions.push(row);
        return select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row;
      }),
      findUnique: vi.fn(async ({ where, select }) => {
        const row = mocks.dailyDecisions.find((r) => r.id === where.id);
        if (!row) return null;
        return select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = mocks.dailyDecisions.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
      findMany: vi.fn(async ({ where, orderBy, take, select }) => {
        let rows = mocks.dailyDecisions.filter((r) =>
          (!where || !where.userId || r.userId === where.userId));
        if (orderBy && orderBy.createdAt === 'desc') {
          rows = [...rows].sort((a, b) => b.createdAt - a.createdAt);
        }
        if (take) rows = rows.slice(0, take);
        if (!select) return rows;
        return rows.map((r) =>
          Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, r[k]])));
      }),
    },
    actionCompletion: {
      create: vi.fn(async ({ data }) => {
        const row = { id: makeId('act'), completedAt: new Date(), ...data };
        mocks.actionCompletions.push(row);
        return row;
      }),
    },
    outcomeFeedback: {
      create: vi.fn(async ({ data }) => {
        const row = { id: makeId('out'), createdAt: new Date(), ...data };
        mocks.outcomeFeedback.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where, orderBy, select }) => {
        let rows = mocks.outcomeFeedback.filter((r) =>
          (!where || !where.userId || r.userId === where.userId));
        if (where && where.decisionId && where.decisionId.in) {
          rows = rows.filter((r) => where.decisionId.in.includes(r.decisionId));
        }
        if (orderBy && orderBy.createdAt === 'desc') {
          rows = [...rows].sort((a, b) => b.createdAt - a.createdAt);
        }
        if (!select) return rows;
        return rows.map((r) =>
          Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, r[k]])));
      }),
    },
    farmProfile: {
      findFirst: vi.fn(async ({ where }) => {
        const rows = mocks.farmProfiles.filter((r) =>
          (!where.userId || r.userId === where.userId)
          && (!where.status || r.status === where.status));
        return rows[0] || null;
      }),
    },
    clientEvent: {
      findFirst: vi.fn(async () => null),
      findMany:  vi.fn(async () => []),
      create:    vi.fn(async ({ data }) => { mocks.clientEvents.push(data); return data; }),
      upsert:    vi.fn(async ({ create }) => { mocks.clientEvents.push(create); return create; }),
    },
  };
  return { default: prisma };
});

// Now import the routes (after mocks).
const { default: routers } = await import('../modules/decisionV2/routes.js');

// ─── Test harness: tiny express app per suite ────────────────
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/decision', routers.decisionRouter);
  app.use('/api/soil',     routers.soilRouter);
  return app;
}

let server;
let baseUrl;
beforeEach(async () => {
  // Reset fakes between tests.
  mocks.decisionContexts.length = 0;
  mocks.dailyDecisions.length = 0;
  mocks.actionCompletions.length = 0;
  mocks.outcomeFeedback.length = 0;
  mocks.fakeUser.role = 'farmer';
  if (server) { server.close(); server = null; }
  const app = buildApp();
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});
afterAll(() => { if (server) server.close(); });

async function call(method, path, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body: json };
}

// ─── Tests ───────────────────────────────────────────────────

describe('GET /api/decision/today — persistence', () => {
  it('creates a DailyDecision and returns the spec response shape', async () => {
    const r = await call('GET', '/api/decision/today');
    expect(r.status).toBe(200);
    expect(r.body.decisionId).toBeTruthy();
    expect(typeof r.body.primaryAction).toBe('string');
    expect(typeof r.body.primaryCta).toBe('string');
    expect(typeof r.body.reason).toBe('string');
    expect(typeof r.body.priority).toBe('number');
    expect(['low', 'medium', 'high']).toContain(r.body.confidence);
    expect(typeof r.body.tomorrowHook).toBe('string');
    // sourceSignals + ruleId NEVER returned to non-admins.
    expect(r.body.sourceSignals).toBeUndefined();
    expect(r.body.ruleId).toBeUndefined();
    // Persistence: one new row.
    expect(mocks.dailyDecisions.length).toBe(1);
    expect(mocks.dailyDecisions[0].userId).toBe('u-1');
    expect(mocks.decisionContexts.length).toBe(1);
  });

  it('returns sourceSignals + ruleId only with debug=1 + admin role', async () => {
    mocks.fakeUser.role = 'platform_admin';
    const r = await call('GET', '/api/decision/today?debug=1');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.sourceSignals)).toBe(true);
    expect(typeof r.body.ruleId).toBe('string');
  });

  it('ignores debug=1 when role is not admin', async () => {
    mocks.fakeUser.role = 'farmer';
    const r = await call('GET', '/api/decision/today?debug=1');
    expect(r.status).toBe(200);
    expect(r.body.sourceSignals).toBeUndefined();
    expect(r.body.ruleId).toBeUndefined();
  });
});

describe('POST /api/decision/complete — ownership', () => {
  it('marks the decision complete + creates an ActionCompletion', async () => {
    const today = await call('GET', '/api/decision/today');
    const decisionId = today.body.decisionId;
    expect(decisionId).toBeTruthy();

    const r = await call('POST', '/api/decision/complete', {
      decisionId, actionType: 'inspect',
    });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(typeof r.body.message).toBe('string');
    expect(r.body.message.length).toBeGreaterThan(0);
    expect(typeof r.body.tomorrowHook).toBe('string');

    const row = mocks.dailyDecisions.find((d) => d.id === decisionId);
    expect(row.completed).toBe(true);
    expect(row.completedAt).toBeTruthy();
    expect(mocks.actionCompletions.length).toBe(1);
    expect(mocks.actionCompletions[0].decisionId).toBe(decisionId);
    expect(mocks.actionCompletions[0].userId).toBe('u-1');
  });

  it('rejects 403 when the decision belongs to another user', async () => {
    // Manually plant a decision owned by someone else.
    mocks.dailyDecisions.push({
      id: 'other-decision',
      userId: 'someone-else',
      completed: false,
      ruleId: null, primaryAction: 'x', tomorrowHook: null,
      contextId: null, createdAt: new Date(),
    });
    const r = await call('POST', '/api/decision/complete', {
      decisionId: 'other-decision',
    });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('decision_not_owned');
  });

  it('returns 404 when the decision does not exist', async () => {
    const r = await call('POST', '/api/decision/complete', {
      decisionId: 'does-not-exist',
    });
    expect(r.status).toBe(404);
    expect(r.body.code).toBe('decision_not_found');
  });

  it('400s on missing decisionId', async () => {
    const r = await call('POST', '/api/decision/complete', {});
    expect(r.status).toBe(400);
  });
});

describe('POST /api/decision/outcome — feedback ledger', () => {
  it('records a healthy outcome on the user\u2019s own decision', async () => {
    const today = await call('GET', '/api/decision/today');
    const decisionId = today.body.decisionId;
    const r = await call('POST', '/api/decision/outcome', {
      decisionId, result: 'healthy', notes: 'Looks great today',
    });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(mocks.outcomeFeedback.length).toBe(1);
    expect(mocks.outcomeFeedback[0].result).toBe('healthy');
    expect(mocks.outcomeFeedback[0].userId).toBe('u-1');
  });

  it('rejects an invalid result enum', async () => {
    const today = await call('GET', '/api/decision/today');
    const r = await call('POST', '/api/decision/outcome', {
      decisionId: today.body.decisionId, result: 'banana',
    });
    expect(r.status).toBe(400);
  });

  it('blocks cross-user outcome writes', async () => {
    mocks.dailyDecisions.push({
      id: 'foreign-decision', userId: 'someone-else',
      completed: false, primaryAction: 'x', createdAt: new Date(),
    });
    const r = await call('POST', '/api/decision/outcome', {
      decisionId: 'foreign-decision', result: 'healthy',
    });
    expect(r.status).toBe(403);
  });
});

describe('GET /api/decision/history — own decisions only', () => {
  it('returns the user\u2019s own decisions hydrated with outcomes', async () => {
    const today = await call('GET', '/api/decision/today');
    await call('POST', '/api/decision/complete', {
      decisionId: today.body.decisionId, actionType: 'inspect',
    });
    await call('POST', '/api/decision/outcome', {
      decisionId: today.body.decisionId, result: 'healthy',
    });

    const r = await call('GET', '/api/decision/history?limit=5');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(Array.isArray(r.body.items)).toBe(true);
    expect(r.body.items.length).toBeGreaterThanOrEqual(1);
    const item = r.body.items.find((i) => i.decisionId === today.body.decisionId);
    expect(item).toBeTruthy();
    expect(item.completed).toBe(true);
    expect(item.outcome).toBeTruthy();
    expect(item.outcome.result).toBe('healthy');
    // sourceSignals + ruleId NEVER in normal user history.
    expect(item.sourceSignals).toBeUndefined();
    expect(item.ruleId).toBeUndefined();
  });

  it('does NOT include another user\u2019s decisions', async () => {
    mocks.dailyDecisions.push({
      id: 'their-decision', userId: 'someone-else',
      completed: true, primaryAction: 'their action', primaryCta: 'X',
      reason: 'theirs', priority: 6, confidence: 'medium',
      tomorrowHook: null, createdAt: new Date(),
    });
    const r = await call('GET', '/api/decision/history');
    expect(r.status).toBe(200);
    expect(r.body.items.find((i) => i.decisionId === 'their-decision')).toBeUndefined();
  });
});

describe('Safe fallbacks — service failures', () => {
  it('still returns a usable envelope when persistence throws', async () => {
    // Force the next two creates to fail.
    const realCreateD = (await import('../config/database.js')).default.dailyDecision.create;
    const realCreateC = (await import('../config/database.js')).default.decisionContext.create;
    realCreateD.mockImplementationOnce(async () => { throw new Error('boom'); });
    realCreateC.mockImplementationOnce(async () => { throw new Error('boom'); });

    const r = await call('GET', '/api/decision/today');
    expect(r.status).toBe(200);
    // Still a primary action — engine never throws.
    expect(typeof r.body.primaryAction).toBe('string');
    expect(r.body.primaryAction.length).toBeGreaterThan(0);
    // decisionId is null because persistence failed; UI handles
    // gracefully (the spec allows this case).
    expect(r.body.decisionId).toBeNull();
  });

  it('returns the farmer fallback wording when crop is missing', async () => {
    // Wipe profile so contextBuilder has no crop/stage.
    mocks.farmProfiles.length = 0;
    const r = await call('GET', '/api/decision/today');
    expect(r.status).toBe(200);
    // Engine returns the v1 profile_missing wording — short, action-first.
    expect(typeof r.body.primaryAction).toBe('string');
    expect(r.body.primaryAction.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(r.body.confidence);
  });
});
