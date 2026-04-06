import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Invite & Registration Flow Tests
 *
 * Tests farmer access status transitions, invite flow validation,
 * and registration approval/rejection with mocked Prisma.
 */

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    farmer: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (fn) => fn(mockPrisma)),
  };
  return { default: mockPrisma };
});

// Mock auth cache invalidation
vi.mock('../middleware/auth.js', () => ({
  invalidateAuthCache: vi.fn(),
}));

// Mock region config
vi.mock('../modules/regionConfig/service.js', () => ({
  DEFAULT_COUNTRY_CODE: 'KE',
}));

import prisma from '../config/database.js';
import { updateAccessStatus, assignOfficerToFarmer } from '../modules/farmers/service.js';

describe('Farmer Access Status Transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeFarmer = (overrides = {}) => ({
    id: 'farmer-1',
    registrationStatus: 'pending_approval',
    userId: 'user-1',
    fullName: 'Test Farmer',
    phone: '+254700000000',
    region: 'Nairobi',
    ...overrides,
  });

  describe('valid transitions', () => {
    it('pending_approval -> approved', async () => {
      prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ registrationStatus: 'pending_approval' }));
      prisma.user.update.mockResolvedValue({ id: 'user-1', active: true });
      prisma.farmer.update.mockResolvedValue({ ...makeFarmer(), registrationStatus: 'approved' });

      const result = await updateAccessStatus('farmer-1', 'approved', 'admin-1');

      expect(prisma.farmer.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          registrationStatus: 'approved',
          approvedAt: expect.any(Date),
          approvedById: 'admin-1',
        }),
      }));
      // User account should be reactivated
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { active: true },
      });
    });

    it('pending_approval -> rejected', async () => {
      prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ registrationStatus: 'pending_approval' }));
      prisma.farmer.update.mockResolvedValue({ ...makeFarmer(), registrationStatus: 'rejected' });

      await updateAccessStatus('farmer-1', 'rejected', 'admin-1');

      expect(prisma.farmer.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { registrationStatus: 'rejected' },
      }));
    });

    it('approved -> disabled (deactivates user account)', async () => {
      prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ registrationStatus: 'approved', userId: 'user-1' }));
      prisma.user.update.mockResolvedValue({ id: 'user-1', active: false });
      prisma.farmer.update.mockResolvedValue({ ...makeFarmer(), registrationStatus: 'disabled' });

      await updateAccessStatus('farmer-1', 'disabled', 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { active: false },
      });
    });

    it('disabled -> approved (reactivates user account)', async () => {
      prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ registrationStatus: 'disabled', userId: 'user-1' }));
      prisma.user.update.mockResolvedValue({ id: 'user-1', active: true });
      prisma.farmer.update.mockResolvedValue({ ...makeFarmer(), registrationStatus: 'approved' });

      await updateAccessStatus('farmer-1', 'approved', 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { active: true },
      });
    });

    it('disabled -> pending_approval (reactivates user account)', async () => {
      prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ registrationStatus: 'disabled', userId: 'user-1' }));
      prisma.user.update.mockResolvedValue({ id: 'user-1', active: true });
      prisma.farmer.update.mockResolvedValue({ ...makeFarmer(), registrationStatus: 'pending_approval' });

      await updateAccessStatus('farmer-1', 'pending_approval', 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { active: true },
      });
    });

    it('rejected -> pending_approval', async () => {
      prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ registrationStatus: 'rejected' }));
      prisma.farmer.update.mockResolvedValue({ ...makeFarmer(), registrationStatus: 'pending_approval' });

      await updateAccessStatus('farmer-1', 'pending_approval', 'admin-1');

      expect(prisma.farmer.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ registrationStatus: 'pending_approval' }),
      }));
    });
  });

  describe('invalid transitions', () => {
    it('approved -> rejected (not allowed)', async () => {
      prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ registrationStatus: 'approved' }));

      await expect(updateAccessStatus('farmer-1', 'rejected', 'admin-1'))
        .rejects.toThrow(/Cannot transition from 'approved' to 'rejected'/);
    });

    it('approved -> pending_approval (not allowed)', async () => {
      prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ registrationStatus: 'approved' }));

      await expect(updateAccessStatus('farmer-1', 'pending_approval', 'admin-1'))
        .rejects.toThrow(/Cannot transition/);
    });

    it('rejected -> approved (must go through pending first)', async () => {
      prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ registrationStatus: 'rejected' }));

      await expect(updateAccessStatus('farmer-1', 'approved', 'admin-1'))
        .rejects.toThrow(/Cannot transition/);
    });

    it('pending_approval -> pending_approval (self-transition not allowed)', async () => {
      prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ registrationStatus: 'pending_approval' }));

      await expect(updateAccessStatus('farmer-1', 'pending_approval', 'admin-1'))
        .rejects.toThrow(/Cannot transition/);
    });
  });

  describe('farmer not found', () => {
    it('throws 404 for nonexistent farmer', async () => {
      prisma.farmer.findUnique.mockResolvedValue(null);

      await expect(updateAccessStatus('nonexistent', 'approved', 'admin-1'))
        .rejects.toThrow(/not found/);
    });
  });

  describe('no userId (farmer without login account)', () => {
    it('approve transition works without user account sync', async () => {
      prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ registrationStatus: 'pending_approval', userId: null }));
      prisma.farmer.update.mockResolvedValue({ ...makeFarmer(), registrationStatus: 'approved' });

      await updateAccessStatus('farmer-1', 'approved', 'admin-1');

      // Should NOT try to update user (no userId)
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});

describe('Assign Officer to Farmer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns a field officer successfully', async () => {
    prisma.farmer.findUnique.mockResolvedValue({ id: 'farmer-1', fullName: 'Test' });
    prisma.user.findUnique.mockResolvedValue({ id: 'officer-1', role: 'field_officer' });
    prisma.farmer.update.mockResolvedValue({ id: 'farmer-1', assignedOfficerId: 'officer-1' });

    const result = await assignOfficerToFarmer('farmer-1', 'officer-1', 'admin-1');

    expect(prisma.farmer.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { assignedOfficerId: 'officer-1' },
    }));
  });

  it('unassigns officer when officerId is null', async () => {
    prisma.farmer.findUnique.mockResolvedValue({ id: 'farmer-1', fullName: 'Test' });
    prisma.farmer.update.mockResolvedValue({ id: 'farmer-1', assignedOfficerId: null });

    await assignOfficerToFarmer('farmer-1', null, 'admin-1');

    expect(prisma.farmer.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { assignedOfficerId: null },
    }));
  });

  it('rejects assignment of non-officer user', async () => {
    prisma.farmer.findUnique.mockResolvedValue({ id: 'farmer-1', fullName: 'Test' });
    prisma.user.findUnique.mockResolvedValue({ id: 'reviewer-1', role: 'reviewer' });

    await expect(assignOfficerToFarmer('farmer-1', 'reviewer-1', 'admin-1'))
      .rejects.toThrow(/not a field officer/);
  });

  it('rejects assignment of nonexistent officer', async () => {
    prisma.farmer.findUnique.mockResolvedValue({ id: 'farmer-1', fullName: 'Test' });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(assignOfficerToFarmer('farmer-1', 'nonexistent', 'admin-1'))
      .rejects.toThrow(/not found/);
  });

  it('allows institutional_admin as officer', async () => {
    prisma.farmer.findUnique.mockResolvedValue({ id: 'farmer-1', fullName: 'Test' });
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'institutional_admin' });
    prisma.farmer.update.mockResolvedValue({ id: 'farmer-1', assignedOfficerId: 'admin-1' });

    await assignOfficerToFarmer('farmer-1', 'admin-1', 'admin-2');

    expect(prisma.farmer.update).toHaveBeenCalled();
  });
});
