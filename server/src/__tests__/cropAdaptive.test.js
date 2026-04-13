/**
 * Adaptive Crop Selection — source-code enforcement tests.
 *
 * Verifies:
 * 1. CropUsage schema model exists
 * 2. Backend records crop usage on profile save
 * 3. Crop suggestions endpoint exists and is registered
 * 4. Frontend caches suggestions locally
 * 5. Recommendation engine uses learned data + last crop
 * 6. CropSelect wires learned data into the UI
 * 7. Crop name normalization works correctly
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  SCHEMA — CropUsage model
// ═══════════════════════════════════════════════════════════

describe('Schema — CropUsage model', () => {
  const schema = read('server/prisma/schema.prisma');

  it('has CropUsage model', () => {
    expect(schema).toContain('model CropUsage');
  });

  it('CropUsage has cropCode field', () => {
    expect(schema).toContain('cropCode');
    expect(schema).toContain('crop_code');
  });

  it('CropUsage has cropName field', () => {
    expect(schema).toContain('cropName');
    expect(schema).toContain('crop_name');
  });

  it('CropUsage has country field', () => {
    expect(schema).toContain('country');
  });

  it('CropUsage has useCount field', () => {
    expect(schema).toContain('useCount');
    expect(schema).toContain('use_count');
  });

  it('CropUsage has unique constraint on cropCode+country', () => {
    expect(schema).toContain('@@unique([cropCode, country]');
  });

  it('CropUsage has country index', () => {
    expect(schema).toContain('idx_crop_usage_country');
  });
});

// ═══════════════════════════════════════════════════════════
//  MIGRATION — crop_usage table
// ═══════════════════════════════════════════════════════════

describe('Migration — crop_usage table', () => {
  const sql = read('server/prisma/migrations/20260413_crop_usage/migration.sql');

  it('creates crop_usage table', () => {
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('crop_usage');
  });

  it('has crop_code column', () => {
    expect(sql).toContain('crop_code');
  });

  it('has use_count column', () => {
    expect(sql).toContain('use_count');
  });

  it('creates unique index on crop_code + country', () => {
    expect(sql).toContain('uq_crop_usage_code_country');
  });

  it('seeds from existing farm_profiles', () => {
    expect(sql).toContain('INSERT INTO "crop_usage"');
    expect(sql).toContain('FROM "farm_profiles"');
    expect(sql).toContain('GROUP BY');
  });
});

// ═══════════════════════════════════════════════════════════
//  BACKEND — crop usage recording
// ═══════════════════════════════════════════════════════════

describe('Backend — crop usage recording on save', () => {
  const farmRoute = read('server/routes/farmProfile.js');

  it('imports recordCropUsage', () => {
    expect(farmRoute).toContain("import { recordCropUsage }");
  });

  it('calls recordCropUsage after profile save', () => {
    expect(farmRoute).toContain('recordCropUsage(profile.crop');
  });

  it('passes country and location to recordCropUsage', () => {
    expect(farmRoute).toContain('profile.country, profile.locationName');
  });
});

describe('Backend — crop suggestions endpoint', () => {
  const src = read('server/routes/cropSuggestions.js');

  it('exports normalizeCropName function', () => {
    expect(src).toContain('export function normalizeCropName');
  });

  it('exports extractCropName function', () => {
    expect(src).toContain('export function extractCropName');
  });

  it('exports recordCropUsage function', () => {
    expect(src).toContain('export async function recordCropUsage');
  });

  it('recordCropUsage uses upsert for dedup', () => {
    expect(src).toContain('prisma.cropUsage.upsert');
  });

  it('recordCropUsage increments useCount', () => {
    expect(src).toContain('increment: 1');
  });

  it('recordCropUsage skips bare OTHER', () => {
    expect(src).toContain("=== 'OTHER'");
  });

  it('GET endpoint queries by country', () => {
    expect(src).toContain('req.query.country');
    expect(src).toContain('prisma.cropUsage.findMany');
  });

  it('orders by useCount desc', () => {
    expect(src).toContain("useCount: 'desc'");
  });

  it('sets Cache-Control header', () => {
    expect(src).toContain('Cache-Control');
    expect(src).toContain('max-age=300');
  });

  it('fails open (returns empty array on error)', () => {
    expect(src).toContain("crops: []");
  });
});

describe('Backend — route registration', () => {
  const app = read('server/src/app.js');

  it('imports crop suggestions routes', () => {
    expect(app).toContain("cropSuggestions");
  });

  it('registers at /api/v2/crop-suggestions', () => {
    expect(app).toContain("'/api/v2/crop-suggestions'");
  });
});

// ═══════════════════════════════════════════════════════════
//  FRONTEND — suggestion cache
// ═══════════════════════════════════════════════════════════

describe('Frontend — crop suggestion cache', () => {
  const src = read('src/utils/cropSuggestionCache.js');

  it('exports fetchCropSuggestions', () => {
    expect(src).toContain('export async function fetchCropSuggestions');
  });

  it('exports saveLastCrop', () => {
    expect(src).toContain('export function saveLastCrop');
  });

  it('exports getLastCrop', () => {
    expect(src).toContain('export function getLastCrop');
  });

  it('uses localStorage for caching', () => {
    expect(src).toContain('localStorage.getItem');
    expect(src).toContain('localStorage.setItem');
  });

  it('has 5-minute TTL', () => {
    expect(src).toContain('5 * 60 * 1000');
  });

  it('fetches from /api/v2/crop-suggestions', () => {
    expect(src).toContain('/api/v2/crop-suggestions');
  });

  it('falls back to expired cache on network error', () => {
    expect(src).toContain('getCachedFallback');
  });

  it('exports normalizeCropName', () => {
    expect(src).toContain('export function normalizeCropName');
  });
});

// ═══════════════════════════════════════════════════════════
//  RECOMMENDATION ENGINE — learned data integration
// ═══════════════════════════════════════════════════════════

describe('Recommendation engine — learned crops support', () => {
  const src = read('src/utils/cropRecommendations.js');

  it('reads learnedCrops from context', () => {
    expect(src).toContain('ctx.learnedCrops');
  });

  it('adds learned crops with popularity reason', () => {
    expect(src).toContain('Popular nearby');
  });

  it('requires useCount >= 2 for learned suggestions', () => {
    expect(src).toContain('useCount >= 2');
  });

  it('reads lastCropCode from context', () => {
    expect(src).toContain('ctx.lastCropCode');
  });

  it('adds last crop with reason', () => {
    expect(src).toContain('Your last crop');
  });

  it('handles custom OTHER: crops in recommendations', () => {
    expect(src).toContain("code.toUpperCase().startsWith('OTHER:')");
  });
});

// ═══════════════════════════════════════════════════════════
//  CropSelect — wiring
// ═══════════════════════════════════════════════════════════

describe('CropSelect — adaptive features wired in', () => {
  const src = read('src/components/CropSelect.jsx');

  it('imports fetchCropSuggestions', () => {
    expect(src).toContain('fetchCropSuggestions');
  });

  it('imports saveLastCrop', () => {
    expect(src).toContain('saveLastCrop');
  });

  it('imports getLastCrop', () => {
    expect(src).toContain('getLastCrop');
  });

  it('fetches learned crops on mount/country change', () => {
    expect(src).toContain('fetchCropSuggestions(countryCode)');
  });

  it('passes learnedCrops to recommendCrops', () => {
    expect(src).toContain('learnedCrops,');
    expect(src).toContain('learnedCrops');
  });

  it('passes lastCropCode to recommendCrops', () => {
    expect(src).toContain('lastCropCode:');
  });

  it('saves last crop on selection', () => {
    expect(src).toContain('saveLastCrop(code)');
  });

  it('builds learned custom entries for the dropdown', () => {
    expect(src).toContain('learnedCustomEntries');
  });

  it('shows Popular badge on learned entries', () => {
    expect(src).toContain('learnedBadge');
    expect(src).toContain('Popular');
  });
});

// ═══════════════════════════════════════════════════════════
//  CROP NAME NORMALIZATION
// ═══════════════════════════════════════════════════════════

describe('Crop name normalization — backend', () => {
  it('normalizeCropName title-cases input', async () => {
    const { normalizeCropName } = await import('../../routes/cropSuggestions.js');
    expect(normalizeCropName('okra')).toBe('Okra');
    expect(normalizeCropName('SWEET POTATO')).toBe('Sweet Potato');
    expect(normalizeCropName('  teff ')).toBe('Teff');
    expect(normalizeCropName('finger millet')).toBe('Finger Millet');
  });

  it('extractCropName parses OTHER: prefix', async () => {
    const { extractCropName } = await import('../../routes/cropSuggestions.js');
    expect(extractCropName('OTHER:teff')).toBe('Teff');
    expect(extractCropName('OTHER:finger millet')).toBe('Finger Millet');
    expect(extractCropName('MAIZE')).toBe('Maize');
    expect(extractCropName('SWEET_POTATO')).toBe('Sweet Potato');
  });
});

describe('Crop name normalization — frontend', () => {
  it('normalizeCropName title-cases input', async () => {
    const { normalizeCropName } = await import('../../../src/utils/cropSuggestionCache.js');
    expect(normalizeCropName('okra')).toBe('Okra');
    expect(normalizeCropName('SWEET POTATO')).toBe('Sweet Potato');
    expect(normalizeCropName('  teff ')).toBe('Teff');
  });
});

// ═══════════════════════════════════════════════════════════
//  RECOMMENDATION ENGINE — learned crops integration
// ═══════════════════════════════════════════════════════════

describe('Recommendation engine — learned crops boost', () => {
  it('blends learned crops into recommendations', async () => {
    const { recommendCrops } = await import('../../../src/utils/cropRecommendations.js');
    // Use learned crops WITHOUT country context so they don't compete with 8 country defaults
    const r = recommendCrops({
      learnedCrops: [
        { cropCode: 'TOMATO', cropName: 'Tomato', useCount: 5 },
        { cropCode: 'OKRA', cropName: 'Okra', useCount: 3 },
      ],
    });
    expect(r.hasContext).toBe(true);
    expect(r.contextUsed).toContain('learnedCrops');
    expect(r.recommendations.some(c => c.code === 'TOMATO')).toBe(true);
    expect(r.recommendations.some(c => c.code === 'OKRA')).toBe(true);
  });

  it('includes last-used crop in recommendations', async () => {
    const { recommendCrops } = await import('../../../src/utils/cropRecommendations.js');
    const r = recommendCrops({
      lastCropCode: 'AVOCADO',
    });
    expect(r.hasContext).toBe(true);
    expect(r.contextUsed).toContain('lastCrop');
    expect(r.recommendations.some(c => c.code === 'AVOCADO')).toBe(true);
    expect(r.recommendations.find(c => c.code === 'AVOCADO').reason).toContain('Your last crop');
  });

  it('skips learned crops with useCount < 2', async () => {
    const { recommendCrops } = await import('../../../src/utils/cropRecommendations.js');
    const r = recommendCrops({
      learnedCrops: [
        { cropCode: 'DRAGON_FRUIT', cropName: 'Dragon Fruit', useCount: 1 },
      ],
    });
    // Only learned crops context, but useCount < 2 → no crops added from it
    // However contextUsed still includes 'learnedCrops' since array was non-empty
    expect(r.recommendations.some(c => c.code === 'DRAGON_FRUIT')).toBe(false);
  });
});
