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
  getCropImagePath, hasCropImage,
  CROP_IMAGE_PATHS, CROP_IMAGE_PLACEHOLDER,
} from '../../../src/config/cropImages.js';

describe('getCropImagePath', () => {
  it('resolves canonical lowercase keys to /crops/*.webp', () => {
    expect(getCropImagePath('maize')).toBe('/crops/maize.webp');
    expect(getCropImagePath('rice')).toBe('/crops/rice.webp');
    expect(getCropImagePath('cassava')).toBe('/crops/cassava.webp');
  });

  it('accepts uppercase storage codes (MAIZE, SWEET_POTATO)', () => {
    expect(getCropImagePath('MAIZE')).toBe('/crops/maize.webp');
    expect(getCropImagePath('SWEET_POTATO')).toBe('/crops/sweet_potato.webp');
  });

  it('accepts display strings ("Maize", "Sweet Potato")', () => {
    expect(getCropImagePath('Maize')).toBe('/crops/maize.webp');
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
});

describe('CROP_IMAGE_PATHS catalog', () => {
  it('every value is a /crops/*.webp URL', () => {
    for (const [key, value] of Object.entries(CROP_IMAGE_PATHS)) {
      expect(value, `${key} should map to a webp under /crops`)
        .toMatch(/^\/crops\/[a-z_]+\.webp$/);
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
    expect(src).toMatch(/borderRadius:\s*circular\s*\?\s*'50%'/);
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
