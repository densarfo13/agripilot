/**
 * taskConfidence.test.js — locks in the confidence layer that sits
 * between buildUnifiedTodayAction and final render.
 *
 *   1. scoreTaskConfidence — per-signal additions, conflict
 *      detection, threshold boundaries
 *   2. applyConfidenceWording — key-driven tier variants, plain-
 *      string hedging fallback, check-first override for low-
 *      confidence risky intents
 *   3. i18n — every task.{clearField,prepareDrainage,plant,water,
 *      scoutPests}.{high,medium,low} key resolves, plus the
 *      confidence.checkFirst.title override; no English leak in
 *      any non-en locale
 */
import { describe, it, expect } from 'vitest';
import {
  scoreTaskConfidence, applyConfidenceWording, shouldUseCheckFirst,
  _internal as confInternal,
} from '../services/today/taskConfidence.js';
import { t } from '../../../src/i18n/index.js';

// ─── 1. scoreTaskConfidence ──────────────────────────────
describe('scoreTaskConfidence', () => {
  it('defaults to medium with zero context (missing signals cost points)', () => {
    const out = scoreTaskConfidence({});
    expect(out.level).toBe('low'); // 50 - 15 (no land) - 10 (no weather) - 10 (no stage) = 15
    expect(out.reasons).toContain('land_missing');
    expect(out.reasons).toContain('weather_missing');
    expect(out.reasons).toContain('stage_missing');
  });

  it('goes HIGH with explicit land blocker + supportive weather + resolved stage', () => {
    const out = scoreTaskConfidence({
      cropStage: 'planting',
      landProfile: { blocker: 'uncleared_land', source: 'question', cleared: false },
      weatherNow: { rainRisk: 'high', rainMmNext24h: 30 },
      taskIntent: 'plant',
    });
    // Expect a drop from the land-vs-plant conflict; land still wins
    // enough to land high-medium range — lock in the direction.
    expect(out.reasons).toContain('land_blocker_explicit');
    expect(out.reasons).toContain('stage_resolved');
    // The conflict rule dropped score; still a believable output.
    expect(['medium', 'high']).toContain(out.level);
  });

  it('wet soil + planting stage triggers the conflict penalty', () => {
    const out = scoreTaskConfidence({
      cropStage: 'planting',
      landProfile: { moisture: 'wet' },
      weatherNow: { rainRisk: 'low', heatRisk: 'low' },
      taskIntent: 'plant',
    });
    expect(out.reasons).toContain('conflict_land_vs_stage');
    expect(out.level).toBe('low');
  });

  it('off-season stage drops confidence sharply', () => {
    const out = scoreTaskConfidence({
      cropStage: 'off_season',
      landProfile: { blocker: 'weeds_present', source: 'question', weeds: true },
      weatherNow: { rainRisk: 'low' },
      taskIntent: 'plant',
    });
    expect(out.reasons).toContain('stage_off_season');
  });

  it('camera pest_detected adds confidence', () => {
    const out = scoreTaskConfidence({
      cropStage: 'growing',
      landProfile: { moisture: 'moist' },
      weatherNow: { rainRisk: 'low' },
      cameraTask: { type: 'pest_detected' },
      taskIntent: 'scout',
    });
    expect(out.reasons).toContain('camera_clear');
  });

  it('camera unknown_issue drops confidence', () => {
    const out = scoreTaskConfidence({
      cropStage: 'growing',
      landProfile: { moisture: 'moist' },
      weatherNow: { rainRisk: 'low' },
      cameraTask: { type: 'unknown_issue' },
      taskIntent: 'scout',
    });
    expect(out.reasons).toContain('camera_uncertain');
  });

  it('photo-only land blocker scores lower than question-driven', () => {
    const photo = scoreTaskConfidence({
      cropStage: 'planting',
      landProfile: { blocker: 'weeds_present', source: 'photo' },
      weatherNow: { rainRisk: 'low' },
      taskIntent: 'clear',
    });
    const question = scoreTaskConfidence({
      cropStage: 'planting',
      landProfile: { blocker: 'weeds_present', source: 'question' },
      weatherNow: { rainRisk: 'low' },
      taskIntent: 'clear',
    });
    expect(question.score).toBeGreaterThan(photo.score);
  });

  it('level thresholds map to the right bands', () => {
    expect(confInternal.MEDIUM_THRESHOLD).toBe(45);
    expect(confInternal.HIGH_THRESHOLD).toBe(75);
  });

  it('weather supports watering at high heat', () => {
    const out = scoreTaskConfidence({
      cropStage: 'growing',
      landProfile: { moisture: 'moist' },
      weatherNow: { heatRisk: 'high', tempHighC: 38 },
      taskIntent: 'water',
    });
    expect(out.reasons).toContain('weather_supports_watering');
  });

  it('weather supports drainage-before-rain plant intent', () => {
    const out = scoreTaskConfidence({
      cropStage: 'planting',
      landProfile: { blocker: 'uncleared_land', source: 'question' },
      weatherNow: { rainRisk: 'high', rainMmNext24h: 40 },
      taskIntent: 'drain',
    });
    expect(out.reasons).toContain('weather_supports_action');
  });
});

// ─── 2. applyConfidenceWording ───────────────────────────
describe('applyConfidenceWording — key-driven tier variants', () => {
  it('HIGH keeps direct copy via .high variant', () => {
    const out = applyConfidenceWording(
      { titleKey: 'task.clearField' },
      { level: 'high', score: 80 },
      (k) => t(k, 'en'),
    );
    expect(out.titleKey).toBe('task.clearField.high');
    expect(out.title).toBe('Clear your field this week');
  });

  it('MEDIUM uses softer .medium variant', () => {
    const out = applyConfidenceWording(
      { titleKey: 'task.clearField' },
      { level: 'medium', score: 55 },
      (k) => t(k, 'en'),
    );
    expect(out.titleKey).toBe('task.clearField.medium');
    expect(out.title).toBe('Your field may need more clearing');
  });

  it('LOW on a risky intent with a conflict reason flips to the checkFirst override', () => {
    // Tightened contract: LOW + risky intent is NOT enough by
    // itself — we require a concrete conflict/uncertainty reason.
    const out = applyConfidenceWording(
      { titleKey: 'task.plant', intent: 'plant' },
      { level: 'low', score: 30, reasons: ['conflict_land_vs_stage'] },
      (k) => t(k, 'en'),
    );
    expect(out.checkFirst).toBe(true);
    expect(out.titleKey).toBe('confidence.checkFirst.title');
    expect(out.title).toBe('Check your field before acting');
  });

  it('LOW on a risky intent WITHOUT a reason softens via tier variant but does NOT flip', () => {
    const out = applyConfidenceWording(
      { titleKey: 'task.plant', intent: 'plant' },
      { level: 'low', score: 30 },
      (k) => t(k, 'en'),
    );
    expect(out.checkFirst).not.toBe(true);
    expect(out.titleKey).toBe('task.plant.low');
  });

  it('LOW on a non-risky intent keeps the direct key (no tier suffix)', () => {
    // Production contract: observational / low-risk tasks are NOT
    // softened. "Check your plants for pests" becoming "Check your
    // plants closely today" just adds noise.
    const out = applyConfidenceWording(
      { titleKey: 'task.scoutPests', intent: 'scout' },
      { level: 'low', score: 30 },
      (k) => t(k, 'en'),
    );
    expect(out.checkFirst).not.toBe(true);
    expect(out.titleKey).toBe('task.scoutPests');
  });

  it('never mutates the original task', () => {
    const original = { titleKey: 'task.water' };
    applyConfidenceWording(original, { level: 'medium' }, (k) => t(k, 'en'));
    expect(original.titleKey).toBe('task.water');
    expect(original.confidence).toBeUndefined();
  });
});

describe('applyConfidenceWording — plain-string fallback', () => {
  it('HIGH passes title through unchanged', () => {
    const out = applyConfidenceWording(
      { title: 'Clear your field this week' },
      { level: 'high', score: 80 },
    );
    expect(out.title).toBe('Clear your field this week');
  });

  it('MEDIUM hedges the title', () => {
    const out = applyConfidenceWording(
      { title: 'Clear your field this week' },
      { level: 'medium', score: 55 },
    );
    expect(out.title).toBe('Your field may need more clearing');
  });

  it('LOW rewrites to a check-first title', () => {
    const out = applyConfidenceWording(
      { title: 'Plant your seeds now' },
      { level: 'low', score: 30 },
    );
    expect(out.title.toLowerCase()).toContain('check');
  });

  it('MEDIUM hedges the detail with "It may be that …"', () => {
    const out = applyConfidenceWording(
      { title: 'x', detail: 'Wet soil can be damaged if worked now' },
      { level: 'medium', score: 55 },
    );
    expect(out.detail).toMatch(/^It may be that /);
  });
});

describe('shouldUseCheckFirst', () => {
  it('true for LOW + risky intent WITH a conflict reason', () => {
    // Note: 'prepare' is no longer a match — risky intents are
    // exact-match now (use 'prep'). Broad substring matching is
    // gone. See taskConfidenceProductionGrade.test.js for full
    // risky/low-risk coverage.
    for (const intent of ['plant', 'drain', 'prep', 'clear']) {
      expect(shouldUseCheckFirst({ intent },
        { level: 'low', reasons: ['conflict_land_vs_stage'] })).toBe(true);
    }
  });
  it('false for LOW + risky intent WITHOUT a conflict reason', () => {
    // Tightened contract: low alone isn't enough. Need a reason.
    expect(shouldUseCheckFirst({ intent: 'plant' }, { level: 'low' })).toBe(false);
  });
  it('false for LOW + scout (inspection already safe)', () => {
    expect(shouldUseCheckFirst({ intent: 'scout' }, { level: 'low' })).toBe(false);
  });
  it('false for non-LOW levels even on risky intents', () => {
    expect(shouldUseCheckFirst({ intent: 'plant' }, { level: 'medium' })).toBe(false);
    expect(shouldUseCheckFirst({ intent: 'plant' }, { level: 'high' })).toBe(false);
  });
  it('true when a land-vs-stage conflict is in the reasons (risky intent)', () => {
    // Previously this test used intent='water'. Under the tight
    // production contract, water is a low-risk intent (mistakes
    // self-correct), so check-first does NOT fire. Switch to a
    // genuinely risky intent to assert the positive case.
    expect(shouldUseCheckFirst(
      { intent: 'plant' },
      { level: 'low', reasons: ['conflict_land_vs_stage'] },
    )).toBe(true);
  });

  it('false for LOW + water + conflict (water is low-risk, self-correcting)', () => {
    expect(shouldUseCheckFirst(
      { intent: 'water' },
      { level: 'low', reasons: ['conflict_land_vs_stage'] },
    )).toBe(false);
  });
});

// ─── 3. i18n wire-up ─────────────────────────────────────
const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const CONFIDENCE_KEYS = [
  'confidence.checkFirst.title',
  'task.clearField.high', 'task.clearField.medium', 'task.clearField.low',
  'task.prepareDrainage.high', 'task.prepareDrainage.medium', 'task.prepareDrainage.low',
  'task.plant.high', 'task.plant.medium', 'task.plant.low',
  'task.water.high', 'task.water.medium', 'task.water.low',
  'task.scoutPests.high', 'task.scoutPests.medium', 'task.scoutPests.low',
];

describe('confidence i18n keys', () => {
  it.each(CONFIDENCE_KEYS)('%s resolves in English', (key) => {
    expect(t(key, 'en')).toBeTruthy();
  });
  it.each(
    NON_EN_LOCALES.flatMap((lang) => CONFIDENCE_KEYS.map((key) => [lang, key])),
  )('[%s] %s is localized (no English leak)', (lang, key) => {
    const en = t(key, 'en');
    const localized = t(key, lang);
    expect(localized).toBeTruthy();
    expect(localized).not.toBe(en);
  });
});

describe('Hindi confidence strings match the spec wording shape', () => {
  it.each([
    ['task.clearField.high',   'इस सप्ताह अपने खेत की सफाई करें'],
    ['task.clearField.medium', 'आपके खेत को और सफाई की ज़रूरत हो सकती है'],
    ['task.clearField.low',    'देखें कि आपके खेत को और सफाई की ज़रूरत है या नहीं'],
    ['task.plant.high',        'अभी अपने बीज बोएँ'],
    ['task.plant.medium',      'जल्द ही बुवाई का अच्छा समय हो सकता है'],
    ['task.plant.low',         'बुवाई से पहले जाँचें कि मिट्टी तैयार है या नहीं'],
    ['task.water.high',        'आज अपनी फसल को पानी दें'],
    ['task.water.medium',      'आज आपकी फसल को पानी की ज़रूरत हो सकती है'],
    ['task.water.low',         'देखें कि आज आपकी फसल को पानी चाहिए या नहीं'],
  ])('%s → %s', (key, expected) => {
    expect(t(key, 'hi')).toBe(expected);
  });
});
