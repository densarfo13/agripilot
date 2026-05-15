/**
 * getIntelligenceSnapshot.test.js — Intelligence Core vNext.
 *
 * getIntelligenceSnapshot.js is THE canonical intelligence entry
 * point — one import surface that re-exports + lightly composes the
 * already-built engines (unifiedIntelligence + agricultureRegistry).
 * It must NOT be a competing implementation.
 *
 * Coverage:
 *   - getIntelligenceSnapshot() returns the unified snapshot shape
 *   - it IS the unified snapshot (canonical name, one implementation)
 *   - the localized-label getters resolve single-language strings
 *   - getTodayRecommendation / getRiskSummary derive cleanly
 *   - everything is resilient (never throws)
 *   - check:intelligence guards the canonical contract
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  getIntelligenceSnapshot,
  getLocalizedCropName,
  getLocalizedTaskText,
  getWeatherGuidance,
  getScanGuidance,
  getTodayRecommendation,
  getRiskSummary,
  getAgricultureVocabulary,
} from '../../../src/core/intelligence/getIntelligenceSnapshot.js';
import { getUnifiedIntelligence } from '../../../src/core/intelligence/unifiedIntelligence.js';

const ROOT = resolve(process.cwd(), '..');

// ─── 1. Canonical snapshot ─────────────────────────────────

describe('getIntelligenceSnapshot — canonical snapshot', () => {
  it('returns the unified snapshot shape', () => {
    const s = getIntelligenceSnapshot();
    expect(s).toBeTruthy();
    expect(s.geo).toBeTruthy();
    expect(s.farm).toBeTruthy();
    expect(s.intelligence).toBeTruthy();
    expect('weather' in s).toBe(true);
    expect('agriculture' in s).toBe(true);
    expect(typeof s.connectivity).toBe('string');
  });

  it('is the SAME snapshot as getUnifiedIntelligence (one implementation)', () => {
    const a = getIntelligenceSnapshot({ nowMs: 1700000000000 });
    const b = getUnifiedIntelligence({ nowMs: 1700000000000 });
    // identical structure for an identical clock
    expect(JSON.stringify(a.geo)).toBe(JSON.stringify(b.geo));
    expect(JSON.stringify(a.farm)).toBe(JSON.stringify(b.farm));
    expect(a.readAt).toBe(b.readAt);
  });

  it('never throws on garbage options', () => {
    expect(() => getIntelligenceSnapshot(42)).not.toThrow();
    expect(() => getIntelligenceSnapshot(null)).not.toThrow();
  });
});

// ─── 2. Localized label facade ─────────────────────────────

describe('getIntelligenceSnapshot — localized label getters', () => {
  it('getLocalizedCropName resolves in any language', () => {
    expect(typeof getLocalizedCropName('pepper', 'fr')).toBe('string');
    expect(getLocalizedCropName('pepper', 'fr').length).toBeGreaterThan(0);
  });

  it('task / weather / scan getters return non-empty strings', () => {
    expect(getLocalizedTaskText('task.remove_weeds', 'en').length).toBeGreaterThan(0);
    expect(getWeatherGuidance('heavyRain', 'en').length).toBeGreaterThan(0);
    expect(getScanGuidance('healthyPlant', 'en').length).toBeGreaterThan(0);
  });

  it('getAgricultureVocabulary is re-exported + language-bound', () => {
    const v = getAgricultureVocabulary('sw');
    expect(v.language).toBe('sw');
    expect(typeof v.cropLabel).toBe('function');
  });
});

// ─── 3. Derived views ──────────────────────────────────────

describe('getIntelligenceSnapshot — derived views', () => {
  it('getTodayRecommendation returns the task/recommendation/alert trio', () => {
    const r = getTodayRecommendation();
    expect(r).toBeTruthy();
    expect('task' in r).toBe(true);
    expect('recommendation' in r).toBe(true);
    expect('alert' in r).toBe(true);
  });

  it('getRiskSummary returns count / risks / healthScore / topRisk', () => {
    const r = getRiskSummary();
    expect(typeof r.count).toBe('number');
    expect(Array.isArray(r.risks)).toBe(true);
    expect('healthScore' in r).toBe(true);
    expect('topRisk' in r).toBe(true);
  });

  it('derived views never throw on garbage options', () => {
    expect(() => getTodayRecommendation('x')).not.toThrow();
    expect(() => getRiskSummary(null)).not.toThrow();
  });
});

// ─── 4. Build guard ────────────────────────────────────────

describe('check:intelligence — guards the canonical contract', () => {
  it('passes and confirms the canonical entry point', () => {
    let stdout;
    try {
      stdout = execSync('node scripts/check-intelligence.mjs', {
        cwd: ROOT, encoding: 'utf8',
      });
    } catch (err) {
      throw new Error('check:intelligence FAILED:\n'
        + ((err.stdout || '') + (err.stderr || '')));
    }
    expect(stdout).toMatch(/\[check:intelligence\] PASS/);
    expect(stdout).toMatch(/canonical entry point exposes 7 getters/);
  });
});
