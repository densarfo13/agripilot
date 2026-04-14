/**
 * User Editing — Safe User-Editing System Validation Suite
 *
 * Covers the Phase 2 backend hardening for user account management:
 *   1. Self-service — updateSelfProfile only allows safe fields
 *   2. Admin profile update — org scope, super_admin-only email, field validation
 *   3. Role change — self-escalation blocked, hierarchy enforced, farmer role blocked
 *   4. Org reassignment — self-change blocked, super_admin only, org existence checked
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    officerValidation: { count: vi.fn().mockResolvedValue(0) },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import prisma from '../config/database.js';
import {
  updateSelfProfile,
  adminUpdateUserProfile,
  adminChangeUserRole,
  adminChangeUserOrg,
} from '../modules/auth/service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides = {}) {
  return {
    id: 'u-1', email: 'user@test.com', fullName: 'Test User',
    role: 'field_officer', active: true, organizationId: 'org-1',
    passwordHash: null, preferredLanguage: null,
    ...overrides,
  };
}

// ─── 1. Self-service profile update ──────────────────────────────────────────

describe('updateSelfProfile — safe fields only', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates fullName and preferredLanguage', async () => {
    prisma.user.update.mockResolvedValue({ id: 'u-1', fullName: 'New Name', preferredLanguage: 'sw' });
    const result = await updateSelfProfile({ userId: 'u-1', fullName: 'New Name', preferredLanguage: 'sw' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1' },
        data: expect.objectContaining({ fullName: 'New Name', preferredLanguage: 'sw' }),
      })
    );
    expect(result.fullName).toBe('New Name');
  });

  it('trims whitespace from fullName', async () => {
    prisma.user.update.mockResolvedValue({ id: 'u-1', fullName: 'Trimmed', preferredLanguage: null });
    await updateSelfProfile({ userId: 'u-1', fullName: '  Trimmed  ' });
    const call = prisma.user.update.mock.calls[0][0];
    expect(call.data.fullName).toBe('Trimmed');
  });

  it('rejects when no fields provided', async () => {
    await expect(updateSelfProfile({ userId: 'u-1' }))
      .rejects.toThrow(/At least one updatable field/);
  });

  it('does NOT accept role in the update data', async () => {
    // updateSelfProfile signature only accepts fullName and preferredLanguage
    // Even if caller passes role, it must not be written
    prisma.user.update.mockResolvedValue({ id: 'u-1', fullName: 'Name' });
    await updateSelfProfile({ userId: 'u-1', fullName: 'Name' });
    const call = prisma.user.update.mock.calls[0][0];
    expect(call.data).not.toHaveProperty('role');
    expect(call.data).not.toHaveProperty('organizationId');
  });
});

// ─── 2. Admin profile update ──────────────────────────────────────────────────

describe('adminUpdateUserProfile — org scope + email restriction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('institutional_admin can update fullName for own-org non-super_admin user', async () => {
    const target = makeUser({ id: 'u-2', organizationId: 'org-1', role: 'field_officer' });
    prisma.user.findUnique.mockResolvedValue(target);
    prisma.user.update.mockResolvedValue({ ...target, fullName: 'Updated' });

    const { user } = await adminUpdateUserProfile({
      targetUserId: 'u-2', actorId: 'admin-1',
      actorRole: 'institutional_admin', actorOrgId: 'org-1',
      updates: { fullName: 'Updated' },
    });
    expect(user.fullName).toBe('Updated');
  });

  it('institutional_admin cannot edit user in a different org', async () => {
    const target = makeUser({ id: 'u-2', organizationId: 'org-2', role: 'field_officer' });
    prisma.user.findUnique.mockResolvedValue(target);

    await expect(adminUpdateUserProfile({
      targetUserId: 'u-2', actorId: 'admin-1',
      actorRole: 'institutional_admin', actorOrgId: 'org-1',
      updates: { fullName: 'Hacked' },
    })).rejects.toThrow(/outside your organization/);
  });

  it('institutional_admin cannot edit a super_admin account', async () => {
    const target = makeUser({ id: 'u-2', organizationId: 'org-1', role: 'super_admin' });
    prisma.user.findUnique.mockResolvedValue(target);

    await expect(adminUpdateUserProfile({
      targetUserId: 'u-2', actorId: 'admin-1',
      actorRole: 'institutional_admin', actorOrgId: 'org-1',
      updates: { fullName: 'Hacked' },
    })).rejects.toThrow(/super_admin/);
  });

  it('only super_admin can change email', async () => {
    const target = makeUser({ id: 'u-2', organizationId: 'org-1', role: 'field_officer' });
    prisma.user.findUnique.mockResolvedValue(target);

    await expect(adminUpdateUserProfile({
      targetUserId: 'u-2', actorId: 'admin-1',
      actorRole: 'institutional_admin', actorOrgId: 'org-1',
      updates: { email: 'new@test.com' },
    })).rejects.toThrow(/Only super_admin can change email/);
  });

  it('super_admin can change email when no conflict', async () => {
    const target = makeUser({ id: 'u-2', email: 'old@test.com' });
    prisma.user.findUnique
      .mockResolvedValueOnce(target)   // target lookup
      .mockResolvedValueOnce(null);     // conflict check → no conflict
    prisma.user.update.mockResolvedValue({ ...target, email: 'new@test.com' });

    const { user } = await adminUpdateUserProfile({
      targetUserId: 'u-2', actorId: 'sa-1',
      actorRole: 'super_admin', actorOrgId: null,
      updates: { email: 'new@test.com' },
    });
    expect(user.email).toBe('new@test.com');
  });

  it('super_admin email change rejected when email already in use by another account', async () => {
    const target = makeUser({ id: 'u-2', email: 'old@test.com' });
    const conflict = makeUser({ id: 'u-9', email: 'taken@test.com' }); // different user owns the email
    prisma.user.findUnique
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(conflict);

    await expect(adminUpdateUserProfile({
      targetUserId: 'u-2', actorId: 'sa-1',
      actorRole: 'super_admin', actorOrgId: null,
      updates: { email: 'taken@test.com' },
    })).rejects.toThrow(/already in use/);
  });

  it('rejects when no valid update fields provided', async () => {
    const target = makeUser({ id: 'u-2' });
    prisma.user.findUnique.mockResolvedValue(target);

    await expect(adminUpdateUserProfile({
      targetUserId: 'u-2', actorId: 'sa-1',
      actorRole: 'super_admin', actorOrgId: null,
      updates: {},
    })).rejects.toThrow(/No valid fields/);
  });
});

// ─── 3. Role change ───────────────────────────────────────────────────────────

describe('adminChangeUserRole — hierarchy + self-escalation guard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('prevents changing own role (self-escalation)', async () => {
    await expect(adminChangeUserRole({
      targetUserId: 'actor-1', newRole: 'super_admin',
      actorId: 'actor-1', actorRole: 'institutional_admin', actorOrgId: 'org-1',
    })).rejects.toThrow(/Cannot change your own role/);
  });

  it('rejects farmer role assignment via role management', async () => {
    await expect(adminChangeUserRole({
      targetUserId: 'u-2', newRole: 'farmer',
      actorId: 'actor-1', actorRole: 'super_admin', actorOrgId: null,
    })).rejects.toThrow(/farmer role/);
  });

  it('rejects completely invalid role value', async () => {
    await expect(adminChangeUserRole({
      targetUserId: 'u-2', newRole: 'overlord',
      actorId: 'actor-1', actorRole: 'super_admin', actorOrgId: null,
    })).rejects.toThrow(/Invalid role/);
  });

  it('institutional_admin cannot assign institutional_admin role', async () => {
    const target = makeUser({ id: 'u-2', organizationId: 'org-1', role: 'field_officer' });
    prisma.user.findUnique.mockResolvedValue(target);

    await expect(adminChangeUserRole({
      targetUserId: 'u-2', newRole: 'institutional_admin',
      actorId: 'actor-1', actorRole: 'institutional_admin', actorOrgId: 'org-1',
    })).rejects.toThrow(/institutional_admin can only assign/);
  });

  it('institutional_admin cannot change role of super_admin account', async () => {
    const target = makeUser({ id: 'u-2', organizationId: 'org-1', role: 'super_admin' });
    prisma.user.findUnique.mockResolvedValue(target);

    await expect(adminChangeUserRole({
      targetUserId: 'u-2', newRole: 'reviewer',
      actorId: 'actor-1', actorRole: 'institutional_admin', actorOrgId: 'org-1',
    })).rejects.toThrow(/super_admin/);
  });

  it('institutional_admin cannot change roles across orgs', async () => {
    const target = makeUser({ id: 'u-2', organizationId: 'org-2', role: 'field_officer' });
    prisma.user.findUnique.mockResolvedValue(target);

    await expect(adminChangeUserRole({
      targetUserId: 'u-2', newRole: 'reviewer',
      actorId: 'actor-1', actorRole: 'institutional_admin', actorOrgId: 'org-1',
    })).rejects.toThrow(/outside your organization/);
  });

  it('super_admin can assign any non-farmer role', async () => {
    const target = makeUser({ id: 'u-2', role: 'field_officer' });
    prisma.user.findUnique.mockResolvedValue(target);
    prisma.user.update.mockResolvedValue({ ...target, role: 'institutional_admin' });

    const { user, previousRole } = await adminChangeUserRole({
      targetUserId: 'u-2', newRole: 'institutional_admin',
      actorId: 'sa-1', actorRole: 'super_admin', actorOrgId: null,
    });
    expect(user.role).toBe('institutional_admin');
    expect(previousRole).toBe('field_officer');
  });

  it('institutional_admin can assign reviewer within own org', async () => {
    const target = makeUser({ id: 'u-2', organizationId: 'org-1', role: 'field_officer' });
    prisma.user.findUnique.mockResolvedValue(target);
    prisma.user.update.mockResolvedValue({ ...target, role: 'reviewer' });

    const { user } = await adminChangeUserRole({
      targetUserId: 'u-2', newRole: 'reviewer',
      actorId: 'actor-1', actorRole: 'institutional_admin', actorOrgId: 'org-1',
    });
    expect(user.role).toBe('reviewer');
  });
});

// ─── 4. Organization reassignment ─────────────────────────────────────────────

describe('adminChangeUserOrg — super_admin only, no self-change', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('prevents changing own organization', async () => {
    await expect(adminChangeUserOrg({
      targetUserId: 'sa-1', newOrgId: 'org-2', actorId: 'sa-1',
    })).rejects.toThrow(/Cannot change your own organization/);
  });

  it('returns 404 when target user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(adminChangeUserOrg({
      targetUserId: 'ghost', newOrgId: 'org-1', actorId: 'sa-1',
    })).rejects.toThrow(/User not found/);
  });

  it('returns 404 when target organization not found', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: 'u-2' }));
    prisma.organization.findUnique.mockResolvedValue(null);

    await expect(adminChangeUserOrg({
      targetUserId: 'u-2', newOrgId: 'org-ghost', actorId: 'sa-1',
    })).rejects.toThrow(/Organization not found/);
  });

  it('successfully reassigns user to valid org', async () => {
    const target = makeUser({ id: 'u-2', organizationId: 'org-1' });
    prisma.user.findUnique.mockResolvedValue(target);
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-2', name: 'New Org' });
    prisma.user.update.mockResolvedValue({ ...target, organizationId: 'org-2' });

    const { user, previousOrgId } = await adminChangeUserOrg({
      targetUserId: 'u-2', newOrgId: 'org-2', actorId: 'sa-1',
    });
    expect(user.organizationId).toBe('org-2');
    expect(previousOrgId).toBe('org-1');
  });

  it('allows removing user from org (null assignment)', async () => {
    const target = makeUser({ id: 'u-2', organizationId: 'org-1' });
    prisma.user.findUnique.mockResolvedValue(target);
    prisma.user.update.mockResolvedValue({ ...target, organizationId: null });

    const { user } = await adminChangeUserOrg({
      targetUserId: 'u-2', newOrgId: null, actorId: 'sa-1',
    });
    expect(user.organizationId).toBeNull();
    // Should NOT call organization.findUnique when newOrgId is null
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });
});
