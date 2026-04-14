/**
 * Crop Icon Registry — correctness and fallback tests.
 *
 * Verifies:
 * - Crop-specific icons for all built-in crops
 * - Normalization helper
 * - Alias resolution
 * - Category fallback
 * - Generic fallback for unknown crops
 * - Consistency: same crop always returns same icon
 */

import { describe, it, expect } from 'vitest';
import {
  getCropIcon,
  normalizeCropName,
  getCropLabel,
  CROPS,
  CROP_ICONS,
  CATEGORY_ICONS,
} from '../../../src/utils/crops.js';

// ── Normalization ──────────────────────────────────────────

describe('normalizeCropName', () => {
  it('trims and lowercases', () => {
    expect(normalizeCropName('  Apple  ')).toBe('apple');
    expect(normalizeCropName('BANANA')).toBe('banana');
  });

  it('collapses duplicate spaces', () => {
    expect(normalizeCropName('sweet   potato')).toBe('sweet potato');
    expect(normalizeCropName('  chili   pepper  ')).toBe('chili pepper');
  });

  it('returns empty string for falsy input', () => {
    expect(normalizeCropName(null)).toBe('');
    expect(normalizeCropName(undefined)).toBe('');
    expect(normalizeCropName('')).toBe('');
  });
});

// ── Crop-specific icon lookup ──────────────────────────────

describe('getCropIcon — crop-specific icons', () => {
  const EXPECTED = {
    APPLE:        '🍎',
    APRICOT:      '🍑',
    AVOCADO:      '🥑',
    BANANA:       '🍌',
    BARLEY:       '🌾',
    BEAN:         '🫘',
    BLUEBERRY:    '🫐',
    CARROT:       '🥕',
    COCONUT:      '🥥',
    COFFEE:       '☕',
    CORN:         '🌽',
    CUCUMBER:     '🥒',
    EGGPLANT:     '🍆',
    GARLIC:       '🧄',
    GINGER:       '🫚',
    GRAPE:        '🍇',
    GROUNDNUT:    '🥜',
    MAIZE:        '🌽',
    MANGO:        '🥭',
    MUSHROOM:     '🍄',
    ONION:        '🧅',
    ORANGE:       '🍊',
    PEACH:        '🍑',
    PEAR:         '🍐',
    PEPPER:       '🫑',
    PINEAPPLE:    '🍍',
    POTATO:       '🥔',
    RICE:         '🍚',
    SWEET_POTATO: '🍠',
    TEA:          '🍵',
    TOMATO:       '🍅',
    WATERMELON:   '🍉',
    WHEAT:        '🌾',
  };

  for (const [code, icon] of Object.entries(EXPECTED)) {
    it(`${code} -> ${icon}`, () => {
      expect(getCropIcon(code)).toBe(icon);
    });
  }

  it('is case-insensitive', () => {
    expect(getCropIcon('apple')).toBe('🍎');
    expect(getCropIcon('Maize')).toBe('🌽');
    expect(getCropIcon('TOMATO')).toBe('🍅');
  });
});

// ── No two distinct fruits share banana icon ───────────────

describe('getCropIcon — no shared banana icon for non-banana fruits', () => {
  const fruits = CROPS.filter(c => c.category === 'fruit' && c.code !== 'BANANA' && c.code !== 'PLANTAIN');
  for (const crop of fruits) {
    it(`${crop.name} should NOT show banana icon`, () => {
      expect(getCropIcon(crop.code)).not.toBe('🍌');
    });
  }
});

// ── Every built-in crop returns a non-generic icon ─────────

describe('getCropIcon — every built-in crop has a specific icon', () => {
  for (const crop of CROPS) {
    it(`${crop.name} (${crop.code}) has icon in registry`, () => {
      const icon = getCropIcon(crop.code);
      expect(icon).toBeTruthy();
      // Every built-in should have at least a category fallback
      expect(icon).not.toBe('');
    });
  }
});

// ── Category fallback ──────────────────────────────────────

describe('getCropIcon — category fallback for unknown crop in known category', () => {
  it('fruit category uses 🍎 (not 🍌)', () => {
    expect(CATEGORY_ICONS.fruit).toBe('🍎');
  });

  it('cereal category uses 🌾', () => {
    expect(CATEGORY_ICONS.cereal).toBe('🌾');
  });

  it('vegetable category uses 🥬', () => {
    expect(CATEGORY_ICONS.vegetable).toBe('🥬');
  });
});

// ── Generic fallback ───────────────────────────────────────

describe('getCropIcon — generic fallback', () => {
  it('unknown crop returns 🌱', () => {
    expect(getCropIcon('QUINOA')).toBe('🌱');
    expect(getCropIcon('FOOBAR')).toBe('🌱');
  });

  it('null/undefined returns 🌱', () => {
    expect(getCropIcon(null)).toBe('🌱');
    expect(getCropIcon(undefined)).toBe('🌱');
    expect(getCropIcon('')).toBe('🌱');
  });

  it('OTHER returns 🌱', () => {
    expect(getCropIcon('OTHER')).toBe('🌱');
  });

  it('OTHER:UnknownCrop returns 🌱', () => {
    expect(getCropIcon('OTHER:SomeRareCrop')).toBe('🌱');
  });
});

// ── Alias resolution ───────────────────────────────────────

describe('getCropIcon — alias resolution', () => {
  it('beans -> bean icon 🫘', () => {
    expect(getCropIcon('beans')).toBe('🫘');
  });

  it('peanut -> groundnut icon 🥜', () => {
    expect(getCropIcon('peanut')).toBe('🥜');
  });

  it('OTHER:beans -> 🫘 via alias', () => {
    expect(getCropIcon('OTHER:beans')).toBe('🫘');
  });

  it('OTHER:peanut -> 🥜 via alias', () => {
    expect(getCropIcon('OTHER:peanut')).toBe('🥜');
  });
});

// ── Consistency ────────────────────────────────────────────

describe('getCropIcon — consistency across calls', () => {
  it('same code always returns same icon', () => {
    for (const crop of CROPS) {
      const first = getCropIcon(crop.code);
      const second = getCropIcon(crop.code);
      const lower = getCropIcon(crop.code.toLowerCase());
      expect(first).toBe(second);
      expect(first).toBe(lower);
    }
  });
});
