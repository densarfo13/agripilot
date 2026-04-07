/**
 * UX Improvements Test Suite
 *
 * Focused tests for:
 * 1. Farmer list registrationStatus filter (backend)
 * 2. Duplicate-submission guard on key farmer actions
 * 3. Role-safe visibility — farmer can't access admin data
 * 4. listFarmers with registrationStatus filter
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listFarmers } from '../modules/farmers/service.js';
import prisma from '../config/database.js';

vi.mock('../config/database.js', () => ({
  default: {
    farmer: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// ─── 1. listFarmers registrationStatus filter ─────────────────────────

describe('listFarmers — registrationStatus filter', () => {
  const mockFarmers = [
    { id: 'f1', fullName: 'Amina Hassan', registrationStatus: 'approved' },
    { id: 'f2', fullName: 'John Kamau',  registrationStatus: 'pending_approval' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.farmer.findMany.mockResolvedValue(mockFarmers);
    prisma.farmer.count.mockResolvedValue(2);
  });

  const lastCall = () => prisma.farmer.findMany.mock.calls.at(-1)[0];

  it('passes registrationStatus into the WHERE clause when provided', async () => {
    await listFarmers({ registrationStatus: 'approved', orgScope: {} });
    expect(lastCall().where.registrationStatus).toBe('approved');
  });

  it('does NOT add registrationStatus to WHERE when undefined', async () => {
    await listFarmers({ orgScope: {} });
    expect(lastCall().where.registrationStatus).toBeUndefined();
  });

  it('does NOT add registrationStatus to WHERE when empty string', async () => {
    await listFarmers({ registrationStatus: '', orgScope: {} });
    // empty string is falsy — should not be added
    expect(lastCall().where.registrationStatus).toBeUndefined();
  });

  it('combines registrationStatus with search filter', async () => {
    await listFarmers({ registrationStatus: 'pending_approval', search: 'John', orgScope: {} });
    expect(lastCall().where.registrationStatus).toBe('pending_approval');
    expect(lastCall().where.OR).toBeDefined();
    expect(lastCall().where.OR.length).toBeGreaterThan(0);
  });

  it('combines registrationStatus with orgScope', async () => {
    const orgScope = { organizationId: 'org-123' };
    await listFarmers({ registrationStatus: 'approved', orgScope });
    expect(lastCall().where.registrationStatus).toBe('approved');
    expect(lastCall().where.organizationId).toBe('org-123');
  });

  it('returns both farmers array and total count', async () => {
    const result = await listFarmers({ orgScope: {} });
    expect(result).toHaveProperty('farmers');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.farmers)).toBe(true);
  });

  it('respects page and limit', async () => {
    await listFarmers({ page: 2, limit: 10, orgScope: {} });
    expect(lastCall().skip).toBe(10);
    expect(lastCall().take).toBe(10);
  });
});

// ─── 2. Duplicate submission protection logic ──────────────────────────

describe('duplicate-submission guard patterns', () => {
  /**
   * The dedup middleware uses a per-key in-memory TTL store.
   * Here we verify that the same key cannot be used twice within the TTL window.
   */
  it('same dedup key is rejected within TTL window', async () => {
    const { dedupGuard } = await import('../middleware/dedup.js');

    const resourceId = 'res-' + Date.now();
    const key = 'test-action';
    const middleware = dedupGuard(key);

    const req = { headers: {}, body: {}, user: { sub: 'user-dedup-1' }, params: { id: resourceId } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), on: vi.fn() };
    const next = vi.fn();

    // First call — should pass
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Second call within TTL — should be rejected
    const next2 = vi.fn();
    await middleware(req, res, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('different resource IDs with same action key do not conflict', async () => {
    const { dedupGuard } = await import('../middleware/dedup.js');

    const middleware = dedupGuard('create-farmer');

    const req1 = { headers: {}, body: {}, user: { sub: 'user-A' }, params: { id: 'res-A-' + Date.now() } };
    const req2 = { headers: {}, body: {}, user: { sub: 'user-B' }, params: { id: 'res-B-' + Date.now() } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), on: vi.fn() };
    const next1 = vi.fn();
    const next2 = vi.fn();

    await middleware(req1, res, next1);
    await middleware(req2, res, next2);

    expect(next1).toHaveBeenCalledTimes(1);
    expect(next2).toHaveBeenCalledTimes(1);
  });
});

// ─── 3. Role visibility — farmer cannot access admin farmer list ───────

describe('role-safe farmer list access', () => {
  it('authorize middleware blocks farmer role from listing farmers', async () => {
    const { authorize } = await import('../middleware/auth.js');

    const middleware = authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer');

    const req = { user: { sub: 'farmer-user-id', role: 'farmer' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('field_officer can access farmer list', async () => {
    const { authorize } = await import('../middleware/auth.js');

    const middleware = authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer');

    const req = { user: { sub: 'officer-user-id', role: 'field_officer' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ─── 4. getNextAction logic (mirrors frontend util) ───────────────────

describe('next action computation', () => {
  /**
   * Mirrors the getNextAction() helper added to VerificationQueuePage.
   * We test the logic rules directly here as pure functions.
   */
  function getNextAction(app) {
    const days = Math.floor((Date.now() - new Date(app.createdAt)) / 86400000);
    const score = app.verificationResult?.verificationScore;

    if (app.status === 'needs_more_evidence')    return { label: 'Waiting for evidence', urgent: false };
    if (app.status === 'field_review_required')  return { label: 'Field visit needed', urgent: true };
    if (app.status === 'escalated')              return { label: 'Senior review needed', urgent: true };
    if (!app.verificationResult)                 return { label: 'Score first', urgent: days > 3 };
    if (app.status === 'under_review') {
      if (score >= 70) return { label: 'Approve or reject', urgent: true };
      if (score >= 40) return { label: 'Review carefully', urgent: days > 5 };
      return { label: 'Consider rejecting', urgent: false };
    }
    if (app.status === 'submitted') {
      if (score >= 70) return { label: 'Move to review', urgent: true };
      return { label: 'Move to review', urgent: false };
    }
    return { label: '—', urgent: false };
  }

  const freshDate = new Date().toISOString();
  const oldDate = new Date(Date.now() - 10 * 86400000).toISOString();

  it('escalated → Senior review needed (urgent)', () => {
    const a = { status: 'escalated', createdAt: freshDate, verificationResult: null };
    const r = getNextAction(a);
    expect(r.label).toBe('Senior review needed');
    expect(r.urgent).toBe(true);
  });

  it('field_review_required → Field visit needed (urgent)', () => {
    const a = { status: 'field_review_required', createdAt: freshDate, verificationResult: null };
    expect(getNextAction(a).urgent).toBe(true);
  });

  it('submitted, unscored, fresh → Score first (not urgent)', () => {
    const a = { status: 'submitted', createdAt: freshDate, verificationResult: null };
    const r = getNextAction(a);
    expect(r.label).toBe('Score first');
    expect(r.urgent).toBe(false);
  });

  it('submitted, unscored, >3 days old → Score first (urgent)', () => {
    const a = { status: 'submitted', createdAt: oldDate, verificationResult: null };
    const r = getNextAction(a);
    expect(r.label).toBe('Score first');
    expect(r.urgent).toBe(true);
  });

  it('under_review, score ≥70 → Approve or reject (urgent)', () => {
    const a = { status: 'under_review', createdAt: freshDate, verificationResult: { verificationScore: 82 } };
    const r = getNextAction(a);
    expect(r.label).toBe('Approve or reject');
    expect(r.urgent).toBe(true);
  });

  it('under_review, score 40–69, old → Review carefully (urgent)', () => {
    const a = { status: 'under_review', createdAt: oldDate, verificationResult: { verificationScore: 55 } };
    const r = getNextAction(a);
    expect(r.label).toBe('Review carefully');
    expect(r.urgent).toBe(true);
  });

  it('under_review, score <40 → Consider rejecting (not urgent)', () => {
    const a = { status: 'under_review', createdAt: freshDate, verificationResult: { verificationScore: 22 } };
    const r = getNextAction(a);
    expect(r.label).toBe('Consider rejecting');
    expect(r.urgent).toBe(false);
  });

  it('needs_more_evidence → Waiting for evidence (not urgent)', () => {
    const a = { status: 'needs_more_evidence', createdAt: freshDate, verificationResult: null };
    expect(getNextAction(a).urgent).toBe(false);
  });
});
