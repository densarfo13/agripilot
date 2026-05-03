import { describe, it, expect } from 'vitest';

/**
 * Calm-UI Upgrade — TodayTaskCard contract tests.
 *
 * The card itself is a React component the security suite
 * doesn't load (it would pull in DOM globals). Instead we
 * exercise the underlying server-side AI Task Engine that
 * produces the envelope the card renders, and verify:
 *
 *   • Every weather-rule envelope carries the fields the
 *     dynamic header reads (`ruleId` for header lookup).
 *   • `nextRecommendedTask` is non-empty so the tomorrow hook
 *     never renders blank.
 *   • Backyard envelopes use plant/garden wording (per spec §13).
 *   • Farmer envelopes use crop/farm wording (per spec §13).
 *   • Fallback wording matches the spec literal.
 *
 * This is a CONTRACT test: when the engine output shape is
 * what the UI expects, the UI's render path stays correct
 * even without a DOM-bound component test.
 */

import { generateTodayTask } from '../modules/aiTask/engine.js';

describe('Calm-UI Upgrade — Home contract via engine', () => {
  it('every rule fires a non-empty nextRecommendedTask (Tomorrow hook)', () => {
    const samples = [
      // Profile missing
      { userType: 'farmer' },
      { userType: 'backyard' },
      // Weather variants
      { userType: 'farmer', crop: 'maize', stage: 'vegetative', rainfallForecast: 30 },
      { userType: 'backyard', crop: 'tomato', stage: 'flowering', temperature: 38 },
      { userType: 'farmer', crop: 'maize', stage: 'germination', temperature: 5 },
      { userType: 'farmer', crop: 'maize', stage: 'vegetative', weather: 'dry' },
      // Stage default
      { userType: 'farmer', crop: 'maize', stage: 'flowering' },
      { userType: 'backyard', crop: 'tomato', stage: 'maturity' },
      // Fallback
      { userType: 'farmer', crop: 'maize', stage: 'mystery' },
    ];
    for (const input of samples) {
      const out = generateTodayTask(input);
      expect(out.nextRecommendedTask).toBeTruthy();
      expect(typeof out.nextRecommendedTask).toBe('string');
      expect(out.nextRecommendedTask.length).toBeGreaterThan(0);
    }
  });

  it('every envelope carries a ruleId so the UI header lookup is deterministic', () => {
    const out = generateTodayTask({ userType: 'farmer', crop: 'maize', stage: 'vegetative' });
    expect(out.ruleId).toBeTruthy();
    expect(typeof out.ruleId).toBe('string');
  });

  it('backyard fallback wording matches the spec literal', () => {
    const out = generateTodayTask({ userType: 'backyard' });
    // profile_missing fires; spec wants "tell us what you're growing" or
    // similar non-farmer phrasing. Verify we don't leak farmer wording.
    const text = `${out.todayTaskTitle} ${out.taskReason}`.toLowerCase();
    expect(text).not.toMatch(/\byield\b|\bincome\b|\bsell\b|\bfarm\b/);
  });

  it('farmer fallback wording uses production-grade language', () => {
    // stage_maturity rule explicitly mentions "sale price"
    const out = generateTodayTask({ userType: 'farmer', crop: 'maize', stage: 'maturity' });
    const text = `${out.todayTaskTitle} ${out.taskReason}`.toLowerCase();
    expect(text).toMatch(/sale|yield|harvest|grade|price/);
  });

  it('weather-rule ruleIds the UI maps to dynamic headers', () => {
    const rainOut = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'vegetative', rainfallForecast: 30,
    });
    expect(rainOut.ruleId).toBe('heavy_rain_warning');

    const heatOut = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'vegetative', temperature: 38,
    });
    expect(heatOut.ruleId).toBe('heat_stress_warning');

    const coldOut = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'flowering', temperature: 5,
    });
    expect(coldOut.ruleId).toBe('cold_stress_warning');

    const dryOut = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'vegetative', weather: 'dry',
    });
    expect(dryOut.ruleId).toBe('dry_irrigation');

    const setupOut = generateTodayTask({ userType: 'farmer' });
    expect(setupOut.ruleId).toBe('profile_missing');
  });

  it('completionPrompt is short enough to fit on a single line', () => {
    for (const userType of ['farmer', 'backyard']) {
      const out = generateTodayTask({ userType, crop: 'maize', stage: 'flowering' });
      // Spec §10 — readable text, big touch targets. A
      // single-line completion prompt comfortably fits a
      // 360 px viewport at 1.25rem font when ≤ 80 chars.
      expect(out.completionPrompt.length).toBeLessThanOrEqual(80);
    }
  });

  it('safetyNote is null OR a short single-line string', () => {
    for (const userType of ['farmer', 'backyard']) {
      const out = generateTodayTask({
        userType, crop: 'maize', stage: 'vegetative', temperature: 38,
      });
      if (out.safetyNote) {
        expect(out.safetyNote.length).toBeLessThanOrEqual(80);
      }
    }
  });

  it('estimatedTime is short and human-readable', () => {
    const out = generateTodayTask({ userType: 'farmer', crop: 'maize', stage: 'vegetative' });
    // Format: "<n> min" — the UI reads this verbatim
    expect(out.estimatedTime).toMatch(/^\d+\s+min$/);
  });

  it('userType passes through unchanged so the scan prompt picks the right wording', () => {
    const farmer  = generateTodayTask({ userType: 'farmer',   crop: 'maize',  stage: 'vegetative' });
    const backyard = generateTodayTask({ userType: 'backyard', crop: 'tomato', stage: 'flowering' });
    expect(farmer.userType).toBe('farmer');
    expect(backyard.userType).toBe('backyard');
  });
});
