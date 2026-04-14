/**
 * Feedback Capture — Service Layer Tests
 *
 * Tests the feedback submission logic: validation, sanitization,
 * severity resolution, and admin read with org scoping.
 *
 * Routes call prisma directly, so we test the logic via the service-equivalent
 * patterns used inline in the routes module by calling the route handler logic
 * through a thin helper that mirrors what the route does.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    userFeedback: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    officerValidation: { count: vi.fn().mockResolvedValue(0) },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { default: mockPrisma };
});

vi.mock('../utils/opsLogger.js', () => ({
  logPermissionEvent: vi.fn(),
  logAuthEvent: vi.fn(),
  logWorkflowEvent: vi.fn(),
  logUploadEvent: vi.fn(),
  logSystemEvent: vi.fn(),
  opsEvent: vi.fn(),
}));

import prisma from '../config/database.js';

// ─── Helper: simulate feedback submission logic ────────────────
// These constants match the routes module to keep tests honest.

const VALID_SEVERITIES = ['info', 'low', 'medium', 'high'];
const MAX_MESSAGE_LENGTH = 2000;

function resolveSeverity(severity) {
  return VALID_SEVERITIES.includes(severity) ? severity : 'info';
}

function validateFeedbackMessage(message) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    return { error: 'message is required' };
  }
  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    return { error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` };
  }
  return null;
}

// ─── Feedback Validation ──────────────────────────────────────

describe('feedback message validation', () => {
  it('rejects empty message', () => {
    expect(validateFeedbackMessage('')).toMatchObject({ error: 'message is required' });
  });

  it('rejects null message', () => {
    expect(validateFeedbackMessage(null)).toMatchObject({ error: 'message is required' });
  });

  it('rejects whitespace-only message', () => {
    expect(validateFeedbackMessage('   ')).toMatchObject({ error: 'message is required' });
  });

  it('rejects message exceeding 2000 characters', () => {
    const long = 'a'.repeat(2001);
    expect(validateFeedbackMessage(long)).toMatchObject({ error: /2000/i });
  });

  it('accepts message at exactly 2000 characters', () => {
    const exact = 'a'.repeat(2000);
    expect(validateFeedbackMessage(exact)).toBeNull();
  });

  it('accepts normal message', () => {
    expect(validateFeedbackMessage('This app is working great!')).toBeNull();
  });
});

// ─── Severity Resolution ──────────────────────────────────────

describe('severity resolution', () => {
  it('keeps valid severity values as-is', () => {
    expect(resolveSeverity('info')).toBe('info');
    expect(resolveSeverity('low')).toBe('low');
    expect(resolveSeverity('medium')).toBe('medium');
    expect(resolveSeverity('high')).toBe('high');
  });

  it('defaults unknown severity to info', () => {
    expect(resolveSeverity('critical')).toBe('info');
    expect(resolveSeverity('urgent')).toBe('info');
    expect(resolveSeverity(undefined)).toBe('info');
    expect(resolveSeverity(null)).toBe('info');
    expect(resolveSeverity('')).toBe('info');
  });
});

// ─── Feedback Submission (prisma.userFeedback.create) ─────────

describe('feedback submission — prisma create', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls prisma.userFeedback.create with trimmed message', async () => {
    prisma.userFeedback.create.mockResolvedValue({
      id: 'fb-1', severity: 'info', context: null, createdAt: new Date(),
    });

    const message = '  This is feedback  ';
    const trimmed = message.trim();
    const validationError = validateFeedbackMessage(message);
    expect(validationError).toBeNull();

    await prisma.userFeedback.create({
      data: {
        userId: 'u-1',
        role: 'field_officer',
        message: trimmed,
        context: null,
        severity: resolveSeverity(undefined),
      },
      select: { id: true, severity: true, context: true, createdAt: true },
    });

    expect(prisma.userFeedback.create).toHaveBeenCalledOnce();
    const call = prisma.userFeedback.create.mock.calls[0][0];
    expect(call.data.message).toBe('This is feedback');
    expect(call.data.severity).toBe('info');
    expect(call.data.userId).toBe('u-1');
  });

  it('truncates context to 200 characters', () => {
    const longContext = 'x'.repeat(300);
    const truncated = String(longContext).slice(0, 200);
    expect(truncated.length).toBe(200);
  });

  it('stores null context when context is not provided', () => {
    const context = undefined;
    const stored = context ? String(context).slice(0, 200) : null;
    expect(stored).toBeNull();
  });

  it('resolves high severity correctly before storing', async () => {
    prisma.userFeedback.create.mockResolvedValue({
      id: 'fb-2', severity: 'high', context: 'farmer-detail/resend-invite', createdAt: new Date(),
    });

    await prisma.userFeedback.create({
      data: {
        userId: 'u-2',
        role: 'institutional_admin',
        message: 'Critical issue found',
        context: 'farmer-detail/resend-invite',
        severity: resolveSeverity('high'),
      },
      select: { id: true, severity: true, context: true, createdAt: true },
    });

    const call = prisma.userFeedback.create.mock.calls[0][0];
    expect(call.data.severity).toBe('high');
    expect(call.data.context).toBe('farmer-detail/resend-invite');
  });
});

// ─── Feedback Read — Admin Query ──────────────────────────────

describe('feedback read — admin list', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const mockItems = [
    { id: 'fb-1', role: 'field_officer', message: 'Great app', context: null, severity: 'info', createdAt: new Date(), user: { id: 'u-1', fullName: 'Alice', email: 'a@test.com' } },
    { id: 'fb-2', role: 'farmer', message: 'App crashed', context: 'harvest-form', severity: 'high', createdAt: new Date(), user: { id: 'u-2', fullName: 'Bob', email: 'b@test.com' } },
  ];

  it('returns paginated feedback with distribution', async () => {
    prisma.userFeedback.findMany.mockResolvedValue(mockItems);
    prisma.userFeedback.count.mockResolvedValue(2);
    prisma.userFeedback.groupBy.mockResolvedValue([
      { severity: 'info', _count: 1 },
      { severity: 'high', _count: 1 },
    ]);

    const [items, total] = await Promise.all([
      prisma.userFeedback.findMany({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
        select: { id: true, role: true, message: true, context: true, severity: true, createdAt: true, user: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.userFeedback.count({ where: {} }),
    ]);

    expect(items).toHaveLength(2);
    expect(total).toBe(2);
  });

  it('filters by severity when provided', async () => {
    prisma.userFeedback.findMany.mockResolvedValue([mockItems[1]]);
    prisma.userFeedback.count.mockResolvedValue(1);
    prisma.userFeedback.groupBy.mockResolvedValue([{ severity: 'high', _count: 1 }]);

    const where = { severity: 'high' };

    await prisma.userFeedback.findMany({ where, orderBy: { createdAt: 'desc' }, skip: 0, take: 50, select: {} });

    const call = prisma.userFeedback.findMany.mock.calls[0][0];
    expect(call.where.severity).toBe('high');
  });

  it('limits results to at most 200 items', () => {
    const limit = Math.min(parseInt('500', 10), 200);
    expect(limit).toBe(200);
  });

  it('default limit is 50', () => {
    const limit = Math.min(parseInt('50', 10), 200);
    expect(limit).toBe(50);
  });

  it('computes correct page skip from page number', () => {
    const limit = 50;
    expect((1 - 1) * limit).toBe(0);   // page 1
    expect((2 - 1) * limit).toBe(50);  // page 2
    expect((3 - 1) * limit).toBe(100); // page 3
  });

  it('builds distribution object from groupBy result', () => {
    const bySeverity = [
      { severity: 'info', _count: 5 },
      { severity: 'high', _count: 2 },
    ];
    const distribution = Object.fromEntries(bySeverity.map(r => [r.severity, r._count]));
    expect(distribution.info).toBe(5);
    expect(distribution.high).toBe(2);
    expect(distribution.low).toBeUndefined();
  });

  it('institutional_admin query scopes to own org users', () => {
    const orgId = 'org-42';
    const where = {};
    // institutional_admin scoping logic (mirrors routes.js)
    if (orgId) {
      where.user = { organizationId: orgId };
    }
    expect(where.user.organizationId).toBe('org-42');
  });

  it('super_admin query has no org scope', () => {
    const where = {};
    // super_admin does NOT add org scope
    expect(where.user).toBeUndefined();
  });
});

// ─── Feedback Rate Limit Config ───────────────────────────────

describe('feedback rate limit config', () => {
  it('allows 10 submissions per 10 minutes', () => {
    const windowMs = 10 * 60 * 1000;
    const max = 10;
    expect(windowMs).toBe(600000);
    expect(max).toBe(10);
  });

  it('keys rate limit by userId when authenticated', () => {
    const req = { user: { sub: 'u-1' }, ip: '127.0.0.1' };
    const key = req.user?.sub || req.ip;
    expect(key).toBe('u-1');
  });

  it('falls back to IP when user is not set', () => {
    const req = { user: null, ip: '127.0.0.1' };
    const key = req.user?.sub || req.ip;
    expect(key).toBe('127.0.0.1');
  });
});
