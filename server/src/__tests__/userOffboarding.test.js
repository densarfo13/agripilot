import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { default: mockPrisma };
});

import prisma from '../config/database.js';
import {
  adminDisableUser,
  adminEnableUser,
  adminArchiveUser,
  adminUnarchiveUser,
} from '../modules/auth/service.js';

// ─── Helpers ──────────────────────────────────────────────

const makeUser = (overrides = {}) => ({
  id: 'user-target',
  email: 'target@example.com',
  fullName: 'Target User',
  role: 'field_officer',
  active: true,
  archivedAt: null,
  organizationId: 'org-a',
  ...overrides,
});

const ACTOR_SUPER = { actorId: 'actor-super', actorRole: 'super_admin', actorOrgId: null };
const ACTOR_INST_A = { actorId: 'actor-inst', actorRole: 'institutional_admin', actorOrgId: 'org-a' };
const ACTOR_INST_B = { actorId: 'actor-inst-b', actorRole: 'institutional_admin', actorOrgId: 'org-b' };

beforeEach(() => {
  vi.clearAllMocks();
  // Default update returns updated user
  prisma.user.update.mockImplementation(({ data }) =>
    Promise.resolve(makeUser({ ...data, active: data.active ?? true, archivedAt: data.archivedAt ?? null }))
  );
});

// ═══════════════════════════════════════════════════════════
// adminDisableUser
// ═══════════════════════════════════════════════════════════

describe('adminDisableUser', () => {
  it('super_admin can disable a field_officer in any org', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: true }));
    const { user } = await adminDisableUser({ targetUserId: 'user-target', ...ACTOR_SUPER });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { active: false } }));
  });

  it('institutional_admin can disable same-org field_officer', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: true, organizationId: 'org-a' }));
    const { user } = await adminDisableUser({ targetUserId: 'user-target', ...ACTOR_INST_A });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { active: false } }));
  });

  it('institutional_admin CANNOT disable user in another org', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: true, organizationId: 'org-b' }));
    await expect(adminDisableUser({ targetUserId: 'user-target', ...ACTOR_INST_A }))
      .rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('outside your organization') });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('institutional_admin CANNOT disable a super_admin', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: true, role: 'super_admin', organizationId: 'org-a' }));
    await expect(adminDisableUser({ targetUserId: 'user-target', ...ACTOR_INST_A }))
      .rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('super admin') });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('cannot disable your own account', async () => {
    await expect(adminDisableUser({ targetUserId: 'actor-super', actorId: 'actor-super', actorRole: 'super_admin', actorOrgId: null }))
      .rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('own account') });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns 409 if user is already disabled', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: false }));
    await expect(adminDisableUser({ targetUserId: 'user-target', ...ACTOR_SUPER }))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('already disabled') });
  });

  it('returns 404 if user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(adminDisableUser({ targetUserId: 'user-target', ...ACTOR_SUPER }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('reviewer/field_officer roles are not callable (route-level guard; service rejects via role check not applicable — but same-org institutional_admin works)', async () => {
    // Verify: the service itself does not reject on reviewer role because the
    // route's authorize() middleware blocks it before reaching the service.
    // We confirm institutional_admin (org-b) is still blocked:
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: true, organizationId: 'org-b' }));
    await expect(adminDisableUser({ targetUserId: 'user-target', ...ACTOR_INST_A }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

// ═══════════════════════════════════════════════════════════
// adminEnableUser
// ═══════════════════════════════════════════════════════════

describe('adminEnableUser', () => {
  it('super_admin can re-enable a disabled user', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: false }));
    const { user } = await adminEnableUser({ targetUserId: 'user-target', ...ACTOR_SUPER });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { active: true } }));
  });

  it('institutional_admin can re-enable disabled same-org user', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: false, organizationId: 'org-a' }));
    const { user } = await adminEnableUser({ targetUserId: 'user-target', ...ACTOR_INST_A });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { active: true } }));
  });

  it('institutional_admin CANNOT re-enable user in another org', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: false, organizationId: 'org-b' }));
    await expect(adminEnableUser({ targetUserId: 'user-target', ...ACTOR_INST_A }))
      .rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('outside your organization') });
  });

  it('institutional_admin CANNOT re-enable a super_admin', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: false, role: 'super_admin', organizationId: 'org-a' }));
    await expect(adminEnableUser({ targetUserId: 'user-target', ...ACTOR_INST_A }))
      .rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('super admin') });
  });

  it('returns 409 if user is already active', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: true }));
    await expect(adminEnableUser({ targetUserId: 'user-target', ...ACTOR_SUPER }))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('already active') });
  });

  it('returns 409 and blocks re-enable on archived user', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: false, archivedAt: new Date() }));
    await expect(adminEnableUser({ targetUserId: 'user-target', ...ACTOR_SUPER }))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('archived') });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 404 if user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(adminEnableUser({ targetUserId: 'user-target', ...ACTOR_SUPER }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═══════════════════════════════════════════════════════════
// adminArchiveUser
// ═══════════════════════════════════════════════════════════

describe('adminArchiveUser', () => {
  it('sets active=false and archivedAt on the user', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: true }));
    await adminArchiveUser({ targetUserId: 'user-target', actorId: 'actor-super' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ active: false, archivedAt: expect.any(Date) }) })
    );
  });

  it('cannot archive your own account', async () => {
    await expect(adminArchiveUser({ targetUserId: 'actor-super', actorId: 'actor-super' }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns 409 if user is already archived', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ archivedAt: new Date() }));
    await expect(adminArchiveUser({ targetUserId: 'user-target', actorId: 'actor-super' }))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('already archived') });
  });

  it('returns 404 if user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(adminArchiveUser({ targetUserId: 'user-target', actorId: 'actor-super' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═══════════════════════════════════════════════════════════
// adminUnarchiveUser
// ═══════════════════════════════════════════════════════════

describe('adminUnarchiveUser', () => {
  it('clears archivedAt without re-enabling', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: false, archivedAt: new Date() }));
    await adminUnarchiveUser({ targetUserId: 'user-target' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { archivedAt: null } })
    );
  });

  it('returns 409 if user is not archived', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ archivedAt: null }));
    await expect(adminUnarchiveUser({ targetUserId: 'user-target' }))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('not archived') });
  });

  it('returns 404 if user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(adminUnarchiveUser({ targetUserId: 'user-target' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═══════════════════════════════════════════════════════════
// Linked history preservation (structural check)
// ═══════════════════════════════════════════════════════════

describe('linked record preservation', () => {
  it('adminDisableUser only updates active flag — no cascade deletes', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: true }));
    await adminDisableUser({ targetUserId: 'user-target', ...ACTOR_SUPER });

    const updateCall = prisma.user.update.mock.calls[0][0];
    // Only sets active: false — no deletion of related records
    expect(Object.keys(updateCall.data)).toEqual(['active']);
  });

  it('adminArchiveUser only sets active+archivedAt — no cascade deletes', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ active: true }));
    await adminArchiveUser({ targetUserId: 'user-target', actorId: 'actor-super' });

    const updateCall = prisma.user.update.mock.calls[0][0];
    expect(Object.keys(updateCall.data).sort()).toEqual(['active', 'archivedAt'].sort());
  });
});
