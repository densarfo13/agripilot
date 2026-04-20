/**
 * stabilizationCore.test.js — contract for the refactor /
 * stabilization modules in server/src/core/.
 *
 *   contextService (getFarmContext, deriveEventStats)
 *   middleware (requireFields, requireRole, standardResponse, asyncHandler)
 *   marketplaceMatch (isMatch, scoreMatch, rankMatches)
 *   retry
 */

import { describe, it, expect, vi } from 'vitest';

// CommonJS modules
import ctxPkg from '../../../server/src/core/contextService.js';
const { getFarmContext, deriveEventStats } = ctxPkg;

import mwPkg from '../../../server/src/core/middleware.js';
const { requireFields, requireRole, standardResponse, asyncHandler } = mwPkg;

import matchPkg from '../../../server/src/core/marketplaceMatch.js';
const { isMatch, scoreMatch, rankMatches } = matchPkg;

import retryPkg from '../../../server/src/core/retry.js';
const { retry } = retryPkg;

// ─── deriveEventStats ───────────────────────────────────────
describe('deriveEventStats', () => {
  const NOW = new Date('2026-04-20T12:00:00Z').getTime();
  const day = 24 * 60 * 60 * 1000;

  it('empty events → zero everything, 0.5 default completion', () => {
    const s = deriveEventStats([], { nowMs: NOW });
    expect(s.total).toBe(0);
    expect(s.completed).toBe(0);
    expect(s.seen).toBe(0);
    expect(s.completionRate).toBe(0.5);
    expect(s.consistencyDays).toBe(0);
  });

  it('counts distinct active days in last 30', () => {
    const s = deriveEventStats([
      { eventType: 'task_seen',      createdAt: new Date(NOW - 1  * day) },
      { eventType: 'task_seen',      createdAt: new Date(NOW - 1  * day) }, // same day
      { eventType: 'task_completed', createdAt: new Date(NOW - 5  * day) },
      { eventType: 'task_completed', createdAt: new Date(NOW - 40 * day) }, // outside 30
    ], { nowMs: NOW });
    expect(s.consistencyDays).toBe(2);
  });

  it('completionRate computed from completed/(completed+seen)', () => {
    const s = deriveEventStats([
      { eventType: 'task_completed' },
      { eventType: 'task_completed' },
      { eventType: 'task_completed' },
      { eventType: 'task_seen' },
    ], { nowMs: NOW });
    expect(s.completionRate).toBeCloseTo(0.75);
  });

  it('non-array input is safe', () => {
    expect(deriveEventStats(null).total).toBe(0);
  });

  it('returns frozen result', () => {
    expect(Object.isFrozen(deriveEventStats([]))).toBe(true);
  });
});

// ─── getFarmContext ──────────────────────────────────────────
describe('getFarmContext', () => {
  function fakePrisma({ farm = null, events = [] } = {}) {
    return {
      farmProfile: { findUnique: async () => farm },
      farmEvent:   { findMany:   async () => events },
    };
  }

  it('returns error object on missing farmId', async () => {
    const c = await getFarmContext({});
    expect(c.error).toBe('missing_farm_id');
    expect(c.farm).toBeNull();
  });

  it('composes farm + risk + yield + score + funding + tasks', async () => {
    const farm = {
      id: 'F1', cropType: 'maize', stage: 'land_prep',
      countryCode: 'GH', region: 'Ashanti',
    };
    const events = [
      { eventType: 'task_completed', createdAt: new Date() },
      { eventType: 'task_completed', createdAt: new Date() },
      { eventType: 'task_seen',      createdAt: new Date() },
    ];
    const ctx = await getFarmContext({
      farmId: 'F1',
      prisma: fakePrisma({ farm, events }),
      weatherFor: () => ({ rainExpected: false }),
    });
    expect(ctx.farm.id).toBe('F1');
    expect(ctx.risk.level).toBeTruthy();
    expect(ctx.yield.estimated).toBeGreaterThan(0);
    expect(ctx.score.score).toBeGreaterThanOrEqual(0);
    expect(ctx.funding.tier).toMatch(/^[ABC]$/);
    expect(Array.isArray(ctx.tasks)).toBe(true);
    expect(ctx.tasks.length).toBeGreaterThan(0);
  });

  it('missing farm still returns safe shape', async () => {
    const ctx = await getFarmContext({
      farmId: 'F404',
      prisma: fakePrisma({ farm: null, events: [] }),
    });
    expect(ctx.farm).toBeNull();
    expect(ctx.tasks).toEqual([]);
    expect(ctx.risk.level).toBe('low');
  });

  it('prisma throw does not blow up the context', async () => {
    const bad = {
      farmProfile: { findUnique: async () => { throw new Error('db'); } },
      farmEvent:   { findMany:   async () => { throw new Error('db'); } },
    };
    const ctx = await getFarmContext({ farmId: 'F1', prisma: bad });
    expect(ctx.farm).toBeNull();
    // Still produces a valid score (with defaults).
    expect(ctx.score.score).toBe(20); // 0.5*40=20 behavior only
  });

  it('result is frozen', async () => {
    const ctx = await getFarmContext({
      farmId: 'F1', prisma: fakePrisma({ farm: { id: 'F1' } }),
    });
    expect(Object.isFrozen(ctx)).toBe(true);
  });
});

// ─── requireFields ───────────────────────────────────────────
describe('requireFields', () => {
  function invoke(mw, body) {
    let statusCode = null, jsonBody = null, nextCalled = false;
    const req = { body };
    const res = {
      status(c) { statusCode = c; return this; },
      json(b)   { jsonBody = b;  return this; },
    };
    const next = () => { nextCalled = true; };
    mw(req, res, next);
    return { statusCode, jsonBody, nextCalled };
  }

  it('next() when every field present', () => {
    const { nextCalled, statusCode } = invoke(
      requireFields(['a', 'b']), { a: 1, b: 'x' });
    expect(nextCalled).toBe(true);
    expect(statusCode).toBeNull();
  });

  it('400 with missing field name when one is absent', () => {
    const { statusCode, jsonBody } = invoke(
      requireFields(['a', 'b']), { a: 1 });
    expect(statusCode).toBe(400);
    expect(jsonBody.success).toBe(false);
    expect(jsonBody.missing).toBe('b');
  });

  it('treats empty string / whitespace as missing', () => {
    const a = invoke(requireFields(['a']), { a: '' });
    const b = invoke(requireFields(['a']), { a: '   ' });
    expect(a.statusCode).toBe(400);
    expect(b.statusCode).toBe(400);
  });

  it('safe on missing body', () => {
    const { statusCode } = invoke(requireFields(['a']), undefined);
    expect(statusCode).toBe(400);
  });
});

// ─── requireRole ─────────────────────────────────────────────
describe('requireRole', () => {
  function invoke(mw, user) {
    let statusCode = null, nextCalled = false;
    const req = { user };
    const res = {
      status(c) { statusCode = c; return this; },
      json()    { return this; },
    };
    mw(req, res, () => { nextCalled = true; });
    return { statusCode, nextCalled };
  }

  it('401 when no user', () => {
    expect(invoke(requireRole('admin'), null).statusCode).toBe(401);
  });

  it('403 on wrong role', () => {
    expect(invoke(requireRole('admin'), { role: 'farmer' }).statusCode).toBe(403);
  });

  it('next() on correct role', () => {
    expect(invoke(requireRole('admin'), { role: 'admin' }).nextCalled).toBe(true);
  });

  it('accepts array of roles', () => {
    expect(invoke(requireRole(['admin', 'buyer']), { role: 'buyer' }).nextCalled).toBe(true);
  });
});

// ─── standardResponse ────────────────────────────────────────
describe('standardResponse', () => {
  function mockRes() {
    const r = { statusCode: 200, body: null };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json   = (b) => { r.body = b; return r; };
    return r;
  }

  it('ok wraps in {success:true, data}', () => {
    const res = mockRes();
    standardResponse(res).ok({ n: 1 });
    expect(res.body).toEqual({ success: true, data: { n: 1 } });
  });

  it('ok with null/undefined stores null data', () => {
    const res = mockRes();
    standardResponse(res).ok();
    expect(res.body.data).toBeNull();
  });

  it('fail wraps in {success:false, error} with status', () => {
    const res = mockRes();
    standardResponse(res).fail('boom', 400);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'boom' });
  });

  it('fail accepts Error object and uses message', () => {
    const res = mockRes();
    standardResponse(res).fail(new Error('bang'));
    expect(res.body.error).toBe('bang');
    expect(res.statusCode).toBe(500);
  });
});

// ─── asyncHandler ────────────────────────────────────────────
describe('asyncHandler', () => {
  it('calls underlying fn and propagates the result', async () => {
    const res = {
      statusCode: 200, body: null, headersSent: false,
      status(c) { this.statusCode = c; return this; },
      json(b)   { this.body = b; return this; },
    };
    const wrapped = asyncHandler(async (_req, r) => {
      r.json({ ok: true });
    });
    await wrapped({}, res, () => {});
    expect(res.body).toEqual({ ok: true });
  });

  it('catches rejected promises and sends 500 JSON', async () => {
    const res = {
      statusCode: 200, body: null, headersSent: false,
      status(c) { this.statusCode = c; return this; },
      json(b)   { this.body = b; return this; },
    };
    const wrapped = asyncHandler(async () => { throw new Error('bang'); });
    await wrapped({}, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('bang');
  });

  it('does not double-send when response already sent', async () => {
    const res = {
      statusCode: 200, body: null, headersSent: true,
      status()  { throw new Error('should not status'); },
      json()    { throw new Error('should not json'); },
    };
    const wrapped = asyncHandler(async () => { throw new Error('bang'); });
    await expect(wrapped({}, res, () => {})).resolves.toBeUndefined();
  });
});

// ─── marketplaceMatch ────────────────────────────────────────
describe('isMatch / scoreMatch / rankMatches', () => {
  const request = { crop: 'MAIZE', quantity: 100, location: 'Kumasi', region: 'Ashanti' };
  const exactMatch  = { crop: 'maize', quantity: 200, location: 'kumasi', region: 'Ashanti' };
  const regionOnly  = { crop: 'MAIZE', quantity: 150, location: 'Other',  region: 'ashanti' };
  const wrongCrop   = { crop: 'RICE',  quantity: 500, location: 'Kumasi', region: 'Ashanti' };
  const tooLittle   = { crop: 'MAIZE', quantity: 50,  location: 'Kumasi', region: 'Ashanti' };
  const farAway     = { crop: 'MAIZE', quantity: 500, location: 'Accra',  region: 'Greater Accra' };

  it('exact match', () => {
    expect(isMatch(exactMatch, request)).toBe(true);
  });
  it('region-only match', () => {
    expect(isMatch(regionOnly, request)).toBe(true);
  });
  it('wrong crop rejected', () => {
    expect(isMatch(wrongCrop, request)).toBe(false);
  });
  it('insufficient quantity rejected', () => {
    expect(isMatch(tooLittle, request)).toBe(false);
  });
  it('different location AND region rejected', () => {
    expect(isMatch(farAway, request)).toBe(false);
  });

  it('scoreMatch gives exact match highest score', () => {
    expect(scoreMatch(exactMatch, request)).toBeGreaterThan(scoreMatch(regionOnly, request));
  });

  it('scoreMatch 0 on non-match', () => {
    expect(scoreMatch(wrongCrop, request)).toBe(0);
  });

  it('rankMatches drops non-matches and sorts by score', () => {
    const ranked = rankMatches([regionOnly, exactMatch, wrongCrop, tooLittle], request);
    expect(ranked.length).toBe(2);
    expect(ranked[0]).toBe(exactMatch);
  });

  it('isMatch null-safe', () => {
    expect(isMatch(null, request)).toBe(false);
    expect(isMatch(exactMatch, null)).toBe(false);
  });
});

// ─── retry ───────────────────────────────────────────────────
describe('retry', () => {
  it('resolves on first try when fn succeeds', async () => {
    const fn = vi.fn(async () => 42);
    expect(await retry(fn)).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure then resolves', async () => {
    let n = 0;
    const fn = async () => {
      n++;
      if (n < 3) throw new Error('flaky');
      return 'ok';
    };
    expect(await retry(fn, { retries: 3, backoffMs: () => 0 })).toBe('ok');
  });

  it('throws after exhausting retries', async () => {
    const err = new Error('persistent');
    const fn = async () => { throw err; };
    await expect(retry(fn, { retries: 2, backoffMs: () => 0 })).rejects.toBe(err);
  });

  it('does not retry 4xx errors by default', async () => {
    const err = Object.assign(new Error('bad request'), { status: 400 });
    let count = 0;
    await expect(retry(async () => { count++; throw err; }, { retries: 3, backoffMs: () => 0 }))
      .rejects.toBe(err);
    expect(count).toBe(1);
  });

  it('shouldRetry override allows retrying 4xx', async () => {
    let n = 0;
    const fn = async () => {
      n++;
      if (n < 2) { const e = new Error('x'); e.status = 400; throw e; }
      return 'ok';
    };
    expect(await retry(fn, {
      retries: 3, backoffMs: () => 0,
      shouldRetry: () => true,
    })).toBe('ok');
  });

  it('throws immediately when fn is not a function', async () => {
    await expect(retry(null)).rejects.toThrow(/must be a function/i);
  });
});
