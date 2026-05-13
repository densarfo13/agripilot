/**
 * closureGapModules.test.js — pins the two genuine gaps closed in
 * this turn: safeAsset (spec §1) + progressiveOnboardingConfig
 * (spec §18).
 */

import { describe, it, expect } from 'vitest';

import { safeAsset, isSafeAssetPath } from '../../../src/lib/safeAsset.js';
import {
  getProgressiveOnboardingFlow,
  requiredStepCount,
  nextOnboardingStep,
  isOnboardingComplete,
  onboardingProgress,
} from '../../../src/lib/progressiveOnboardingConfig.js';

// ─── safeAsset ──────────────────────────────────────────────────

describe('safeAsset — exception-free asset URL resolver', () => {
  it('returns trimmed string for a valid relative path', () => {
    expect(safeAsset('/assets/realism/farm/pepper-closeup.jpeg'))
      .toBe('/assets/realism/farm/pepper-closeup.jpeg');
  });

  it('returns null on null / undefined / empty / non-string', () => {
    expect(safeAsset(null)).toBeNull();
    expect(safeAsset(undefined)).toBeNull();
    expect(safeAsset('')).toBeNull();
    expect(safeAsset('   ')).toBeNull();
    expect(safeAsset(42)).toBeNull();
    expect(safeAsset({})).toBeNull();
  });

  it('returns fallback when input is invalid', () => {
    expect(safeAsset(null, '/fallback.jpeg')).toBe('/fallback.jpeg');
    expect(safeAsset('', '/fallback.jpeg')).toBe('/fallback.jpeg');
  });

  it('blocks dangerous protocols', () => {
    expect(safeAsset('javascript:alert(1)')).toBeNull();
    expect(safeAsset('vbscript:foo')).toBeNull();
    expect(safeAsset('file:///etc/passwd')).toBeNull();
    expect(safeAsset('JAVASCRIPT:alert(1)')).toBeNull();   // case-insensitive
  });

  it('allows data:image/* but blocks other data: URIs', () => {
    expect(safeAsset('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(safeAsset('data:text/html,<script>')).toBeNull();
  });

  it('blocks path traversal', () => {
    expect(safeAsset('/assets/../../etc/passwd')).toBeNull();
    expect(safeAsset('../../secret.png')).toBeNull();
    expect(safeAsset('a/b/../../c')).toBeNull();
  });

  it('allows absolute http(s) URLs', () => {
    expect(safeAsset('https://cdn.farroway.app/logo.jpg'))
      .toBe('https://cdn.farroway.app/logo.jpg');
    expect(safeAsset('http://localhost:3000/img.png'))
      .toBe('http://localhost:3000/img.png');
  });

  it('falls through to null when both input and fallback are unsafe', () => {
    expect(safeAsset('javascript:1', 'javascript:2')).toBeNull();
  });

  it('never throws on garbage input', () => {
    expect(() => safeAsset(null)).not.toThrow();
    expect(() => safeAsset(undefined, undefined)).not.toThrow();
    expect(() => safeAsset({ a: 1 })).not.toThrow();
  });

  it('isSafeAssetPath is the boolean variant', () => {
    expect(isSafeAssetPath('/ok.jpg')).toBe(true);
    expect(isSafeAssetPath('javascript:alert(1)')).toBe(false);
    expect(isSafeAssetPath(null)).toBe(false);
  });
});

// ─── progressiveOnboardingConfig ────────────────────────────────

describe('progressiveOnboardingConfig — declarative short flow (§18)', () => {
  it('farmer flow has exactly 5 steps total (4 required + 1 optional)', () => {
    const flow = getProgressiveOnboardingFlow('farmer');
    expect(flow).toHaveLength(5);
    expect(flow.filter((s) => s.required).length).toBe(4);
    expect(flow.filter((s) => !s.required).length).toBe(1);
  });

  it('gardener flow has exactly 5 steps total (4 required + 1 optional)', () => {
    const flow = getProgressiveOnboardingFlow('gardener');
    expect(flow).toHaveLength(5);
    expect(flow.filter((s) => s.required).length).toBe(4);
  });

  it('farmer flow asks crop + farm name; gardener flow asks plant + setup', () => {
    const farmer = getProgressiveOnboardingFlow('farmer').map((s) => s.key);
    const gardener = getProgressiveOnboardingFlow('gardener').map((s) => s.key);
    expect(farmer).toContain('crop');
    expect(farmer).toContain('farmName');
    expect(gardener).toContain('plant');
    expect(gardener).toContain('gardenSetup');
    expect(gardener).not.toContain('crop');
    expect(gardener).not.toContain('farmName');
  });

  it('country + language are required + shared', () => {
    for (const userType of ['farmer', 'gardener']) {
      const flow = getProgressiveOnboardingFlow(userType);
      const country  = flow.find((s) => s.key === 'country');
      const language = flow.find((s) => s.key === 'language');
      expect(country).toBeDefined();
      expect(country.required).toBe(true);
      expect(language).toBeDefined();
      expect(language.required).toBe(true);
    }
  });

  it('location step is optional in both flows', () => {
    for (const userType of ['farmer', 'gardener']) {
      const loc = getProgressiveOnboardingFlow(userType).find((s) => s.key === 'location');
      expect(loc).toBeDefined();
      expect(loc.required).toBe(false);
    }
  });

  it('requiredStepCount is 4 (spec rule: 3-5 questions, immediate reveal after required)', () => {
    expect(requiredStepCount('farmer')).toBe(4);
    expect(requiredStepCount('gardener')).toBe(4);
  });

  it('nextOnboardingStep returns the first unanswered required step', () => {
    const next = nextOnboardingStep({}, 'farmer');
    expect(next.key).toBe('country');
  });

  it('nextOnboardingStep skips answered required steps', () => {
    const next = nextOnboardingStep({
      country: 'GH',
      language: 'en',
    }, 'farmer');
    expect(next.key).toBe('crop');
  });

  it('nextOnboardingStep returns null when ALL required answered (location not required)', () => {
    expect(nextOnboardingStep({
      country: 'GH',
      language: 'en',
      crop: 'tomato',
      farmName: 'North Field',
    }, 'farmer')).toBeNull();
  });

  it('isOnboardingComplete fires reveal after 4 required answers (location skipped)', () => {
    expect(isOnboardingComplete({
      country: 'GH', language: 'en', crop: 'tomato', farmName: 'North',
    }, 'farmer')).toBe(true);

    expect(isOnboardingComplete({
      country: 'GH', language: 'en', crop: 'tomato',
    }, 'farmer')).toBe(false);
  });

  it('onboardingProgress returns 0..1 over required steps', () => {
    expect(onboardingProgress({}, 'farmer')).toBe(0);
    expect(onboardingProgress({ country: 'GH', language: 'en' }, 'farmer')).toBe(0.5);
    expect(onboardingProgress({
      country: 'GH', language: 'en', crop: 'tomato', farmName: 'N',
    }, 'farmer')).toBe(1);
  });

  it('treats unknown userType as farmer (safe default)', () => {
    expect(requiredStepCount('alien')).toBe(4);
    expect(getProgressiveOnboardingFlow('alien').map((s) => s.key))
      .toContain('crop');
  });

  it('location answered with valid lat/lng counts as answered', () => {
    // Even though location is optional, the helpers should treat
    // a valid object as answered for progress purposes.
    expect(nextOnboardingStep({
      country: 'GH', language: 'en', crop: 'tomato', farmName: 'N',
      location: { lat: 5.6, lng: -0.18 },
    }, 'farmer')).toBeNull();
  });

  it('never throws on null answers', () => {
    expect(() => nextOnboardingStep(null, 'farmer')).not.toThrow();
    expect(nextOnboardingStep(null, 'farmer').key).toBe('country');
  });
});
