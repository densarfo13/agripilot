/**
 * cropDiagnosisGuide.test.js — pins the Plantix-inspired
 * crop-specific guidance contract.
 *
 *   1. Coverage: all 7 spec-priority crops have at least one entry
 *   2. Calm wording: zero banned words across the entire registry
 *   3. Safety: no specific chemical / pesticide names anywhere
 *   4. Honest fallback: uncurated combos return null (never fake)
 *   5. Aliases work: 'tomatoes' / 'corn' / 'chili' resolve cleanly
 *   6. Every entry has the canonical 3-field shape
 */

import { describe, it, expect } from 'vitest';
import {
  getCropGuidance,
  isPriorityCrop,
  getSupportedCropKeys,
  getCropAliases,
} from '../../../src/lib/cropDiagnosisGuide.js';

const SPEC_PRIORITY_CROPS = ['tomato', 'maize', 'pepper', 'cassava', 'rice', 'onion', 'cocoa'];

// ─── Coverage ──────────────────────────────────────────────────

describe('coverage — every priority crop has guidance', () => {
  for (const crop of SPEC_PRIORITY_CROPS) {
    it(`${crop} has at least one curated entry`, () => {
      // Try every common category — at least one must match.
      const found = ['fungal', 'pest', 'nutrient', 'water', 'heat', 'leaf']
        .some((cat) => getCropGuidance(crop, cat) !== null);
      expect(found).toBe(true);
    });
  }

  it('every priority crop covers BOTH fungal AND pest categories', () => {
    for (const crop of SPEC_PRIORITY_CROPS) {
      expect(getCropGuidance(crop, 'fungal')).not.toBeNull();
      expect(getCropGuidance(crop, 'pest')).not.toBeNull();
    }
  });

  it('isPriorityCrop returns true for every spec crop + common aliases', () => {
    for (const crop of SPEC_PRIORITY_CROPS) {
      expect(isPriorityCrop(crop)).toBe(true);
    }
    // Aliases
    expect(isPriorityCrop('tomatoes')).toBe(true);
    expect(isPriorityCrop('corn')).toBe(true);
    expect(isPriorityCrop('chili')).toBe(true);
    expect(isPriorityCrop('manioc')).toBe(true);
  });

  it('getSupportedCropKeys exposes the canonical crop key set', () => {
    const keys = getSupportedCropKeys();
    for (const c of SPEC_PRIORITY_CROPS) {
      expect(keys).toContain(c);
    }
    expect(keys).toContain('leafy_green');
    expect(keys).toContain('cucurbit');
    expect(keys).toContain('okra');
  });
});

// ─── Honest fallback — never fabricate ─────────────────────────

describe('honest fallback — null for uncurated combos', () => {
  it('returns null for an unknown crop', () => {
    expect(getCropGuidance('saffron', 'pest')).toBeNull();
    expect(getCropGuidance('vanilla', 'fungal')).toBeNull();
  });

  it('returns null for an unknown category', () => {
    expect(getCropGuidance('tomato', 'martian')).toBeNull();
  });

  it('returns null on null / garbage input (never throws)', () => {
    expect(() => getCropGuidance(null, null)).not.toThrow();
    expect(getCropGuidance(null, null)).toBeNull();
    expect(getCropGuidance({}, [])).toBeNull();
  });

  it('returns null for a crop on the list with NO entry for the queried category', () => {
    // Cocoa is on the priority list but has no curated 'nutrient' entry.
    // The guide returns null so the caller falls back to the generic
    // safety phrase — never fabricates a "cocoa nutrient" tip.
    expect(getCropGuidance('cocoa', 'nutrient')).toBeNull();
  });
});

// ─── Aliases ──────────────────────────────────────────────────

describe('crop aliases', () => {
  it('aliases resolve to the canonical crop', () => {
    expect(getCropGuidance('tomatoes', 'fungal'))
      .toBe(getCropGuidance('tomato', 'fungal'));
    expect(getCropGuidance('corn', 'pest'))
      .toBe(getCropGuidance('maize', 'pest'));
    expect(getCropGuidance('chili', 'fungal'))
      .toBe(getCropGuidance('pepper', 'fungal'));
    expect(getCropGuidance('chilli', 'fungal'))
      .toBe(getCropGuidance('pepper', 'fungal'));
    expect(getCropGuidance('manioc', 'pest'))
      .toBe(getCropGuidance('cassava', 'pest'));
  });

  it('handles case-insensitivity', () => {
    expect(getCropGuidance('TOMATO', 'FUNGAL')).not.toBeNull();
    expect(getCropGuidance('Maize', 'Pest')).not.toBeNull();
  });

  it('cucurbit + leafy_green aliases share entries', () => {
    expect(getCropGuidance('cucumber', 'pest')).not.toBeNull();
    expect(getCropGuidance('zucchini', 'fungal')).not.toBeNull();
    expect(getCropGuidance('lettuce', 'pest')).not.toBeNull();
    expect(getCropGuidance('kale', 'fungal')).not.toBeNull();
  });
});

// ─── Canonical shape ───────────────────────────────────────────

describe('canonical 3-field entry shape', () => {
  it('every entry returns { whereToCheck, whatToWatchFor, calmTip }', () => {
    for (const crop of SPEC_PRIORITY_CROPS) {
      for (const cat of ['fungal', 'pest', 'nutrient', 'water', 'heat', 'leaf']) {
        const e = getCropGuidance(crop, cat);
        if (e === null) continue;
        expect(typeof e.whereToCheck).toBe('string');
        expect(typeof e.whatToWatchFor).toBe('string');
        expect(typeof e.calmTip).toBe('string');
        expect(e.whereToCheck.length).toBeGreaterThan(0);
        expect(e.whatToWatchFor.length).toBeGreaterThan(0);
        expect(e.calmTip.length).toBeGreaterThan(0);
      }
    }
  });

  it('entries are frozen — UI cannot mutate canonical strings', () => {
    const e = getCropGuidance('tomato', 'fungal');
    expect(Object.isFrozen(e)).toBe(true);
  });
});

// ─── Safety + calm wording enforcement ────────────────────────

describe('safety enforcement — never names a specific pesticide', () => {
  it('zero entries mention specific chemical / pesticide names', () => {
    const BANNED_CHEMICALS = [
      'captan', 'chlorothalonil', 'mancozeb', 'imidacloprid',
      'permethrin', 'deltamethrin', 'glyphosate', 'pyrethrin',
      'malathion', 'carbaryl', 'metalaxyl', 'azoxystrobin',
    ];

    for (const crop of SPEC_PRIORITY_CROPS.concat(['leafy_green', 'cucurbit', 'okra'])) {
      for (const cat of ['fungal', 'pest', 'nutrient', 'water', 'heat', 'leaf']) {
        const e = getCropGuidance(crop, cat);
        if (!e) continue;
        const text = `${e.whereToCheck} ${e.whatToWatchFor} ${e.calmTip}`.toLowerCase();
        for (const banned of BANNED_CHEMICALS) {
          expect(text).not.toContain(banned);
        }
      }
    }
  });
});

describe('calm wording — zero banned words across registry', () => {
  it('no entry uses "confirmed" / "definitely" / "guaranteed" / "critical" / "danger"', () => {
    const BANNED = [
      /\bconfirmed\b/i,
      /\bdefinitely\b/i,
      /\bguaranteed\b/i,
      /\bcritical\b/i,
      /\bdangerous\b/i,
      /\bcatastrophic\b/i,
      /\bfatal\b/i,
    ];

    for (const crop of SPEC_PRIORITY_CROPS.concat(['leafy_green', 'cucurbit', 'okra'])) {
      for (const cat of ['fungal', 'pest', 'nutrient', 'water', 'heat', 'leaf']) {
        const e = getCropGuidance(crop, cat);
        if (!e) continue;
        const text = `${e.whereToCheck} ${e.whatToWatchFor} ${e.calmTip}`;
        for (const re of BANNED) {
          expect(text).not.toMatch(re);
        }
      }
    }
  });
});

describe('getCropAliases', () => {
  it('exposes the alias map as a defensive copy', () => {
    const a = getCropAliases();
    expect(a.tomatoes).toBe('tomato');
    a.tomatoes = 'mutated';
    const a2 = getCropAliases();
    expect(a2.tomatoes).toBe('tomato');   // proves it was a copy
  });
});
