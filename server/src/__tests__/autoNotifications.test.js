/**
 * Auto-Notification system tests
 *
 * Covers:
 *   - Trigger rules (all 6)
 *   - Rate limiting / no-spam
 *   - Channel fallback logic (SMS → email → in_app)
 *   - Org scoping in listNotifications and retryNotification
 *   - Template rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Prisma mock ──────────────────────────────────────────
vi.mock('../config/database.js', () => ({
  default: {
    farmer:             { findMany: vi.fn(), findUnique: vi.fn() },
    farmSeason:         { findMany: vi.fn() },
    officerValidation:  { findMany: vi.fn() },
    user:               { findMany: vi.fn(), findUnique: vi.fn() },
    application:        { count: vi.fn(), groupBy: vi.fn() },
    autoNotification:   {
      count:      vi.fn(),
      create:     vi.fn(),
      findUnique: vi.fn(),
      findMany:   vi.fn(),
      update:     vi.fn(),
    },
    farmerNotification: { create: vi.fn() },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

// ─── Risk engine mock ─────────────────────────────────────
vi.mock('../modules/risk/service.js', () => ({
  computeSeasonRisk: vi.fn(),
}));

// ─── Ops logger mock ──────────────────────────────────────
vi.mock('../utils/opsLogger.js', () => ({
  opsEvent:     vi.fn(),
  logAuthEvent: vi.fn(),
}));

import prisma from '../config/database.js';
import { computeSeasonRisk } from '../modules/risk/service.js';

// ═══════════════════════════════════════════════════════════
// Templates
// ═══════════════════════════════════════════════════════════

describe('renderTemplate', () => {
  let renderTemplate;
  beforeEach(async () => {
    vi.resetModules();
    ({ renderTemplate } = await import('../modules/autoNotifications/templates.js'));
  });

  it('renders invite_reminder with invite URL', () => {
    const { subject, message } = renderTemplate('invite_reminder', {
      farmerName: 'Alice', daysSinceInvite: 4, inviteUrl: 'https://app.example.com/invite/abc',
    });
    expect(subject).toContain('registration');
    expect(message).toContain('Alice');
    expect(message).toContain('4');
    expect(message).toContain('https://app.example.com');
  });

  it('renders invite_reminder without invite URL', () => {
    const { message } = renderTemplate('invite_reminder', {
      farmerName: 'Bob', daysSinceInvite: 5, inviteUrl: null,
    });
    expect(message).toContain('contact your field officer');
  });

  it('renders no_first_update', () => {
    const { subject, message } = renderTemplate('no_first_update', {
      farmerName: 'Carol', cropType: 'maize', daysSincePlanting: 10,
    });
    expect(subject).toContain('update');
    expect(message).toContain('maize');
    expect(message).toContain('10');
  });

  it('renders stale_farmer with officer name', () => {
    const { message } = renderTemplate('stale_farmer', {
      farmerName: 'Dave', daysSinceActivity: 20, officerName: 'Officer Jane',
    });
    expect(message).toContain('20');
    expect(message).toContain('Officer Jane');
  });

  it('renders reviewer_backlog', () => {
    const { message } = renderTemplate('reviewer_backlog', {
      reviewerName: 'Eve', pendingCount: 12,
    });
    expect(message).toContain('12');
    expect(message).toContain('applications');
  });

  it('renders high_risk_alert', () => {
    const { subject, message } = renderTemplate('high_risk_alert', {
      officerName: 'Frank', farmerName: 'Grace', riskLevel: 'Critical',
      riskCategory: 'stale_season', seasonId: 'season-uuid-1234',
    });
    expect(subject).toContain('Critical');
    expect(message).toContain('Critical risk');
  });

  it('throws for unknown type', () => {
    expect(() => renderTemplate('nonexistent_type', {})).toThrow('No template');
  });
});

// ═══════════════════════════════════════════════════════════
// Rate limiter
// ═══════════════════════════════════════════════════════════

describe('isAllowed (rate limiter)', () => {
  let isAllowed;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ isAllowed } = await import('../modules/autoNotifications/rateLimiter.js'));
  });

  it('allows when no recent notifications exist', async () => {
    prisma.autoNotification.count.mockResolvedValue(0);
    const result = await isAllowed({ type: 'stale_farmer', farmerId: 'f1', userId: null, seasonId: null });
    expect(result).toBe(true);
  });

  it('blocks when farmer already received this type today', async () => {
    // First call (same-type-per-farmer): returns 1
    prisma.autoNotification.count.mockResolvedValueOnce(1);
    const result = await isAllowed({ type: 'stale_farmer', farmerId: 'f1', userId: null, seasonId: null });
    expect(result).toBe(false);
  });

  it('blocks when farmer hits global daily cap (3 total)', async () => {
    // Same-type per farmer today: 0 (ok)
    prisma.autoNotification.count.mockResolvedValueOnce(0);
    // Global daily count: 3 (at cap)
    prisma.autoNotification.count.mockResolvedValueOnce(3);
    const result = await isAllowed({ type: 'no_first_update', farmerId: 'f1', userId: null, seasonId: null });
    expect(result).toBe(false);
  });

  it('blocks high_risk_alert for same season within 6 hours', async () => {
    prisma.autoNotification.count.mockResolvedValueOnce(1); // recent within 6h
    const result = await isAllowed({ type: 'high_risk_alert', farmerId: null, userId: null, seasonId: 's1' });
    expect(result).toBe(false);
  });

  it('allows high_risk_alert when none sent in past 6 hours', async () => {
    prisma.autoNotification.count.mockResolvedValueOnce(0); // no recent within 6h
    prisma.autoNotification.count.mockResolvedValueOnce(0); // global daily
    const result = await isAllowed({ type: 'high_risk_alert', farmerId: 'f2', userId: null, seasonId: 's1' });
    expect(result).toBe(true);
  });

  it('blocks user-targeted type if already sent today (no farmerId)', async () => {
    prisma.autoNotification.count.mockResolvedValueOnce(1);
    const result = await isAllowed({ type: 'reviewer_backlog', farmerId: null, userId: 'u1', seasonId: null });
    expect(result).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Channel dispatch / fallback
// ═══════════════════════════════════════════════════════════

describe('dispatch (sender fallback)', () => {
  let dispatch;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Mock delivery service helpers
    vi.doMock('../modules/notifications/deliveryService.js', () => ({
      isEmailConfigured: vi.fn().mockReturnValue(true),
      isSmsConfigured:   vi.fn().mockReturnValue(false), // SMS NOT configured by default
    }));

    // Mock SendGrid
    vi.doMock('@sendgrid/mail', () => ({
      default: {
        setApiKey: vi.fn(),
        send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
      },
    }));

    ({ dispatch } = await import('../modules/autoNotifications/sender.js'));
  });

  it('falls back from SMS to email when SMS is not configured', async () => {
    const result = await dispatch({
      preferredChannel: 'sms',
      subject: 'Test',
      message: 'Hello',
      phone: '+254700000000',
      email: 'test@example.com',
      farmerId: null,
    });
    // SMS not configured → falls back to email
    expect(result.channel).toBe('email');
    expect(result.fallback).toBe(true);
  });

  it('falls back from email to in_app when email not configured and no phone', async () => {
    vi.resetModules();
    vi.doMock('../modules/notifications/deliveryService.js', () => ({
      isEmailConfigured: vi.fn().mockReturnValue(false),
      isSmsConfigured:   vi.fn().mockReturnValue(false),
    }));

    prisma.farmerNotification.create.mockResolvedValue({ id: 'n1' });

    const { dispatch: d } = await import('../modules/autoNotifications/sender.js');
    const result = await d({
      preferredChannel: 'email',
      subject: 'Test',
      message: 'Hello',
      phone: null,
      email: 'test@example.com',
      farmerId: 'f1',
    });
    expect(result.channel).toBe('in_app');
    expect(result.fallback).toBe(true);
  });

  it('succeeds on preferred channel when available', async () => {
    vi.resetModules();
    vi.doMock('../modules/notifications/deliveryService.js', () => ({
      isEmailConfigured: vi.fn().mockReturnValue(true),
      isSmsConfigured:   vi.fn().mockReturnValue(true),
    }));
    vi.doMock('twilio', () => ({
      default: vi.fn().mockReturnValue({
        messages: { create: vi.fn().mockResolvedValue({ sid: 'SM123' }) },
      }),
    }));

    const { dispatch: d } = await import('../modules/autoNotifications/sender.js');
    const result = await d({
      preferredChannel: 'sms',
      subject: 'Test',
      message: 'Hello',
      phone: '+254700000000',
      email: null,
      farmerId: null,
    });
    expect(result.channel).toBe('sms');
    expect(result.fallback).toBe(false);
  });

  it('throws when all channels fail', async () => {
    vi.resetModules();
    vi.doMock('../modules/notifications/deliveryService.js', () => ({
      isEmailConfigured: vi.fn().mockReturnValue(false),
      isSmsConfigured:   vi.fn().mockReturnValue(false),
    }));

    const { dispatch: d } = await import('../modules/autoNotifications/sender.js');
    await expect(d({
      preferredChannel: 'email',
      subject: 'Test',
      message: 'Hello',
      phone: null,
      email: 'x@x.com',
      farmerId: null,
    })).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════
// Trigger rules
// ═══════════════════════════════════════════════════════════

describe('ruleInviteReminder', () => {
  let ruleInviteReminder;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ ruleInviteReminder } = await import('../modules/autoNotifications/triggerEngine.js'));
  });

  it('returns a payload for each un-accepted farmer with old invite', async () => {
    const oldInvite = new Date(Date.now() - 5 * 86400000); // 5 days ago
    prisma.farmer.findMany.mockResolvedValue([
      { id: 'f1', fullName: 'Alice', phone: '+1', organizationId: 'org1', inviteToken: 'tok1', invitedAt: oldInvite },
    ]);

    const payloads = await ruleInviteReminder();
    expect(payloads).toHaveLength(1);
    expect(payloads[0].type).toBe('invite_reminder');
    expect(payloads[0].farmerId).toBe('f1');
    expect(payloads[0].templateCtx.daysSinceInvite).toBeGreaterThanOrEqual(4);
  });

  it('returns empty array when no pending invites', async () => {
    prisma.farmer.findMany.mockResolvedValue([]);
    const payloads = await ruleInviteReminder();
    expect(payloads).toHaveLength(0);
  });
});

describe('ruleNoFirstUpdate', () => {
  let ruleNoFirstUpdate;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ ruleNoFirstUpdate } = await import('../modules/autoNotifications/triggerEngine.js'));
  });

  it('returns payload for seasons with no progress after planting', async () => {
    const oldPlanting = new Date(Date.now() - 10 * 86400000);
    prisma.farmSeason.findMany.mockResolvedValue([
      {
        id: 's1', cropType: 'maize', plantingDate: oldPlanting,
        farmer: { id: 'f1', fullName: 'Bob', phone: '+2', organizationId: 'org1', assignedOfficerId: null },
      },
    ]);

    const payloads = await ruleNoFirstUpdate();
    expect(payloads).toHaveLength(1);
    expect(payloads[0].type).toBe('no_first_update');
    expect(payloads[0].templateCtx.cropType).toBe('maize');
  });
});

describe('ruleStaleActivity', () => {
  let ruleStaleActivity;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ ruleStaleActivity } = await import('../modules/autoNotifications/triggerEngine.js'));
  });

  it('deduplicates by farmerId across multiple stale seasons', async () => {
    const staleDate = new Date(Date.now() - 20 * 86400000);
    prisma.farmSeason.findMany.mockResolvedValue([
      { id: 's1', lastActivityDate: staleDate, farmer: { id: 'f1', fullName: 'Carol', phone: '+3', organizationId: 'org1', assignedOfficerId: null } },
      { id: 's2', lastActivityDate: staleDate, farmer: { id: 'f1', fullName: 'Carol', phone: '+3', organizationId: 'org1', assignedOfficerId: null } },
    ]);

    const payloads = await ruleStaleActivity();
    // f1 has 2 stale seasons but should only produce 1 notification
    expect(payloads).toHaveLength(1);
    expect(payloads[0].farmerId).toBe('f1');
  });
});

describe('ruleReviewerBacklog', () => {
  let ruleReviewerBacklog;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ ruleReviewerBacklog } = await import('../modules/autoNotifications/triggerEngine.js'));
  });

  it('returns payload for reviewers above threshold', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', fullName: 'Rev1', email: 'rev1@example.com', organizationId: 'org1' },
      { id: 'u2', fullName: 'Rev2', email: 'rev2@example.com', organizationId: 'org2' },
    ]);
    // Single groupBy replaces N count queries: u1 has 12 pending (above threshold=10), u2 has 3 (below)
    prisma.application.groupBy.mockResolvedValue([
      { assignedReviewerId: 'u1', _count: { id: 12 } },
      { assignedReviewerId: 'u2', _count: { id: 3 } },
    ]);

    const payloads = await ruleReviewerBacklog();
    expect(payloads).toHaveLength(1);
    expect(payloads[0].userId).toBe('u1');
    expect(payloads[0].templateCtx.pendingCount).toBe(12);
  });

  it('returns empty when all reviewers are under threshold', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', fullName: 'Rev1', email: 'rev1@example.com', organizationId: 'org1' },
    ]);
    prisma.application.groupBy.mockResolvedValue([
      { assignedReviewerId: 'u1', _count: { id: 5 } },
    ]);

    const payloads = await ruleReviewerBacklog();
    expect(payloads).toHaveLength(0);
  });
});

describe('ruleHighRiskAlert', () => {
  let ruleHighRiskAlert;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ ruleHighRiskAlert } = await import('../modules/autoNotifications/triggerEngine.js'));
  });

  it('returns payload for seasons with Critical risk', async () => {
    prisma.farmSeason.findMany.mockResolvedValue([
      {
        id: 's1', farmerId: 'f1',
        farmer: { id: 'f1', fullName: 'Dave', organizationId: 'org1', assignedOfficerId: 'u1', phone: '+4' },
      },
    ]);
    computeSeasonRisk.mockResolvedValue({ riskLevel: 'Critical', riskCategory: 'stale_season' });
    prisma.user.findUnique.mockResolvedValue({ fullName: 'Officer Joe', email: 'joe@example.com' });

    const payloads = await ruleHighRiskAlert();
    expect(payloads).toHaveLength(1);
    expect(payloads[0].type).toBe('high_risk_alert');
    expect(payloads[0].templateCtx.riskLevel).toBe('Critical');
  });

  it('ignores seasons with Medium or Low risk', async () => {
    prisma.farmSeason.findMany.mockResolvedValue([
      {
        id: 's2', farmerId: 'f2',
        farmer: { id: 'f2', fullName: 'Eve', organizationId: 'org1', assignedOfficerId: null, phone: null },
      },
    ]);
    computeSeasonRisk.mockResolvedValue({ riskLevel: 'Medium', riskCategory: 'no_updates' });

    const payloads = await ruleHighRiskAlert();
    expect(payloads).toHaveLength(0);
  });

  it('skips seasons where risk computation throws', async () => {
    prisma.farmSeason.findMany.mockResolvedValue([
      {
        id: 's3', farmerId: 'f3',
        farmer: { id: 'f3', fullName: 'Frank', organizationId: 'org1', assignedOfficerId: null, phone: null },
      },
    ]);
    computeSeasonRisk.mockRejectedValue(new Error('season not found'));

    const payloads = await ruleHighRiskAlert();
    expect(payloads).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════
// Org scoping in service
// ═══════════════════════════════════════════════════════════

describe('listNotifications org scoping', () => {
  let listNotifications;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ listNotifications } = await import('../modules/autoNotifications/service.js'));
  });

  it('scopes to org for institutional_admin', async () => {
    prisma.autoNotification.findMany.mockResolvedValue([]);
    prisma.autoNotification.count.mockResolvedValue(0);

    await listNotifications({ actorRole: 'institutional_admin', actorOrgId: 'org1' });

    const call = prisma.autoNotification.findMany.mock.calls[0][0];
    expect(call.where.organizationId).toBe('org1');
  });

  it('does not scope for super_admin', async () => {
    prisma.autoNotification.findMany.mockResolvedValue([]);
    prisma.autoNotification.count.mockResolvedValue(0);

    await listNotifications({ actorRole: 'super_admin', actorOrgId: null });

    const call = prisma.autoNotification.findMany.mock.calls[0][0];
    expect(call.where.organizationId).toBeUndefined();
  });
});

describe('retryNotification', () => {
  let retryNotification;
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ retryNotification } = await import('../modules/autoNotifications/service.js'));
  });

  it('throws 404 when notification not found', async () => {
    prisma.autoNotification.findUnique.mockResolvedValue(null);
    await expect(retryNotification({ id: 'bad-id', actorRole: 'super_admin', actorOrgId: null }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when notification is not failed', async () => {
    prisma.autoNotification.findUnique.mockResolvedValue({
      id: 'n1', status: 'sent', organizationId: 'org1', channel: 'email',
      farmerId: null, userId: null,
    });
    await expect(retryNotification({ id: 'n1', actorRole: 'super_admin', actorOrgId: null }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 403 when institutional_admin tries to retry another org notification', async () => {
    prisma.autoNotification.findUnique.mockResolvedValue({
      id: 'n2', status: 'failed', organizationId: 'org-other', channel: 'email',
      farmerId: null, userId: null,
    });
    await expect(retryNotification({ id: 'n2', actorRole: 'institutional_admin', actorOrgId: 'org1' }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});
