/**
 * Scale-Ready Foundation Tests
 *
 * Covers the Phase 2 + Phase 3 hardening pass:
 *
 *   Part A — Trigger engine: no N+1 queries, bounded results
 *   Part B — Notification cycle: logNotificationEvent fires with correct data
 *   Part C — Delivery failure: logDeliveryEvent fires on dispatch error
 *   Part D — Delivery service provider config degradation
 *   Part E — opsLogger helpers: correct severity classification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mock objects (hoisted so vi.mock factories can reference them) ───
// vi.hoisted runs before vi.mock factories — this is the correct pattern for
// stable mock references in Vitest ESM.

const {
  _prisma,
  _triggerEngine,
  _rateLimiter,
  _templates,
  _sender,
  _risk,
} = vi.hoisted(() => ({
  _prisma: {
    farmer:              { findMany: vi.fn(), findUnique: vi.fn() },
    farmSeason:          { findMany: vi.fn() },
    officerValidation:   { findMany: vi.fn() },
    user:                { findMany: vi.fn(), findUnique: vi.fn() },
    application:         { count: vi.fn(), groupBy: vi.fn() },
    autoNotification:    { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
    farmerNotification:  { create: vi.fn() },
  },
  _triggerEngine: { collectAllTriggers: vi.fn() },
  _rateLimiter:   { isAllowed: vi.fn() },
  _templates:     { renderTemplate: vi.fn() },
  _sender:        { dispatch: vi.fn() },
  _risk:          { computeSeasonRisk: vi.fn() },
}));

vi.mock('../config/database.js',                          () => ({ default: _prisma }));
vi.mock('../modules/risk/service.js',                     () => _risk);
// Spread the real triggerEngine exports so Part A tests can call individual rules,
// but replace collectAllTriggers with the stable mock for Part B/C service tests.
vi.mock('../modules/autoNotifications/triggerEngine.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, collectAllTriggers: _triggerEngine.collectAllTriggers };
});
vi.mock('../modules/autoNotifications/rateLimiter.js',    () => _rateLimiter);
vi.mock('../modules/autoNotifications/templates.js',      () => _templates);
vi.mock('../modules/autoNotifications/sender.js',         () => _sender);

// Real opsLogger + eventStore — NOT mocked so we can verify event emission
import { logDeliveryEvent, logNotificationEvent } from '../utils/opsLogger.js';
import { _resetForTesting, getRecentEvents } from '../utils/eventStore.js';

// Service under test (stable top-level import, uses the file-level mocks)
import { runNotificationCycle } from '../modules/autoNotifications/service.js';

// Helpers — cleared between each test
beforeEach(() => {
  vi.clearAllMocks();
  _resetForTesting();
});

// ═══════════════════════════════════════════════════════════
// Part A — Trigger engine: N+1 elimination + bounded queries
// ═══════════════════════════════════════════════════════════

describe('ruleStaleActivity — batch officer fetch (no N+1)', () => {
  let ruleStaleActivity;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    _resetForTesting();
    ({ ruleStaleActivity } = await import('../modules/autoNotifications/triggerEngine.js'));
  });

  it('fetches all officers in one findMany call regardless of season count', async () => {
    const staleDate = new Date(Date.now() - 20 * 86400000);
    _prisma.farmSeason.findMany.mockResolvedValue([
      { id: 's1', lastActivityDate: staleDate, farmer: { id: 'f1', fullName: 'Alice', phone: '+1', organizationId: 'org1', assignedOfficerId: 'o1' } },
      { id: 's2', lastActivityDate: staleDate, farmer: { id: 'f2', fullName: 'Bob',   phone: '+2', organizationId: 'org1', assignedOfficerId: 'o2' } },
      { id: 's3', lastActivityDate: staleDate, farmer: { id: 'f3', fullName: 'Carol', phone: '+3', organizationId: 'org1', assignedOfficerId: 'o1' } },
    ]);
    _prisma.user.findMany.mockResolvedValue([
      { id: 'o1', fullName: 'Officer One' },
      { id: 'o2', fullName: 'Officer Two' },
    ]);

    const payloads = await ruleStaleActivity();

    // Batch fetch: findMany called ONCE, findUnique NEVER
    expect(_prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(_prisma.user.findUnique).not.toHaveBeenCalled();
    expect(payloads).toHaveLength(3);
  });

  it('deduplicates by farmerId before fetching officers', async () => {
    const staleDate = new Date(Date.now() - 20 * 86400000);
    _prisma.farmSeason.findMany.mockResolvedValue([
      { id: 's1', lastActivityDate: staleDate, farmer: { id: 'f1', fullName: 'Alice', phone: '+1', organizationId: 'org1', assignedOfficerId: 'o1' } },
      { id: 's2', lastActivityDate: staleDate, farmer: { id: 'f1', fullName: 'Alice', phone: '+1', organizationId: 'org1', assignedOfficerId: 'o1' } },
    ]);
    _prisma.user.findMany.mockResolvedValue([{ id: 'o1', fullName: 'Officer One' }]);

    const payloads = await ruleStaleActivity();

    expect(payloads).toHaveLength(1);
    const fetchCall = _prisma.user.findMany.mock.calls[0][0];
    expect(fetchCall.where.id.in).toEqual(['o1']);
  });

  it('skips officer fetch entirely when no assignedOfficerId exists', async () => {
    const staleDate = new Date(Date.now() - 20 * 86400000);
    _prisma.farmSeason.findMany.mockResolvedValue([
      { id: 's1', lastActivityDate: staleDate, farmer: { id: 'f1', fullName: 'Alice', phone: '+1', organizationId: 'org1', assignedOfficerId: null } },
    ]);

    const payloads = await ruleStaleActivity();

    expect(_prisma.user.findMany).not.toHaveBeenCalled();
    expect(payloads[0].templateCtx.officerName).toBeNull();
  });
});

describe('ruleValidationPending — batch officer fetch (no N+1)', () => {
  let ruleValidationPending;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    _resetForTesting();
    ({ ruleValidationPending } = await import('../modules/autoNotifications/triggerEngine.js'));
  });

  it('fetches all validation officers in one findMany, not one per validation', async () => {
    const oldDate = new Date(Date.now() - 10 * 86400000);
    _prisma.officerValidation.findMany.mockResolvedValue([
      { id: 'v1', createdAt: oldDate, officerId: 'o1', season: { id: 's1', farmer: { id: 'f1', fullName: 'Dave',  organizationId: 'org1' } } },
      { id: 'v2', createdAt: oldDate, officerId: 'o2', season: { id: 's2', farmer: { id: 'f2', fullName: 'Eve',   organizationId: 'org1' } } },
      { id: 'v3', createdAt: oldDate, officerId: 'o1', season: { id: 's3', farmer: { id: 'f3', fullName: 'Frank', organizationId: 'org1' } } },
    ]);
    _prisma.user.findMany.mockResolvedValue([
      { id: 'o1', fullName: 'Officer A', email: 'a@example.com' },
      { id: 'o2', fullName: 'Officer B', email: 'b@example.com' },
    ]);

    const payloads = await ruleValidationPending();

    expect(_prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(_prisma.user.findUnique).not.toHaveBeenCalled();
    const fetchCall = _prisma.user.findMany.mock.calls[0][0];
    expect(fetchCall.where.id.in).toHaveLength(2);
    expect(fetchCall.where.id.in).toContain('o1');
    expect(fetchCall.where.id.in).toContain('o2');
    expect(payloads).toHaveLength(3);
    expect(payloads[0].email).toBe('a@example.com');
  });

  it('returns empty array and skips officer fetch when no pending validations', async () => {
    _prisma.officerValidation.findMany.mockResolvedValue([]);
    const payloads = await ruleValidationPending();
    expect(payloads).toHaveLength(0);
    expect(_prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('ruleHighRiskAlert — batch officer fetch after risk filtering (no N+1)', () => {
  let ruleHighRiskAlert;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    _resetForTesting();
    ({ ruleHighRiskAlert } = await import('../modules/autoNotifications/triggerEngine.js'));
  });

  it('fetches officers only for high-risk seasons in one batch', async () => {
    _prisma.farmSeason.findMany.mockResolvedValue([
      { id: 's1', farmerId: 'f1', farmer: { id: 'f1', fullName: 'Alice', organizationId: 'org1', assignedOfficerId: 'o1', phone: null } },
      { id: 's2', farmerId: 'f2', farmer: { id: 'f2', fullName: 'Bob',   organizationId: 'org1', assignedOfficerId: 'o2', phone: null } },
    ]);
    _risk.computeSeasonRisk
      .mockResolvedValueOnce({ riskLevel: 'Critical', riskCategory: 'stale' })
      .mockResolvedValueOnce({ riskLevel: 'Low',      riskCategory: 'none' });
    _prisma.user.findMany.mockResolvedValue([
      { id: 'o1', fullName: 'Officer One', email: 'o1@example.com' },
    ]);

    const payloads = await ruleHighRiskAlert();

    expect(payloads).toHaveLength(1);
    expect(payloads[0].seasonId).toBe('s1');
    expect(_prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(_prisma.user.findUnique).not.toHaveBeenCalled();
    const fetchCall = _prisma.user.findMany.mock.calls[0][0];
    expect(fetchCall.where.id.in).toEqual(['o1']);
  });

  it('skips officer fetch entirely when no seasons are high-risk', async () => {
    _prisma.farmSeason.findMany.mockResolvedValue([
      { id: 's1', farmerId: 'f1', farmer: { id: 'f1', fullName: 'Alice', organizationId: 'org1', assignedOfficerId: 'o1', phone: null } },
    ]);
    _risk.computeSeasonRisk.mockResolvedValue({ riskLevel: 'Medium', riskCategory: 'ok' });

    const payloads = await ruleHighRiskAlert();

    expect(payloads).toHaveLength(0);
    expect(_prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('ruleReviewerBacklog — single groupBy replaces N count queries', () => {
  let ruleReviewerBacklog;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    _resetForTesting();
    ({ ruleReviewerBacklog } = await import('../modules/autoNotifications/triggerEngine.js'));
  });

  it('uses one groupBy query regardless of reviewer count', async () => {
    _prisma.user.findMany.mockResolvedValue([
      { id: 'r1', fullName: 'Rev1', email: 'r1@example.com', organizationId: 'org1' },
      { id: 'r2', fullName: 'Rev2', email: 'r2@example.com', organizationId: 'org1' },
      { id: 'r3', fullName: 'Rev3', email: 'r3@example.com', organizationId: 'org1' },
    ]);
    _prisma.application.groupBy.mockResolvedValue([
      { assignedReviewerId: 'r1', _count: { id: 15 } },
      { assignedReviewerId: 'r2', _count: { id: 3 } },
    ]);

    const payloads = await ruleReviewerBacklog();

    expect(_prisma.application.groupBy).toHaveBeenCalledTimes(1);
    expect(_prisma.application.count).not.toHaveBeenCalled();
    expect(payloads).toHaveLength(1);
    expect(payloads[0].userId).toBe('r1');
    expect(payloads[0].templateCtx.pendingCount).toBe(15);
  });

  it('passes all reviewer IDs into the groupBy where clause', async () => {
    _prisma.user.findMany.mockResolvedValue([
      { id: 'r1', fullName: 'Rev1', email: 'r1@example.com', organizationId: 'org1' },
      { id: 'r2', fullName: 'Rev2', email: 'r2@example.com', organizationId: 'org1' },
    ]);
    _prisma.application.groupBy.mockResolvedValue([]);

    await ruleReviewerBacklog();

    const call = _prisma.application.groupBy.mock.calls[0][0];
    expect(call.where.assignedReviewerId.in).toContain('r1');
    expect(call.where.assignedReviewerId.in).toContain('r2');
  });

  it('returns empty immediately and skips groupBy when no reviewers exist', async () => {
    _prisma.user.findMany.mockResolvedValue([]);
    const payloads = await ruleReviewerBacklog();
    expect(payloads).toHaveLength(0);
    expect(_prisma.application.groupBy).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════
// Part B — Notification cycle: logNotificationEvent event emission
// ═══════════════════════════════════════════════════════════

describe('runNotificationCycle — logNotificationEvent stored in eventStore', () => {
  it('stores notification/cycle_summary in eventStore after an empty cycle', async () => {
    _triggerEngine.collectAllTriggers.mockResolvedValue([]);

    const result = await runNotificationCycle();

    expect(result).toMatchObject({ enqueued: 0, sent: 0, skipped: 0, failed: 0 });

    // Real opsLogger writes to the real eventStore — same instance as our import
    const events = getRecentEvents({ category: 'notification' });
    const cycleEvent = events.find(e => e.event === 'cycle_summary');
    expect(cycleEvent).toBeDefined();
    expect(cycleEvent.enqueued).toBe(0);
    expect(cycleEvent.sent).toBe(0);
  });

  it('includes correct counts in cycle_summary when triggers fire', async () => {
    // One trigger that passes rate-limiting, creates a record, and is sent
    _triggerEngine.collectAllTriggers.mockResolvedValue([{
      type: 'invite_reminder',
      organizationId: 'org1',
      userId: null,
      roleTarget: 'field_officer',
      farmerId: 'f1',
      seasonId: null,
      preferredChannel: 'sms',
      phone: '+1234567890',
      email: null,
      templateCtx: { farmerName: 'Alice', daysSinceInvite: 5, inviteUrl: null },
    }]);
    _rateLimiter.isAllowed.mockResolvedValue(true);
    _templates.renderTemplate.mockReturnValue({ subject: 'Reminder', message: 'Hello Alice' });
    _prisma.autoNotification.create.mockResolvedValue({ id: 'n1', attempts: 0, channel: 'sms', subject: 'Reminder', message: 'Hello Alice' });
    _sender.dispatch.mockResolvedValue({ channel: 'sms', fallback: false });
    _prisma.autoNotification.update.mockResolvedValue({});
    _prisma.autoNotification.findUnique.mockResolvedValue({ status: 'sent' });

    const result = await runNotificationCycle();

    expect(result.enqueued).toBe(1);
    expect(result.sent).toBe(1);

    const events = getRecentEvents({ category: 'notification' });
    const cycleEvent = events.find(e => e.event === 'cycle_summary');
    expect(cycleEvent).toBeDefined();
    expect(cycleEvent.enqueued).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// Part C — Delivery failure: logDeliveryEvent emission
// ═══════════════════════════════════════════════════════════

describe('autoNotification deliverRecord — delivery/send_failed stored in eventStore', () => {
  it('stores delivery/send_failed event when dispatch throws', async () => {
    _triggerEngine.collectAllTriggers.mockResolvedValue([{
      type: 'validation_pending',
      organizationId: 'org1',
      userId: 'u1',
      roleTarget: 'field_officer',
      farmerId: 'f1',
      seasonId: 's1',
      preferredChannel: 'email',
      phone: null,
      email: 'officer@example.com',
      templateCtx: { officerName: 'Joe', farmerName: 'Alice', seasonId: 's1', daysWaiting: 6 },
    }]);
    _rateLimiter.isAllowed.mockResolvedValue(true);
    _templates.renderTemplate.mockReturnValue({ subject: 'Pending', message: 'Validate now' });
    _prisma.autoNotification.create.mockResolvedValue({
      id: 'n2', attempts: 0, type: 'validation_pending', channel: 'email',
      subject: 'Pending', message: 'Validate now',
    });
    _sender.dispatch.mockRejectedValue(new Error('SendGrid rate limit'));
    _prisma.autoNotification.update.mockResolvedValue({});
    _prisma.autoNotification.findUnique.mockResolvedValue({ status: 'failed' });

    await runNotificationCycle();

    // delivery/send_failed must be in the same eventStore we imported
    const events = getRecentEvents({ category: 'delivery' });
    const failEvent = events.find(e => e.event === 'send_failed');
    expect(failEvent).toBeDefined();
    expect(failEvent.notificationId).toBe('n2');
    expect(failEvent.type).toBe('validation_pending');
    expect(failEvent.error).toBe('SendGrid rate limit');
  });

  it('marks autoNotification as failed in DB when dispatch throws', async () => {
    _triggerEngine.collectAllTriggers.mockResolvedValue([{
      type: 'stale_farmer',
      organizationId: 'org1',
      userId: null,
      roleTarget: 'field_officer',
      farmerId: 'f2',
      seasonId: 's2',
      preferredChannel: 'sms',
      phone: '+9876',
      email: null,
      templateCtx: { farmerName: 'Bob', daysSinceActivity: 16, officerName: null },
    }]);
    _rateLimiter.isAllowed.mockResolvedValue(true);
    _templates.renderTemplate.mockReturnValue({ subject: 'Stale', message: 'Check in' });
    const record = { id: 'n3', attempts: 0, type: 'stale_farmer', channel: 'sms', subject: 'Stale', message: 'Check in' };
    _prisma.autoNotification.create.mockResolvedValue(record);
    _sender.dispatch.mockRejectedValue(new Error('Twilio unreachable'));
    _prisma.autoNotification.update.mockResolvedValue({});
    _prisma.autoNotification.findUnique.mockResolvedValue({ status: 'failed' });

    await runNotificationCycle();

    // DB should be updated with failed status and failure reason
    const updateCall = _prisma.autoNotification.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe('n3');
    expect(updateCall.data.status).toBe('failed');
    expect(updateCall.data.failureReason).toBe('Twilio unreachable');
  });
});

// ═══════════════════════════════════════════════════════════
// Part D — Delivery service provider config degradation
// ═══════════════════════════════════════════════════════════

describe('deliveryService — provider config detection', () => {
  it('isEmailConfigured returns false when SENDGRID_API_KEY missing', async () => {
    const orig = process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    vi.resetModules();
    const { isEmailConfigured } = await import('../modules/notifications/deliveryService.js');
    expect(isEmailConfigured()).toBe(false);
    if (orig !== undefined) process.env.SENDGRID_API_KEY = orig;
  });

  it('isEmailConfigured returns false when EMAIL_FROM_ADDRESS missing', async () => {
    const origKey  = process.env.SENDGRID_API_KEY;
    const origFrom = process.env.EMAIL_FROM_ADDRESS;
    process.env.SENDGRID_API_KEY = 'SG.test';
    delete process.env.EMAIL_FROM_ADDRESS;
    vi.resetModules();
    const { isEmailConfigured } = await import('../modules/notifications/deliveryService.js');
    expect(isEmailConfigured()).toBe(false);
    if (origKey  !== undefined) process.env.SENDGRID_API_KEY   = origKey;  else delete process.env.SENDGRID_API_KEY;
    if (origFrom !== undefined) process.env.EMAIL_FROM_ADDRESS = origFrom;
  });

  it('isSmsConfigured returns false when TWILIO_ACCOUNT_SID missing', async () => {
    const origSid = process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_ACCOUNT_SID;
    vi.resetModules();
    const { isSmsConfigured } = await import('../modules/notifications/deliveryService.js');
    expect(isSmsConfigured()).toBe(false);
    if (origSid !== undefined) process.env.TWILIO_ACCOUNT_SID = origSid;
  });

  it('sendInviteEmail returns manual_share_ready when not configured', async () => {
    const origKey = process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    vi.resetModules();
    const { sendInviteEmail } = await import('../modules/notifications/deliveryService.js');
    const result = await sendInviteEmail({
      toEmail: 'farmer@example.com',
      farmerName: 'Alice',
      inviteUrl: 'http://localhost/invite/abc',
      inviterName: 'Admin',
    });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
    expect(result.reason).toMatch(/not configured/i);
    if (origKey !== undefined) process.env.SENDGRID_API_KEY = origKey;
  });

  it('sendInviteEmail returns manual_share_ready when no toEmail provided', async () => {
    vi.resetModules();
    const { sendInviteEmail } = await import('../modules/notifications/deliveryService.js');
    const result = await sendInviteEmail({ toEmail: null, farmerName: 'Bob', inviteUrl: 'http://x' });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
  });

  it('sendInviteSms returns manual_share_ready when no phone provided', async () => {
    vi.resetModules();
    const { sendInviteSms } = await import('../modules/notifications/deliveryService.js');
    const result = await sendInviteSms({ toPhone: null, farmerName: 'Carol', inviteUrl: 'http://x' });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
  });
});

// ═══════════════════════════════════════════════════════════
// Part E — opsLogger helpers: correct severity + event shape
// ═══════════════════════════════════════════════════════════
// These import the REAL opsLogger (not mocked). Uses the same eventStore
// instance as the top-level import above.

describe('logDeliveryEvent — severity classification', () => {
  it('emits error severity for "send_failed"', () => {
    const entry = logDeliveryEvent('send_failed', { provider: 'sendgrid', error: 'timeout' });
    expect(entry.category).toBe('delivery');
    expect(entry.event).toBe('send_failed');
    expect(entry.severity).toBe('error');
    expect(entry.provider).toBe('sendgrid');
    // Must appear in eventStore
    const stored = getRecentEvents({ category: 'delivery' });
    expect(stored.some(e => e.event === 'send_failed')).toBe(true);
  });

  it('emits error severity for "provider_error"', () => {
    const entry = logDeliveryEvent('provider_error', { provider: 'twilio' });
    expect(entry.severity).toBe('error');
  });

  it('emits error severity for "all_channels_failed"', () => {
    const entry = logDeliveryEvent('all_channels_failed', {});
    expect(entry.severity).toBe('error');
  });

  it('emits warn severity for "provider_unconfigured"', () => {
    const entry = logDeliveryEvent('provider_unconfigured', { provider: 'twilio' });
    expect(entry.severity).toBe('warn');
  });

  it('emits warn severity for "channel_fallback"', () => {
    const entry = logDeliveryEvent('channel_fallback', { from: 'sms', to: 'email' });
    expect(entry.severity).toBe('warn');
  });

  it('emits info severity for any other event', () => {
    const entry = logDeliveryEvent('invite_sent', { channel: 'email' });
    expect(entry.severity).toBe('info');
  });
});

describe('logNotificationEvent — severity classification', () => {
  it('emits info severity for "cycle_complete"', () => {
    const entry = logNotificationEvent('cycle_complete', { durationMs: 1200, enqueued: 5 });
    expect(entry.category).toBe('notification');
    expect(entry.event).toBe('cycle_complete');
    expect(entry.severity).toBe('info');
    expect(entry.durationMs).toBe(1200);
  });

  it('emits info severity for "cycle_summary"', () => {
    const entry = logNotificationEvent('cycle_summary', { enqueued: 3 });
    expect(entry.severity).toBe('info');
    // Verify stored in eventStore
    const stored = getRecentEvents({ category: 'notification' });
    expect(stored.some(e => e.event === 'cycle_summary')).toBe(true);
  });

  it('emits warn severity for "cycle_slow"', () => {
    const entry = logNotificationEvent('cycle_slow', { durationMs: 75000 });
    expect(entry.severity).toBe('warn');
  });

  it('emits error severity for "cycle_error"', () => {
    const entry = logNotificationEvent('cycle_error', { error: 'DB timeout' });
    expect(entry.severity).toBe('error');
  });

  it('emits error severity for "send_failed"', () => {
    const entry = logNotificationEvent('send_failed', { id: 'n1' });
    expect(entry.severity).toBe('error');
  });
});
