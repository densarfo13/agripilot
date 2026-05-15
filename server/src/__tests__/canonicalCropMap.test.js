/**
 * canonicalCropMap.test.js — Intelligence Core vNext §3.
 *
 * canonicalCropMap.js is the crop TAXONOMY layer: canonical id +
 * aliases + marketplace category + scan categories + growth stages.
 * It is the single answer to "what crop is this, by any name".
 *
 * Coverage:
 *   - the registry covers the spec's crop list, frozen + well-shaped
 *   - normalizeCropId resolves aliases / plurals / spellings
 *   - corn normalises to maize (same plant, one canonical id)
 *   - unknown input → null, never throws
 *   - getCropLabel (agricultureRegistry) now resolves aliases
 */

import { describe, it, expect } from 'vitest';
import {
  CANONICAL_CROPS,
  normalizeCropId,
  getCanonicalCrop,
  isKnownCrop,
  listCanonicalCropIds,
  getCropMarketplaceCategory,
} from '../../../src/core/agriculture/canonicalCropMap.js';
import { getCropLabel } from '../../../src/core/intelligence/agricultureRegistry.js';

// ─── 1. Registry shape ─────────────────────────────────────

describe('canonicalCropMap — registry', () => {
  it('covers the core crops and is frozen', () => {
    const ids = listCanonicalCropIds();
    for (const id of ['pepper', 'tomato', 'maize', 'cassava', 'rice',
      'okra', 'onion', 'lettuce', 'cabbage', 'cucumber', 'carrot',
      'potato', 'sweet_potato', 'banana', 'mango', 'avocado', 'citrus',
      'beans', 'soybean', 'wheat', 'spinach', 'herbs']) {
      expect(ids).toContain(id);
    }
    expect(Object.isFrozen(CANONICAL_CROPS)).toBe(true);
  });

  it('every entry has the documented taxonomy fields', () => {
    for (const id of listCanonicalCropIds()) {
      const c = CANONICAL_CROPS[id];
      expect(c.id).toBe(id);
      expect(Array.isArray(c.aliases)).toBe(true);
      expect(typeof c.marketplaceCategory).toBe('string');
      expect(Array.isArray(c.scanCategories)).toBe(true);
      expect(Array.isArray(c.stages)).toBe(true);
      expect(c.scanCategories).toContain('healthy');
    }
  });
});

// ─── 2. Normalisation ──────────────────────────────────────

describe('canonicalCropMap — normalizeCropId', () => {
  it('resolves a canonical id to itself', () => {
    expect(normalizeCropId('pepper')).toBe('pepper');
  });

  it('resolves corn to maize (same plant, one canonical id)', () => {
    expect(normalizeCropId('corn')).toBe('maize');
    expect(normalizeCropId('Corn')).toBe('maize');
  });

  it('resolves aliases, plurals and spellings', () => {
    expect(normalizeCropId('chilli')).toBe('pepper');
    expect(normalizeCropId('capsicum')).toBe('pepper');
    expect(normalizeCropId('yuca')).toBe('cassava');
    expect(normalizeCropId('tomatoes')).toBe('tomato');
    expect(normalizeCropId('Sweet Potato')).toBe('sweet_potato');
    expect(normalizeCropId('sweet_potato')).toBe('sweet_potato');
    expect(normalizeCropId('sweetpotato')).toBe('sweet_potato');
  });

  it('returns null for an unknown crop and never throws', () => {
    expect(normalizeCropId('dragonfruit')).toBeNull();
    expect(normalizeCropId('')).toBeNull();
    expect(() => normalizeCropId(null)).not.toThrow();
    expect(() => normalizeCropId(42)).not.toThrow();
    expect(normalizeCropId(42)).toBeNull();
  });
});

// ─── 3. Lookups ────────────────────────────────────────────

describe('canonicalCropMap — lookups', () => {
  it('getCanonicalCrop returns the entry for any alias', () => {
    expect(getCanonicalCrop('corn').id).toBe('maize');
    expect(getCanonicalCrop('nonsense')).toBeNull();
  });

  it('isKnownCrop is true for aliases, false for unknowns', () => {
    expect(isKnownCrop('chilli')).toBe(true);
    expect(isKnownCrop('moon cheese')).toBe(false);
  });

  it('getCropMarketplaceCategory classifies crops', () => {
    expect(getCropMarketplaceCategory('maize')).toBe('grain');
    expect(getCropMarketplaceCategory('mango')).toBe('fruit');
    expect(getCropMarketplaceCategory('beans')).toBe('legume');
    expect(getCropMarketplaceCategory('pepper')).toBe('vegetable');
  });
});

// ─── 4. Registry wiring ────────────────────────────────────

describe('agricultureRegistry — getCropLabel resolves aliases', () => {
  it('an alias and its canonical id give the same label', () => {
    expect(getCropLabel('corn', 'fr')).toBe(getCropLabel('maize', 'fr'));
    expect(getCropLabel('chilli', 'en')).toBe(getCropLabel('pepper', 'en'));
  });
});
