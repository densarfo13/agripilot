import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Last-Mile Hardening Test Suite
 *
 * Focused automated tests for the highest-risk flows:
 * A. Auth / IAM
 * B. Core workflow (application creation, transitions, audit)
 * C. Season / progress / harvest
 * D. Invite / self-registration
 * E. Evidence service
 * F. Location / boundary
 * G. Planting date validation
 */

// ─── Shared mocks ──────────────────────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    farmer: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    application: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    reviewNote: { create: vi.fn() },
    reviewAssignment: { create: vi.fn() },
    evidenceFile: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    farmLocation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    farmBoundary: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    boundaryPoint: { deleteMany: vi.fn() },
    farmSeason: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    seasonProgressEntry: { findMany: vi.fn(), create: vi.fn() },
    stageConfirmation: { findMany: vi.fn(), create: vi.fn() },
    harvestReport: { findUnique: vi.fn(), create: vi.fn() },
    credibilityAssessment: { findUnique: vi.fn(), upsert: vi.fn() },
    progressScore: { findUnique: vi.fn() },
    officerValidation: { findMany: vi.fn() },
    farmProfile: { findFirst: vi.fn() },
    notification: { create: vi.fn() },
    $transaction: vi.fn(async (arg) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      return arg; // batched transaction
    }),
    $queryRaw: vi.fn(),
  };
  return { default: mockPrisma };
});

vi.mock('../modules/regionConfig/service.js', () => ({
  DEFAULT_COUNTRY_CODE: 'KE',
  getRegionConfig: () => ({
    areaUnit: 'acres', currencyCode: 'KES', country: 'Kenya',
    cropCalendars: { maize: { growingDays: 120 } },
  }),
  getCropCalendar: () => ({ growingDays: 120 }),
}));

vi.mock('../modules/lifecycle/service.js', () => ({
  STAGE_ORDER: ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'],
}));

vi.mock('../modules/reminders/service.js', () => ({
  generateCropLifecycleReminders: vi.fn().mockResolvedValue([]),
}));

vi.mock('../utils/opsLogger.js', () => ({
  logWorkflowEvent: vi.fn(),
  logAuthEvent: vi.fn(),
  logPermissionEvent: vi.fn(),
  logUploadEvent: vi.fn(),
  opsEvent: vi.fn(),
}));

import prisma from '../config/database.js';

// ═══════════════════════════════════════════════════════════
//  A. AUTH / IAM TESTS
// ═══════════════════════════════════════════════════════════

describe('Auth / IAM — role enforcement', () => {
  let authorize;

  beforeEach(async () => {
    const mod = await import('../middleware/auth.js');
    authorize = mod.authorize;
  });

  function mockReq(role) {
    return { user: { sub: 'u-1', role } };
  }

  function mockRes() {
    const res = { statusCode: 200, _json: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res._json = b; return res; };
    return res;
  }

  it('farmer cannot access admin-only endpoint', () => {
    const guard = authorize('super_admin', 'institutional_admin');
    const res = mockRes();
    let passed = false;
    guard(mockReq('farmer'), res, () => { passed = true; });
    expect(passed).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('farmer cannot access field_officer endpoint', () => {
    const guard = authorize('super_admin', 'institutional_admin', 'field_officer');
    const res = mockRes();
    let passed = false;
    guard(mockReq('farmer'), res, () => { passed = true; });
    expect(passed).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('investor_viewer cannot access staff-write endpoints', () => {
    const guard = authorize('super_admin', 'institutional_admin', 'field_officer');
    const res = mockRes();
    let passed = false;
    guard(mockReq('investor_viewer'), res, () => { passed = true; });
    expect(passed).toBe(false);
  });

  it('investor_viewer can access read-only endpoint when authorized', () => {
    const guard = authorize('super_admin', 'institutional_admin', 'investor_viewer');
    const res = mockRes();
    let passed = false;
    guard(mockReq('investor_viewer'), res, () => { passed = true; });
    expect(passed).toBe(true);
  });

  it('field_officer passes when in allowed roles', () => {
    const guard = authorize('super_admin', 'institutional_admin', 'field_officer');
    const res = mockRes();
    let passed = false;
    guard(mockReq('field_officer'), res, () => { passed = true; });
    expect(passed).toBe(true);
  });

  it('super_admin passes all role checks', () => {
    const guard = authorize('super_admin');
    const res = mockRes();
    let passed = false;
    guard(mockReq('super_admin'), res, () => { passed = true; });
    expect(passed).toBe(true);
  });

  it('rejects unauthenticated request (no user)', () => {
    const guard = authorize('super_admin');
    const res = mockRes();
    let passed = false;
    guard({ user: null }, res, () => { passed = true; });
    expect(passed).toBe(false);
    expect(res.statusCode).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════
//  B. CORE WORKFLOW — Application creation and transitions
// ═══════════════════════════════════════════════════════════

describe('Core Workflow — Application', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('createApplication creates draft application', async () => {
    const { createApplication } = await import('../modules/applications/service.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', countryCode: 'KE' });
    const mockApp = { id: 'a-1', status: 'draft', farmerId: 'f-1', cropType: 'maize' };
    prisma.application.create.mockResolvedValue(mockApp);

    const result = await createApplication({
      farmerId: 'f-1', cropType: 'maize', farmSizeAcres: 2, requestedAmount: 5000,
    }, 'u-1');

    expect(result.status).toBe('draft');
    expect(prisma.application.create).toHaveBeenCalledTimes(1);
  });

  it('createApplication rejects unknown farmer', async () => {
    const { createApplication } = await import('../modules/applications/service.js');

    prisma.farmer.findUnique.mockResolvedValue(null);

    await expect(createApplication({ farmerId: 'f-999', cropType: 'maize', farmSizeAcres: 2, requestedAmount: 5000 }, 'u-1'))
      .rejects.toThrow(/Farmer not found/);
  });

  it('submitApplication transitions draft to submitted', async () => {
    const { submitApplication } = await import('../modules/applications/service.js');

    // First call: getApplicationStatus returns draft
    // Second call: atomicTransition's findUnique returns submitted
    prisma.application.findUnique
      .mockResolvedValueOnce({ id: 'a-1', status: 'draft' })
      .mockResolvedValueOnce({ id: 'a-1', status: 'submitted' });
    prisma.application.updateMany.mockResolvedValue({ count: 1 });

    const result = await submitApplication('a-1');
    // submitApplication returns the app directly (not wrapped in { application })
    expect(result.status).toBe('submitted');
  });

  it('rejects invalid transition (submitted directly to disbursed)', async () => {
    const { disburseApplication } = await import('../modules/applications/service.js');

    prisma.application.findUnique.mockResolvedValue({ id: 'a-1', status: 'submitted' });

    await expect(disburseApplication('a-1', 'u-1'))
      .rejects.toThrow(/Cannot transition/);
  });
});

// ═══════════════════════════════════════════════════════════
//  C. EVIDENCE SERVICE
// ═══════════════════════════════════════════════════════════

describe('Evidence Service', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uploadEvidence creates evidence record with url', async () => {
    const { uploadEvidence } = await import('../modules/evidence/service.js');

    prisma.application.findUnique.mockResolvedValue({ id: 'a-1', status: 'submitted' });
    prisma.evidenceFile.findMany.mockResolvedValue([]); // no duplicates
    const mockEvidence = { id: 'ev-1', url: '/uploads/test.jpg', type: 'farm_photo' };
    prisma.evidenceFile.create.mockResolvedValue(mockEvidence);

    const file = {
      filename: 'uuid-test.jpg',
      originalname: 'my-photo.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      path: null, // skip hash computation
    };

    const result = await uploadEvidence('a-1', file, 'farm_photo');
    expect(result.id).toBe('ev-1');
    expect(prisma.evidenceFile.create).toHaveBeenCalledTimes(1);
  });

  it('uploadEvidence rejects missing application', async () => {
    const { uploadEvidence } = await import('../modules/evidence/service.js');

    prisma.application.findUnique.mockResolvedValue(null);

    await expect(uploadEvidence('nonexistent', { filename: 'f.jpg', originalname: 'f.jpg', mimetype: 'image/jpeg', size: 100 }, 'other'))
      .rejects.toThrow(/Application not found/);
  });

  it('deleteEvidence removes record and returns deleted', async () => {
    const { deleteEvidence } = await import('../modules/evidence/service.js');

    prisma.evidenceFile.findUnique.mockResolvedValue({ id: 'ev-1', url: '/uploads/fake.jpg', filename: 'fake.jpg' });
    prisma.evidenceFile.delete.mockResolvedValue({ id: 'ev-1' });

    const result = await deleteEvidence('ev-1');
    expect(result.id).toBe('ev-1');
  });

  it('deleteEvidence rejects missing evidence', async () => {
    const { deleteEvidence } = await import('../modules/evidence/service.js');

    prisma.evidenceFile.findUnique.mockResolvedValue(null);

    await expect(deleteEvidence('nonexistent'))
      .rejects.toThrow(/Evidence file not found/);
  });

  it('listEvidence returns files for application', async () => {
    const { listEvidence } = await import('../modules/evidence/service.js');

    const mockFiles = [{ id: 'ev-1' }, { id: 'ev-2' }];
    prisma.evidenceFile.findMany.mockResolvedValue(mockFiles);

    const result = await listEvidence('a-1');
    expect(result).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════
//  D. LOCATION / BOUNDARY
// ═══════════════════════════════════════════════════════════

describe('Location Service', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('captureGPS creates new location record', async () => {
    const { captureGPS } = await import('../modules/location/service.js');

    prisma.farmLocation.findUnique.mockResolvedValue(null); // no existing
    const mockLoc = { id: 'loc-1', latitude: -1.28, longitude: 36.81 };
    prisma.farmLocation.create.mockResolvedValue(mockLoc);

    const result = await captureGPS('a-1', { latitude: -1.28, longitude: 36.81 });
    expect(result.latitude).toBe(-1.28);
    expect(prisma.farmLocation.create).toHaveBeenCalledTimes(1);
  });

  it('captureGPS updates existing location', async () => {
    const { captureGPS } = await import('../modules/location/service.js');

    prisma.farmLocation.findUnique.mockResolvedValue({ id: 'loc-1', applicationId: 'a-1' });
    const mockUpdated = { id: 'loc-1', latitude: -1.30, longitude: 36.85 };
    prisma.farmLocation.update.mockResolvedValue(mockUpdated);

    const result = await captureGPS('a-1', { latitude: -1.30, longitude: 36.85 });
    expect(result.latitude).toBe(-1.30);
    expect(prisma.farmLocation.update).toHaveBeenCalledTimes(1);
    expect(prisma.farmLocation.create).not.toHaveBeenCalled();
  });

  it('captureBoundary requires at least 3 points', async () => {
    const { captureBoundary } = await import('../modules/location/service.js');

    await expect(captureBoundary('a-1', { points: [{ latitude: 1, longitude: 1 }] }))
      .rejects.toThrow(/At least 3 boundary points/);
  });

  it('captureBoundary validates coordinate ranges', async () => {
    const { captureBoundary } = await import('../modules/location/service.js');

    const badPoints = [
      { latitude: 91, longitude: 0 },
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0 },
    ];

    await expect(captureBoundary('a-1', { points: badPoints }))
      .rejects.toThrow(/latitude must be between/);
  });

  it('captureBoundary creates boundary with valid points', async () => {
    const { captureBoundary } = await import('../modules/location/service.js');

    prisma.farmBoundary.findUnique.mockResolvedValue(null);
    const mockBoundary = { id: 'b-1', points: [{ latitude: -1.28, longitude: 36.81 }] };
    prisma.farmBoundary.create.mockResolvedValue(mockBoundary);

    const points = [
      { latitude: -1.28, longitude: 36.81 },
      { latitude: -1.29, longitude: 36.82 },
      { latitude: -1.30, longitude: 36.80 },
    ];

    const result = await captureBoundary('a-1', { points });
    expect(prisma.farmBoundary.create).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════
//  E. SELF-REGISTRATION AND INVITE
// ═══════════════════════════════════════════════════════════

describe('Farmer Self-Registration', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates user + farmer in pending_approval state', async () => {
    const { farmerSelfRegister } = await import('../modules/auth/farmer-registration.js');

    prisma.user.findUnique.mockResolvedValue(null); // no existing email
    prisma.farmer.findFirst.mockResolvedValue(null); // no existing phone
    prisma.user.create.mockResolvedValue({ id: 'u-new', email: 'test@farm.com', fullName: 'Test Farmer', role: 'farmer' });
    prisma.farmer.create.mockResolvedValue({ id: 'f-new', fullName: 'Test Farmer', registrationStatus: 'pending_approval' });

    const result = await farmerSelfRegister({
      fullName: 'Test Farmer', phone: '+254700000000', email: 'test@farm.com', password: 'SecurePass123!',
    });

    expect(result.farmer.registrationStatus).toBe('pending_approval');
    expect(result.message).toMatch(/pending approval/);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.farmer.create).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate email', async () => {
    const { farmerSelfRegister } = await import('../modules/auth/farmer-registration.js');

    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(farmerSelfRegister({
      fullName: 'Test', phone: '+254700000001', email: 'dupe@farm.com', password: 'Pass123!',
    })).rejects.toThrow(/Email already registered/);
  });

  it('rejects duplicate phone', async () => {
    const { farmerSelfRegister } = await import('../modules/auth/farmer-registration.js');

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.farmer.findFirst.mockResolvedValue({ id: 'existing-farmer' });

    await expect(farmerSelfRegister({
      fullName: 'Test', phone: '+254700000002', email: 'new@farm.com', password: 'Pass123!',
    })).rejects.toThrow(/Phone number already registered/);
  });
});

describe('Farmer Invite', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates farmer with approved status when invited', async () => {
    const { inviteFarmer } = await import('../modules/auth/farmer-registration.js');

    prisma.farmer.findFirst.mockResolvedValue(null); // no duplicate phone
    prisma.farmer.create.mockResolvedValue({
      id: 'f-inv', fullName: 'Invited Farmer', registrationStatus: 'approved', invitedAt: new Date(),
    });

    const result = await inviteFarmer({
      fullName: 'Invited Farmer', phone: '+254700000003', region: 'Central',
      invitedById: 'admin-1',
    });

    expect(result.registrationStatus).toBe('approved');
    expect(prisma.farmer.create).toHaveBeenCalledTimes(1);
  });

  it('creates linked user account when email+password provided', async () => {
    const { inviteFarmer } = await import('../modules/auth/farmer-registration.js');

    prisma.farmer.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null); // no existing email
    prisma.user.create.mockResolvedValue({ id: 'u-inv', email: 'invite@farm.com', role: 'farmer' });
    prisma.farmer.create.mockResolvedValue({
      id: 'f-inv2', registrationStatus: 'approved', userId: 'u-inv',
    });

    const result = await inviteFarmer({
      fullName: 'Invited', phone: '+254700000004', region: 'Central',
      email: 'invite@farm.com', password: 'Pass123!', invitedById: 'admin-1',
    });

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.farmer.create).toHaveBeenCalledTimes(1);
  });

  it('rejects invite with missing required fields', async () => {
    const { inviteFarmer } = await import('../modules/auth/farmer-registration.js');

    await expect(inviteFarmer({ fullName: 'Test', invitedById: 'admin-1' }))
      .rejects.toThrow(/fullName, phone, and region are required/);
  });

  it('rejects invite with duplicate phone', async () => {
    const { inviteFarmer } = await import('../modules/auth/farmer-registration.js');

    prisma.farmer.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(inviteFarmer({
      fullName: 'Test', phone: '+254700000005', region: 'Central', invitedById: 'admin-1',
    })).rejects.toThrow(/Phone number already registered/);
  });
});

describe('Registration Approval / Rejection', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('approveRegistration sets approved status', async () => {
    const { approveRegistration } = await import('../modules/auth/farmer-registration.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', registrationStatus: 'pending_approval' });
    prisma.farmer.update.mockResolvedValue({ id: 'f-1', registrationStatus: 'approved' });

    const result = await approveRegistration({ farmerId: 'f-1', approvedById: 'admin-1' });
    expect(result.registrationStatus).toBe('approved');
  });

  it('rejects approval of non-pending farmer', async () => {
    const { approveRegistration } = await import('../modules/auth/farmer-registration.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', registrationStatus: 'approved' });

    await expect(approveRegistration({ farmerId: 'f-1', approvedById: 'admin-1' }))
      .rejects.toThrow(/Cannot approve/);
  });

  it('rejectRegistration sets rejected status', async () => {
    const { rejectRegistration } = await import('../modules/auth/farmer-registration.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', registrationStatus: 'pending_approval', userId: 'u-1' });
    prisma.farmer.update.mockResolvedValue({ id: 'f-1', registrationStatus: 'rejected' });
    prisma.user.update.mockResolvedValue({ id: 'u-1', active: false });

    const result = await rejectRegistration({ farmerId: 'f-1', rejectedById: 'admin-1', rejectionReason: 'Incomplete docs' });
    expect(result.registrationStatus).toBe('rejected');
    // User account should be deactivated
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } })
    );
  });
});

// ═══════════════════════════════════════════════════════════
//  F. SEASON — Planting date validation
// ═══════════════════════════════════════════════════════════

describe('Season — Planting date bounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Lifecycle guard requires a complete farm profile
    prisma.farmProfile.findFirst.mockResolvedValue({
      id: 'fp-1', farmerId: 'f-1', crop: 'MAIZE',
      landSizeValue: 2, landSizeUnit: 'ACRE', landSizeHectares: 0.81,
      farmSizeAcres: 2, countryCode: 'KE',
    });
  });

  it('rejects planting date more than 1 year in the future', async () => {
    const { createSeason } = await import('../modules/seasons/service.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', countryCode: 'KE' });
    prisma.farmSeason.findFirst.mockResolvedValue(null);

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);

    await expect(createSeason('f-1', {
      cropType: 'maize', plantingDate: futureDate.toISOString(), farmSizeAcres: 2,
    })).rejects.toThrow(/planting date/i);
  });

  it('rejects planting date more than 2 years in the past', async () => {
    const { createSeason } = await import('../modules/seasons/service.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', countryCode: 'KE' });
    prisma.farmSeason.findFirst.mockResolvedValue(null);

    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 3);

    await expect(createSeason('f-1', {
      cropType: 'maize', plantingDate: pastDate.toISOString(), farmSizeAcres: 2,
    })).rejects.toThrow(/planting date/i);
  });

  it('accepts planting date within valid range', async () => {
    const { createSeason } = await import('../modules/seasons/service.js');

    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', countryCode: 'KE' });
    prisma.farmSeason.findFirst.mockResolvedValue(null);
    const mockSeason = { id: 's-1', status: 'active', cropType: 'maize' };
    prisma.farmSeason.create.mockResolvedValue(mockSeason);

    const validDate = new Date();
    validDate.setMonth(validDate.getMonth() - 2); // 2 months ago

    const result = await createSeason('f-1', {
      cropType: 'maize', plantingDate: validDate.toISOString(), farmSizeAcres: 2,
    });
    expect(result.status).toBe('active');
  });
});

// ═══════════════════════════════════════════════════════════
//  G. SEASON — Invalid transitions blocked
// ═══════════════════════════════════════════════════════════

describe('Season — blocked operations on non-active seasons', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects progress entry on completed season', async () => {
    const { createProgressEntry } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'completed' });

    await expect(createProgressEntry('s-1', { entryType: 'activity' }))
      .rejects.toThrow(/active seasons/);
  });

  it('rejects progress entry on abandoned season', async () => {
    const { createProgressEntry } = await import('../modules/seasons/service.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'abandoned' });

    await expect(createProgressEntry('s-1', { entryType: 'activity' }))
      .rejects.toThrow(/active seasons/);
  });

  it('rejects harvest report on non-active season', async () => {
    const { createHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({ id: 's-1', status: 'harvested', harvestReport: null });

    await expect(createHarvestReport('s-1', { totalHarvestKg: 100 }))
      .rejects.toThrow(/active seasons/);
  });

  it('rejects duplicate harvest report', async () => {
    const { createHarvestReport } = await import('../modules/seasons/harvest.js');

    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', farmSizeAcres: 2,
      harvestReport: { id: 'hr-1' }, // already has report
    });

    await expect(createHarvestReport('s-1', { totalHarvestKg: 100 }))
      .rejects.toThrow(/already exists/);
  });
});

// ═══════════════════════════════════════════════════════════
//  H. TRANSACTION INTEGRITY — disburse and reopen
// ═══════════════════════════════════════════════════════════

describe('Transaction Integrity — disburse and reopen', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('disburseApplication wraps status + note in transaction', async () => {
    const { disburseApplication } = await import('../modules/applications/service.js');

    // getApplicationStatus
    prisma.application.findUnique.mockResolvedValueOnce({ id: 'a-1', status: 'approved' });

    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        application: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({ id: 'a-1', status: 'disbursed' }),
        },
        reviewNote: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const { application } = await disburseApplication('a-1', 'u-1', { reason: 'Funds ready' });
    expect(application.status).toBe('disbursed');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('reopenApplication wraps status + note in transaction', async () => {
    const { reopenApplication } = await import('../modules/applications/service.js');

    prisma.application.findUnique.mockResolvedValueOnce({ id: 'a-1', status: 'rejected' });

    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        application: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({ id: 'a-1', status: 'under_review' }),
        },
        reviewNote: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const { application } = await reopenApplication('a-1', 'u-1', 'Correction needed');
    expect(application.status).toBe('under_review');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
