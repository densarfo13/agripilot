import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    farmer: { findUnique: vi.fn() },
    farmSeason: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    seasonProgressEntry: { findMany: vi.fn(), create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    stageConfirmation: { findMany: vi.fn() },
    harvestReport: { findUnique: vi.fn() },
    progressScore: { findUnique: vi.fn() },
    credibilityAssessment: { findUnique: vi.fn(), upsert: vi.fn() },
    officerValidation: { findMany: vi.fn() },
    $transaction: vi.fn(async (fn) => fn(mockPrisma)),
  };
  return { default: mockPrisma };
});

vi.mock('../modules/regionConfig/service.js', () => ({
  DEFAULT_COUNTRY_CODE: 'KE',
  getRegionConfig: () => ({
    areaUnit: 'acres', currencyCode: 'KES', country: 'Kenya',
    cropCalendars: { maize: { growingDays: 120, plantMonths: [3, 4], harvestMonths: [7, 8] } },
  }),
  getCropCalendar: () => ({ growingDays: 120 }),
}));

vi.mock('../modules/lifecycle/service.js', () => ({
  STAGE_ORDER: ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'],
}));

vi.mock('../modules/reminders/service.js', () => ({
  generateCropLifecycleReminders: vi.fn().mockResolvedValue([]),
}));

import prisma from '../config/database.js';
import { computeCredibility, getCredibility, getFarmerCredibilitySummary } from '../modules/seasons/credibility.js';
import { addProgressImage, getProgressImages } from '../modules/seasons/imageValidation.js';

// ─── Helper: build a mock season ─────────────────────

function mockSeason(overrides = {}) {
  const now = new Date();
  const plantingDate = new Date(now - 60 * 86400000); // 60 days ago
  return {
    id: 's-1',
    farmerId: 'f-1',
    cropType: 'maize',
    farmSizeAcres: 5,
    plantingDate,
    expectedHarvestDate: new Date(plantingDate.getTime() + 120 * 86400000),
    status: 'active',
    cropFailureReported: false,
    partialHarvest: false,
    lastActivityDate: null,
    farmer: { id: 'f-1', countryCode: 'KE', assignedOfficerId: 'off-1' },
    progressEntries: [],
    stageConfirmations: [],
    harvestReport: null,
    progressScore: null,
    officerValidations: [],
    ...overrides,
  };
}

function mockEntry(overrides = {}) {
  return {
    id: 'e-1',
    entryType: 'activity',
    activityType: 'weeding',
    cropCondition: null,
    followedAdvice: null,
    imageUrl: null,
    imageStage: null,
    imageUploadedAt: null,
    entryDate: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe('Credibility Assessment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('computes credibility for a clean season', async () => {
    const season = mockSeason({
      progressEntries: [
        mockEntry({ entryDate: new Date(Date.now() - 50 * 86400000) }),
        mockEntry({ entryDate: new Date(Date.now() - 40 * 86400000) }),
        mockEntry({ entryDate: new Date(Date.now() - 30 * 86400000) }),
        mockEntry({ entryDate: new Date(Date.now() - 20 * 86400000) }),
        mockEntry({ entryDate: new Date(Date.now() - 10 * 86400000) }),
      ],
    });

    prisma.farmSeason.findUnique.mockResolvedValue(season);
    prisma.credibilityAssessment.upsert.mockImplementation((args) =>
      Promise.resolve({ id: 'ca-1', seasonId: 's-1', ...args.create || args.update })
    );

    const result = await computeCredibility('s-1');
    expect(result.credibilityScore).toBeGreaterThanOrEqual(75);
    expect(result.credibilityLevel).toBe('high_confidence');
    expect(result.flags).toHaveLength(0);
  });

  it('flags entries before planting date', async () => {
    const plantingDate = new Date(Date.now() - 60 * 86400000);
    const season = mockSeason({
      plantingDate,
      progressEntries: [
        mockEntry({ entryDate: new Date(plantingDate.getTime() - 5 * 86400000) }),
        mockEntry({ entryDate: new Date(Date.now() - 10 * 86400000) }),
      ],
    });

    prisma.farmSeason.findUnique.mockResolvedValue(season);
    prisma.credibilityAssessment.upsert.mockImplementation((args) =>
      Promise.resolve({ id: 'ca-1', seasonId: 's-1', ...args.create || args.update })
    );

    const result = await computeCredibility('s-1');
    expect(result.flags).toContain('entries_before_planting');
    expect(result.credibilityScore).toBeLessThan(100);
  });

  it('flags burst submissions', async () => {
    const sameDay = new Date(Date.now() - 30 * 86400000);
    const season = mockSeason({
      progressEntries: Array.from({ length: 6 }, (_, i) =>
        mockEntry({ id: `e-${i}`, entryDate: sameDay })
      ),
    });

    prisma.farmSeason.findUnique.mockResolvedValue(season);
    prisma.credibilityAssessment.upsert.mockImplementation((args) =>
      Promise.resolve({ id: 'ca-1', seasonId: 's-1', ...args.create || args.update })
    );

    const result = await computeCredibility('s-1');
    expect(result.flags).toContain('burst_submissions');
  });

  it('flags update gaps', async () => {
    const plantingDate = new Date(Date.now() - 90 * 86400000);
    const season = mockSeason({
      plantingDate,
      progressEntries: [
        mockEntry({ entryDate: new Date(plantingDate.getTime() + 5 * 86400000) }),
        mockEntry({ entryDate: new Date(Date.now() - 5 * 86400000) }), // 80-day gap
      ],
    });

    prisma.farmSeason.findUnique.mockResolvedValue(season);
    prisma.credibilityAssessment.upsert.mockImplementation((args) =>
      Promise.resolve({ id: 'ca-1', seasonId: 's-1', ...args.create || args.update })
    );

    const result = await computeCredibility('s-1');
    expect(result.flags).toContain('update_gap_detected');
  });

  it('flags no updates on active season', async () => {
    const season = mockSeason({ progressEntries: [] });

    prisma.farmSeason.findUnique.mockResolvedValue(season);
    prisma.credibilityAssessment.upsert.mockImplementation((args) =>
      Promise.resolve({ id: 'ca-1', seasonId: 's-1', ...args.create || args.update })
    );

    const result = await computeCredibility('s-1');
    expect(result.flags).toContain('no_updates_logged');
    expect(result.credibilityScore).toBeLessThanOrEqual(80);
  });

  it('flags stage regression in confirmations', async () => {
    const season = mockSeason({
      stageConfirmations: [
        { confirmedStage: 'vegetative', expectedStage: 'vegetative', isMismatch: false, createdAt: new Date(Date.now() - 30 * 86400000) },
        { confirmedStage: 'planting', expectedStage: 'flowering', isMismatch: true, createdAt: new Date(Date.now() - 10 * 86400000) },
      ],
      progressEntries: [mockEntry()],
    });

    prisma.farmSeason.findUnique.mockResolvedValue(season);
    prisma.credibilityAssessment.upsert.mockImplementation((args) =>
      Promise.resolve({ id: 'ca-1', seasonId: 's-1', ...args.create || args.update })
    );

    const result = await computeCredibility('s-1');
    expect(result.flags).toContain('stage_regression');
  });

  it('awards officer validation bonus', async () => {
    const season = mockSeason({
      progressEntries: [
        mockEntry({ entryDate: new Date(Date.now() - 40 * 86400000) }),
        mockEntry({ entryDate: new Date(Date.now() - 20 * 86400000) }),
      ],
      officerValidations: [
        { validationType: 'stage', validatedAt: new Date() },
        { validationType: 'condition', validatedAt: new Date() },
      ],
    });

    prisma.farmSeason.findUnique.mockResolvedValue(season);
    prisma.credibilityAssessment.upsert.mockImplementation((args) =>
      Promise.resolve({ id: 'ca-1', seasonId: 's-1', ...args.create || args.update })
    );

    const result = await computeCredibility('s-1');
    // Officer bonus should push score higher
    expect(result.credibilityScore).toBeGreaterThanOrEqual(100);
    expect(result.reasons.some(r => r.includes('officer validation'))).toBe(true);
  });

  it('flags harvest too early', async () => {
    const plantingDate = new Date(Date.now() - 30 * 86400000);
    const season = mockSeason({
      plantingDate,
      progressEntries: [mockEntry()],
      harvestReport: {
        totalHarvestKg: 2000, yieldPerAcre: 400,
        createdAt: new Date(), // only 30 days since planting
      },
    });

    prisma.farmSeason.findUnique.mockResolvedValue(season);
    prisma.credibilityAssessment.upsert.mockImplementation((args) =>
      Promise.resolve({ id: 'ca-1', seasonId: 's-1', ...args.create || args.update })
    );

    const result = await computeCredibility('s-1');
    expect(result.flags).toContain('harvest_too_early');
  });

  it('flags implausible yield', async () => {
    const season = mockSeason({
      progressEntries: [mockEntry()],
      harvestReport: {
        totalHarvestKg: 100000, yieldPerAcre: 20000,
        createdAt: new Date(),
      },
    });

    prisma.farmSeason.findUnique.mockResolvedValue(season);
    prisma.credibilityAssessment.upsert.mockImplementation((args) =>
      Promise.resolve({ id: 'ca-1', seasonId: 's-1', ...args.create || args.update })
    );

    const result = await computeCredibility('s-1');
    expect(result.flags).toContain('implausible_yield');
  });

  it('returns existing credibility on getCredibility', async () => {
    const existing = { id: 'ca-1', seasonId: 's-1', credibilityScore: 85, credibilityLevel: 'high_confidence' };
    prisma.credibilityAssessment.findUnique.mockResolvedValue(existing);

    const result = await getCredibility('s-1');
    expect(result.credibilityScore).toBe(85);
  });

  it('throws 404 for missing season', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(null);
    await expect(computeCredibility('bad')).rejects.toThrow(/Season not found/);
  });
});

describe('Farmer Credibility Summary', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns multi-season credibility summary', async () => {
    prisma.farmer.findUnique.mockResolvedValue({ id: 'f-1', fullName: 'Jane', countryCode: 'KE', region: 'Nakuru' });
    prisma.farmSeason.findMany.mockResolvedValue([
      {
        id: 's-1', cropType: 'maize', status: 'completed', plantingDate: new Date(),
        credibilityAssessment: { credibilityScore: 85, credibilityLevel: 'high_confidence', flags: [], confidence: 'high' },
        progressScore: { progressScore: 78, performanceClassification: 'on_track' },
        harvestReport: { totalHarvestKg: 2000 },
        officerValidations: [{ id: 'ov-1' }],
        _count: { progressEntries: 12, stageConfirmations: 3 },
      },
    ]);

    const result = await getFarmerCredibilitySummary('f-1');
    expect(result.farmer.id).toBe('f-1');
    expect(result.overallCredibility.avgScore).toBe(85);
    expect(result.overallCredibility.level).toBe('high_confidence');
    expect(result.seasons).toHaveLength(1);
  });

  it('throws 404 for missing farmer', async () => {
    prisma.farmer.findUnique.mockResolvedValue(null);
    await expect(getFarmerCredibilitySummary('bad')).rejects.toThrow(/Farmer not found/);
  });
});

describe('Image Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('adds progress image with metadata', async () => {
    const plantingDate = new Date(Date.now() - 30 * 86400000);
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', plantingDate, cropType: 'maize',
      farmer: { countryCode: 'KE' },
    });
    prisma.seasonProgressEntry.create.mockResolvedValue({
      id: 'e-1', imageUrl: 'https://img.test/1.jpg', imageStage: 'early_growth',
    });
    prisma.farmSeason.update.mockResolvedValue({});

    const result = await addProgressImage('s-1', {
      imageUrl: 'https://img.test/1.jpg',
      imageStage: 'early_growth',
    });

    expect(result.entry.imageUrl).toBe('https://img.test/1.jpg');
    expect(prisma.seasonProgressEntry.create).toHaveBeenCalled();
    expect(prisma.farmSeason.update).toHaveBeenCalled();
  });

  it('warns on stage timing mismatch', async () => {
    const plantingDate = new Date(Date.now() - 10 * 86400000); // only 10 days ago
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', plantingDate, cropType: 'maize',
      farmer: { countryCode: 'KE' },
    });
    prisma.seasonProgressEntry.create.mockResolvedValue({
      id: 'e-1', imageUrl: 'https://img.test/1.jpg', imageStage: 'harvest',
    });
    prisma.farmSeason.update.mockResolvedValue({});

    const result = await addProgressImage('s-1', {
      imageUrl: 'https://img.test/1.jpg',
      imageStage: 'harvest', // too early for harvest
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].code).toBe('stage_timing_mismatch');
  });

  it('rejects image for non-active season', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'completed', plantingDate: new Date(), cropType: 'maize',
      farmer: { countryCode: 'KE' },
    });

    await expect(addProgressImage('s-1', { imageUrl: 'https://img.test/1.jpg' }))
      .rejects.toThrow(/active seasons/);
  });

  it('rejects missing imageUrl', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', status: 'active', plantingDate: new Date(), cropType: 'maize',
      farmer: { countryCode: 'KE' },
    });

    await expect(addProgressImage('s-1', {}))
      .rejects.toThrow(/imageUrl is required/);
  });

  it('gets progress images with coverage', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', cropType: 'maize', farmer: { countryCode: 'KE' },
    });
    prisma.seasonProgressEntry.findMany.mockResolvedValue([
      { id: 'e-1', imageUrl: 'url1', imageStage: 'early_growth', entryDate: new Date(Date.now() - 50 * 86400000) },
      { id: 'e-2', imageUrl: 'url2', imageStage: 'mid_stage', entryDate: new Date(Date.now() - 30 * 86400000) },
    ]);

    const result = await getProgressImages('s-1');
    expect(result.images).toHaveLength(2);
    expect(result.coverage.coveredStages).toContain('early_growth');
    expect(result.coverage.coveredStages).toContain('mid_stage');
    expect(result.coverage.missingStages).toContain('harvest');
    expect(result.coverage.coverageRate).toBe(40);
  });

  it('detects image sequence regression', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue({
      id: 's-1', cropType: 'maize', farmer: { countryCode: 'KE' },
    });
    prisma.seasonProgressEntry.findMany.mockResolvedValue([
      { id: 'e-1', imageUrl: 'url1', imageStage: 'pre_harvest', entryDate: new Date(Date.now() - 30 * 86400000) },
      { id: 'e-2', imageUrl: 'url2', imageStage: 'early_growth', entryDate: new Date(Date.now() - 10 * 86400000) },
    ]);

    const result = await getProgressImages('s-1');
    expect(result.sequenceIssues.length).toBeGreaterThan(0);
    expect(result.sequenceIssues[0].code).toBe('stage_regression');
  });
});
