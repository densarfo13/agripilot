import { describe, it, expect } from 'vitest';
import {
  evaluatePesticideCompliance,
  buildComplianceTimeline,
  determineConfidence,
  FARMER_WORDING,
  DEFAULT_RULES,
} from '../utils/pesticideCompliance.js';

// ─── Helpers ────────────────────────────────────────────────────
const pest = (id, date, name = 'Neem Oil') => ({
  id, activityDate: date, metadata: { pesticideName: name },
});
const harv = (id, date, qty = 100) => ({
  id, activityDate: date, quantity: qty, unit: 'kg',
});

// ─── Buyer-facing status mapping ────────────────────────────────
const BUYER_STATUS = {
  compliant: { label: 'Safe to harvest', color: 'green' },
  needs_review: { label: 'Needs review', color: 'amber' },
  non_compliant: { label: 'Not safe', color: 'red' },
};

function mapToBuyerStatus(internalStatus) {
  return BUYER_STATUS[internalStatus] || BUYER_STATUS.needs_review;
}

describe('Buyer Trust Layer', () => {
  // ── 1. Status mapping ─────────────────────────────────────────

  describe('Status mapping — internal to buyer-friendly', () => {
    it('compliant → Safe to harvest (green)', () => {
      const bs = mapToBuyerStatus('compliant');
      expect(bs.label).toBe('Safe to harvest');
      expect(bs.color).toBe('green');
    });

    it('needs_review → Needs review (amber)', () => {
      const bs = mapToBuyerStatus('needs_review');
      expect(bs.label).toBe('Needs review');
      expect(bs.color).toBe('amber');
    });

    it('non_compliant → Not safe (red)', () => {
      const bs = mapToBuyerStatus('non_compliant');
      expect(bs.label).toBe('Not safe');
      expect(bs.color).toBe('red');
    });

    it('unknown status → fallback to Needs review', () => {
      const bs = mapToBuyerStatus('unknown');
      expect(bs.label).toBe('Needs review');
    });
  });

  // ── 2. Farm trust card data ───────────────────────────────────

  describe('Farm Trust Card — data shape', () => {
    it('compliant farm produces all buyer-visible fields', () => {
      const result = evaluatePesticideCompliance({
        pesticideActivities: [pest('p1', '2026-03-01')],
        harvestActivities: [harv('h1', '2026-03-20')],
        hasOfficerValidation: true,
      });

      // Status fields
      expect(result.status).toBe('compliant');
      expect(result.farmerLabel).toBe('Safe to harvest');
      expect(result.confidence).toBe('verified');

      // Context for card display
      expect(result.context.lastPesticideDate).toBe('2026-03-01');
      expect(result.context.lastHarvestDate).toBe('2026-03-20');

      // Timeline present
      expect(result.timeline).toBeDefined();
      expect(result.timeline.length).toBeGreaterThan(0);

      // Rules transparency
      expect(result.rules.harvestWaitingPeriodDays).toBe(7);
    });

    it('safe harvest date can be computed from last pesticide + waiting period', () => {
      const result = evaluatePesticideCompliance({
        pesticideActivities: [pest('p1', '2026-04-01')],
      });
      const lastPest = new Date(result.context.lastPesticideDate);
      const safeDate = new Date(lastPest);
      safeDate.setDate(safeDate.getDate() + result.rules.harvestWaitingPeriodDays);

      expect(safeDate.toISOString().slice(0, 10)).toBe('2026-04-08');
    });
  });

  // ── 3. Confidence display ─────────────────────────────────────

  describe('Confidence — buyer sees verified vs self-reported', () => {
    it('officer-validated → verified', () => {
      expect(determineConfidence(true)).toBe('verified');
    });

    it('no validation → self_reported', () => {
      expect(determineConfidence(false)).toBe('self_reported');
    });

    it('confidence is included in compliance result', () => {
      const result = evaluatePesticideCompliance({
        pesticideActivities: [pest('p1', '2026-03-01')],
        hasOfficerValidation: false,
      });
      expect(result.confidence).toBe('self_reported');
    });
  });

  // ── 4. Timeline for buyer view ────────────────────────────────

  describe('Timeline — chronological events for expand view', () => {
    it('returns events in chronological order', () => {
      const tl = buildComplianceTimeline(
        [pest('p1', '2026-03-10'), pest('p2', '2026-03-01')],
        [harv('h1', '2026-03-15')],
      );

      const dates = tl.map(e => e.date);
      for (let i = 1; i < dates.length; i++) {
        expect(new Date(dates[i]) >= new Date(dates[i - 1])).toBe(true);
      }
    });

    it('includes pesticide, harvest, and safe_date types', () => {
      const tl = buildComplianceTimeline(
        [pest('p1', '2026-03-01')],
        [harv('h1', '2026-03-20')],
      );
      const types = new Set(tl.map(e => e.type));
      expect(types.has('pesticide')).toBe(true);
      expect(types.has('harvest')).toBe(true);
      expect(types.has('safe_date')).toBe(true);
    });

    it('each event has date, type, and label', () => {
      const tl = buildComplianceTimeline([pest('p1', '2026-03-01')], []);
      for (const evt of tl) {
        expect(evt.date).toBeDefined();
        expect(evt.type).toBeDefined();
        expect(evt.label).toBeDefined();
      }
    });

    it('harvest events include quantity detail', () => {
      const tl = buildComplianceTimeline([], [harv('h1', '2026-03-15', 500)]);
      const harvEvt = tl.find(e => e.type === 'harvest');
      expect(harvEvt.detail).toBe('500 kg');
    });
  });

  // ── 5. Filtering ──────────────────────────────────────────────

  describe('Filter support — compliance status categories', () => {
    const farms = [
      { status: 'compliant', name: 'Farm A' },
      { status: 'needs_review', name: 'Farm B' },
      { status: 'non_compliant', name: 'Farm C' },
      { status: 'compliant', name: 'Farm D' },
    ];

    it('filter "safe" returns only compliant farms', () => {
      const safe = farms.filter(f => f.status === 'compliant');
      expect(safe.length).toBe(2);
      expect(safe.every(f => f.status === 'compliant')).toBe(true);
    });

    it('filter "needs_review" returns only needs_review farms', () => {
      const nr = farms.filter(f => f.status === 'needs_review');
      expect(nr.length).toBe(1);
    });

    it('filter "not_safe" returns only non_compliant farms', () => {
      const ns = farms.filter(f => f.status === 'non_compliant');
      expect(ns.length).toBe(1);
    });

    it('no filter returns all farms', () => {
      expect(farms.length).toBe(4);
    });
  });

  // ── 6. Summary counts ─────────────────────────────────────────

  describe('Summary counts for buyer overview', () => {
    it('produces correct totals from mixed statuses', () => {
      const results = [
        evaluatePesticideCompliance({ pesticideActivities: [pest('p1', '2026-03-01')] }),
        evaluatePesticideCompliance({ pesticideActivities: [] }),
        evaluatePesticideCompliance({
          pesticideActivities: [pest('p2', '2026-04-01'), pest('p3', '2026-04-02')],
        }),
      ];

      const summary = {
        total: results.length,
        safe: results.filter(r => r.status === 'compliant').length,
        needsReview: results.filter(r => r.status === 'needs_review').length,
        notSafe: results.filter(r => r.status === 'non_compliant').length,
      };

      expect(summary.total).toBe(3);
      expect(summary.safe + summary.needsReview + summary.notSafe).toBe(summary.total);
    });
  });

  // ── 7. Farm isolation ─────────────────────────────────────────

  describe('Farm isolation — buyer sees per-farm data', () => {
    it('two farms get independent compliance evaluations', () => {
      const farmA = evaluatePesticideCompliance({
        pesticideActivities: [pest('p1', '2026-03-01')],
        hasOfficerValidation: true,
      });
      const farmB = evaluatePesticideCompliance({
        pesticideActivities: [],
        hasOfficerValidation: false,
      });

      expect(farmA.status).toBe('compliant');
      expect(farmA.confidence).toBe('verified');
      expect(farmB.status).toBe('needs_review');
      expect(farmB.confidence).toBe('self_reported');
    });
  });

  // ── 8. Edge cases ─────────────────────────────────────────────

  describe('Edge cases', () => {
    it('no data at all → needs_review, not crash', () => {
      const result = evaluatePesticideCompliance({});
      expect(result.status).toBe('needs_review');
      expect(result.timeline).toBeDefined();
    });

    it('null input → needs_review', () => {
      const result = evaluatePesticideCompliance(null);
      expect(result.status).toBe('needs_review');
    });

    it('non_compliant farm still includes timeline', () => {
      const result = evaluatePesticideCompliance({
        pesticideActivities: [pest('p1', '2026-04-01'), pest('p2', '2026-04-02')],
      });
      expect(result.status).toBe('non_compliant');
      expect(result.timeline.length).toBeGreaterThan(0);
    });
  });
});
