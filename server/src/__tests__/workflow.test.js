import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Workflow Service Tests
 *
 * Tests the application workflow service functions with mocked Prisma.
 * Verifies: state transitions, optimistic locking, validation, audit trail creation.
 */

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    application: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    reviewNote: { create: vi.fn() },
    reviewAssignment: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    farmer: { findUnique: vi.fn() },
    officerValidation: { count: vi.fn().mockResolvedValue(0) },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
    // Interactive transaction: executes the callback passing the prisma client itself
    // so tx.application.updateMany etc. reference the same mocks.
    $transaction: vi.fn(async (fn) => fn(mockPrisma)),
  };
  return { default: mockPrisma };
});

import prisma from '../config/database.js';
import {
  submitApplication,
  approveApplication,
  rejectApplication,
  escalateApplication,
  disburseApplication,
  reopenApplication,
  requestEvidence,
  getApplicationById,
} from '../modules/applications/service.js';

// Helper: mock a lightweight status query + successful atomic transition
function setupWorkflowMocks(currentStatus, newStatus) {
  // getApplicationStatus (lightweight)
  prisma.application.findUnique
    .mockResolvedValueOnce({ id: 'app-1', status: currentStatus }) // status-only check
    .mockResolvedValueOnce({ id: 'app-1', status: newStatus, farmer: { fullName: 'Test' } }); // full include after transition

  // atomicTransition succeeds
  prisma.application.updateMany.mockResolvedValue({ count: 1 });
}

describe('Application Workflow Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Submit ───────────────────────────────────────
  describe('submitApplication', () => {
    it('transitions draft to submitted', async () => {
      setupWorkflowMocks('draft', 'submitted');

      const result = await submitApplication('app-1');

      expect(prisma.application.updateMany).toHaveBeenCalledWith({
        where: { id: 'app-1', status: 'draft' },
        data: { status: 'submitted' },
      });
      expect(result.status).toBe('submitted');
    });

    it('rejects transition from submitted to submitted', async () => {
      prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'submitted' });

      await expect(submitApplication('app-1')).rejects.toThrow(/Cannot transition/);
    });

    it('rejects transition from approved to submitted', async () => {
      prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'approved' });

      await expect(submitApplication('app-1')).rejects.toThrow(/Cannot transition/);
    });
  });

  // ─── Approve ──────────────────────────────────────
  describe('approveApplication', () => {
    it('transitions under_review to approved', async () => {
      setupWorkflowMocks('under_review', 'approved');

      const result = await approveApplication('app-1', 'user-1', { reason: 'Good application' });

      expect(prisma.application.updateMany).toHaveBeenCalledWith({
        where: { id: 'app-1', status: 'under_review' },
        data: { status: 'approved' },
      });
      // Should create review note with reason
      expect(prisma.reviewNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicationId: 'app-1',
          content: 'Approved: Good application',
        }),
      });
    });

    it('passes recommended amount in extraData', async () => {
      setupWorkflowMocks('under_review', 'approved');

      await approveApplication('app-1', 'user-1', { reason: 'ok', recommendedAmount: 50000 });

      expect(prisma.application.updateMany).toHaveBeenCalledWith({
        where: { id: 'app-1', status: 'under_review' },
        data: { status: 'approved', recommendedAmount: 50000 },
      });
    });

    it('transitions escalated to approved', async () => {
      setupWorkflowMocks('escalated', 'approved');

      const result = await approveApplication('app-1', 'user-1', {});
      expect(result.application.status).toBe('approved');
    });

    it('rejects transition from draft to approved', async () => {
      prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'draft' });

      await expect(approveApplication('app-1', 'user-1', {})).rejects.toThrow(/Cannot transition/);
    });
  });

  // ─── Reject ───────────────────────────────────────
  describe('rejectApplication', () => {
    it('transitions under_review to rejected', async () => {
      setupWorkflowMocks('under_review', 'rejected');

      await rejectApplication('app-1', 'user-1', 'Insufficient evidence');

      expect(prisma.reviewNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: 'Rejected: Insufficient evidence' }),
      });
    });

    it('rejects transition from disbursed to rejected', async () => {
      prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'disbursed' });

      await expect(rejectApplication('app-1', 'user-1', 'test')).rejects.toThrow(/Cannot transition/);
    });
  });

  // ─── Escalate ─────────────────────────────────────
  describe('escalateApplication', () => {
    it('transitions under_review to escalated', async () => {
      setupWorkflowMocks('under_review', 'escalated');

      await escalateApplication('app-1', 'user-1', 'Needs senior review');

      expect(prisma.application.updateMany).toHaveBeenCalledWith({
        where: { id: 'app-1', status: 'under_review' },
        data: { status: 'escalated' },
      });
    });

    it('rejects escalation from draft', async () => {
      prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'draft' });
      await expect(escalateApplication('app-1', 'user-1', 'test')).rejects.toThrow(/Cannot transition/);
    });
  });

  // ─── Disburse ─────────────────────────────────────
  describe('disburseApplication', () => {
    it('transitions approved to disbursed', async () => {
      setupWorkflowMocks('approved', 'disbursed');

      const result = await disburseApplication('app-1', 'user-1', {});
      expect(result.application.status).toBe('disbursed');
    });

    it('transitions conditional_approved to disbursed', async () => {
      setupWorkflowMocks('conditional_approved', 'disbursed');

      const result = await disburseApplication('app-1', 'user-1', {});
      expect(result.application.status).toBe('disbursed');
    });

    it('rejects disbursement from under_review', async () => {
      prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'under_review' });
      await expect(disburseApplication('app-1', 'user-1', {})).rejects.toThrow(/Cannot transition/);
    });
  });

  // ─── Reopen ───────────────────────────────────────
  describe('reopenApplication', () => {
    it('transitions rejected to under_review', async () => {
      setupWorkflowMocks('rejected', 'under_review');

      const result = await reopenApplication('app-1', 'user-1', 'Re-evaluating');
      expect(result.application.status).toBe('under_review');
    });

    it('rejects reopening from draft', async () => {
      prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'draft' });
      await expect(reopenApplication('app-1', 'user-1', 'test')).rejects.toThrow(/Cannot transition/);
    });
  });

  // ─── Request Evidence ─────────────────────────────
  describe('requestEvidence', () => {
    it('transitions under_review to needs_more_evidence', async () => {
      setupWorkflowMocks('under_review', 'needs_more_evidence');

      await requestEvidence('app-1', 'user-1', { reason: 'Need farm photos', requiredTypes: ['farm_photo', 'id_document'] });

      expect(prisma.reviewNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: 'Evidence requested: Need farm photos (Types: farm_photo, id_document)',
        }),
      });
    });
  });

  // ─── Optimistic Locking ───────────────────────────
  describe('optimistic locking', () => {
    it('throws 409 when status changed between read and update', async () => {
      // Status check succeeds
      prisma.application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'under_review' });
      // But atomic update finds 0 rows (someone else changed status)
      prisma.application.updateMany.mockResolvedValue({ count: 0 });

      await expect(approveApplication('app-1', 'user-1', {})).rejects.toThrow(/status has changed/);
    });
  });

  // ─── Not Found ────────────────────────────────────
  describe('not found', () => {
    it('throws 404 for nonexistent application', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(submitApplication('nonexistent')).rejects.toThrow(/not found/);
    });
  });

  // ─── Happy Path: Full Workflow ────────────────────
  describe('happy path: full workflow', () => {
    it('draft → submitted → under_review (via approve) → disbursed', async () => {
      // Step 1: submit
      setupWorkflowMocks('draft', 'submitted');
      await submitApplication('app-1');
      expect(prisma.application.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { status: 'submitted' } })
      );

      // Step 2: approve
      setupWorkflowMocks('under_review', 'approved');
      await approveApplication('app-1', 'user-1', { reason: 'Verified' });
      expect(prisma.application.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { status: 'approved' } })
      );

      // Step 3: disburse
      setupWorkflowMocks('approved', 'disbursed');
      await disburseApplication('app-1', 'user-1', {});
      expect(prisma.application.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { status: 'disbursed' } })
      );
    });
  });
});
