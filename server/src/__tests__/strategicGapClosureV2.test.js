/**
 * strategicGapClosureV2.test.js — Remaining Strategic Gap Closure v2.
 * Covers: reviewed guidance (§1), scan-quality insights (§2),
 * trust profile extension (§4), marketplace trust signals (§5),
 * education cards (§6), prediction calibration (§7),
 * farm health score (§8).
 */

import { describe, it, expect } from 'vitest';
import {
  getReviewedGuidance, GUIDANCE_CATEGORIES,
} from '../../../src/core/agronomy/reviewedGuidanceRegistry.js';
import { computeScanQualityInsights } from '../../../src/core/scan/scanQualityInsights.js';
import { computeFarmerTrustProfile, TRUST_TIER } from '../../../src/core/trust/farmerTrustProfile.js';
import {
  computeListingTrustSignals, FRESHNESS, READINESS, ACTIVITY,
} from '../../../src/core/marketplace/listingTrustSignals.js';
import {
  listEducationCards, getEducationCard, localizeCard, voiceReadoutText,
} from '../../../src/core/education/educationCards.js';
import { computePredictionCalibration } from '../../../src/core/prediction/predictionCalibration.js';
import { computeFarmHealthScore, HEALTH_STATE } from '../../../src/core/scoring/farmHealthScore.js';

// ─── §1 — reviewed guidance ────────────────────────────────

describe('reviewedGuidanceRegistry — reviewed guidance content', () => {
  it('returns confidence-aware, never-guaranteed guidance', () => {
    const g = getReviewedGuidance('fungal');
    expect(g.summary).toMatch(/possible/i);
    expect(g.summary).not.toMatch(/\bconfirmed\b/i);
    expect(typeof g.watering).toBe('string');
    expect(typeof g.nutrient).toBe('string');
    expect(g.reviewStatus).toBe('expert_review_recommended');
  });

  it('unknown category falls through safely', () => {
    expect(getReviewedGuidance('xyz').reviewStatus).toBe('expert_review_recommended');
    expect(GUIDANCE_CATEGORIES).toContain('healthy');
  });
});

// ─── §2 — scan quality insights ────────────────────────────

describe('scanQualityInsights — scan failure patterns', () => {
  it('counts blurry/dark/retake/manual/lowConfidence and ranks crops', () => {
    const events = [
      { name: 'scan_failed', payload: { reason: 'blurry', crop: 'maize', device: 'phoneA' } },
      { name: 'scan_failed', payload: { reason: 'dark', crop: 'maize', device: 'phoneA' } },
      { name: 'scan_completed', payload: { confidence: 0.3, crop: 'cassava', retake: true } },
      { name: 'scan_completed', payload: { manualFallback: true, crop: 'maize' } },
    ];
    const r = computeScanQualityInsights(events);
    expect(r.blurry).toBe(1);
    expect(r.dark).toBe(1);
    expect(r.retakes).toBe(1);
    expect(r.manualFallback).toBe(1);
    expect(r.lowConfidence).toBe(1);
    expect(r.topProblematicCrops[0].key).toBe('maize');
    expect(r.failurePatterns.length).toBeGreaterThan(0);
  });

  it('never throws on garbage input', () => {
    expect(() => computeScanQualityInsights(null)).not.toThrow();
    expect(computeScanQualityInsights('x').scanTotal).toBe(0);
  });
});

// ─── §4 — trust profile + trustConfidenceScore ─────────────

describe('farmerTrustProfile — v2 continuity + confidence', () => {
  it('exposes trustConfidenceScore reflecting data volume', () => {
    const thin = computeFarmerTrustProfile({ scansCompleted: 1 });
    const rich = computeFarmerTrustProfile({
      scansCompleted: 20, tasksCompleted: 20, distinctActiveDays: 20,
    });
    expect(thin.trustConfidenceScore).toBeLessThan(rich.trustConfidenceScore);
    expect(rich.trustConfidenceScore).toBeLessThanOrEqual(100);
  });

  it('continuity signals contribute to the score', () => {
    const withCont = computeFarmerTrustProfile({
      scansCompleted: 3,
      cropContinuity: 1, scanConsistency: 1,
      harvestConsistency: 1, taskReliability: 1,
    });
    const without = computeFarmerTrustProfile({ scansCompleted: 3 });
    expect(withCont.score).toBeGreaterThan(without.score);
    expect(withCont.components.continuity).toBeGreaterThan(0);
  });

  it('stays internal-only and never throws', () => {
    expect(computeFarmerTrustProfile({}).internalOnly).toBe(true);
    expect(() => computeFarmerTrustProfile(null)).not.toThrow();
    expect(computeFarmerTrustProfile(null).tier).toBe(TRUST_TIER.NEW);
  });
});

// ─── §5 — marketplace trust signals ────────────────────────

describe('listingTrustSignals — honest activity indicators', () => {
  it('computes freshness, readiness, completeness with a disclaimer', () => {
    const now = Date.UTC(2026, 4, 17);
    const r = computeListingTrustSignals(
      {
        updatedAt: new Date(now - 1 * 86400000).toISOString(),
        expectedHarvestDate: new Date(now + 3 * 86400000).toISOString(),
        title: 'Fresh maize', description: 'good', price: 10,
        cropType: 'maize', quantity: '50kg', photo: 'p.jpg', location: 'Accra',
      },
      { lastScanAt: new Date(now - 2 * 86400000).toISOString(), sellerActiveDays: 8, nowMs: now },
    );
    expect(r.listingFreshness).toBe(FRESHNESS.FRESH);
    expect(r.harvestReadiness).toBe(READINESS.SOON);
    expect(r.recentlyScanned).toBe(true);
    expect(r.sellerActivityScore).toBe(ACTIVITY.HIGH);
    expect(r.profileCompleteness).toBe(1);
    expect(r.disclaimer).toMatch(/not a quality guarantee/i);
  });

  it('never throws on garbage input', () => {
    expect(() => computeListingTrustSignals(null, null)).not.toThrow();
    expect(computeListingTrustSignals(null).profileCompleteness).toBe(0);
  });
});

// ─── §6 — education cards ──────────────────────────────────

describe('educationCards — localized micro-help', () => {
  it('ships the spec-mandated explainer cards', () => {
    const ids = listEducationCards().map((c) => c.id);
    for (const id of [
      'confidence_explainer', 'scan_tips', 'weather_task',
      'disease_risk', 'notification_explainer', 'marketplace_explainer',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('localizes via a translator and falls back to English', () => {
    const card = getEducationCard('confidence_explainer');
    const localized = localizeCard(card, (_k, fb) => fb);
    expect(localized.title).toBe('What confidence means');
    expect(typeof voiceReadoutText(card)).toBe('string');
    expect(voiceReadoutText(card).length).toBeGreaterThan(0);
  });

  it('never throws on unknown ids', () => {
    expect(getEducationCard('nope')).toBe(null);
    expect(localizeCard(null)).toBe(null);
  });
});

// ─── §7 — prediction calibration ───────────────────────────

describe('predictionCalibration — outcome-based tuning', () => {
  it('damps recommendation weight when false alarms dominate', () => {
    const noisy = computePredictionCalibration([
      { outcome: 'false_alarm' }, { outcome: 'false_alarm' },
      { outcome: 'false_alarm' }, { outcome: 'ignored' },
    ]);
    expect(noisy.falsePositiveRate).toBeGreaterThan(0.5);
    expect(noisy.recommendationWeight).toBeLessThan(1.0);
    expect(noisy.alertConfidenceAdjustment).toBe(-1);
  });

  it('keeps full strength when predictions hit', () => {
    const good = computePredictionCalibration([
      { outcome: 'confirmed' }, { outcome: 'intervened' },
      { outcome: 'confirmed' }, { outcome: 'confirmed' },
    ]);
    expect(good.hitRate).toBeGreaterThan(0.6);
    expect(good.recommendationWeight).toBeGreaterThanOrEqual(1.0);
  });

  it('defaults to neutral with no data, never throws', () => {
    const empty = computePredictionCalibration(null);
    expect(empty.recommendationWeight).toBe(1.0);
    expect(empty.hasEnoughData).toBe(false);
  });
});

// ─── §8 — farm health score ────────────────────────────────

describe('farmHealthScore — categorical, no fake precision', () => {
  it('returns a state, not a number', () => {
    const r = computeFarmHealthScore({ taskCompletionRate: 0.9, scanTrend: 'improving' });
    expect(Object.values(HEALTH_STATE)).toContain(r.state);
    expect(typeof r.state).toBe('string');
  });

  it('flags high risk when issues stack up', () => {
    const r = computeFarmHealthScore({
      scanTrend: 'declining', cropStress: 'high',
      unresolvedIssues: 4, weatherExposure: 'high', taskCompletionRate: 0.2,
    });
    expect(r.state).toBe(HEALTH_STATE.HIGH_RISK);
    expect(r.drivers.length).toBeGreaterThan(0);
  });

  it('reads as improving with strong habits', () => {
    const r = computeFarmHealthScore({ scanTrend: 'improving', taskCompletionRate: 0.85 });
    expect(r.state).toBe(HEALTH_STATE.IMPROVING);
  });

  it('never throws on garbage input', () => {
    expect(() => computeFarmHealthScore(null)).not.toThrow();
    expect(computeFarmHealthScore(null).state).toBe(HEALTH_STATE.STABLE);
  });
});
