/**
 * strategicGapClosure.test.js — Strategic Gap Closure + Pilot
 * Validation. Covers the agronomy credibility layer (§1) and the
 * internal farmer trust profile (§5) — the two genuine new modules.
 */

import { describe, it, expect } from 'vitest';
import {
  CONFIDENCE_WORDS,
  confidenceWord,
  confidenceTier,
  describeConfidence,
  overclaimsCertainty,
} from '../../../src/core/agronomy/confidenceLanguage.js';
import {
  ADVICE_TIER,
  EXPERT_REQUIRED_NOTE,
  classifyAdvice,
  partitionAdvice,
} from '../../../src/core/agronomy/agronomySafetyRules.js';
import {
  getReviewStatus,
  isExpertReviewed,
  REVIEWED_CATEGORIES,
} from '../../../src/core/agronomy/reviewedGuidanceRegistry.js';
import {
  TRUST_TIER,
  computeFarmerTrustProfile,
} from '../../../src/core/trust/farmerTrustProfile.js';

// ─── §1 — confidence language ──────────────────────────────

describe('confidenceLanguage — safe wording only', () => {
  it('the only permitted words are likely / possible / needs review', () => {
    expect(CONFIDENCE_WORDS).toEqual(['likely', 'possible', 'needs review']);
  });

  it('never escalates above "likely" — even at high confidence', () => {
    expect(confidenceWord(0.99)).toBe('likely');
    expect(confidenceWord('high')).toBe('likely');
    expect(confidenceWord(0.7)).toBe('possible');
    expect(confidenceWord(0.2)).toBe('needs review');
    expect(confidenceWord(null)).toBe('needs review'); // safest fallback
  });

  it('confidenceTier normalises numeric + string input', () => {
    expect(confidenceTier(0.9)).toBe('high');
    expect(confidenceTier('medium')).toBe('medium');
    expect(confidenceTier('garbage')).toBe('low');
  });

  it('describeConfidence returns a safe sentence with no "confirmed"', () => {
    for (const v of [0.99, 0.7, 0.1, 'high', null]) {
      const s = describeConfidence(v);
      expect(typeof s).toBe('string');
      expect(overclaimsCertainty(s)).toBe(false);
    }
  });

  it('overclaimsCertainty flags banned absolute-certainty wording', () => {
    expect(overclaimsCertainty('This is a confirmed disease')).toBe(true);
    expect(overclaimsCertainty('definitely blight')).toBe(true);
    expect(overclaimsCertainty('guaranteed cure')).toBe(true);
    expect(overclaimsCertainty('a possible issue worth checking')).toBe(false);
    expect(overclaimsCertainty(null)).toBe(false);
  });
});

// ─── §1 — agronomy safety rules ────────────────────────────

describe('agronomySafetyRules — general-safe vs expert-required', () => {
  it('flags chemical / pesticide advice as expert-required', () => {
    const r = classifyAdvice('Spray a pesticide on the affected leaves');
    expect(r.tier).toBe(ADVICE_TIER.EXPERT_REQUIRED);
    expect(r.expertRequired).toBe(true);
    expect(r.note).toBe(EXPERT_REQUIRED_NOTE);
  });

  it('treats watering / inspection advice as general-safe', () => {
    const r = classifyAdvice('Water the plant early in the morning');
    expect(r.tier).toBe(ADVICE_TIER.GENERAL_SAFE);
    expect(r.expertRequired).toBe(false);
  });

  it('partitions a mixed advice list and attaches the expert note', () => {
    const { safe, expertRequired, note } = partitionAdvice([
      'Check the leaves again tomorrow',
      'Apply 20 ml of fungicide solution',
      'Move the pot into partial shade',
    ]);
    expect(safe.length).toBe(2);
    expect(expertRequired.length).toBe(1);
    expect(note).toBe(EXPERT_REQUIRED_NOTE);
  });

  it('never throws on garbage input', () => {
    expect(() => classifyAdvice(null)).not.toThrow();
    expect(() => partitionAdvice(42)).not.toThrow();
    expect(partitionAdvice(null)).toEqual({ safe: [], expertRequired: [], note: '' });
  });
});

// ─── §1 — reviewed guidance registry ───────────────────────

describe('reviewedGuidanceRegistry — honest review seam', () => {
  it('nothing is faked as expert-reviewed in the pilot', () => {
    expect(REVIEWED_CATEGORIES).toEqual([]);
    for (const cat of ['fungal', 'pest', 'water', 'heat', 'nutrient']) {
      expect(isExpertReviewed(cat)).toBe(false);
      expect(getReviewStatus(cat).source).toBe('community-pattern');
    }
  });

  it('unknown categories return a safe unreviewed entry', () => {
    expect(getReviewStatus('not-a-category').reviewed).toBe(false);
    expect(isExpertReviewed(null)).toBe(false);
  });
});

// ─── §5 — farmer trust profile ─────────────────────────────

describe('farmerTrustProfile — internal-only trust signal', () => {
  it('a brand-new farmer scores low and is tier "new"', () => {
    const p = computeFarmerTrustProfile({});
    expect(p.score).toBe(0);
    expect(p.tier).toBe(TRUST_TIER.NEW);
    expect(p.internalOnly).toBe(true);
  });

  it('a consistently active farmer reaches the established tier', () => {
    const p = computeFarmerTrustProfile({
      scansCompleted: 10, tasksCompleted: 12, produceListings: 5,
      journalEntries: 8, distinctActiveDays: 15,
      locationSamples: [{ lat: 5.6, lng: -0.2 }, { lat: 5.6, lng: -0.2 }],
    });
    expect(p.score).toBeGreaterThanOrEqual(60);
    expect(p.tier).toBe(TRUST_TIER.ESTABLISHED);
    expect(p.locationConsistent).toBe(true);
  });

  it('no single signal can dominate — components are capped', () => {
    const p = computeFarmerTrustProfile({ scansCompleted: 9999 });
    expect(p.components.scans).toBeLessThanOrEqual(20);
    expect(p.score).toBeLessThan(60);
  });

  it('scattered locations lower location consistency', () => {
    const p = computeFarmerTrustProfile({
      distinctActiveDays: 3,
      locationSamples: [{ lat: 5.6, lng: -0.2 }, { lat: 9.9, lng: 4.5 }],
    });
    expect(p.locationConsistent).toBe(false);
  });

  it('never throws on garbage input', () => {
    expect(() => computeFarmerTrustProfile(null)).not.toThrow();
    expect(() => computeFarmerTrustProfile(42)).not.toThrow();
    expect(computeFarmerTrustProfile('x').tier).toBe(TRUST_TIER.NEW);
  });
});
