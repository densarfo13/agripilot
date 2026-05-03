import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Soft-launch monitoring pipeline — Zod schemas + service layer
 * unit tests. Covers:
 *   • event / batch / error Zod validation
 *   • toClientEventRow shape coercion
 *   • persistEvents idempotency contract
 *   • persistError payload shape
 *   • buildMetrics aggregation
 *
 * The route layer's auth + rate-limit middleware is exercised
 * by the live HTTP harness (`security-tests/api-security.test.ts`)
 * — these tests validate the pure logic + persistence shape.
 */

import {
  eventSchema, eventBatchSchema, errorSchema, metricsQuerySchema,
  KNOWN_EVENT_NAMES, toClientEventRow,
} from '../modules/events/schemas.js';
// Re-import metricsQuerySchema explicitly so the extended-suite
// describe blocks below can reference it without an import-order
// quirk on hoisting.
import {
  persistEvents, persistError, buildMetrics,
} from '../modules/events/service.js';

// ─── Schemas ──────────────────────────────────────────────
describe('eventSchema', () => {
  it('accepts a known-name event with payload', () => {
    const r = eventSchema.safeParse({
      name: 'task_completed',
      payload: { taskId: 't1', source: 'home' },
    });
    expect(r.success).toBe(true);
    expect(r.data.name).toBe('task_completed');
  });

  it('rejects an unknown event name', () => {
    const r = eventSchema.safeParse({ name: 'nuclear_launch' });
    expect(r.success).toBe(false);
  });

  it('rejects a missing name', () => {
    const r = eventSchema.safeParse({ payload: { x: 1 } });
    expect(r.success).toBe(false);
  });

  it('rejects a payload that exceeds the size cap', () => {
    const huge = { data: 'x'.repeat(70_000) };
    const r = eventSchema.safeParse({ name: 'task_completed', payload: huge });
    expect(r.success).toBe(false);
  });

  it('accepts an ISO timestamp', () => {
    const r = eventSchema.safeParse({
      name: 'task_completed',
      timestamp: '2026-05-03T12:00:00Z',
    });
    expect(r.success).toBe(true);
  });

  it('accepts an epoch-ms timestamp', () => {
    const r = eventSchema.safeParse({
      name: 'task_completed',
      timestamp: 1_770_000_000_000,
    });
    expect(r.success).toBe(true);
  });

  it('hard-caps the name length', () => {
    const r = eventSchema.safeParse({ name: 'x'.repeat(120) });
    expect(r.success).toBe(false);
  });

  it('exports the canonical KNOWN_EVENT_NAMES list', () => {
    expect(Array.isArray(KNOWN_EVENT_NAMES)).toBe(true);
    expect(KNOWN_EVENT_NAMES).toContain('farm_created');
    expect(KNOWN_EVENT_NAMES).toContain('grow_created');
    expect(KNOWN_EVENT_NAMES).toContain('task_completed');
    expect(KNOWN_EVENT_NAMES).toContain('app_error');
    expect(KNOWN_EVENT_NAMES).toContain('language_changed');
    expect(KNOWN_EVENT_NAMES).toContain('user_type_selected');
    expect(KNOWN_EVENT_NAMES).toContain('buyer_interest');
    expect(KNOWN_EVENT_NAMES).toContain('funding_viewed');
    expect(KNOWN_EVENT_NAMES).toContain('photo_uploaded');
    expect(KNOWN_EVENT_NAMES).toContain('location_permission_denied');
    expect(KNOWN_EVENT_NAMES).toContain('screen_stuck');
  });
});

describe('eventBatchSchema', () => {
  it('accepts a 1-event batch', () => {
    const r = eventBatchSchema.safeParse({
      events: [{ name: 'task_completed' }],
    });
    expect(r.success).toBe(true);
  });

  it('accepts up to 100 events', () => {
    const events = Array.from({ length: 100 }, () => ({ name: 'task_completed' }));
    const r = eventBatchSchema.safeParse({ events });
    expect(r.success).toBe(true);
  });

  it('rejects > 100 events', () => {
    const events = Array.from({ length: 101 }, () => ({ name: 'task_completed' }));
    const r = eventBatchSchema.safeParse({ events });
    expect(r.success).toBe(false);
  });

  it('rejects an empty batch', () => {
    const r = eventBatchSchema.safeParse({ events: [] });
    expect(r.success).toBe(false);
  });

  it('rejects a batch where any event is invalid', () => {
    const r = eventBatchSchema.safeParse({
      events: [
        { name: 'task_completed' },
        { name: 'unknown_event' },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe('errorSchema', () => {
  it('accepts the minimum shape', () => {
    const r = errorSchema.safeParse({ message: 'oops' });
    expect(r.success).toBe(true);
  });

  it('truncates long stack via the max() cap', () => {
    const r = errorSchema.safeParse({
      message: 'oops',
      stack:   'x'.repeat(5_000),
    });
    expect(r.success).toBe(false);
  });

  it('accepts a full crash payload', () => {
    const r = errorSchema.safeParse({
      message: 'TypeError: x is undefined',
      stack:   'at Object.<anonymous> (/app/foo.js:12)',
      surface: 'render',
      componentStack: '\n    in App\n    in Provider',
      route:   '/dashboard',
      userAgent: 'Mozilla/5.0',
      timestamp: 1_770_000_000_000,
      context: { lang: 'en', appVersion: '1.0.2' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects an empty message', () => {
    const r = errorSchema.safeParse({ message: '' });
    expect(r.success).toBe(false);
  });
});

describe('metricsQuerySchema', () => {
  it('defaults windowDays=7', () => {
    const r = metricsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    expect(r.data.windowDays).toBe(7);
  });

  it('coerces string query value', () => {
    const r = metricsQuerySchema.safeParse({ windowDays: '14' });
    expect(r.success).toBe(true);
    expect(r.data.windowDays).toBe(14);
  });

  it('caps windowDays at 30', () => {
    const r = metricsQuerySchema.safeParse({ windowDays: 90 });
    expect(r.success).toBe(false);
  });

  it('rejects 0 / negative', () => {
    expect(metricsQuerySchema.safeParse({ windowDays: 0 }).success).toBe(false);
    expect(metricsQuerySchema.safeParse({ windowDays: -1 }).success).toBe(false);
  });
});

// ─── toClientEventRow ─────────────────────────────────────
describe('toClientEventRow', () => {
  it('produces a persistable row from a validated event', () => {
    const r = toClientEventRow(
      { name: 'task_completed', payload: { taskId: 't1' }, timestamp: 1_770_000_000_000 },
      { userId: 'u1', orgId: 'o1', appVersion: '1.0.2' },
    );
    expect(r.type).toBe('task_completed');
    expect(r.farmerId).toBe('u1');
    expect(r.orgId).toBe('o1');
    expect(r.appVersion).toBe('1.0.2');
    expect(r.payload).toEqual({ taskId: 't1' });
    expect(r.id).toBeTruthy();
    expect(r.createdAt).toBeInstanceOf(Date);
  });

  it('synthesizes an id when none supplied', () => {
    const a = toClientEventRow({ name: 'task_completed' }, {});
    const b = toClientEventRow({ name: 'task_completed' }, {});
    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('clamps a future timestamp to now', () => {
    const future = Date.now() + 60 * 60 * 1000; // 1h in the future
    const r = toClientEventRow(
      { name: 'task_completed', timestamp: future },
      {},
    );
    // The row's createdAt is clamped to within ~1s of "now".
    expect(Math.abs(r.createdAt.getTime() - Date.now())).toBeLessThan(1500);
  });

  it('preserves a past timestamp', () => {
    const past = Date.now() - 60_000;
    const r = toClientEventRow(
      { name: 'task_completed', timestamp: past },
      {},
    );
    expect(Math.abs(r.createdAt.getTime() - past)).toBeLessThan(1500);
  });
});

// ─── persistEvents ────────────────────────────────────────
describe('persistEvents', () => {
  let prisma;
  beforeEach(() => {
    prisma = {
      clientEvent: {
        upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve({
          ...create,
          receivedAt: new Date(), // first insert → close to now
        })),
      },
    };
  });

  it('counts accepted writes', async () => {
    const rows = [
      { id: 'a', type: 'task_completed', createdAt: new Date() },
      { id: 'b', type: 'task_viewed', createdAt: new Date() },
    ];
    const r = await persistEvents(prisma, rows);
    expect(r.accepted).toBe(2);
    expect(r.duplicates).toBe(0);
    expect(r.rejected).toBe(0);
    expect(prisma.clientEvent.upsert).toHaveBeenCalledTimes(2);
  });

  it('counts duplicates (existing receivedAt > 5s ago)', async () => {
    const oldDate = new Date(Date.now() - 60_000);
    prisma.clientEvent.upsert.mockResolvedValue({
      id: 'a',
      receivedAt: oldDate,
    });
    const r = await persistEvents(prisma, [
      { id: 'a', type: 'task_completed', createdAt: new Date() },
    ]);
    expect(r.duplicates).toBe(1);
    expect(r.accepted).toBe(0);
  });

  it('counts rejected on prisma error', async () => {
    prisma.clientEvent.upsert.mockRejectedValue(new Error('constraint fail'));
    const r = await persistEvents(prisma, [
      { id: 'a', type: 'task_completed', createdAt: new Date() },
    ]);
    expect(r.rejected).toBe(1);
  });

  it('rejects rows missing id or type', async () => {
    const r = await persistEvents(prisma, [
      { type: 'task_completed' }, // no id
      { id: 'a' },                // no type
    ]);
    expect(r.rejected).toBe(2);
    expect(r.accepted).toBe(0);
  });

  it('returns zeros on empty input', async () => {
    const r = await persistEvents(prisma, []);
    expect(r).toEqual({ accepted: 0, duplicates: 0, rejected: 0 });
  });

  it('uses upsert with empty update for idempotency', async () => {
    await persistEvents(prisma, [
      { id: 'a', type: 'task_completed', createdAt: new Date() },
    ]);
    const call = prisma.clientEvent.upsert.mock.calls[0][0];
    expect(call.update).toEqual({});
  });
});

// ─── persistError ────────────────────────────────────────
describe('persistError', () => {
  it('writes app_error type with message + stack in payload', async () => {
    const prisma = {
      clientEvent: {
        upsert: vi.fn().mockResolvedValue({ id: 'x', receivedAt: new Date() }),
      },
    };
    const r = await persistError(prisma, {
      message: 'TypeError: x',
      stack:   'at Object.<anonymous>',
      surface: 'render',
    }, { userId: 'u1' });
    expect(r.accepted).toBe(1);
    const args = prisma.clientEvent.upsert.mock.calls[0][0];
    expect(args.create.type).toBe('app_error');
    expect(args.create.payload.message).toBe('TypeError: x');
    expect(args.create.payload.stack).toBe('at Object.<anonymous>');
    expect(args.create.payload.surface).toBe('render');
    expect(args.create.farmerId).toBe('u1');
  });

  it('counts rejected on prisma error', async () => {
    const prisma = {
      clientEvent: {
        upsert: vi.fn().mockRejectedValue(new Error('boom')),
      },
    };
    const r = await persistError(prisma, { message: 'oops' });
    expect(r.rejected).toBe(1);
    expect(r.accepted).toBe(0);
  });
});

// ─── buildMetrics ────────────────────────────────────────
describe('buildMetrics', () => {
  function makeEvent(overrides = {}) {
    return {
      id:        'e' + Math.random(),
      type:      'task_completed',
      payload:   {},
      createdAt: new Date(),
      farmerId:  null,
      ...overrides,
    };
  }

  it('aggregates DAU, completion rate, retention', async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const prisma = {
      clientEvent: {
        findMany: vi.fn().mockResolvedValue([
          // Today: u1 viewed + completed (1.0 completion); u2 viewed only.
          makeEvent({ type: 'task_viewed',    createdAt: today, farmerId: 'u1' }),
          makeEvent({ type: 'task_completed', createdAt: today, farmerId: 'u1' }),
          makeEvent({ type: 'task_viewed',    createdAt: today, farmerId: 'u2' }),
          // Yesterday: u1 was active.
          makeEvent({ type: 'task_viewed',    createdAt: yesterday, farmerId: 'u1' }),
        ]),
      },
    };
    const m = await buildMetrics(prisma, { windowDays: 7 });
    expect(m.dau).toBe(2);              // u1, u2 today
    expect(m.yesterdayUsers).toBe(1);   // u1
    expect(m.retainedUsers).toBe(1);    // u1 returned today
    expect(m.taskViewed).toBe(3);
    expect(m.taskCompleted).toBe(1);
    expect(m.completionRate).toBeCloseTo(1 / 3, 5);
    expect(m.retentionRate).toBe(1);
  });

  it('counts farms_created, grows_created, app_error, screen_stuck', async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const prisma = {
      clientEvent: {
        findMany: vi.fn().mockResolvedValue([
          makeEvent({ type: 'farm_created',   createdAt: today }),
          makeEvent({ type: 'farm_created',   createdAt: today }),
          makeEvent({ type: 'grow_created',   createdAt: today }),
          makeEvent({ type: 'app_error',      createdAt: today, payload: { route: '/scan' } }),
          makeEvent({ type: 'app_error',      createdAt: today, payload: { route: '/scan' } }),
          makeEvent({ type: 'screen_stuck',   createdAt: today, payload: { route: '/dashboard' } }),
        ]),
      },
    };
    const m = await buildMetrics(prisma, {});
    expect(m.farmsCreated.today).toBe(2);
    expect(m.growsCreated.today).toBe(1);
    expect(m.appErrors).toBe(2);
    expect(m.screenStuck).toBe(1);
    expect(m.topErrors[0]).toEqual({ key: '/scan', count: 2 });
    expect(m.topStuckRoutes[0]).toEqual({ key: '/dashboard', count: 1 });
  });

  it('aggregates user_type_split', async () => {
    const today = new Date();
    const prisma = {
      clientEvent: {
        findMany: vi.fn().mockResolvedValue([
          makeEvent({ type: 'user_type_selected', createdAt: today, payload: { userType: 'farmer' } }),
          makeEvent({ type: 'user_type_selected', createdAt: today, payload: { userType: 'farmer' } }),
          makeEvent({ type: 'user_type_selected', createdAt: today, payload: { userType: 'backyard' } }),
          makeEvent({ type: 'user_type_selected', createdAt: today, payload: { userType: 'unknown' } }),
        ]),
      },
    };
    const m = await buildMetrics(prisma, {});
    expect(m.userTypeSplit.farmer).toBe(2);
    expect(m.userTypeSplit.backyard).toBe(1);
    expect(m.userTypeSplit.other).toBe(1);
  });

  it('returns null retention when yesterday is empty', async () => {
    const prisma = {
      clientEvent: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const m = await buildMetrics(prisma, {});
    expect(m.retentionRate).toBeNull();
    expect(m.completionRate).toBeNull();
  });

  it('clamps windowDays to [1, 30]', async () => {
    const prisma = { clientEvent: { findMany: vi.fn().mockResolvedValue([]) } };
    const a = await buildMetrics(prisma, { windowDays: 0 });
    const b = await buildMetrics(prisma, { windowDays: 100 });
    expect(a.windowDays).toBe(1);
    expect(b.windowDays).toBe(30);
  });

  it('caps the read at 5_000 rows', async () => {
    const prisma = { clientEvent: { findMany: vi.fn().mockResolvedValue([]) } };
    await buildMetrics(prisma, {});
    expect(prisma.clientEvent.findMany.mock.calls[0][0].take).toBe(5000);
  });

  // ─── Admin Monitoring Dashboard v1 — extended fields ───
  it('counts upload_failed and rate_limit_hit events', async () => {
    const today = new Date();
    const prisma = {
      clientEvent: {
        findMany: vi.fn().mockResolvedValue([
          makeEvent({ type: 'upload_failed',  createdAt: today, payload: { reason: 'mime' } }),
          makeEvent({ type: 'upload_failed',  createdAt: today, payload: { reason: 'size' } }),
          makeEvent({ type: 'rate_limit_hit', createdAt: today, payload: { route: '/api/scan' } }),
        ]),
      },
    };
    const m = await buildMetrics(prisma, {});
    expect(m.uploadFailed).toBe(2);
    expect(m.rateLimitHits).toBe(1);
  });

  it('flags raise correctly: crashes / stuck / lowCompletion / spikes', async () => {
    const today = new Date();
    const prisma = {
      clientEvent: {
        findMany: vi.fn().mockResolvedValue([
          // 1 crash → flags.crashes
          makeEvent({ type: 'app_error', createdAt: today, payload: { route: '/x' } }),
          // 1 stuck → flags.stuck
          makeEvent({ type: 'screen_stuck', createdAt: today, payload: { route: '/y' } }),
          // 5 rate_limit_hit → flags.rateLimitSpike
          ...Array.from({ length: 5 }, () => makeEvent({ type: 'rate_limit_hit', createdAt: today })),
          // 5 upload_failed → flags.uploadFailures
          ...Array.from({ length: 5 }, () => makeEvent({ type: 'upload_failed', createdAt: today })),
          // 10 task_viewed but only 1 task_completed → completion 10% → lowCompletion
          ...Array.from({ length: 10 }, () => makeEvent({ type: 'task_viewed', createdAt: today, farmerId: 'u1' })),
          makeEvent({ type: 'task_completed', createdAt: today, farmerId: 'u1' }),
        ]),
      },
    };
    const m = await buildMetrics(prisma, {});
    expect(m.flags.crashes).toBe(true);
    expect(m.flags.stuck).toBe(true);
    expect(m.flags.lowCompletion).toBe(true);
    expect(m.flags.rateLimitSpike).toBe(true);
    expect(m.flags.uploadFailures).toBe(true);
  });

  it('flags do NOT raise on quiet periods', async () => {
    const today = new Date();
    const prisma = {
      clientEvent: {
        findMany: vi.fn().mockResolvedValue([
          // 5 viewed, 4 completed → 80% completion, all flags off
          ...Array.from({ length: 5 }, () => makeEvent({ type: 'task_viewed',    createdAt: today, farmerId: 'u1' })),
          ...Array.from({ length: 4 }, () => makeEvent({ type: 'task_completed', createdAt: today, farmerId: 'u1' })),
        ]),
      },
    };
    const m = await buildMetrics(prisma, {});
    expect(m.flags.crashes).toBe(false);
    expect(m.flags.stuck).toBe(false);
    expect(m.flags.lowCompletion).toBe(false);
    expect(m.flags.rateLimitSpike).toBe(false);
    expect(m.flags.uploadFailures).toBe(false);
  });

  it('echoes the resolved filter context in the response', async () => {
    const prisma = { clientEvent: { findMany: vi.fn().mockResolvedValue([]) } };
    const m = await buildMetrics(prisma, {
      windowDays: 1,
      userType: 'farmer',
      country:  'gh',
      region:   'Greater Accra',
      language: 'fr',
    });
    expect(m.filters).toEqual({
      windowDays: 1,
      userType:   'farmer',
      country:    'GH',
      region:     'greater accra',
      language:   'fr',
    });
  });

  it('filters events by userType', async () => {
    const today = new Date();
    const prisma = {
      clientEvent: {
        findMany: vi.fn().mockResolvedValue([
          makeEvent({ type: 'task_completed', createdAt: today, farmerId: 'u1', payload: { userType: 'farmer' } }),
          makeEvent({ type: 'task_completed', createdAt: today, farmerId: 'u2', payload: { userType: 'backyard' } }),
          makeEvent({ type: 'task_completed', createdAt: today, farmerId: 'u3', payload: { userType: 'farmer' } }),
        ]),
      },
    };
    const m = await buildMetrics(prisma, { userType: 'backyard' });
    expect(m.taskCompleted).toBe(1);
  });

  it('filters events by country (case-insensitive)', async () => {
    const today = new Date();
    const prisma = {
      clientEvent: {
        findMany: vi.fn().mockResolvedValue([
          makeEvent({ type: 'task_viewed', createdAt: today, payload: { country: 'GH' } }),
          makeEvent({ type: 'task_viewed', createdAt: today, payload: { country: 'KE' } }),
        ]),
      },
    };
    const m = await buildMetrics(prisma, { country: 'gh' });
    expect(m.taskViewed).toBe(1);
  });

  it('filters events by language', async () => {
    const today = new Date();
    const prisma = {
      clientEvent: {
        findMany: vi.fn().mockResolvedValue([
          makeEvent({ type: 'language_changed', createdAt: today, payload: { to: 'fr' } }),
          makeEvent({ type: 'language_changed', createdAt: today, payload: { to: 'sw' } }),
          makeEvent({ type: 'language_changed', createdAt: today, payload: { to: 'fr' } }),
        ]),
      },
    };
    const m = await buildMetrics(prisma, { language: 'fr' });
    expect(m.languageUsage.fr).toBe(2);
    expect(m.languageUsage.sw).toBeUndefined();
  });
});

// ─── metricsQuerySchema — filter validation ──────────────
describe('metricsQuerySchema (extended)', () => {
  it('accepts the full filter set', () => {
    const r = metricsQuerySchema.safeParse({
      windowDays: '7',
      userType:   'farmer',
      country:    'GH',
      region:     'Greater Accra',
      language:   'fr',
    });
    expect(r.success).toBe(true);
    expect(r.data.windowDays).toBe(7);
  });

  it('rejects an unknown userType', () => {
    const r = metricsQuerySchema.safeParse({ userType: 'investor' });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown language', () => {
    const r = metricsQuerySchema.safeParse({ language: 'klingon' });
    expect(r.success).toBe(false);
  });

  it('accepts userType=all / language=all (filter pass-through)', () => {
    const r = metricsQuerySchema.safeParse({ userType: 'all', language: 'all' });
    expect(r.success).toBe(true);
  });
});
