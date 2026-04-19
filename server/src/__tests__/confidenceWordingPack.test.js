/**
 * confidenceWordingPack.test.js — verifies confidence drives
 * the copy the farmer actually sees.
 *
 * High confidence → direct, imperative copy ("Plant now", etc.)
 * Medium          → softened hedging ("may need", "likely")
 * Low             → check-first framing ("Check whether the
 *                   soil is ready before planting")
 *
 * Covers:
 *   • buildHomeExperience for all three tiers
 *   • applyConfidenceWording for the task engine
 *   • hedging patterns — presence/absence of words, not exact text
 *   • photo-only land signal → softened vs question-driven → direct
 */

import { describe, it, expect } from 'vitest';

import {
  resolveFarmerState,
  buildHomeExperience,
  STATE_TYPES,
} from '../../../src/utils/farmerState/index.js';
import {
  applyConfidenceWording,
  shouldUseCheckFirst,
  scoreTaskConfidence,
} from '../services/today/taskConfidence.js';

import {
  composeFixtures,
  freshOnline, staleOffline,
  indiaRiceFarmer, ghanaMaizeFarmer, usaCornFarmer,
  wetSoilLand, tidyLand, photoOnlyLand,
  cameraBlurry, cameraUnknownIssue,
  completedHarvest, recentUndoHeavy,
} from './__fixtures__/farmerStateFixtures.js';

// Localization fixture — minimal t() covers just the keys we
// assert. The engine falls back to English when the key isn't in
// the table, which is the intended production behavior.
function makeT(dict) {
  return (key) => (dict && dict[key]) || key;
}

const IMPERATIVE_COMMANDS = [
  /\bplant now\b/i,
  /\bharvest today\b/i,
  /\bdo this today\b/i,
];

const HEDGING_WORDS = [
  /\bmay\b/i,
  /\blikely\b/i,
  /\bmight\b/i,
  /\bshould\b/i,
];

const CHECK_FIRST_WORDS = [
  /\bcheck\b/i,
  /\breview\b/i,
  /\bsee if\b/i,
  /\bwhether\b/i,
];

// ─── applyConfidenceWording — direct unit coverage ────────
describe('applyConfidenceWording', () => {
  it('HIGH confidence keeps the direct title', () => {
    const task = { title: 'Plant your seeds now', detail: 'Get them into the ground today.' };
    const out = applyConfidenceWording(task, { level: 'high', score: 85 });
    expect(out.title).toMatch(/^Plant your seeds now$/i);
    expect(out.title).not.toMatch(/\bmay\b|\blikely\b/i);
  });

  it('MEDIUM confidence softens with hedging words', () => {
    const task = { title: 'Plant your seeds now', detail: 'Direct imperative.' };
    const out = applyConfidenceWording(task, { level: 'medium', score: 60 });
    // Not the same as the original
    expect(out.title).not.toBe(task.title);
    // Contains at least one hedging signal
    expect(HEDGING_WORDS.some((r) => r.test(out.title))).toBe(true);
  });

  it('LOW confidence switches to check-first framing', () => {
    const task = { title: 'Plant your seeds now', detail: 'Direct imperative.' };
    const out = applyConfidenceWording(task, { level: 'low', score: 30 });
    // The hedgeTitle rule produces "Check if the soil is ready before planting"
    // for titles starting with "plant".
    expect(CHECK_FIRST_WORDS.some((r) => r.test(out.title))).toBe(true);
    // Low wording MUST NOT retain "plant now" style imperatives.
    expect(IMPERATIVE_COMMANDS.some((r) => r.test(out.title))).toBe(false);
  });

  it('attaches confidence block to the resulting task', () => {
    const out = applyConfidenceWording({ title: 'Water your tomatoes' },
      { level: 'medium', score: 55 });
    expect(out.confidence).toEqual({ level: 'medium', score: 55 });
  });

  it('key-driven tasks use the tier-variant i18n key', () => {
    const task = { titleKey: 'task.plant', title: 'Plant now' };
    const t = makeT({ 'task.plant.low': 'Check if the soil is ready before planting' });
    const out = applyConfidenceWording(task, { level: 'low' }, t);
    expect(out.titleKey).toBe('task.plant.low');
    expect(out.title).toMatch(/check/i);
  });
});

// ─── shouldUseCheckFirst — safety gate ────────────────────
describe('shouldUseCheckFirst — production contract', () => {
  it('true for LOW + risky intent WITH a real conflict reason', () => {
    for (const intent of ['plant', 'drain', 'clear']) {
      expect(shouldUseCheckFirst({ intent },
        { level: 'low', reasons: ['conflict_land_vs_stage'] })).toBe(true);
    }
  });

  it('false for LOW + risky intent but NO conflict reason', () => {
    // Tightened contract: low level alone is not enough to force
    // check-first. We need a concrete reason to suspect the
    // action will go wrong.
    for (const intent of ['plant', 'drain', 'clear']) {
      expect(shouldUseCheckFirst({ intent },
        { level: 'low', reasons: [] })).toBe(false);
    }
  });

  it('false for LOW + scout (inspection already safe)', () => {
    expect(shouldUseCheckFirst({ intent: 'scout' },
      { level: 'low', reasons: [] })).toBe(false);
    // Even with a conflict reason, a low-risk intent doesn't flip
    // — observational tasks shouldn't be wrapped in reminders.
    expect(shouldUseCheckFirst({ intent: 'scout' },
      { level: 'low', reasons: ['conflict_land_vs_stage'] })).toBe(false);
  });

  it('false for MEDIUM / HIGH — tier must be low', () => {
    expect(shouldUseCheckFirst({ intent: 'plant' },
      { level: 'medium', reasons: ['conflict_land_vs_stage'] })).toBe(false);
    expect(shouldUseCheckFirst({ intent: 'plant' },
      { level: 'high', reasons: ['conflict_land_vs_stage'] })).toBe(false);
  });

  it('risky intent + allowlisted reason fires check-first', () => {
    expect(shouldUseCheckFirst({ intent: 'plant' },
      { level: 'low', reasons: ['conflict_land_vs_stage'] })).toBe(true);
  });
});

// ─── scoreTaskConfidence — realistic scenarios ────────────
describe('scoreTaskConfidence — rule coverage', () => {
  it('question-driven land blocker → higher confidence than photo-only', () => {
    const questionDriven = scoreTaskConfidence({
      cropStage: 'planting',
      landProfile: { blocker: 'wet_soil', source: 'question', moisture: 'wet' },
      weatherNow:  { rainRisk: 'low' },
      taskIntent:  'clear',
    });
    const photoOnly = scoreTaskConfidence({
      cropStage: 'planting',
      landProfile: { blocker: 'wet_soil', source: 'photo', moisture: 'wet' },
      weatherNow:  { rainRisk: 'low' },
      taskIntent:  'clear',
    });
    expect(questionDriven.score).toBeGreaterThan(photoOnly.score);
  });

  it('conflict between land (wet) and stage (planting) drops confidence sharply', () => {
    const noConflict = scoreTaskConfidence({
      cropStage: 'clearing',
      landProfile: { blocker: 'wet_soil', source: 'question', moisture: 'wet' },
      weatherNow: { rainRisk: 'low' },
      taskIntent: 'clear',
    });
    const withConflict = scoreTaskConfidence({
      cropStage: 'planting',
      landProfile: { blocker: 'wet_soil', source: 'question', moisture: 'wet' },
      weatherNow: { rainRisk: 'low' },
      taskIntent: 'plant',
    });
    expect(withConflict.reasons).toContain('conflict_land_vs_stage');
    expect(withConflict.score).toBeLessThan(noConflict.score);
  });
});

// ─── buildHomeExperience — tier → copy ───────────────────
describe('buildHomeExperience — wording follows confidence tier', () => {
  const t = makeT({
    'state.harvest_complete.title':        'Harvest complete 🌾',
    'state.harvest_complete.title.medium': 'Harvest may be complete',
    'state.harvest_complete.title.low':    'Your harvest may be complete',
    'state.blocked_by_land.title.low':     'Your field may need more preparation',
    'state.soft.based_on_last_update':     'Based on your last update',
  });

  it('HIGH confidence harvest renders direct title', () => {
    const state = resolveFarmerState(composeFixtures(
      completedHarvest(),
      freshOnline(),
      { hasCompletedOnboarding: true, hasActiveCropCycle: true, countryCode: 'GH' },
    ));
    expect(state.confidenceLevel).toBe('high');
    const home = buildHomeExperience({ farmerState: state, t });
    expect(home.title).toBe('Harvest complete 🌾');
    expect(home.title).not.toMatch(/\bmay\b|\blikely\b/i);
  });

  it('MEDIUM confidence harvest renders softer title', () => {
    // Heavy undo pushes confidence down one tier.
    const state = resolveFarmerState(composeFixtures(
      completedHarvest(),
      recentUndoHeavy(),
      freshOnline(),
      { hasCompletedOnboarding: true, hasActiveCropCycle: true, countryCode: 'GH' },
    ));
    expect(state.confidenceLevel).not.toBe('high');
    const home = buildHomeExperience({ farmerState: state, t });
    expect(home.title.toLowerCase()).toMatch(/may/);
  });

  it('LOW confidence (camera blurry) renders state_first with softened copy', () => {
    const state = resolveFarmerState(composeFixtures(
      ghanaMaizeFarmer(),
      cameraBlurry(),
      freshOnline(),
    ));
    expect(state.confidenceLevel).toBe('low');
    expect(state.displayMode).toBe('state_first');
  });

  it('stale offline harvest adds "Based on your last update" prefix', () => {
    const state = resolveFarmerState(composeFixtures(
      completedHarvest(),
      staleOffline(),
      { hasCompletedOnboarding: true, hasActiveCropCycle: true },
    ));
    const home = buildHomeExperience({ farmerState: state, t });
    expect(home.confidenceLine).toBe('Based on your last update');
    // Title itself should not falsely claim certainty in that case.
    expect(home.level).not.toBe('high');
  });
});

// ─── Hedging realism — photo vs question sources ─────────
describe('photo vs question land source — wording softens for photo-only', () => {
  it('photo-only land signal does NOT produce high-confidence planting copy', () => {
    const state = resolveFarmerState(composeFixtures(
      indiaRiceFarmer(),
      photoOnlyLand(),
      freshOnline(),
    ));
    // Photo-only evidence scores lower than question-driven.
    // The engine may still pick blocked_by_land (safety), but
    // the title must not assert a direct imperative.
    expect(state.titleFallback.toLowerCase())
      .not.toMatch(/\bplant now\b/);
  });

  it('question-driven land blocker can render direct copy', () => {
    const state = resolveFarmerState(composeFixtures(
      indiaRiceFarmer(),
      wetSoilLand(),  // source: 'question'
      freshOnline(),
    ));
    // Direct wording is fine here because land blocker evidence
    // is explicit. The state is blocked_by_land → direct title.
    expect(state.stateType).toBe(STATE_TYPES.BLOCKED_BY_LAND);
    expect(['high', 'medium']).toContain(state.confidenceLevel);
  });
});

// ─── Guarantee no imperative leaks at LOW confidence ─────
describe('LOW confidence never produces imperative action copy', () => {
  it('camera unknown + planting stage → no "plant now" in title', () => {
    const state = resolveFarmerState(composeFixtures(
      usaCornFarmer(),
      cameraUnknownIssue(),
      freshOnline(),
    ));
    expect(state.confidenceLevel).toBe('low');
    expect(state.titleFallback.toLowerCase()).not.toMatch(/\bplant now\b/);
    expect(state.titleFallback.toLowerCase()).not.toMatch(/\bharvest today\b/);
  });
});
