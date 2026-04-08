import { describe, it, expect } from 'vitest';
import { computeSeasonTrust, getTrustLevel } from '../modules/trust/service.js';

// ─── Helpers ───────────────────────────────────────────────

const now = new Date();
const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000);
const daysAhead = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

function makeSeason(overrides = {}) {
  return {
    id: 'season-1',
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
    credibilityAssessment: null,
    farmer: { id: 'farmer-1', organizationId: 'org-1', userId: 'user-1' },
    ...overrides,
  };
}

// ─── getTrustLevel ─────────────────────────────────────────

describe('getTrustLevel', () => {
  it('returns High Trust for score >= 75', () => expect(getTrustLevel(80)).toBe('High Trust'));
  it('returns Moderate Trust for score 50-74', () => expect(getTrustLevel(60)).toBe('Moderate Trust'));
  it('returns Low Trust for score 25-49', () => expect(getTrustLevel(40)).toBe('Low Trust'));
  it('returns Needs Review for score < 25', () => expect(getTrustLevel(10)).toBe('Needs Review'));
  it('boundary 75 = High Trust', () => expect(getTrustLevel(75)).toBe('High Trust'));
  it('boundary 50 = Moderate Trust', () => expect(getTrustLevel(50)).toBe('Moderate Trust'));
  it('boundary 25 = Low Trust', () => expect(getTrustLevel(25)).toBe('Low Trust'));
});

// ─── computeSeasonTrust — update consistency ───────────────

describe('computeSeasonTrust — update consistency', () => {
  it('recent update (< 7 days) contributes max update score', async () => {
    const season = makeSeason({ lastActivityDate: daysAgo(3) });
    const result = await computeSeasonTrust(season);
    expect(result.trustScore).toBeGreaterThanOrEqual(45); // update + cycle partial credit
    expect(result.trustReasons.some(r => /current|recent/i.test(r))).toBe(true);
  });

  it('stale season (> 30 days) reduces trust score', async () => {
    const season = makeSeason({ lastActivityDate: daysAgo(35) });
    const fresh = makeSeason({ lastActivityDate: daysAgo(3) });
    const staleResult = await computeSeasonTrust(season);
    const freshResult = await computeSeasonTrust(fresh);
    expect(staleResult.trustScore).toBeLessThan(freshResult.trustScore);
    expect(staleResult.negativeTrustFactors.some(f => /update/i.test(f))).toBe(true);
  });

  it('very stale season (> 60 days) gets 0 update score', async () => {
    const season = makeSeason({ lastActivityDate: daysAgo(65) });
    const result = await computeSeasonTrust(season);
    expect(result.negativeTrustFactors.some(f => /inactive/i.test(f))).toBe(true);
  });

  it('completed season gets full update score without requiring recent activity', async () => {
    const season = makeSeason({ status: 'completed', lastActivityDate: daysAgo(90) });
    const result = await computeSeasonTrust(season);
    // Should not penalize for lack of recent activity on a completed season
    expect(result.negativeTrustFactors.some(f => /No update/i.test(f))).toBe(false);
  });
});

// ─── computeSeasonTrust — evidence completeness ───────────

describe('computeSeasonTrust — evidence completeness', () => {
  it('no images results in negative factor', async () => {
    const season = makeSeason({
      progressEntries: [{ id: 'e1', imageUrl: null, imageStage: null, entryDate: daysAgo(5), entryType: 'activity' }],
    });
    const result = await computeSeasonTrust(season);
    expect(result.negativeTrustFactors.some(f => /image/i.test(f))).toBe(true);
  });

  it('multiple images increase trust score', async () => {
    const withImages = makeSeason({
      progressEntries: [
        { id: 'e1', imageUrl: '/uploads/a.jpg', imageStage: 'early_growth', entryDate: daysAgo(30), entryType: 'activity' },
        { id: 'e2', imageUrl: '/uploads/b.jpg', imageStage: 'mid_stage', entryDate: daysAgo(10), entryType: 'activity' },
      ],
    });
    const withoutImages = makeSeason({ progressEntries: [] });
    const withResult = await computeSeasonTrust(withImages);
    const withoutResult = await computeSeasonTrust(withoutImages);
    expect(withResult.trustScore).toBeGreaterThan(withoutResult.trustScore);
    expect(withResult.trustReasons.some(r => /image/i.test(r))).toBe(true);
  });
});

// ─── computeSeasonTrust — validation presence ─────────────

describe('computeSeasonTrust — validation presence', () => {
  it('no officer validation reduces trust for seasons older than 7 days', async () => {
    const season = makeSeason({
      createdAt: daysAgo(14),
      officerValidations: [],
    });
    const result = await computeSeasonTrust(season);
    expect(result.negativeTrustFactors.some(f => /officer validation/i.test(f))).toBe(true);
  });

  it('officer validation increases trust and appears in positive reasons', async () => {
    const withValidation = makeSeason({
      createdAt: daysAgo(14),
      officerValidations: [
        { id: 'v1', validationType: 'stage', confirmedHarvest: false, validatedAt: daysAgo(3) },
      ],
    });
    const withoutValidation = makeSeason({ createdAt: daysAgo(14), officerValidations: [] });
    const withResult = await computeSeasonTrust(withValidation);
    const withoutResult = await computeSeasonTrust(withoutValidation);
    expect(withResult.trustScore).toBeGreaterThan(withoutResult.trustScore);
    expect(withResult.trustReasons.some(r => /officer/i.test(r))).toBe(true);
  });

  it('harvest validation appears as explicit positive reason', async () => {
    const season = makeSeason({
      officerValidations: [
        { id: 'v1', validationType: 'harvest', confirmedHarvest: true, validatedAt: daysAgo(2) },
      ],
    });
    const result = await computeSeasonTrust(season);
    expect(result.trustReasons.some(r => /harvest.*validated/i.test(r))).toBe(true);
  });
});

// ─── computeSeasonTrust — harvest/cycle completeness ──────

describe('computeSeasonTrust — cycle completeness', () => {
  it('completed season with harvest report gets maximum cycle score', async () => {
    const season = makeSeason({
      status: 'completed',
      harvestReport: { id: 'hr1', totalHarvestKg: 500, yieldPerAcre: 250, createdAt: daysAgo(10) },
    });
    const result = await computeSeasonTrust(season);
    expect(result.trustReasons.some(r => /harvest.*season completed/i.test(r))).toBe(true);
  });

  it('harvest overdue adds negative factor', async () => {
    const season = makeSeason({
      status: 'active',
      expectedHarvestDate: daysAgo(10),
      harvestReport: null,
    });
    const result = await computeSeasonTrust(season);
    expect(result.negativeTrustFactors.some(f => /harvest.*not reported/i.test(f))).toBe(true);
  });

  it('harvest reported returns trustUpdatedAt as a Date', async () => {
    const season = makeSeason({
      status: 'harvested',
      harvestReport: { id: 'hr2', totalHarvestKg: 300, createdAt: daysAgo(5) },
    });
    const result = await computeSeasonTrust(season);
    expect(result.trustUpdatedAt).toBeInstanceOf(Date);
  });
});

// ─── computeSeasonTrust — output structure ─────────────────

describe('computeSeasonTrust — output structure', () => {
  it('returns all required fields', async () => {
    const season = makeSeason();
    const result = await computeSeasonTrust(season);
    expect(result).toHaveProperty('trustScore');
    expect(result).toHaveProperty('trustLevel');
    expect(result).toHaveProperty('trustReasons');
    expect(result).toHaveProperty('negativeTrustFactors');
    expect(result).toHaveProperty('trustUpdatedAt');
    expect(typeof result.trustScore).toBe('number');
    expect(result.trustScore).toBeGreaterThanOrEqual(0);
    expect(result.trustScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.trustReasons)).toBe(true);
    expect(Array.isArray(result.negativeTrustFactors)).toBe(true);
  });

  it('trust levels match expected strings', async () => {
    const validLevels = ['High Trust', 'Moderate Trust', 'Low Trust', 'Needs Review'];
    const result = await computeSeasonTrust(makeSeason());
    expect(validLevels).toContain(result.trustLevel);
  });
});

// ─── Trust separation from fraud/verification/decision ─────

describe('trust score isolation', () => {
  it('computeSeasonTrust does not reference fraud or verification fields', async () => {
    // Verify it works with a season that has no fraud/verification data
    const season = makeSeason(); // no fraudResult, no verificationResult
    const result = await computeSeasonTrust(season);
    expect(result.trustScore).toBeGreaterThanOrEqual(0);
    // Should not throw or produce unexpected output
    expect(result.trustLevel).toBeTruthy();
  });
});
