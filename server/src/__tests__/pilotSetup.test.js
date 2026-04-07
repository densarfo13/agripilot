import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      create: vi.fn(),
    },
  };
  return { default: mockPrisma };
});

vi.mock('../modules/audit/service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue({}),
}));

// bcrypt is slow — mock it so tests run fast
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$hashed$'),
    compare: vi.fn(),
  },
}));

import prisma from '../config/database.js';
import { setupPilotOrganization } from '../modules/pilotMetrics/pilotSetup.js';

// ─── Helpers ──────────────────────────────────────────────

function mockSuccessfulSetup() {
  prisma.user.findMany.mockResolvedValue([]); // no existing emails
  prisma.organization.create.mockResolvedValue({
    id: 'org-1',
    name: 'Test NGO',
    type: 'NGO',
    countryCode: 'KE',
    createdAt: new Date(),
  });

  let callCount = 0;
  prisma.user.create.mockImplementation(({ data }) => {
    callCount++;
    return Promise.resolve({
      id: `user-${callCount}`,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      organizationId: data.organizationId,
    });
  });
}

const minimalInput = {
  organizationName: 'Test NGO',
  admin: { email: 'admin@test.com', password: 'Admin1234!', fullName: 'Admin User' },
  createdByUserId: 'super-1',
};

// ─── Tests ────────────────────────────────────────────────

describe('setupPilotOrganization — input validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws 400 when organizationName is missing', async () => {
    const err = await setupPilotOrganization({ ...minimalInput, organizationName: '' }).catch(e => e);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/organizationName/);
  });

  it('throws 400 when organizationName is too short (1 char)', async () => {
    const err = await setupPilotOrganization({ ...minimalInput, organizationName: 'X' }).catch(e => e);
    expect(err.statusCode).toBe(400);
  });

  it('throws 400 when organizationType is invalid', async () => {
    const err = await setupPilotOrganization({ ...minimalInput, organizationType: 'BANK' }).catch(e => e);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/organizationType/);
  });

  it('throws 400 when admin email is missing', async () => {
    const err = await setupPilotOrganization({
      ...minimalInput,
      admin: { password: 'Admin1234!', fullName: 'Admin User' },
    }).catch(e => e);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/admin/);
  });

  it('throws 400 when admin password is missing', async () => {
    const err = await setupPilotOrganization({
      ...minimalInput,
      admin: { email: 'admin@test.com', fullName: 'Admin User' },
    }).catch(e => e);
    expect(err.statusCode).toBe(400);
  });

  it('throws 400 when more than 5 field officers provided', async () => {
    const officers = Array.from({ length: 6 }, (_, i) => ({
      email: `officer${i}@test.com`, password: 'Pass1234!', fullName: `Officer ${i}`,
    }));
    const err = await setupPilotOrganization({ ...minimalInput, fieldOfficers: officers }).catch(e => e);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/5/);
  });

  it('throws 400 when duplicate emails are provided', async () => {
    const err = await setupPilotOrganization({
      ...minimalInput,
      fieldOfficers: [{ email: 'admin@test.com', password: 'Pass1234!', fullName: 'Dup Officer' }],
    }).catch(e => e);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/[Dd]uplicate/);
  });

  it('throws 409 when an email is already registered', async () => {
    prisma.user.findMany.mockResolvedValue([{ email: 'admin@test.com' }]);
    const err = await setupPilotOrganization(minimalInput).catch(e => e);
    expect(err.statusCode).toBe(409);
    expect(err.message).toMatch(/already registered/);
  });
});

describe('setupPilotOrganization — successful setup', () => {
  beforeEach(() => { vi.clearAllMocks(); mockSuccessfulSetup(); });

  it('returns organization with correct fields (minimal setup)', async () => {
    const result = await setupPilotOrganization(minimalInput);
    expect(result.organization.name).toBe('Test NGO');
    expect(result.organization.type).toBe('NGO');
    expect(result.organization.id).toBe('org-1');
  });

  it('creates exactly 1 user (institutional_admin) with minimal input', async () => {
    const result = await setupPilotOrganization(minimalInput);
    expect(result.users).toHaveLength(1);
    expect(result.users[0].role).toBe('institutional_admin');
    expect(result.users[0].email).toBe('admin@test.com');
  });

  it('returns correct summary for minimal setup', async () => {
    const result = await setupPilotOrganization(minimalInput);
    expect(result.summary.totalUsersCreated).toBe(1);
    expect(result.summary.roles).toEqual(['institutional_admin']);
  });

  it('creates field officers when provided', async () => {
    const result = await setupPilotOrganization({
      ...minimalInput,
      fieldOfficers: [
        { email: 'fo1@test.com', password: 'Pass1!', fullName: 'Field Officer 1' },
        { email: 'fo2@test.com', password: 'Pass2!', fullName: 'Field Officer 2' },
      ],
    });
    expect(result.users).toHaveLength(3);
    const roles = result.users.map(u => u.role);
    expect(roles.filter(r => r === 'field_officer')).toHaveLength(2);
  });

  it('creates reviewer when provided', async () => {
    const result = await setupPilotOrganization({
      ...minimalInput,
      reviewer: { email: 'reviewer@test.com', password: 'Rev1234!', fullName: 'Reviewer' },
    });
    expect(result.users.some(u => u.role === 'reviewer')).toBe(true);
    expect(result.summary.totalUsersCreated).toBe(2);
  });

  it('creates investor_viewer when provided', async () => {
    const result = await setupPilotOrganization({
      ...minimalInput,
      investorViewer: { email: 'investor@test.com', password: 'Inv1234!', fullName: 'Investor' },
    });
    expect(result.users.some(u => u.role === 'investor_viewer')).toBe(true);
  });

  it('creates all optional users together (admin + 2 officers + reviewer + investor)', async () => {
    const result = await setupPilotOrganization({
      ...minimalInput,
      fieldOfficers: [
        { email: 'fo1@test.com', password: 'Fo1!', fullName: 'FO 1' },
        { email: 'fo2@test.com', password: 'Fo2!', fullName: 'FO 2' },
      ],
      reviewer: { email: 'reviewer@test.com', password: 'Rev!', fullName: 'Reviewer' },
      investorViewer: { email: 'investor@test.com', password: 'Inv!', fullName: 'Investor' },
    });
    expect(result.users).toHaveLength(5);
    expect(result.summary.totalUsersCreated).toBe(5);
  });

  it('uses NGO as default organizationType', async () => {
    const result = await setupPilotOrganization(minimalInput);
    expect(result.organization.type).toBe('NGO');
  });

  it('accepts all valid organizationType values', async () => {
    const types = ['NGO', 'LENDER', 'COOPERATIVE', 'INVESTOR', 'DEVELOPMENT_PARTNER', 'INTERNAL'];
    for (const type of types) {
      prisma.organization.create.mockResolvedValueOnce({
        id: `org-${type}`, name: 'Test', type, countryCode: 'KE', createdAt: new Date(),
      });
      const result = await setupPilotOrganization({ ...minimalInput, organizationType: type });
      expect(result.organization.type).toBe(type);
    }
  });

  it('includes nextSteps in response', async () => {
    const result = await setupPilotOrganization(minimalInput);
    expect(Array.isArray(result.nextSteps)).toBe(true);
    expect(result.nextSteps.length).toBeGreaterThan(0);
  });

  it('skips field officers with incomplete data (missing email)', async () => {
    const result = await setupPilotOrganization({
      ...minimalInput,
      fieldOfficers: [
        { password: 'Pass!', fullName: 'Incomplete Officer' }, // missing email — should be skipped
        { email: 'fo@test.com', password: 'Pass!', fullName: 'Complete Officer' },
      ],
    });
    // Only the complete officer should be created
    const foUsers = result.users.filter(u => u.role === 'field_officer');
    expect(foUsers).toHaveLength(1);
    expect(foUsers[0].email).toBe('fo@test.com');
  });

  it('omits reviewer when reviewer object is null', async () => {
    const result = await setupPilotOrganization({ ...minimalInput, reviewer: null });
    expect(result.users.every(u => u.role !== 'reviewer')).toBe(true);
  });
});
