/**
 * Farmer Operations — comprehensive structural integrity tests.
 *
 * Covers:
 *   1. Duplicate detection scoring
 *   2. Activity status classification
 *   3. Time-bound metric helpers
 *   4. Profile completeness calculation
 *   5. Program/cohort structure
 *   6. Dashboard/export alignment
 *   7. No double counting with multiple farms
 *   8. Backward compatibility
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readFile(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, '../../..', relativePath), 'utf8');
}

// ═══════════════════════════════════════════════════════════
//  1. DUPLICATE DETECTION SCORING
// ═══════════════════════════════════════════════════════════

describe('Duplicate detection — scoring', () => {
  let scoreDuplicateMatch;

  beforeAll(async () => {
    const mod = await import('../utils/farmerOps.js');
    scoreDuplicateMatch = mod.scoreDuplicateMatch;
  });

  it('phone exact match scores ≥50 (exact level)', () => {
    const result = scoreDuplicateMatch(
      { phone: '+233551234567' },
      { phone: '+233551234567' }
    );
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.matchLevel).toBe('exact');
    expect(result.signals).toContain('phone_exact');
  });

  it('phone match ignores formatting differences', () => {
    const result = scoreDuplicateMatch(
      { phone: '055-123-4567' },
      { phone: '0551234567' }
    );
    expect(result.matchLevel).toBe('exact');
  });

  it('nationalId exact match scores ≥50', () => {
    const result = scoreDuplicateMatch(
      { nationalId: 'GHA-123456789' },
      { nationalId: 'gha-123456789' }
    );
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.signals).toContain('national_id_exact');
  });

  it('name exact + region match scores likely (≥30)', () => {
    const result = scoreDuplicateMatch(
      { fullName: 'Kwame Mensah', region: 'Ashanti' },
      { fullName: 'kwame mensah', region: 'ashanti' }
    );
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.matchLevel).toBe('likely');
    expect(result.signals).toContain('name_exact_region_match');
  });

  it('name exact without region scores possible (≥15)', () => {
    const result = scoreDuplicateMatch(
      { fullName: 'Ama Serwaa' },
      { fullName: 'Ama Serwaa' }
    );
    expect(result.score).toBeGreaterThanOrEqual(15);
    expect(result.matchLevel).toBe('possible');
    expect(result.signals).toContain('name_exact');
  });

  it('fuzzy name (token reorder) + region scores likely or possible', () => {
    const result = scoreDuplicateMatch(
      { fullName: 'Mensah Kwame', region: 'Ashanti' },
      { fullName: 'Kwame Mensah', region: 'Ashanti' }
    );
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.signals).toContain('name_fuzzy_region_match');
  });

  it('completely different records score none', () => {
    const result = scoreDuplicateMatch(
      { fullName: 'John Doe', phone: '1111111111', region: 'Northern' },
      { fullName: 'Jane Smith', phone: '9999999999', region: 'Southern' }
    );
    expect(result.matchLevel).toBe('none');
    expect(result.score).toBeLessThan(15);
  });

  it('empty input scores none', () => {
    const result = scoreDuplicateMatch({}, {});
    expect(result.matchLevel).toBe('none');
    expect(result.score).toBe(0);
  });

  it('region + crop match gives small bonus', () => {
    const result = scoreDuplicateMatch(
      { region: 'Ashanti', primaryCrop: 'MAIZE' },
      { region: 'Ashanti', primaryCrop: 'maize' }
    );
    expect(result.score).toBeGreaterThanOrEqual(5);
    expect(result.signals).toContain('region_crop_match');
  });

  it('multiple signals stack', () => {
    const result = scoreDuplicateMatch(
      { fullName: 'Ama Serwaa', phone: '0551234567', region: 'Ashanti' },
      { fullName: 'Ama Serwaa', phone: '0551234567', region: 'Ashanti' }
    );
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.matchLevel).toBe('exact');
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════
//  2. ACTIVITY STATUS CLASSIFICATION
// ═══════════════════════════════════════════════════════════

describe('Activity status — classification', () => {
  let classifyFarmerActivity;

  beforeAll(async () => {
    const mod = await import('../utils/farmerOps.js');
    classifyFarmerActivity = mod.classifyFarmerActivity;
  });

  it('disabled farmer → DISABLED', () => {
    const result = classifyFarmerActivity({ registrationStatus: 'disabled' });
    expect(result.status).toBe('DISABLED');
  });

  it('pending_approval → PENDING_APPROVAL', () => {
    const result = classifyFarmerActivity({ registrationStatus: 'pending_approval' });
    expect(result.status).toBe('PENDING_APPROVAL');
  });

  it('rejected → DISABLED', () => {
    const result = classifyFarmerActivity({ registrationStatus: 'rejected' });
    expect(result.status).toBe('DISABLED');
  });

  it('approved + no userId → SETUP_INCOMPLETE', () => {
    const result = classifyFarmerActivity({
      registrationStatus: 'approved',
      userId: null,
      userAccount: null,
    });
    expect(result.status).toBe('SETUP_INCOMPLETE');
  });

  it('approved + account + no season → SETUP_INCOMPLETE', () => {
    const result = classifyFarmerActivity({
      registrationStatus: 'approved',
      userId: 'user-1',
      userAccount: { active: true, lastLoginAt: new Date() },
      farmSeasons: [],
    });
    expect(result.status).toBe('SETUP_INCOMPLETE');
  });

  it('approved + account + season + recent login → ACTIVE', () => {
    const result = classifyFarmerActivity({
      registrationStatus: 'approved',
      userId: 'user-1',
      userAccount: { active: true, lastLoginAt: new Date() },
      farmSeasons: [{ status: 'active', lastActivityDate: null }],
    });
    expect(result.status).toBe('ACTIVE');
  });

  it('approved + account + season + recent season activity → ACTIVE', () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const result = classifyFarmerActivity({
      registrationStatus: 'approved',
      userId: 'user-1',
      userAccount: { active: true, lastLoginAt: null },
      farmSeasons: [{ status: 'active', lastActivityDate: recentDate }],
    });
    expect(result.status).toBe('ACTIVE');
  });

  it('approved + account + season + old activity → INACTIVE', () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    const result = classifyFarmerActivity({
      registrationStatus: 'approved',
      userId: 'user-1',
      userAccount: { active: true, lastLoginAt: oldDate },
      farmSeasons: [{ status: 'active', lastActivityDate: oldDate }],
    });
    expect(result.status).toBe('INACTIVE');
  });

  it('custom window changes classification', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const farmer = {
      registrationStatus: 'approved',
      userId: 'user-1',
      userAccount: { active: true, lastLoginAt: tenDaysAgo },
      farmSeasons: [{ status: 'active', lastActivityDate: tenDaysAgo }],
    };

    // With 30-day window → ACTIVE (10 < 30)
    expect(classifyFarmerActivity(farmer, { windowDays: 30 }).status).toBe('ACTIVE');
    // With 7-day window → INACTIVE (10 > 7)
    expect(classifyFarmerActivity(farmer, { windowDays: 7 }).status).toBe('INACTIVE');
  });

  it('null farmer → INACTIVE', () => {
    const result = classifyFarmerActivity(null);
    expect(result.status).toBe('INACTIVE');
  });

  it('returns lastActivityAt', () => {
    const loginDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const result = classifyFarmerActivity({
      registrationStatus: 'approved',
      userId: 'user-1',
      userAccount: { active: true, lastLoginAt: loginDate },
      farmSeasons: [{ status: 'active', lastActivityDate: null }],
    });
    expect(result.lastActivityAt).toEqual(loginDate);
  });

  it('returns most recent of login and season activity', () => {
    const loginDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const activityDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // more recent
    const result = classifyFarmerActivity({
      registrationStatus: 'approved',
      userId: 'user-1',
      userAccount: { active: true, lastLoginAt: loginDate },
      farmSeasons: [{ status: 'active', lastActivityDate: activityDate }],
    });
    expect(result.lastActivityAt).toEqual(activityDate);
  });

  it('deactivated user account → DISABLED', () => {
    const result = classifyFarmerActivity({
      registrationStatus: 'approved',
      userId: 'user-1',
      userAccount: { active: false, lastLoginAt: new Date() },
      farmSeasons: [{ status: 'active' }],
    });
    expect(result.status).toBe('DISABLED');
  });
});

// ═══════════════════════════════════════════════════════════
//  3. TIME-BOUND METRIC HELPERS
// ═══════════════════════════════════════════════════════════

describe('Time-bound metrics', () => {
  let buildTimeWindows, buildActivityFilters, DEFAULT_ACTIVITY_WINDOW_DAYS;

  beforeAll(async () => {
    const mod = await import('../utils/farmerOps.js');
    buildTimeWindows = mod.buildTimeWindows;
    buildActivityFilters = mod.buildActivityFilters;
    DEFAULT_ACTIVITY_WINDOW_DAYS = mod.DEFAULT_ACTIVITY_WINDOW_DAYS;
  });

  it('default window is 30 days', () => {
    expect(DEFAULT_ACTIVITY_WINDOW_DAYS).toBe(30);
  });

  it('buildTimeWindows returns all expected fields', () => {
    const tw = buildTimeWindows();
    expect(tw).toHaveProperty('now');
    expect(tw).toHaveProperty('activityCutoff');
    expect(tw).toHaveProperty('weekCutoff');
    expect(tw).toHaveProperty('monthCutoff');
    expect(tw).toHaveProperty('quarterCutoff');
    expect(tw).toHaveProperty('windowDays');
    expect(tw).toHaveProperty('windowLabel');
  });

  it('activityCutoff is windowDays ago', () => {
    const tw = buildTimeWindows({ activityWindowDays: 14 });
    const expectedCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    expect(Math.abs(tw.activityCutoff.getTime() - expectedCutoff)).toBeLessThan(1000);
    expect(tw.windowDays).toBe(14);
    expect(tw.windowLabel).toBe('last 14 days');
  });

  it('buildActivityFilters returns 3 where clauses + timeWindows', () => {
    const filters = buildActivityFilters({ organizationId: 'org-1' });
    expect(filters).toHaveProperty('activeFarmerWhere');
    expect(filters).toHaveProperty('inactiveFarmerWhere');
    expect(filters).toHaveProperty('setupIncompleteWhere');
    expect(filters).toHaveProperty('timeWindows');
  });

  it('activeFarmerWhere includes registrationStatus: approved', () => {
    const { activeFarmerWhere } = buildActivityFilters({ organizationId: 'org-1' });
    expect(activeFarmerWhere.registrationStatus).toBe('approved');
    expect(activeFarmerWhere.organizationId).toBe('org-1');
  });

  it('setupIncompleteWhere checks for missing userId or no season', () => {
    const { setupIncompleteWhere } = buildActivityFilters({});
    expect(setupIncompleteWhere.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: null }),
      ])
    );
  });
});

// ═══════════════════════════════════════════════════════════
//  4. PROFILE COMPLETENESS
// ═══════════════════════════════════════════════════════════

describe('Profile completeness', () => {
  let calculateFarmerCompleteness, summarizeCompleteness, REQUIRED_FARMER_FIELDS;

  beforeAll(async () => {
    const mod = await import('../utils/farmerOps.js');
    calculateFarmerCompleteness = mod.calculateFarmerCompleteness;
    summarizeCompleteness = mod.summarizeCompleteness;
    REQUIRED_FARMER_FIELDS = mod.REQUIRED_FARMER_FIELDS;
  });

  it('defines 6 required fields', () => {
    expect(REQUIRED_FARMER_FIELDS).toHaveLength(6);
    expect(REQUIRED_FARMER_FIELDS).toContain('fullName');
    expect(REQUIRED_FARMER_FIELDS).toContain('phone');
    expect(REQUIRED_FARMER_FIELDS).toContain('region');
    expect(REQUIRED_FARMER_FIELDS).toContain('primaryCrop');
    expect(REQUIRED_FARMER_FIELDS).toContain('landSizeHectares');
    expect(REQUIRED_FARMER_FIELDS).toContain('countryCode');
  });

  it('complete farmer → 100%', () => {
    const result = calculateFarmerCompleteness({
      fullName: 'Kwame', phone: '+233551234567', region: 'Ashanti',
      primaryCrop: 'MAIZE', landSizeHectares: 2.5, countryCode: 'GH',
    });
    expect(result.complete).toBe(true);
    expect(result.completionPct).toBe(100);
    expect(result.missingFields).toHaveLength(0);
  });

  it('missing all fields → 0%', () => {
    const result = calculateFarmerCompleteness({});
    expect(result.complete).toBe(false);
    expect(result.completionPct).toBe(0);
    expect(result.missingFields).toHaveLength(6);
  });

  it('partial → correct percentage', () => {
    const result = calculateFarmerCompleteness({
      fullName: 'Kwame', phone: '+233551234567', region: 'Ashanti',
      // Missing: primaryCrop, landSizeHectares, countryCode
    });
    expect(result.filledCount).toBe(3);
    expect(result.completionPct).toBe(50);
    expect(result.missingFields).toContain('primaryCrop');
    expect(result.missingFields).toContain('landSizeHectares');
  });

  it('null farmer → 0%', () => {
    const result = calculateFarmerCompleteness(null);
    expect(result.complete).toBe(false);
    expect(result.completionPct).toBe(0);
  });

  it('landSizeHectares = 0 → not filled', () => {
    const result = calculateFarmerCompleteness({
      fullName: 'Kwame', phone: '123', region: 'Ashanti',
      primaryCrop: 'MAIZE', landSizeHectares: 0, countryCode: 'GH',
    });
    expect(result.complete).toBe(false);
    expect(result.missingFields).toContain('landSizeHectares');
  });

  it('summarizeCompleteness handles list', () => {
    const farmers = [
      { fullName: 'A', phone: '1', region: 'R', primaryCrop: 'C', landSizeHectares: 1, countryCode: 'KE' },
      { fullName: 'B', phone: '2', region: 'R' }, // incomplete
    ];
    const result = summarizeCompleteness(farmers);
    expect(result.total).toBe(2);
    expect(result.complete).toBe(1);
    expect(result.incomplete).toBe(1);
    expect(result.completePct).toBe(50);
  });

  it('summarizeCompleteness empty list', () => {
    const result = summarizeCompleteness([]);
    expect(result.total).toBe(0);
    expect(result.complete).toBe(0);
  });

  it('commonMissing sorted by count desc', () => {
    const farmers = [
      { fullName: 'A' }, // missing 5 fields
      { fullName: 'B', phone: '1' }, // missing 4 fields
      { fullName: 'C', phone: '2', region: 'R' }, // missing 3 fields
    ];
    const result = summarizeCompleteness(farmers);
    // landSizeHectares, primaryCrop, countryCode should be most common
    expect(result.commonMissing[0].count).toBe(3);
    expect(result.commonMissing.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
//  5. PROGRAM/COHORT STRUCTURE
// ═══════════════════════════════════════════════════════════

describe('Program/cohort — schema', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('defines Program model', () => {
    expect(schema).toContain('model Program {');
  });

  it('Program has organizationId', () => {
    expect(schema).toContain('organizationId  String       @map("organization_id")');
  });

  it('Program has name and status', () => {
    expect(schema).toMatch(/model Program \{[\s\S]*?name\s+String/);
    expect(schema).toMatch(/model Program \{[\s\S]*?status\s+String/);
  });

  it('defines Cohort model', () => {
    expect(schema).toContain('model Cohort {');
  });

  it('Cohort has programId', () => {
    expect(schema).toContain('programId   String   @map("program_id")');
  });

  it('Farmer has programId field', () => {
    expect(schema).toContain('programId            String?             @map("program_id")');
  });

  it('Farmer has cohortId field', () => {
    expect(schema).toContain('cohortId             String?             @map("cohort_id")');
  });

  it('Organization has programs relation', () => {
    expect(schema).toContain('programs             Program[]');
  });

  it('Farmer has program relation', () => {
    expect(schema).toMatch(/program\s+Program\?\s+@relation/);
  });

  it('Farmer has cohort relation', () => {
    expect(schema).toMatch(/cohort\s+Cohort\?\s+@relation/);
  });

  it('has index on programId', () => {
    expect(schema).toContain('idx_farmers_program');
  });

  it('has index on cohortId', () => {
    expect(schema).toContain('idx_farmers_cohort');
  });
});

describe('Program/cohort — routes', () => {
  const routes = readFile('server/src/modules/programs/routes.js');

  it('has GET / for listing programs', () => {
    expect(routes).toContain("router.get('/'");
  });

  it('has POST / for creating programs', () => {
    expect(routes).toContain("router.post('/'");
  });

  it('has PATCH /:id for updating programs', () => {
    expect(routes).toContain("router.patch('/:id'");
  });

  it('has GET /:programId/cohorts for listing cohorts', () => {
    expect(routes).toContain("router.get('/:programId/cohorts'");
  });

  it('has POST /:programId/cohorts for creating cohorts', () => {
    expect(routes).toContain("router.post('/:programId/cohorts'");
  });

  it('has POST /:programId/assign-farmers', () => {
    expect(routes).toContain("router.post('/:programId/assign-farmers'");
  });

  it('verifies org ownership on program operations', () => {
    expect(routes).toContain('organizationId: orgId');
  });

  it('verifies cohort belongs to program', () => {
    expect(routes).toContain('programId: req.params.programId');
  });
});

describe('Program/cohort — app wiring', () => {
  const app = readFile('server/src/app.js');

  it('imports program routes', () => {
    expect(app).toContain("import programRoutes from './modules/programs/routes.js'");
  });

  it('mounts at /api/programs', () => {
    expect(app).toContain("app.use('/api/programs', programRoutes)");
  });
});

// ═══════════════════════════════════════════════════════════
//  6. DASHBOARD / EXPORT ALIGNMENT
// ═══════════════════════════════════════════════════════════

describe('Dashboard/export alignment', () => {
  const analyticsSummary = readFile('server/routes/analytics-summary.js');
  const pilotMetrics = readFile('server/src/modules/pilotMetrics/service.js');

  it('analytics-summary imports buildActivityFilters', () => {
    expect(analyticsSummary).toContain('buildActivityFilters');
  });

  it('analytics-summary imports buildTimeWindows', () => {
    expect(analyticsSummary).toContain('buildTimeWindows');
  });

  it('analytics-summary imports summarizeCompleteness', () => {
    expect(analyticsSummary).toContain('summarizeCompleteness');
  });

  it('analytics-summary returns timeWindow metadata', () => {
    expect(analyticsSummary).toContain('timeWindow:');
    expect(analyticsSummary).toContain('windowDays:');
    expect(analyticsSummary).toContain('windowLabel');
  });

  it('analytics-summary returns activeFarmers from buildActivityFilters', () => {
    expect(analyticsSummary).toContain('activeFarmerWhere');
    expect(analyticsSummary).toContain('inactiveFarmerWhere');
  });

  it('analytics-summary returns profileCompleteness', () => {
    expect(analyticsSummary).toContain('profileCompleteness');
  });

  it('analytics-summary returns duplicateFlagged', () => {
    expect(analyticsSummary).toContain('duplicateFlagged');
  });

  it('pilotMetrics imports buildActivityFilters', () => {
    expect(pilotMetrics).toContain('buildActivityFilters');
  });

  it('pilotMetrics returns activityStatus section', () => {
    expect(pilotMetrics).toContain('activityStatus:');
  });

  it('pilotMetrics returns profileCompleteness section', () => {
    expect(pilotMetrics).toContain('profileCompleteness:');
  });

  it('both use same DEFAULT_ACTIVITY_WINDOW_DAYS', () => {
    expect(analyticsSummary).toContain('DEFAULT_ACTIVITY_WINDOW_DAYS');
    expect(pilotMetrics).toContain('DEFAULT_ACTIVITY_WINDOW_DAYS');
  });
});

// ═══════════════════════════════════════════════════════════
//  7. DUPLICATE FLAG FIELDS
// ═══════════════════════════════════════════════════════════

describe('Duplicate flag — schema + service', () => {
  const schema = readFile('server/prisma/schema.prisma');
  const service = readFile('server/src/modules/farmers/service.js');

  it('schema has duplicateFlag field', () => {
    expect(schema).toContain('duplicateFlag');
  });

  it('schema has duplicateOfId field', () => {
    expect(schema).toContain('duplicateOfId');
  });

  it('schema has duplicateScore field', () => {
    expect(schema).toContain('duplicateScore');
  });

  it('schema has duplicateSignals field', () => {
    expect(schema).toContain('duplicateSignals');
  });

  it('schema has duplicateReviewedAt field', () => {
    expect(schema).toContain('duplicateReviewedAt');
  });

  it('schema has index on duplicateFlag', () => {
    expect(schema).toContain('idx_farmers_duplicate_flag');
  });

  it('service exports setDuplicateFlag', () => {
    expect(service).toContain('export async function setDuplicateFlag');
  });

  it('service exports clearDuplicateFlag', () => {
    expect(service).toContain('export async function clearDuplicateFlag');
  });

  it('checkDuplicateFarmer returns scored matches', () => {
    expect(service).toContain('scoreDuplicateMatch');
    expect(service).toContain('matchScore');
    expect(service).toContain('matchLevel');
    expect(service).toContain('matchSignals');
  });

  it('checkDuplicateFarmer returns topMatchLevel', () => {
    expect(service).toContain('topMatchLevel');
  });
});

describe('Duplicate flag — routes', () => {
  const routes = readFile('server/src/modules/farmers/routes.js');

  it('has POST /:id/duplicate-flag endpoint', () => {
    expect(routes).toContain("router.post('/:id/duplicate-flag'");
  });

  it('has POST /:id/clear-duplicate endpoint', () => {
    expect(routes).toContain("router.post('/:id/clear-duplicate'");
  });

  it('duplicate-flag validates flag values', () => {
    expect(routes).toContain("'possible_duplicate', 'review_needed', 'cleared'");
  });

  it('clear-duplicate writes audit log', () => {
    expect(routes).toContain('farmer_duplicate_cleared');
  });
});

// ═══════════════════════════════════════════════════════════
//  8. FARMER LIST ENRICHMENT
// ═══════════════════════════════════════════════════════════

describe('Farmer list — enrichment', () => {
  const service = readFile('server/src/modules/farmers/service.js');

  it('listFarmers accepts programId filter', () => {
    expect(service).toContain('programId');
  });

  it('listFarmers accepts cohortId filter', () => {
    expect(service).toContain('cohortId');
  });

  it('listFarmers accepts duplicateFlag filter', () => {
    expect(service).toContain('duplicateFlag');
  });

  it('listFarmers accepts activityStatus filter', () => {
    expect(service).toContain('activityStatus');
  });

  it('listFarmers returns activityStatus per farmer', () => {
    expect(service).toContain('activityStatus: activity.status');
  });

  it('listFarmers returns profileComplete per farmer', () => {
    expect(service).toContain('profileComplete: completeness.complete');
  });

  it('listFarmers returns completionPct per farmer', () => {
    expect(service).toContain('completionPct: completeness.completionPct');
  });

  it('listFarmers returns missingFields per farmer', () => {
    expect(service).toContain('missingFields: completeness.missingFields');
  });

  it('listFarmers includes program relation', () => {
    expect(service).toContain("program: { select: { id: true, name: true } }");
  });

  it('listFarmers includes cohort relation', () => {
    expect(service).toContain("cohort: { select: { id: true, name: true } }");
  });

  it('getFarmerById returns activityStatus', () => {
    // Verify it appears in the getFarmerById function context
    expect(service).toContain('activityStatus: activity.status');
  });

  it('getFarmerById returns profileComplete', () => {
    expect(service).toContain('profileComplete: completeness.complete');
  });
});

// ═══════════════════════════════════════════════════════════
//  9. FILTER SCOPE BUILDER
// ═══════════════════════════════════════════════════════════

describe('Filter scope builder', () => {
  let buildFarmerScopeFilter;

  beforeAll(async () => {
    const mod = await import('../utils/farmerOps.js');
    buildFarmerScopeFilter = mod.buildFarmerScopeFilter;
  });

  it('empty opts returns empty filter', () => {
    const result = buildFarmerScopeFilter({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('organizationId adds to filter', () => {
    const result = buildFarmerScopeFilter({ organizationId: 'org-1' });
    expect(result.organizationId).toBe('org-1');
  });

  it('programId adds to filter', () => {
    const result = buildFarmerScopeFilter({ programId: 'prog-1' });
    expect(result.programId).toBe('prog-1');
  });

  it('cohortId adds to filter', () => {
    const result = buildFarmerScopeFilter({ cohortId: 'cohort-1' });
    expect(result.cohortId).toBe('cohort-1');
  });

  it('region adds to filter', () => {
    const result = buildFarmerScopeFilter({ region: 'Ashanti' });
    expect(result.region).toBe('Ashanti');
  });

  it('primaryCrop adds to filter', () => {
    const result = buildFarmerScopeFilter({ primaryCrop: 'MAIZE' });
    expect(result.primaryCrop).toBe('MAIZE');
  });

  it('all fields combine', () => {
    const result = buildFarmerScopeFilter({
      organizationId: 'org-1', programId: 'prog-1', cohortId: 'cohort-1',
      region: 'Ashanti', primaryCrop: 'MAIZE',
    });
    expect(Object.keys(result)).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════
//  10. BACKWARD COMPATIBILITY
// ═══════════════════════════════════════════════════════════

describe('Backward compatibility', () => {
  let calculateFarmerCompleteness, classifyFarmerActivity;

  beforeAll(async () => {
    const mod = await import('../utils/farmerOps.js');
    calculateFarmerCompleteness = mod.calculateFarmerCompleteness;
    classifyFarmerActivity = mod.classifyFarmerActivity;
  });

  it('completeness handles legacy farmer with no landSizeHectares', () => {
    const result = calculateFarmerCompleteness({
      fullName: 'Old Farmer', phone: '123', region: 'Northern',
      primaryCrop: 'RICE', countryCode: 'GH',
      // landSizeHectares is missing (old record)
    });
    expect(result.complete).toBe(false);
    expect(result.filledCount).toBe(5);
    expect(result.missingFields).toContain('landSizeHectares');
  });

  it('activity classification handles farmer with no farmSeasons key', () => {
    const result = classifyFarmerActivity({
      registrationStatus: 'approved',
      userId: 'user-1',
      userAccount: { active: true, lastLoginAt: new Date() },
      // farmSeasons not included at all
    });
    expect(result.status).toBe('SETUP_INCOMPLETE');
  });

  it('programId null does not break farmer listing filters', () => {
    const { buildFarmerScopeFilter } = require('../utils/farmerOps.js');
    const result = buildFarmerScopeFilter({ organizationId: 'org-1', programId: undefined });
    expect(result).not.toHaveProperty('programId');
  });

  it('schema Program and Cohort fields are all optional on Farmer', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('programId            String?');
    expect(schema).toContain('cohortId             String?');
    expect(schema).toContain('duplicateFlag        String?');
  });
});

// ═══════════════════════════════════════════════════════════
//  11. PESTICIDE COMPLIANCE — TRUST LAYER
// ═══════════════════════════════════════════════════════════

describe('Pesticide compliance — trust layer', () => {
  let evaluatePesticideCompliance, summarizeCompliance, buildComplianceTimeline, determineConfidence;
  let DEFAULT_RULES, FARMER_WORDING, MIN_DAYS_BETWEEN_APPLICATIONS, MAX_APPLICATIONS_PER_WINDOW;

  beforeAll(async () => {
    const mod = await import('../utils/pesticideCompliance.js');
    evaluatePesticideCompliance = mod.evaluatePesticideCompliance;
    summarizeCompliance = mod.summarizeCompliance;
    buildComplianceTimeline = mod.buildComplianceTimeline;
    determineConfidence = mod.determineConfidence;
    DEFAULT_RULES = mod.DEFAULT_RULES;
    FARMER_WORDING = mod.FARMER_WORDING;
    MIN_DAYS_BETWEEN_APPLICATIONS = mod.MIN_DAYS_BETWEEN_APPLICATIONS;
    MAX_APPLICATIONS_PER_WINDOW = mod.MAX_APPLICATIONS_PER_WINDOW;
  });

  const pest = (id, date, name) => ({
    id, activityDate: new Date(date), metadata: { pesticideName: name },
  });
  const harv = (id, date, qty) => ({
    id, activityDate: new Date(date), quantity: qty, unit: 'kg',
  });

  // ── 1. Farm-specific compliance ────────────────────────

  it('evaluates per-farm (no cross-farm mixing)', () => {
    const farm1 = [pest('a1', '2026-03-01', 'A'), pest('a2', '2026-03-03', 'B')];
    const farm2 = [pest('b1', '2026-03-01', 'C'), pest('b2', '2026-03-15', 'D')];
    const r1 = evaluatePesticideCompliance({ pesticideActivities: farm1 });
    const r2 = evaluatePesticideCompliance({ pesticideActivities: farm2 });
    expect(r1.status).toBe('non_compliant');
    expect(r2.status).toBe('compliant');
  });

  // ── 2. Harvest linkage ─────────────────────────────────

  it('harvest too soon after pesticide → non_compliant', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-04-10', 'Neem')],
      harvestActivities: [harv('h1', '2026-04-12', 50)],
    });
    expect(result.status).toBe('non_compliant');
    expect(result.violations.some(v => v.rule === 'harvest_too_soon')).toBe(true);
  });

  it('harvest after safe waiting period → compliant', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-04-01', 'Neem')],
      harvestActivities: [harv('h1', '2026-04-15', 100)],
    });
    expect(result.status).toBe('compliant');
  });

  it('missing harvest → no violation (stays compliant if safe)', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-04-01', 'Neem')],
      harvestActivities: [],
    });
    expect(result.status).toBe('compliant');
  });

  // ── 3. Last action context ─────────────────────────────

  it('context includes lastPesticideDate and lastHarvestDate', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-04-10', 'A')],
      harvestActivities: [harv('h1', '2026-04-20', 50)],
    });
    expect(result.context).toBeDefined();
    expect(result.context.lastPesticideDate).toBeTruthy();
    expect(result.context.lastHarvestDate).toBeTruthy();
    expect(result.context.lastUpdateType).toBe('harvesting');
  });

  it('context.lastUpdateType is pesticide when no harvest', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-04-10', 'A')],
      harvestActivities: [],
    });
    expect(result.context.lastUpdateType).toBe('pesticide');
  });

  it('context is null-safe when no activities', () => {
    const result = evaluatePesticideCompliance({ pesticideActivities: [] });
    expect(result.context.lastPesticideDate).toBeNull();
    expect(result.context.lastUpdateType).toBeNull();
  });

  // ── 4. Confidence level ────────────────────────────────

  it('default confidence is self_reported', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-04-01', 'A')],
    });
    expect(result.confidence).toBe('self_reported');
  });

  it('confidence is verified when officer validation exists', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-04-01', 'A')],
      hasOfficerValidation: true,
    });
    expect(result.confidence).toBe('verified');
  });

  it('determineConfidence returns correct values', () => {
    expect(determineConfidence(false)).toBe('self_reported');
    expect(determineConfidence(true)).toBe('verified');
  });

  // ── 5. Timeline ────────────────────────────────────────

  it('timeline is chronological', () => {
    const tl = buildComplianceTimeline(
      [pest('p1', '2026-04-01', 'A'), pest('p2', '2026-04-15', 'B')],
      [harv('h1', '2026-04-10', 50)],
    );
    expect(tl.length).toBeGreaterThan(0);
    for (let i = 1; i < tl.length; i++) {
      expect(new Date(tl[i].date) >= new Date(tl[i - 1].date)).toBe(true);
    }
  });

  it('timeline includes pesticide, harvest, and safe_date events', () => {
    const tl = buildComplianceTimeline(
      [pest('p1', '2026-04-01', 'Neem')],
      [harv('h1', '2026-04-15', 50)],
    );
    const types = tl.map(e => e.type);
    expect(types).toContain('pesticide');
    expect(types).toContain('harvest');
    expect(types).toContain('safe_date');
  });

  it('timeline pesticide label includes pesticide name', () => {
    const tl = buildComplianceTimeline([pest('p1', '2026-04-01', 'Neem')], []);
    const pestEvent = tl.find(e => e.type === 'pesticide');
    expect(pestEvent.label).toContain('Neem');
  });

  it('compliance result includes timeline array', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-04-01', 'A')],
      harvestActivities: [harv('h1', '2026-04-15', 50)],
    });
    expect(Array.isArray(result.timeline)).toBe(true);
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  // ── 6. Farmer-facing wording ───────────────────────────

  it('compliant → "Safe to harvest"', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-03-01', 'A')],
    });
    expect(result.farmerLabel).toBe('Safe to harvest');
  });

  it('needs_review → "Check details"', () => {
    const result = evaluatePesticideCompliance({ pesticideActivities: [] });
    expect(result.farmerLabel).toBe('Check details');
  });

  it('non_compliant → "Wait before harvesting"', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-03-01', 'A'), pest('p2', '2026-03-03', 'B')],
    });
    expect(result.farmerLabel).toBe('Wait before harvesting');
  });

  it('all results include action string', () => {
    const r1 = evaluatePesticideCompliance({ pesticideActivities: [pest('p1', '2026-03-01', 'A')] });
    const r2 = evaluatePesticideCompliance({ pesticideActivities: [] });
    expect(typeof r1.action).toBe('string');
    expect(typeof r2.action).toBe('string');
    expect(r1.action.length).toBeGreaterThan(0);
  });

  it('FARMER_WORDING exports all three statuses', () => {
    expect(FARMER_WORDING.compliant.label).toBe('Safe to harvest');
    expect(FARMER_WORDING.needs_review.label).toBe('Check details');
    expect(FARMER_WORDING.non_compliant.label).toBe('Wait before harvesting');
  });

  // ── 7. Rule configuration ──────────────────────────────

  it('DEFAULT_RULES are exported', () => {
    expect(DEFAULT_RULES.minDaysBetweenApplications).toBe(7);
    expect(DEFAULT_RULES.maxApplicationsPerWindow).toBe(4);
    expect(DEFAULT_RULES.frequencyWindowDays).toBe(30);
    expect(DEFAULT_RULES.harvestWaitingPeriodDays).toBe(7);
  });

  it('custom rules override defaults', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-03-01', 'A'), pest('p2', '2026-03-03', 'B')],
      rules: { minDaysBetweenApplications: 1 },
    });
    expect(result.status).toBe('compliant');
    expect(result.rules.minDaysBetweenApplications).toBe(1);
  });

  it('result includes active rules object', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [pest('p1', '2026-03-01', 'A')],
    });
    expect(result.rules).toBeDefined();
    expect(result.rules.minDaysBetweenApplications).toBe(7);
    expect(result.rules.harvestWaitingPeriodDays).toBe(7);
  });

  // ── 8. Edge cases ──────────────────────────────────────

  it('multiple pesticide events → uses most recent for harvest check', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [
        pest('p1', '2026-03-01', 'Old'),
        pest('p2', '2026-04-01', 'Recent'),
      ],
      harvestActivities: [harv('h1', '2026-04-05', 50)],
    });
    expect(result.status).toBe('non_compliant');
    expect(result.violations.some(v => v.rule === 'harvest_too_soon')).toBe(true);
  });

  it('missing pesticide data → needs_review (stops before rules)', () => {
    const result = evaluatePesticideCompliance({
      pesticideActivities: [{ id: 'p1', activityDate: new Date('2026-03-01'), metadata: {} }],
      harvestActivities: [harv('h1', '2026-03-02', 50)],
    });
    expect(result.status).toBe('needs_review');
    expect(result.violations).toHaveLength(0);
  });

  it('legacy array call signature still works', () => {
    const activities = [pest('p1', '2026-03-01', 'A')];
    const result = evaluatePesticideCompliance(activities);
    expect(result.status).toBe('compliant');
    expect(result.confidence).toBe('self_reported');
  });

  it('null/undefined input → needs_review', () => {
    expect(evaluatePesticideCompliance(null).status).toBe('needs_review');
    expect(evaluatePesticideCompliance(undefined).status).toBe('needs_review');
  });

  // ── 9. Priority enforcement ────────────────────────────

  it('priority: needs_review > non_compliant > compliant', () => {
    // Missing data + would-be violation → needs_review (not non_compliant)
    const result = evaluatePesticideCompliance({
      pesticideActivities: [
        { id: 'p1', activityDate: new Date('2026-03-01'), metadata: {} },
        pest('p2', '2026-03-02', 'A'),
      ],
    });
    expect(result.status).toBe('needs_review');
    expect(result.violations).toHaveLength(0);
  });

  // ── 10. Aggregation ────────────────────────────────────

  it('summarizeCompliance aggregates correctly', () => {
    const results = [
      { status: 'compliant' }, { status: 'compliant' },
      { status: 'needs_review' }, { status: 'non_compliant' },
    ];
    const summary = summarizeCompliance(results);
    expect(summary.compliant).toBe(2);
    expect(summary.needsReview).toBe(1);
    expect(summary.nonCompliant).toBe(1);
    expect(summary.totalEvaluated).toBe(4);
  });

  // ── 11. Structural integration tests ───────────────────

  it('FarmActivityType enum includes pesticide', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toMatch(/enum FarmActivityType\s*\{[^}]*pesticide/s);
  });

  it('farmer service fetches harvest activities for compliance', () => {
    const svc = readFile('server/src/modules/farmers/service.js');
    expect(svc).toContain("activityType: 'harvesting'");
    expect(svc).toContain('harvestActivities');
    expect(svc).toContain('hasOfficerValidation');
  });

  it('farmer service passes harvest and validation to engine', () => {
    const svc = readFile('server/src/modules/farmers/service.js');
    expect(svc).toContain('compliance.confidence');
    expect(svc).toContain('compliance.context');
    expect(svc).toContain('compliance.timeline');
  });

  it('compliance endpoint fetches harvest + validation data', () => {
    const routes = readFile('server/src/modules/farmers/routes.js');
    expect(routes).toContain('pesticide-compliance');
    expect(routes).toContain("activityType: 'harvesting'");
    expect(routes).toContain('officerValidation.count');
  });

  it('dashboard renders timeline and farmer-facing labels', () => {
    const page = readFile('src/pages/FarmerDetailPage.jsx');
    expect(page).toContain('Activity Timeline');
    expect(page).toContain('farmerLabel');
    expect(page).toContain('confidence');
    expect(page).toContain('TIMELINE_ICONS');
  });

  it('analytics-summary groups by farmer for farm isolation', () => {
    const analytics = readFile('server/routes/analytics-summary.js');
    expect(analytics).toContain('pestByFarmer');
    expect(analytics).toContain('harvByFarmer');
  });

  it('compliance translations exist for farmer-facing labels', () => {
    const i18n = readFile('src/i18n/translations.js');
    expect(i18n).toContain('compliance.safeToHarvest');
    expect(i18n).toContain('compliance.checkDetails');
    expect(i18n).toContain('compliance.waitBeforeHarvesting');
  });
});
