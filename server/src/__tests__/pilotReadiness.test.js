import { describe, it, expect } from 'vitest';
import {
  classifyFarmerActivity,
  buildTimeWindows,
  calculateFarmerCompleteness,
  summarizeCompleteness,
  buildFarmerScopeFilter,
  buildActivityFilters,
  scoreDuplicateMatch,
  DEFAULT_ACTIVITY_WINDOW_DAYS,
  REQUIRED_FARMER_FIELDS,
} from '../utils/farmerOps.js';
import {
  evaluatePesticideCompliance,
  buildComplianceTimeline,
  determineConfidence,
  summarizeCompliance,
  DEFAULT_RULES,
  FARMER_WORDING,
} from '../utils/pesticideCompliance.js';

// ─── Helpers ────────────────────────────────────────────────
const pest = (id, date, name = 'Neem Oil') => ({
  id, activityDate: date, metadata: { pesticideName: name },
});
const harv = (id, date, qty = 100) => ({
  id, activityDate: date, quantity: qty, unit: 'kg',
});
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

// ═══════════════════════════════════════════════════════════
//  PILOT READINESS — UNIFIED TEST SUITE
// ═══════════════════════════════════════════════════════════

describe('Pilot Readiness — Unified Test Suite', () => {

  // ── 1. Farmer activity classification (state gating) ───
  describe('1. Farmer activity classification', () => {
    it('ACTIVE: approved farmer with recent login', () => {
      const farmer = {
        registrationStatus: 'approved',
        userId: 'u1',
        userAccount: { active: true, lastLoginAt: daysAgo(5) },
        farmSeasons: [{ status: 'active', lastActivityDate: null }],
      };
      const result = classifyFarmerActivity(farmer);
      expect(result.status).toBe('ACTIVE');
      expect(result.lastActivityAt).toBeTruthy();
    });

    it('INACTIVE: approved farmer with no recent activity', () => {
      const farmer = {
        registrationStatus: 'approved',
        userId: 'u2',
        userAccount: { active: true, lastLoginAt: daysAgo(60) },
        farmSeasons: [{ status: 'active', lastActivityDate: daysAgo(60) }],
      };
      const result = classifyFarmerActivity(farmer);
      expect(result.status).toBe('INACTIVE');
    });

    it('SETUP_INCOMPLETE: approved but no season', () => {
      const farmer = {
        registrationStatus: 'approved',
        userId: 'u3',
        userAccount: { active: true, lastLoginAt: null },
        farmSeasons: [],
      };
      const result = classifyFarmerActivity(farmer);
      expect(result.status).toBe('SETUP_INCOMPLETE');
      expect(result.reason).toContain('No season');
    });

    it('SETUP_INCOMPLETE: approved but no user account', () => {
      const farmer = {
        registrationStatus: 'approved',
        userId: null,
        userAccount: null,
        farmSeasons: [{ status: 'active' }],
      };
      const result = classifyFarmerActivity(farmer);
      expect(result.status).toBe('SETUP_INCOMPLETE');
      expect(result.reason).toContain('No user account');
    });

    it('PENDING_APPROVAL: not yet approved', () => {
      const farmer = { registrationStatus: 'pending_approval', farmSeasons: [] };
      const result = classifyFarmerActivity(farmer);
      expect(result.status).toBe('PENDING_APPROVAL');
    });

    it('DISABLED: disabled or rejected', () => {
      expect(classifyFarmerActivity({ registrationStatus: 'disabled' }).status).toBe('DISABLED');
      expect(classifyFarmerActivity({ registrationStatus: 'rejected' }).status).toBe('DISABLED');
    });

    it('null farmer -> INACTIVE gracefully', () => {
      const result = classifyFarmerActivity(null);
      expect(result.status).toBe('INACTIVE');
    });

    it('custom window days affects classification', () => {
      const farmer = {
        registrationStatus: 'approved',
        userId: 'u4',
        userAccount: { active: true, lastLoginAt: daysAgo(15) },
        farmSeasons: [{ status: 'active', lastActivityDate: daysAgo(15) }],
      };
      expect(classifyFarmerActivity(farmer, { windowDays: 10 }).status).toBe('INACTIVE');
      expect(classifyFarmerActivity(farmer, { windowDays: 20 }).status).toBe('ACTIVE');
    });
  });

  // ── 2. Profile completeness ────────────────────────────
  describe('2. Profile completeness', () => {
    it('complete farmer: all required fields present', () => {
      const farmer = {
        fullName: 'Kofi Mensah',
        phone: '+233123456789',
        region: 'Ashanti',
        primaryCrop: 'Cocoa',
        landSizeHectares: 2.5,
        countryCode: 'GH',
      };
      const result = calculateFarmerCompleteness(farmer);
      expect(result.complete).toBe(true);
      expect(result.completionPct).toBe(100);
      expect(result.missingFields).toHaveLength(0);
    });

    it('incomplete farmer: missing fields identified', () => {
      const farmer = { fullName: 'Ama', phone: '+233111', region: null, primaryCrop: null, landSizeHectares: 0, countryCode: 'GH' };
      const result = calculateFarmerCompleteness(farmer);
      expect(result.complete).toBe(false);
      expect(result.missingFields).toContain('region');
      expect(result.missingFields).toContain('primaryCrop');
      expect(result.missingFields).toContain('landSizeHectares');
      expect(result.completionPct).toBeLessThan(100);
    });

    it('null farmer -> 0% complete', () => {
      const result = calculateFarmerCompleteness(null);
      expect(result.complete).toBe(false);
      expect(result.completionPct).toBe(0);
      expect(result.missingFields).toEqual(REQUIRED_FARMER_FIELDS);
    });

    it('summarizeCompleteness aggregates across multiple farmers', () => {
      const farmers = [
        { fullName: 'A', phone: '1', region: 'R', primaryCrop: 'C', landSizeHectares: 1, countryCode: 'GH' },
        { fullName: 'B', phone: '2', region: null, primaryCrop: null, landSizeHectares: 0, countryCode: null },
      ];
      const summary = summarizeCompleteness(farmers);
      expect(summary.total).toBe(2);
      expect(summary.complete).toBe(1);
      expect(summary.incomplete).toBe(1);
      expect(summary.commonMissing.length).toBeGreaterThan(0);
    });

    it('empty farmer list -> zero summary', () => {
      const summary = summarizeCompleteness([]);
      expect(summary.total).toBe(0);
      expect(summary.completePct).toBe(0);
    });
  });

  // ── 3. Pesticide compliance — 3 outcomes ───────────────
  describe('3. Pesticide compliance — 3 outcomes', () => {
    it('compliant: single pesticide, well-spaced, with harvest after waiting period', () => {
      const result = evaluatePesticideCompliance({
        pesticideActivities: [pest('p1', '2026-03-01')],
        harvestActivities: [harv('h1', '2026-03-20')],
        hasOfficerValidation: true,
      });
      expect(result.status).toBe('compliant');
      expect(result.farmerLabel).toBe('Safe to harvest');
      expect(result.confidence).toBe('verified');
      expect(result.violations).toHaveLength(0);
    });

    it('needs_review: no pesticide records at all', () => {
      const result = evaluatePesticideCompliance({ pesticideActivities: [] });
      expect(result.status).toBe('needs_review');
      expect(result.farmerLabel).toBe('Check details');
    });

    it('needs_review: missing required field on record', () => {
      const result = evaluatePesticideCompliance({
        pesticideActivities: [{ id: 'p1', activityDate: '2026-03-01', metadata: {} }],
      });
      expect(result.status).toBe('needs_review');
      expect(result.missingFields.length).toBeGreaterThan(0);
    });

    it('non_compliant: applications too close together', () => {
      const result = evaluatePesticideCompliance({
        pesticideActivities: [
          pest('p1', '2026-04-01'),
          pest('p2', '2026-04-03'), // only 2 days apart (min 7)
        ],
      });
      expect(result.status).toBe('non_compliant');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].rule).toBe('waiting_period');
    });

    it('non_compliant: harvest too soon after pesticide', () => {
      const result = evaluatePesticideCompliance({
        pesticideActivities: [pest('p1', '2026-04-01')],
        harvestActivities: [harv('h1', '2026-04-03')], // 2 days, min 7
      });
      expect(result.status).toBe('non_compliant');
      expect(result.violations.some(v => v.rule === 'harvest_too_soon')).toBe(true);
    });

    it('null/undefined input -> needs_review, no crash', () => {
      expect(evaluatePesticideCompliance(null).status).toBe('needs_review');
      expect(evaluatePesticideCompliance(undefined).status).toBe('needs_review');
      expect(evaluatePesticideCompliance({}).status).toBe('needs_review');
    });

    it('custom rules override defaults', () => {
      const result1 = evaluatePesticideCompliance({
        pesticideActivities: [pest('p1', '2026-04-01'), pest('p2', '2026-04-04')],
      });
      expect(result1.status).toBe('non_compliant');

      const result2 = evaluatePesticideCompliance({
        pesticideActivities: [pest('p1', '2026-04-01'), pest('p2', '2026-04-04')],
        rules: { minDaysBetweenApplications: 2 },
      });
      expect(result2.status).toBe('compliant');
    });
  });

  // ── 4. Confidence levels ───────────────────────────────
  describe('4. Confidence levels', () => {
    it('verified when officer validation exists', () => {
      expect(determineConfidence(true)).toBe('verified');
    });

    it('self_reported when no officer validation', () => {
      expect(determineConfidence(false)).toBe('self_reported');
    });

    it('compliance result includes confidence', () => {
      const r1 = evaluatePesticideCompliance({ pesticideActivities: [pest('p1', '2026-03-01')], hasOfficerValidation: true });
      const r2 = evaluatePesticideCompliance({ pesticideActivities: [pest('p1', '2026-03-01')], hasOfficerValidation: false });
      expect(r1.confidence).toBe('verified');
      expect(r2.confidence).toBe('self_reported');
    });
  });

  // ── 5. Compliance timeline ─────────────────────────────
  describe('5. Compliance timeline', () => {
    it('chronological order', () => {
      const tl = buildComplianceTimeline(
        [pest('p1', '2026-03-15'), pest('p2', '2026-03-01')],
        [harv('h1', '2026-03-20')],
      );
      const dates = tl.map(e => new Date(e.date));
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i] >= dates[i - 1]).toBe(true);
      }
    });

    it('includes pesticide, harvest, and safe_date events', () => {
      const tl = buildComplianceTimeline([pest('p1', '2026-03-01')], [harv('h1', '2026-03-20')]);
      const types = new Set(tl.map(e => e.type));
      expect(types.has('pesticide')).toBe(true);
      expect(types.has('harvest')).toBe(true);
      expect(types.has('safe_date')).toBe(true);
    });

    it('safe_date computed correctly from pesticide + waiting period', () => {
      const tl = buildComplianceTimeline([pest('p1', '2026-04-01')], []);
      const safeDateEvt = tl.find(e => e.type === 'safe_date');
      expect(safeDateEvt).toBeDefined();
      const safeDateStr = new Date(safeDateEvt.date).toISOString().slice(0, 10);
      expect(safeDateStr).toBe('2026-04-08');
    });
  });

  // ── 6. Farmer-facing wording ───────────────────────────
  describe('6. Farmer-facing wording', () => {
    it('FARMER_WORDING has all 3 statuses', () => {
      expect(FARMER_WORDING.compliant.label).toBe('Safe to harvest');
      expect(FARMER_WORDING.needs_review.label).toBe('Check details');
      expect(FARMER_WORDING.non_compliant.label).toBe('Wait before harvesting');
    });

    it('evaluatePesticideCompliance includes farmerLabel', () => {
      const r = evaluatePesticideCompliance({ pesticideActivities: [pest('p1', '2026-03-01')] });
      expect(r.farmerLabel).toBeTruthy();
      expect(['Safe to harvest', 'Check details', 'Wait before harvesting']).toContain(r.farmerLabel);
    });
  });

  // ── 7. Duplicate detection ─────────────────────────────
  describe('7. Duplicate detection', () => {
    it('exact phone match -> score >= 50, matchLevel exact', () => {
      const result = scoreDuplicateMatch(
        { phone: '+233-555-1234', fullName: 'A' },
        { phone: '2335551234', fullName: 'B' },
      );
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.matchLevel).toBe('exact');
      expect(result.signals).toContain('phone_exact');
    });

    it('name + region match -> likely', () => {
      const result = scoreDuplicateMatch(
        { fullName: 'Kofi Mensah', region: 'Ashanti' },
        { fullName: 'Kofi Mensah', region: 'Ashanti' },
      );
      expect(result.matchLevel).toBe('likely');
      expect(result.signals).toContain('name_exact_region_match');
    });

    it('no match -> none', () => {
      const result = scoreDuplicateMatch(
        { fullName: 'Alice', phone: '111' },
        { fullName: 'Bob', phone: '222' },
      );
      expect(result.matchLevel).toBe('none');
      expect(result.score).toBeLessThan(15);
    });

    it('fuzzy name + region -> name_fuzzy_region_match', () => {
      const result = scoreDuplicateMatch(
        { fullName: 'Mensah Kofi', region: 'Ashanti' },
        { fullName: 'Kofi Mensah', region: 'Ashanti' },
      );
      expect(result.score).toBeGreaterThanOrEqual(15);
      expect(result.signals).toContain('name_fuzzy_region_match');
    });
  });

  // ── 8. Time windows ────────────────────────────────────
  describe('8. Time windows', () => {
    it('builds correct default time windows', () => {
      const tw = buildTimeWindows();
      expect(tw.windowDays).toBe(DEFAULT_ACTIVITY_WINDOW_DAYS);
      expect(tw.activityCutoff).toBeInstanceOf(Date);
      expect(tw.weekCutoff).toBeInstanceOf(Date);
      expect(tw.monthCutoff).toBeInstanceOf(Date);
      expect(tw.quarterCutoff).toBeInstanceOf(Date);
      expect(tw.windowLabel).toBe(`last ${DEFAULT_ACTIVITY_WINDOW_DAYS} days`);
    });

    it('custom window days', () => {
      const tw = buildTimeWindows({ activityWindowDays: 14 });
      expect(tw.windowDays).toBe(14);
      expect(tw.windowLabel).toBe('last 14 days');
    });
  });

  // ── 9. Scope filters ──────────────────────────────────
  describe('9. Scope filters', () => {
    it('buildFarmerScopeFilter includes only provided fields', () => {
      const f = buildFarmerScopeFilter({ organizationId: 'org1', region: 'Ashanti' });
      expect(f.organizationId).toBe('org1');
      expect(f.region).toBe('Ashanti');
      expect(f.programId).toBeUndefined();
    });

    it('empty opts -> empty where', () => {
      expect(buildFarmerScopeFilter({})).toEqual({});
    });

    it('buildActivityFilters returns all 3 where clauses', () => {
      const result = buildActivityFilters({ organizationId: 'org1' });
      expect(result.activeFarmerWhere).toBeDefined();
      expect(result.inactiveFarmerWhere).toBeDefined();
      expect(result.setupIncompleteWhere).toBeDefined();
      expect(result.timeWindows).toBeDefined();
    });
  });

  // ── 10. Compliance summary aggregation ─────────────────
  describe('10. Compliance summary', () => {
    it('summarizeCompliance counts correctly', () => {
      const results = [
        evaluatePesticideCompliance({ pesticideActivities: [pest('p1', '2026-03-01')] }),
        evaluatePesticideCompliance({ pesticideActivities: [] }),
        evaluatePesticideCompliance({
          pesticideActivities: [pest('p2', '2026-04-01'), pest('p3', '2026-04-02')],
        }),
      ];
      const summary = summarizeCompliance(results);
      expect(summary.totalEvaluated).toBe(3);
      expect(summary.compliant + summary.needsReview + summary.nonCompliant).toBe(3);
    });
  });

  // ── 11. DEFAULT_RULES transparency ─────────────────────
  describe('11. Default rules transparency', () => {
    it('DEFAULT_RULES has all expected fields', () => {
      expect(DEFAULT_RULES.minDaysBetweenApplications).toBe(7);
      expect(DEFAULT_RULES.maxApplicationsPerWindow).toBe(4);
      expect(DEFAULT_RULES.frequencyWindowDays).toBe(30);
      expect(DEFAULT_RULES.harvestWaitingPeriodDays).toBe(7);
    });

    it('compliance result exposes rules used', () => {
      const r = evaluatePesticideCompliance({ pesticideActivities: [pest('p1', '2026-03-01')] });
      expect(r.rules).toBeDefined();
      expect(r.rules.harvestWaitingPeriodDays).toBe(7);
    });
  });

  // ── 12. Farm isolation ─────────────────────────────────
  describe('12. Farm isolation — per-farm independence', () => {
    it('two farms produce different results independently', () => {
      const farmA = evaluatePesticideCompliance({
        pesticideActivities: [pest('p1', '2026-03-01')],
        hasOfficerValidation: true,
      });
      const farmB = evaluatePesticideCompliance({
        pesticideActivities: [pest('p1', '2026-04-01'), pest('p2', '2026-04-02')],
        hasOfficerValidation: false,
      });
      expect(farmA.status).toBe('compliant');
      expect(farmA.confidence).toBe('verified');
      expect(farmB.status).toBe('non_compliant');
      expect(farmB.confidence).toBe('self_reported');
    });
  });

  // ── 13. REQUIRED_FARMER_FIELDS consistency ─────────────
  describe('13. Required fields consistency', () => {
    it('REQUIRED_FARMER_FIELDS matches expected list', () => {
      expect(REQUIRED_FARMER_FIELDS).toEqual([
        'fullName', 'phone', 'region', 'primaryCrop', 'landSizeHectares', 'countryCode',
      ]);
    });

    it('farmer missing one field has completionPct < 100', () => {
      const farmer = { fullName: 'A', phone: '1', region: 'R', primaryCrop: 'C', landSizeHectares: 1, countryCode: null };
      const result = calculateFarmerCompleteness(farmer);
      expect(result.complete).toBe(false);
      expect(result.missingFields).toEqual(['countryCode']);
      expect(result.completionPct).toBe(Math.round(5 / 6 * 100));
    });
  });

  // ── 14. Result shape contract ──────────────────────────
  describe('14. Compliance result shape contract', () => {
    it('every result has all required fields regardless of status', () => {
      const inputs = [
        { pesticideActivities: [pest('p1', '2026-03-01')], hasOfficerValidation: true },
        { pesticideActivities: [] },
        { pesticideActivities: [pest('p1', '2026-04-01'), pest('p2', '2026-04-02')] },
        null,
      ];
      for (const input of inputs) {
        const r = evaluatePesticideCompliance(input);
        expect(r).toHaveProperty('status');
        expect(r).toHaveProperty('reason');
        expect(r).toHaveProperty('farmerLabel');
        expect(r).toHaveProperty('confidence');
        expect(r).toHaveProperty('violations');
        expect(r).toHaveProperty('context');
        expect(r).toHaveProperty('timeline');
        expect(r).toHaveProperty('rules');
        expect(Array.isArray(r.timeline)).toBe(true);
        expect(Array.isArray(r.violations)).toBe(true);
        expect(['compliant', 'needs_review', 'non_compliant']).toContain(r.status);
      }
    });
  });

  // ── 15. Overuse detection ──────────────────────────────
  describe('15. Overuse (frequency cap) detection', () => {
    it('5 applications in 30-day window -> non_compliant', () => {
      const now = new Date();
      const apps = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - (i * 7));
        apps.push(pest(`p${i}`, d.toISOString().slice(0, 10)));
      }
      const result = evaluatePesticideCompliance({ pesticideActivities: apps });
      expect(result.status).toBe('non_compliant');
      expect(result.violations.some(v => v.rule === 'excessive_frequency')).toBe(true);
    });
  });
});
