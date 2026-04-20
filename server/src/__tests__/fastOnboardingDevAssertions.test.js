/**
 * fastOnboardingDevAssertions.test.js — contract for the
 * centralized Section-19 dev assertions.
 *
 * Notes on environment:
 *   • Production-silence is verified manually via a node eval
 *     (vitest's env stubbing doesn't consistently propagate to
 *     already-imported modules). Tests below verify the dev-mode
 *     decision logic — the meaningful half of the contract.
 *   • Every assertion is a pure function with no side effects
 *     beyond console.warn, so tests just spy on console.warn.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  assertSingleDominantCard,
  assertHomeHasWhy,
  assertCountryPresent,
  assertCheckFirstHasReason,
  assertNotDirectOnStale,
  assertLocationConfirmed,
  assertHeaderFromStateEngine,
  assertNotBothOnboardingRoutes,
  assertNoEnglishLeakInHindi,
} from '../../../src/utils/fastOnboarding/devAssertions.js';

const TAG = '[farroway.firstTimeRouting]';

let warnSpy;
beforeEach(() => {
  globalThis.window = globalThis.window || {};
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

// ─── assertSingleDominantCard ────────────────────────────────
describe('assertSingleDominantCard', () => {
  it('silent when count <= 1', () => {
    assertSingleDominantCard(0);
    assertSingleDominantCard(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns on 2+ dominant cards', () => {
    assertSingleDominantCard(2, { where: 'Home' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [tag, reason] = warnSpy.mock.calls[0];
    expect(tag).toBe(TAG);
    expect(reason).toMatch(/more than one dominant/i);
  });
});

// ─── assertHomeHasWhy ────────────────────────────────────────
describe('assertHomeHasWhy', () => {
  it('silent when payload has non-empty why', () => {
    assertHomeHasWhy({ why: 'Rain expected in 2 days' });
    assertHomeHasWhy({ whyLine: 'Drains fastest now' });
    assertHomeHasWhy({ reason: 'Stage is land_prep' });
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns when why is blank or missing', () => {
    assertHomeHasWhy({});
    assertHomeHasWhy({ why: '' });
    assertHomeHasWhy({ why: '   ' });
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });
  it('silent when payload is null/invalid', () => {
    assertHomeHasWhy(null);
    assertHomeHasWhy(undefined);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ─── assertCountryPresent ────────────────────────────────────
describe('assertCountryPresent', () => {
  it('silent when country is present', () => {
    assertCountryPresent('GH');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns when country is empty / null / whitespace', () => {
    assertCountryPresent('');
    assertCountryPresent(null);
    assertCountryPresent('   ');
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });
});

// ─── assertCheckFirstHasReason ───────────────────────────────
describe('assertCheckFirstHasReason', () => {
  it('silent when not using check-first', () => {
    assertCheckFirstHasReason(false, null);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('silent when check-first IS backed by a reason', () => {
    assertCheckFirstHasReason(true, 'conflict_weather_vs_land');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns when check-first has no reason', () => {
    assertCheckFirstHasReason(true, null);
    assertCheckFirstHasReason(true, '');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

// ─── assertNotDirectOnStale ──────────────────────────────────
describe('assertNotDirectOnStale', () => {
  it('silent on fresh data regardless of tone', () => {
    assertNotDirectOnStale('fresh', 'direct');
    assertNotDirectOnStale('fresh', 'certain');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('silent on stale with softened tone', () => {
    assertNotDirectOnStale('stale', 'softened');
    assertNotDirectOnStale('very_stale', 'cautious');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns on stale with direct/certain tone', () => {
    assertNotDirectOnStale('stale', 'direct');
    assertNotDirectOnStale('very_stale', 'certain');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

// ─── assertLocationConfirmed ─────────────────────────────────
describe('assertLocationConfirmed', () => {
  it('silent on manual selection', () => {
    assertLocationConfirmed('manual', false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('silent on detect + confirmed', () => {
    assertLocationConfirmed('detect', true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns on detect WITHOUT confirm', () => {
    assertLocationConfirmed('detect', false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][1]).toMatch(/auto-detect committed without confirmation/i);
  });
});

// ─── assertHeaderFromStateEngine ─────────────────────────────
describe('assertHeaderFromStateEngine', () => {
  it('silent when header came from the state engine', () => {
    assertHeaderFromStateEngine('state_engine');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns on ad-hoc header source', () => {
    assertHeaderFromStateEngine('hardcoded');
    assertHeaderFromStateEngine(null);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

// ─── assertNotBothOnboardingRoutes ───────────────────────────
describe('assertNotBothOnboardingRoutes', () => {
  it('silent when only one path is active', () => {
    assertNotBothOnboardingRoutes(true, false);
    assertNotBothOnboardingRoutes(false, true);
    assertNotBothOnboardingRoutes(false, false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns when BOTH paths are active simultaneously', () => {
    assertNotBothOnboardingRoutes(true, true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── assertNoEnglishLeakInHindi ──────────────────────────────
describe('assertNoEnglishLeakInHindi', () => {
  it('silent on non-Hindi locales even if text is English', () => {
    assertNoEnglishLeakInHindi('en', 'Continue');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('silent on Hindi locale when text is Devanagari', () => {
    assertNoEnglishLeakInHindi('hi', 'जारी रखें');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('silent on very short / empty strings (too noisy otherwise)', () => {
    assertNoEnglishLeakInHindi('hi', '—');
    assertNoEnglishLeakInHindi('hi', '');
    assertNoEnglishLeakInHindi('hi', null);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns on Hindi locale when the visible text is pure English', () => {
    assertNoEnglishLeakInHindi('hi', 'Set up Farroway');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
