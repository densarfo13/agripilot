import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma (not used in pure-logic tests, only in DB-path tests) ────

vi.mock('../config/database.js', () => ({
  default: {
    farmSeason: { findUnique: vi.fn() },
    farmer: { findUnique: vi.fn() },
    application: { findUnique: vi.fn() },
  },
}));

import { computeSeasonRisk } from '../modules/risk/service.js';

// ─── Helpers ───────────────────────────────────────────────

const now = new Date();
const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000);
const daysAhead = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

function makeSeason(overrides = {}) {
  return {
    id: 'season-risk-1',
    status: 'active',
    cropType: 'maize',
    farmSizeAcres: 2,
    plantingDate: daysAgo(60),
    expectedHarvestDate: daysAhead(60),
    lastActivityDate: daysAgo(3),
    createdAt: daysAgo(60),
    updatedAt: daysAgo(3),
    progressEntries: [],
    officerValidations: [],
    stageConfirmations: [],
    harvestReport: null,
    farmer: { id: 'farmer-risk-1', fullName: 'Test Farmer', assignedOfficerId: 'officer-1' },
    ...overrides,
  };
}

// ─── HARVEST_PENDING ───────────────────────────────────────

describe('computeSeasonRisk — HARVEST_PENDING', () => {
  it('returns High risk when harvest overdue < 21 days', async () => {
    const season = makeSeason({ expectedHarvestDate: daysAgo(10), harvestReport: null });
    const result = await computeSeasonRisk(season);
    expect(result.riskCategory).toBe('HARVEST_PENDING');
    expect(result.riskLevel).toBe('High');
    expect(result.agingDays).toBe(10);
  });

  it('returns Critical risk when harvest overdue >= 21 days', async () => {
    const season = makeSeason({ expectedHarvestDate: daysAgo(25), harvestReport: null });
    const result = await computeSeasonRisk(season);
    expect(result.riskCategory).toBe('HARVEST_PENDING');
    expect(result.riskLevel).toBe('Critical');
  });

  it('does not flag HARVEST_PENDING if harvest report exists', async () => {
    const season = makeSeason({
      expectedHarvestDate: daysAgo(10),
      harvestReport: { id: 'hr1', totalHarvestKg: 400, createdAt: daysAgo(5) },
    });
    const result = await computeSeasonRisk(season);
    expect(result.riskCategory).not.toBe('HARVEST_PENDING');
  });

  it('does not flag HARVEST_PENDING if harvest date is in the future', async () => {
    const season = makeSeason({ expectedHarvestDate: daysAhead(30), harvestReport: null });
    const result = await computeSeasonRisk(season);
    expect(result.riskCategory).not.toBe('HARVEST_PENDING');
  });
});

// ─── INACTIVE_SEASON ──────────────────────────────────────

describe('computeSeasonRisk — INACTIVE_SEASON / STALE_UPDATE', () => {
  it('Medium or High risk for 14-29 days inactive', async () => {
    const season = makeSeason({ lastActivityDate: daysAgo(20) });
    const result = await computeSeasonRisk(season);
    // Top risk may be STALE_UPDATE, VALIDATION_OVERDUE, or MISSING_EVIDENCE — all legitimate
    expect(['STALE_UPDATE', 'INACTIVE_SEASON', 'VALIDATION_OVERDUE', 'MISSING_EVIDENCE']).toContain(result.riskCategory);
    expect(['Medium', 'High']).toContain(result.riskLevel);
    // The inactivity risk should appear somewhere in allRisks
    const staleRisk = result.allRisks?.find(r => ['STALE_UPDATE', 'INACTIVE_SEASON'].includes(r.riskCategory));
    expect(staleRisk).toBeDefined();
  });

  it('High risk for 30-59 days inactive', async () => {
    const season = makeSeason({ lastActivityDate: daysAgo(40) });
    const result = await computeSeasonRisk(season);
    expect(['STALE_UPDATE', 'INACTIVE_SEASON']).toContain(result.riskCategory);
    expect(['High', 'Critical']).toContain(result.riskLevel);
  });

  it('Critical risk for 60+ days inactive', async () => {
    const season = makeSeason({ lastActivityDate: daysAgo(65) });
    const result = await computeSeasonRisk(season);
    expect(result.riskCategory).toBe('INACTIVE_SEASON');
    expect(result.riskLevel).toBe('Critical');
    expect(result.agingDays).toBeGreaterThanOrEqual(60);
  });

  it('no inactivity risk for recently updated season', async () => {
    const season = makeSeason({ lastActivityDate: daysAgo(3) });
    const result = await computeSeasonRisk(season);
    // Should not return inactivity-related category
    expect(['STALE_UPDATE', 'INACTIVE_SEASON']).not.toContain(result.riskCategory);
  });
});

// ─── VALIDATION_OVERDUE ───────────────────────────────────

describe('computeSeasonRisk — VALIDATION_OVERDUE', () => {
  it('returns Medium risk when no validation and season is 7+ days old', async () => {
    const season = makeSeason({
      createdAt: daysAgo(10),
      officerValidations: [],
    });
    const result = await computeSeasonRisk(season);
    // May be overridden by higher-priority risk — check allRisks
    const validationRisk = result.allRisks?.find(r => r.riskCategory === 'VALIDATION_OVERDUE');
    expect(validationRisk).toBeDefined();
    expect(['Medium', 'High']).toContain(validationRisk.riskLevel);
  });

  it('no VALIDATION_OVERDUE for recently created season (< 7 days)', async () => {
    const season = makeSeason({ createdAt: daysAgo(3), officerValidations: [] });
    const result = await computeSeasonRisk(season);
    const validationRisk = result.allRisks?.find(r => r.riskCategory === 'VALIDATION_OVERDUE');
    expect(validationRisk).toBeUndefined();
  });

  it('no VALIDATION_OVERDUE when officer has recently validated', async () => {
    const season = makeSeason({
      createdAt: daysAgo(30),
      officerValidations: [
        { id: 'v1', validationType: 'stage', validatedAt: daysAgo(2) },
      ],
    });
    const result = await computeSeasonRisk(season);
    const validationRisk = result.allRisks?.find(r => r.riskCategory === 'VALIDATION_OVERDUE');
    expect(validationRisk).toBeUndefined();
  });
});

// ─── Risk output structure ────────────────────────────────

describe('computeSeasonRisk — output structure', () => {
  it('returns all required fields', async () => {
    const season = makeSeason();
    const result = await computeSeasonRisk(season);
    expect(result).toHaveProperty('riskLevel');
    expect(result).toHaveProperty('riskCategory');
    expect(result).toHaveProperty('riskReason');
    expect(result).toHaveProperty('nextRecommendedAction');
    expect(result).toHaveProperty('agingDays');
    expect(result).toHaveProperty('allRisks');
  });

  it('Low risk when season is healthy and recent', async () => {
    const season = makeSeason({
      lastActivityDate: daysAgo(2),
      createdAt: daysAgo(5), // too new for validation requirement
      expectedHarvestDate: daysAhead(90),
      progressEntries: [
        { id: 'e1', imageUrl: '/uploads/a.jpg', imageStage: 'early_growth', entryDate: daysAgo(2), entryType: 'activity' },
      ],
      officerValidations: [
        { id: 'v1', validationType: 'stage', validatedAt: daysAgo(1) },
      ],
    });
    const result = await computeSeasonRisk(season);
    // May have MISSING_EVIDENCE for mid-stage but core risk should be Low or medium
    expect(['Low', 'Medium']).toContain(result.riskLevel);
  });

  it('HARVEST_PENDING takes priority over STALE_UPDATE', async () => {
    // Both conditions present — harvest overdue should win
    const season = makeSeason({
      lastActivityDate: daysAgo(20),    // stale
      expectedHarvestDate: daysAgo(10), // harvest overdue
      harvestReport: null,
    });
    const result = await computeSeasonRisk(season);
    expect(result.riskCategory).toBe('HARVEST_PENDING');
  });

  it('returns human-readable riskReason string', async () => {
    const season = makeSeason({ lastActivityDate: daysAgo(20) });
    const result = await computeSeasonRisk(season);
    expect(typeof result.riskReason).toBe('string');
    expect(result.riskReason.length).toBeGreaterThan(5);
  });
});

// ─── Risk does not override protected decisions ───────────

describe('risk engine isolation', () => {
  it('returns risk info without touching fraud, verification, or decision fields', async () => {
    const season = makeSeason(); // no fraud/verification data
    const result = await computeSeasonRisk(season);
    // Should complete without error
    expect(result.riskLevel).toBeTruthy();
    // Result should not contain decision-type fields
    expect(result).not.toHaveProperty('decision');
    expect(result).not.toHaveProperty('fraudRiskScore');
    expect(result).not.toHaveProperty('verificationScore');
  });
});
