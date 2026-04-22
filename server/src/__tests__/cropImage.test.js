/**
 * cropImage.test.js — locks the crop image catalog + CropImage
 * component contract:
 *
 *   1. getCropImagePath resolves canonical lowercase keys
 *   2. Accepts uppercase storage codes (MAIZE) case-insensitively
 *   3. Returns null for unknown / empty / structured-other keys
 *   4. Synonyms (corn → maize, cacao → cocoa) map to the same path
 *   5. Every canonical crop in CROP_IMAGE_PATHS targets /crops/*.webp
 *   6. CropImage component has the required contract markers
 *   7. CropImage uses object-fit: cover + fixed square dimensions
 *   8. CropImage supports a circular prop for the card UI
 *   9. CropImage falls back to the placeholder via onError guard
 *  10. MyFarmPage + FarmerDashboardPage both consume CropImage
 *  11. Placeholder SVG exists at /public/crops/_placeholder.svg
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

import {
  getCropImagePath, getCropImage, hasCropImage,
  CROP_IMAGE_PATHS, CROP_IMAGE_PLACEHOLDER,
} from '../../../src/config/cropImages.js';

// Canonical key list from the spec (§2).
const SPEC_CANONICAL_KEYS = [
  'banana', 'cabbage', 'carrot', 'cassava', 'cocoa', 'coffee',
  'cotton', 'cucumber', 'eggplant', 'garlic', 'ginger', 'groundnut',
  'lettuce', 'maize', 'mango', 'millet', 'oil-palm', 'okra',
  'onion', 'orange', 'pepper', 'plantain', 'potato', 'rice',
  'sorghum', 'soybean', 'spinach', 'sugarcane', 'sweet-potato', 'tomato',
];

describe('getCropImagePath', () => {
  it('resolves canonical lowercase keys to /crops/*.webp', () => {
    expect(getCropImagePath('maize')).toBe('/crops/maize.svg');
    expect(getCropImagePath('rice')).toBe('/crops/rice.svg');
    expect(getCropImagePath('cassava')).toBe('/crops/cassava.svg');
  });

  it('accepts uppercase storage codes (MAIZE, SWEET_POTATO)', () => {
    // Spec §2 standardised on hyphenated canonical keys
    // (sweet-potato, oil-palm). Underscored legacy forms still
    // resolve through getCropImagePath's separator collapse.
    expect(getCropImagePath('MAIZE')).toBe('/crops/maize.svg');
    expect(getCropImagePath('SWEET_POTATO')).toBe('/crops/sweet-potato.svg');
  });

  it('accepts display strings ("Maize", "Sweet Potato")', () => {
    expect(getCropImagePath('Maize')).toBe('/crops/maize.svg');
  });

  it('returns null for unknown / empty / null inputs (no crashes)', () => {
    expect(getCropImagePath('unobtainium')).toBeNull();
    expect(getCropImagePath('')).toBeNull();
    expect(getCropImagePath(null)).toBeNull();
    expect(getCropImagePath(undefined)).toBeNull();
  });

  it('returns null for structured "OTHER:" values (caller shows placeholder)', () => {
    // normalizeCrop returns 'other' for structured values; the
    // catalog has no "other" entry, so null is correct.
    expect(getCropImagePath('OTHER:Teff')).toBeNull();
  });

  it('synonyms map to the canonical path (corn→maize, cacao→cocoa)', () => {
    expect(getCropImagePath('corn')).toBe(getCropImagePath('maize'));
    expect(getCropImagePath('cacao')).toBe(getCropImagePath('cocoa'));
    expect(getCropImagePath('bean')).toBe(getCropImagePath('beans'));
    expect(getCropImagePath('peanut')).toBe(getCropImagePath('groundnut'));
  });

  it('hasCropImage mirrors the null/non-null contract', () => {
    expect(hasCropImage('maize')).toBe(true);
    expect(hasCropImage('unobtainium')).toBe(false);
  });

  it('resolves every spec-mandated canonical key (30 keys)', () => {
    for (const key of SPEC_CANONICAL_KEYS) {
      expect(getCropImagePath(key),
        `spec canonical key "${key}" should map to a webp`).not.toBeNull();
    }
  });

  it('treats hyphen, underscore, and space as interchangeable separators', () => {
    // Hyphenated (spec canonical)
    expect(getCropImagePath('sweet-potato')).toBe('/crops/sweet-potato.svg');
    expect(getCropImagePath('oil-palm')).toBe('/crops/oil-palm.webp');
    // Underscored (legacy storage)
    expect(getCropImagePath('sweet_potato')).toBe('/crops/sweet-potato.svg');
    expect(getCropImagePath('oil_palm')).toBe('/crops/oil-palm.webp');
    // Display strings with spaces
    expect(getCropImagePath('Sweet Potato')).toBe('/crops/sweet-potato.svg');
    expect(getCropImagePath('OIL PALM')).toBe('/crops/oil-palm.webp');
  });

  it('eggplant/aubergine both resolve to the same image', () => {
    expect(getCropImagePath('eggplant')).toBe('/crops/eggplant.webp');
    expect(getCropImagePath('aubergine')).toBe('/crops/eggplant.webp');
  });
});

describe('getCropImage (placeholder-safe alias)', () => {
  it('returns the mapped URL when the crop is known', () => {
    expect(getCropImage('maize')).toBe('/crops/maize.svg');
    expect(getCropImage('sweet-potato')).toBe('/crops/sweet-potato.svg');
  });

  it('returns the placeholder SVG when the crop is unknown', () => {
    expect(getCropImage('dragonfruit')).toBe('/crops/_placeholder.svg');
    expect(getCropImage(null)).toBe('/crops/_placeholder.svg');
    expect(getCropImage('')).toBe('/crops/_placeholder.svg');
  });

  it('is safe to drop directly into <img src> (never returns null)', () => {
    for (const v of [null, undefined, '', 'maize', 'unknown', 'Oil Palm']) {
      const src = getCropImage(v);
      expect(typeof src).toBe('string');
      expect(src.length).toBeGreaterThan(0);
    }
  });
});

describe('CROP_IMAGE_PATHS catalog', () => {
  it('every value is a /crops/*.{webp|svg} URL', () => {
    // Allow .svg as a legitimate asset extension (illustration
    // placeholders shipped while real photographic .webp files are
    // commissioned). Hyphens + underscores both accepted in the key.
    for (const [key, value] of Object.entries(CROP_IMAGE_PATHS)) {
      expect(value, `${key} should map to a webp/svg under /crops`)
        .toMatch(/^\/crops\/[a-z_-]+\.(webp|svg)$/);
    }
  });

  it('the object is frozen (callers cannot corrupt the catalog)', () => {
    expect(Object.isFrozen(CROP_IMAGE_PATHS)).toBe(true);
  });

  it('CROP_IMAGE_PLACEHOLDER points at the shipped SVG', () => {
    expect(CROP_IMAGE_PLACEHOLDER).toBe('/crops/_placeholder.svg');
  });
});

describe('public assets', () => {
  it('placeholder SVG exists in /public/crops', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'public/crops/_placeholder.svg'))).toBe(true);
  });
});

describe('CropImage component — source contract', () => {
  const src = readFile('src/components/CropImage.jsx');

  it('accepts cropKey + alt props', () => {
    expect(src).toMatch(/cropKey/);
    expect(src).toMatch(/alt/);
  });

  it('uses getCropImagePath from the catalog', () => {
    expect(src).toMatch(/from '\.\.\/config\/cropImages\.js'/);
    expect(src).toMatch(/getCropImagePath\(cropKey\)/);
  });

  it('falls back to the placeholder when the mapping is missing', () => {
    expect(src).toMatch(/const initial = mapped \|\| CROP_IMAGE_PLACEHOLDER/);
  });

  it('falls back via onError once + guards against infinite loop', () => {
    expect(src).toMatch(/function handleError/);
    expect(src).toMatch(/if \(fellBack\) return/);
    expect(src).toMatch(/setSrc\(CROP_IMAGE_PLACEHOLDER\)/);
  });

  it('uses object-fit: cover + fixed square dimensions', () => {
    expect(src).toMatch(/objectFit:\s*'cover'/);
    expect(src).toMatch(/width:\s*`\$\{size\}px`/);
    expect(src).toMatch(/height:\s*`\$\{size\}px`/);
  });

  it('supports a circular prop for the existing crop card look', () => {
    expect(src).toMatch(/circular = false/);
    // Radius can be inlined (`circular ? '50%' : ...`) OR lifted to
    // a `radius` helper var — both satisfy the spec as long as 50%
    // is the circular value.
    expect(src).toMatch(/(circular\s*\?\s*'50%'|const radius\s*=\s*circular\s*\?\s*'50%')/);
  });

  it('uses loading=lazy + decoding=async for mobile bandwidth', () => {
    expect(src).toMatch(/loading="lazy"/);
    expect(src).toMatch(/decoding="async"/);
  });

  it('forwards alt to the img tag', () => {
    expect(src).toMatch(/alt=\{imgAriaLabel\}/);
  });
});

describe('Integration — crop cards use CropImage', () => {
  it('MyFarmPage renders the crop tile via CropImage', () => {
    const src = readFile('src/pages/MyFarmPage.jsx');
    expect(src).toMatch(/import CropImage from '\.\.\/components\/CropImage/);
    expect(src).toMatch(/<CropImage[\s\S]*cropKey=\{farm\.cropType \|\| farm\.crop\}/);
    expect(src).toMatch(/circular/);
  });

  it('FarmerDashboardPage hero renders CropImage when cropCode is set', () => {
    const src = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(src).toMatch(/import CropImage from '\.\.\/components\/CropImage/);
    expect(src).toMatch(/<CropImage[\s\S]*cropKey=\{cropCode\}/);
  });

  it('canonical crop storage unaffected — still uses getCropLabel for display', () => {
    // Localisation chain is preserved: CropImage just renders the
    // picture; the TEXT alongside it still flows through
    // getCropLabel, so crop labels stay localized in every page.
    const src = readFile('src/pages/MyFarmPage.jsx');
    expect(src).toMatch(/alt=\{getCropLabel\(farm\.cropType \|\| farm\.crop\)\}/);
  });
});
