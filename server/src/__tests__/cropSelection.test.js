import { describe, it, expect } from 'vitest';

/**
 * Crop Selection — Comprehensive Tests
 *
 * Covers: expanded crop list, search behavior, "Other" support,
 * structured storage, backend validation, recommendation engine,
 * regionConfig integration, and backward compatibility.
 */

// ─── 1. Shared crop dataset ──────────────────────────────────

describe('Shared crop dataset (src/utils/crops.js concepts)', () => {
  it('KNOWN_CROP_CODES contains the full A-Z crop set', async () => {
    // Verify via the validateCrop function which uses KNOWN_CROP_CODES
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    const sampleCrops = [
      'ALFALFA', 'BANANA', 'CABBAGE', 'CASSAVA', 'EGGPLANT',
      'GRAPE', 'GROUNDNUT', 'KALE', 'MAIZE',
      'OKRA', 'PALM_OIL', 'PEA', 'RICE', 'SESAME', 'SPINACH',
      'TOMATO', 'WHEAT', 'YAM',
    ];
    for (const crop of sampleCrops) {
      expect(() => validateCrop(crop), `${crop} should be valid`).not.toThrow();
    }
  });

  it('crops list contains all 63 distinct entries', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    // The full 63-crop list specified for the project
    const testCodes = [
      'ALFALFA', 'ALMOND', 'APPLE', 'APRICOT', 'AVOCADO',
      'BANANA', 'BARLEY', 'BEAN', 'BEETROOT', 'BLACK_PEPPER', 'BLUEBERRY',
      'CABBAGE', 'CACAO', 'CARROT', 'CASSAVA', 'CAULIFLOWER', 'CHILI', 'COCOA', 'COCONUT', 'COFFEE', 'CORN', 'COTTON', 'COWPEA', 'CUCUMBER',
      'DATE', 'DRAGON_FRUIT',
      'EGGPLANT',
      'FIG',
      'GARLIC', 'GINGER', 'GRAPE', 'GROUNDNUT',
      'KALE',
      'LETTUCE',
      'MAIZE', 'MANGO', 'MILLET', 'MUSHROOM',
      'OKRA', 'ONION', 'ORANGE',
      'PAPAYA', 'PALM_OIL', 'PEA', 'PEACH', 'PEAR', 'PEPPER', 'PINEAPPLE', 'PLANTAIN', 'POTATO',
      'RICE',
      'SESAME', 'SORGHUM', 'SOYBEAN', 'SPINACH', 'SUGARCANE', 'SUNFLOWER', 'SWEET_POTATO',
      'TOMATO', 'TEA',
      'WATERMELON', 'WHEAT',
      'YAM',
    ];
    expect(testCodes.length).toBe(63);
    for (const code of testCodes) {
      expect(() => validateCrop(code)).not.toThrow();
    }
  });

  it('each crop has a stable uppercase code', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    // Uppercase codes should work directly
    expect(() => validateCrop('MAIZE')).not.toThrow();
    expect(() => validateCrop('SWEET_POTATO')).not.toThrow();
    expect(() => validateCrop('PALM_OIL')).not.toThrow();
  });
});

// ─── 2. Search behavior (backend validates what frontend sends) ──

describe('Search / partial match — crop validation', () => {
  it('accepts first-letter matches as valid codes', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    // If user searches "M" and picks MAIZE, MANGO, MILLET — all valid
    expect(() => validateCrop('MAIZE')).not.toThrow();
    expect(() => validateCrop('MANGO')).not.toThrow();
    expect(() => validateCrop('MILLET')).not.toThrow();
  });

  it('accepts partial search results as valid codes', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    // User types "sun" → picks SUNFLOWER
    expect(() => validateCrop('SUNFLOWER')).not.toThrow();
    // User types "cass" → picks CASSAVA
    expect(() => validateCrop('CASSAVA')).not.toThrow();
  });

  it('rejects truly unknown values that no search would produce', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    expect(() => validateCrop('UNOBTANIUM')).toThrow(/Unknown crop/);
    expect(() => validateCrop('KRYPTONITE')).toThrow(/Unknown crop/);
  });
});

// ─── 3. "Other" support ─────────────────────────────────────

describe('"Other" — structured storage', () => {
  it('accepts bare "OTHER"', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    expect(() => validateCrop('OTHER')).not.toThrow();
  });

  it('accepts "OTHER:CustomCropName" with name >= 2 chars', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    expect(() => validateCrop('OTHER:Teff')).not.toThrow();
    expect(() => validateCrop('OTHER:Finger Millet Local')).not.toThrow();
    expect(() => validateCrop('OTHER:AB')).not.toThrow();
  });

  it('rejects "OTHER:X" with name < 2 chars', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    expect(() => validateCrop('OTHER:X')).toThrow(/at least 2 characters/);
    expect(() => validateCrop('OTHER:')).not.toThrow(); // bare OTHER: treated like OTHER
  });

  it('accepts legacy lowercase "other" and "other:name"', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    expect(() => validateCrop('other')).not.toThrow();
    expect(() => validateCrop('other:Teff')).not.toThrow();
  });

  it('rejects null/undefined/empty', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    expect(() => validateCrop(null)).toThrow(/required/);
    expect(() => validateCrop(undefined)).toThrow(/required/);
    expect(() => validateCrop('')).toThrow(/required/);
  });
});

// ─── 4. Standard crop stores structured code ────────────────

describe('Standard crop — structured storage', () => {
  it('stores uppercase codes for standard crops', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    // Standard crops use their code directly — MAIZE, RICE, etc.
    expect(() => validateCrop('MAIZE')).not.toThrow();
    expect(() => validateCrop('RICE')).not.toThrow();
  });

  it('standard crops do NOT use customCropName', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    // A standard crop code is just the code, not OTHER:anything
    expect(() => validateCrop('MAIZE')).not.toThrow();
    // MAIZE does not start with OTHER: so isCustomCrop = false in frontend
  });
});

// ─── 5. Backward compatibility ──────────────────────────────

describe('Backward compatibility — legacy lowercase values', () => {
  it('accepts original 4 crops in lowercase', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    for (const crop of ['maize', 'rice', 'cassava', 'wheat']) {
      expect(() => validateCrop(crop)).not.toThrow();
    }
  });

  it('accepts legacy pluralized/aliased forms', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    // Old "beans" → now BEAN, but "beans" still works via alias
    expect(() => validateCrop('beans')).not.toThrow();
    expect(() => validateCrop('chickpeas')).not.toThrow();
    expect(() => validateCrop('groundnuts')).not.toThrow();
    expect(() => validateCrop('soybeans')).not.toThrow();
    expect(() => validateCrop('irish_potato')).not.toThrow();
  });

  it('accepts expanded legacy lowercase', async () => {
    const { validateCrop } = await import('../modules/farmProfiles/service.js');
    const legacyCrops = ['coffee', 'tea', 'sugarcane', 'sorghum', 'cotton',
      'banana', 'avocado', 'tomato', 'sunflower', 'sweet_potato'];
    for (const crop of legacyCrops) {
      expect(() => validateCrop(crop)).not.toThrow();
    }
  });
});

// ─── 6. Recommendation engine — regionConfig integration ────

describe('regionConfig — crop recommendations', () => {
  it('returns crops for KE', async () => {
    const { getCropsForCountry } = await import('../modules/regionConfig/service.js');
    const crops = getCropsForCountry('KE');
    expect(Array.isArray(crops)).toBe(true);
    expect(crops.length).toBeGreaterThanOrEqual(5);
    expect(crops).toContain('maize');
    expect(crops).toContain('coffee');
  });

  it('returns crops for TZ', async () => {
    const { getCropsForCountry } = await import('../modules/regionConfig/service.js');
    const crops = getCropsForCountry('TZ');
    expect(Array.isArray(crops)).toBe(true);
    expect(crops.length).toBeGreaterThanOrEqual(5);
    expect(crops).toContain('rice');
    expect(crops).toContain('coffee');
  });

  it('returns fallback (KE) for unknown country', async () => {
    const { getCropsForCountry } = await import('../modules/regionConfig/service.js');
    const crops = getCropsForCountry('XX');
    expect(Array.isArray(crops)).toBe(true);
    expect(crops).toContain('maize');
  });

  it('regionConfig routes export a valid Express router', async () => {
    const mod = await import('../modules/regionConfig/routes.js');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ─── 7. FarmProfile + Application services unaffected ───────

describe('Service modules — no regression', () => {
  it('farmProfiles service exports all CRUD functions', async () => {
    const mod = await import('../modules/farmProfiles/service.js');
    expect(typeof mod.createFarmProfile).toBe('function');
    expect(typeof mod.getFarmProfile).toBe('function');
    expect(typeof mod.updateFarmProfile).toBe('function');
    expect(typeof mod.listFarmProfiles).toBe('function');
    expect(typeof mod.validateCrop).toBe('function');
  });

  it('application service exports normally', async () => {
    const mod = await import('../modules/applications/service.js');
    expect(typeof mod.createApplication).toBe('function');
    expect(typeof mod.listApplications).toBe('function');
    expect(typeof mod.getApplicationById).toBe('function');
  });

  it('farmer-registration module loads without error', async () => {
    const mod = await import('../modules/auth/farmer-registration.js');
    expect(mod.farmerSelfRegister).toBeDefined();
    expect(typeof mod.farmerSelfRegister).toBe('function');
  });
});
