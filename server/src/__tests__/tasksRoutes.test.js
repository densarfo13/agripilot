/**
 * tasksRoutes.test.js — contract for the offline-sync task-event
 * sink endpoints (POST /completed, DELETE /completed, POST /skipped).
 * Tests the exported helpers directly (findDuplicateTaskEvent,
 * writeTaskEvent) so we don't need supertest.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database.js FIRST so routes.js picks up the fake.
vi.mock('../config/database.js', () => {
  const mockPrisma = {
    farmer:   { findFirst: vi.fn() },
    auditLog: { findMany:  vi.fn() },
  };
  return { default: mockPrisma };
});

// Mock writeAuditLog so we can assert on its calls.
vi.mock('../modules/audit/service.js', () => ({
  writeAuditLog: vi.fn(async (payload) => ({ id: `audit_${Date.now()}`, ...payload })),
}));

import prisma from '../config/database.js';
import { writeAuditLog } from '../modules/audit/service.js';
import {
  writeTaskEvent, findDuplicateTaskEvent,
} from '../modules/tasks/routes.js';

beforeEach(() => {
  vi.clearAllMocks();
  prisma.farmer.findFirst.mockResolvedValue({
    id: 'farmer-1', organizationId: 'org-1',
  });
  prisma.auditLog.findMany.mockResolvedValue([]);
});

// ─── findDuplicateTaskEvent ────────────────────────────────
describe('findDuplicateTaskEvent', () => {
  it('returns null when no idempotency key supplied', async () => {
    const dup = await findDuplicateTaskEvent('task.completed', null);
    expect(dup).toBeNull();
  });

  it('scans recent audit rows and matches by idempotencyKey in details', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'a1', details: { idempotencyKey: 'not-this' } },
      { id: 'a2', details: { idempotencyKey: 'KEY-123' } },
    ]);
    const dup = await findDuplicateTaskEvent('task.completed', 'KEY-123');
    expect(dup).toBeTruthy();
    expect(dup.id).toBe('a2');
  });

  it('tolerates stringified JSON in the details column', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'a3', details: JSON.stringify({ idempotencyKey: 'KEY-777' }) },
    ]);
    const dup = await findDuplicateTaskEvent('task.skipped', 'KEY-777');
    expect(dup && dup.id).toBe('a3');
  });

  it('returns null if no match', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'a1', details: { idempotencyKey: 'other' } },
    ]);
    expect(await findDuplicateTaskEvent('task.completed', 'KEY-no')).toBeNull();
  });
});

// ─── writeTaskEvent ────────────────────────────────────────
describe('writeTaskEvent', () => {
  function makeReq(body = {}, headers = {}) {
    return {
      body,
      headers,
      ip: '127.0.0.1',
      user: { sub: 'user-1' },
    };
  }

  it('rejects when templateId is missing', async () => {
    const out = await writeTaskEvent(makeReq({ farmId: 'farm-1' }), 'task.completed');
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('missing_template_id');
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('persists an AuditLog with farmer + organization resolved', async () => {
    const out = await writeTaskEvent(
      makeReq({ farmId: 'farm-1', templateId: 'water_check' }, {}),
      'task.completed',
      { completedAt: '2026-04-22T10:00:00Z' },
    );
    expect(out.status).toBe(200);
    expect(out.body.ok).toBe(true);
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    const payload = writeAuditLog.mock.calls[0][0];
    expect(payload.action).toBe('task.completed');
    expect(payload.organizationId).toBe('org-1');
    expect(payload.details.farmerId).toBe('farmer-1');
    expect(payload.details.templateId).toBe('water_check');
    expect(payload.details.completedAt).toBe('2026-04-22T10:00:00Z');
    expect(payload.details.source).toBe('offline_sync');
  });

  it('returns 409 duplicate when idempotency key already seen', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'earlier', details: { idempotencyKey: 'DUP-1' } },
    ]);
    const req = makeReq(
      { farmId: 'farm-1', templateId: 't' },
      { 'idempotency-key': 'DUP-1' },
    );
    const out = await writeTaskEvent(req, 'task.completed');
    expect(out.status).toBe(409);
    expect(out.body.error).toBe('duplicate');
    expect(out.body.id).toBe('earlier');
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('propagates the idempotencyKey into details when no duplicate', async () => {
    const req = makeReq(
      { farmId: 'farm-1', templateId: 't' },
      { 'idempotency-key': 'FRESH-1' },
    );
    const out = await writeTaskEvent(req, 'task.skipped', { skippedAt: '2026-04-22T11:00:00Z' });
    expect(out.status).toBe(200);
    const payload = writeAuditLog.mock.calls[0][0];
    expect(payload.action).toBe('task.skipped');
    expect(payload.details.idempotencyKey).toBe('FRESH-1');
    expect(payload.details.skippedAt).toBe('2026-04-22T11:00:00Z');
  });

  it('tolerates missing farmer profile (writes with null org)', async () => {
    prisma.farmer.findFirst.mockResolvedValue(null);
    const out = await writeTaskEvent(
      makeReq({ templateId: 't' }),
      'task.uncompleted',
      { uncompletedAt: '2026-04-22T12:00:00Z' },
    );
    expect(out.status).toBe(200);
    const payload = writeAuditLog.mock.calls[0][0];
    expect(payload.organizationId).toBeNull();
    expect(payload.details.farmerId).toBeNull();
  });
});
