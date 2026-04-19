/**
 * hardeningFinal.test.js — final-pass tests covering the remaining
 * checklist items: harvest validation and season edge-case scoring.
 */
import { describe, it, expect } from 'vitest';
import { validateHarvestPayload } from '../services/harvests/harvestValidation.js';
import { recommendCropsForUSFarm } from '../domain/us/recommend.js';

function nameSet(list) { return new Set(list.map((r) => r.name)); }
function ctx(overrides = {}) {
  return {
    country: 'USA', state: 'TX', farmType: 'backyard',
    beginnerLevel: 'beginner', currentMonth: 7, ...overrides,
  };
}

// ─── Harvest validation ────────────────────────────────
describe('validateHarvestPayload', () => {
  // Use a date that's always in the recent past relative to the test
  // run so the future-date check doesn't accidentally reject the
  // fixture when the suite is run months later.
  const pastDate = new Date(Date.now() - 7 * 86_400_000);
  const ok = {
    cropId: 'tomato',
    harvestDate: pastDate,
    quantityHarvested: 100,
    quantityUnit: 'kg',
    quantityLost: 5,
    quantitySold: 70,
    quantityStored: 20,
    qualityGrade: 'A',
  };

  it('accepts a well-formed payload', () => {
    const r = validateHarvestPayload(ok);
    expect(r.ok).toBe(true);
    expect(r.data.quantityHarvested).toBe(100);
  });
  it('rejects zero or negative quantity', () => {
    expect(validateHarvestPayload({ ...ok, quantityHarvested: 0 })).toEqual({ ok: false, error: 'quantity_must_be_positive' });
    expect(validateHarvestPayload({ ...ok, quantityHarvested: -1 })).toEqual({ ok: false, error: 'quantity_must_be_positive' });
  });
  it('rejects absurdly large quantities', () => {
    expect(validateHarvestPayload({ ...ok, quantityHarvested: 99_999_999 }))
      .toEqual({ ok: false, error: 'quantity_too_large' });
  });
  it('rejects invalid units', () => {
    expect(validateHarvestPayload({ ...ok, quantityUnit: 'bushels' }))
      .toEqual({ ok: false, error: 'invalid_unit' });
  });
  it('rejects missing crop', () => {
    expect(validateHarvestPayload({ ...ok, cropId: '' }))
      .toEqual({ ok: false, error: 'missing_crop' });
  });
  it('rejects future dates', () => {
    const future = new Date(Date.now() + 30 * 86_400_000);
    expect(validateHarvestPayload({ ...ok, harvestDate: future }))
      .toEqual({ ok: false, error: 'harvest_date_in_future' });
  });
  it('rejects invalid dates', () => {
    expect(validateHarvestPayload({ ...ok, harvestDate: 'yesterday' }))
      .toEqual({ ok: false, error: 'invalid_harvest_date' });
  });
  it('rejects negative losses', () => {
    expect(validateHarvestPayload({ ...ok, quantityLost: -3 }))
      .toEqual({ ok: false, error: 'losses_must_be_nonnegative' });
  });
  it('rejects losses larger than harvest', () => {
    expect(validateHarvestPayload({ ...ok, quantityLost: 200 }))
      .toEqual({ ok: false, error: 'losses_exceed_harvest' });
  });
  it('rejects sold+stored+lost > harvest (beyond 1% slack)', () => {
    expect(validateHarvestPayload({ ...ok, quantitySold: 80, quantityStored: 80, quantityLost: 0 }))
      .toEqual({ ok: false, error: 'breakdown_exceeds_harvest' });
  });
  it('accepts 1% rounding slack on the breakdown', () => {
    const r = validateHarvestPayload({
      ...ok, quantitySold: 60, quantityStored: 40.5, quantityLost: 0,
    });
    expect(r.ok).toBe(true);
  });
  it('rejects invalid quality grades', () => {
    expect(validateHarvestPayload({ ...ok, qualityGrade: 'diamond' }))
      .toEqual({ ok: false, error: 'invalid_quality_grade' });
  });
  it('trims notes to 2000 chars', () => {
    const r = validateHarvestPayload({ ...ok, notes: 'x'.repeat(5000) });
    expect(r.ok).toBe(true);
    expect(r.data.notes.length).toBe(2000);
  });
});

// ─── Season edge cases ─────────────────────────────────
describe('Season edge-case scoring', () => {
  it('Alaska backyard in July only shows short-season crops', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'AK', farmType: 'backyard', currentMonth: 7 }));
    const names = nameSet([...out.bestMatch, ...out.alsoConsider]);
    // Must NOT include warm-weather long-season staples.
    expect(names.has('Okra')).toBe(false);
    expect(names.has('Sweet Potato')).toBe(false);
    expect(names.has('Sugarcane')).toBe(false);
    // Should include at least one short-season-friendly crop.
    const shortSeason = ['Lettuce', 'Kale', 'Cabbage', 'Potato', 'Carrot'];
    expect(shortSeason.some((n) => names.has(n))).toBe(true);
  });

  it('Hawaii backyard surfaces tropical / subtropical picks', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'HI', farmType: 'backyard', currentMonth: 6 }));
    const names = nameSet([...out.bestMatch, ...out.alsoConsider]);
    // Tropical specialties present
    const hits = ['Sweet Potato', 'Taro', 'Pepper', 'Eggplant', 'Herbs'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('Florida commercial in winter (Jan) still allows citrus + vegetables', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'FL', farmType: 'commercial', currentMonth: 1 }));
    const names = nameSet([...out.bestMatch, ...out.alsoConsider]);
    const hits = ['Citrus', 'Tomato', 'Pepper'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('Cassava stays out of continental bestMatch even in warm months', () => {
    for (const state of ['TX', 'AZ', 'CA', 'GA', 'FL', 'IA', 'MD']) {
      for (const ft of ['backyard', 'commercial']) {
        const out = recommendCropsForUSFarm(ctx({ state, farmType: ft, currentMonth: 6 }));
        expect(
          nameSet(out.bestMatch).has('Cassava'),
          `Cassava should not be a best match in ${state} (${ft})`,
        ).toBe(false);
      }
    }
  });

  it('Mid-Atlantic (MD) backyard in April has shoulder-season mix', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'MD', farmType: 'backyard', currentMonth: 4 }));
    const names = nameSet([...out.bestMatch, ...out.alsoConsider]);
    const hits = ['Tomato', 'Pepper', 'Lettuce', 'Herbs', 'Beans'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });

  it('North Dakota in January keeps warm-season crops out of bestMatch', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'ND', farmType: 'backyard', currentMonth: 1 }));
    const names = nameSet(out.bestMatch);
    expect(names.has('Okra')).toBe(false);
    expect(names.has('Tomato')).toBe(false);
    expect(names.has('Sweet Potato')).toBe(false);
  });

  it('Commercial and backyard paths emit different crop mixes for the same state', () => {
    const com = recommendCropsForUSFarm(ctx({ state: 'KS', farmType: 'commercial', currentMonth: 5 }));
    const back = recommendCropsForUSFarm(ctx({ state: 'KS', farmType: 'backyard', currentMonth: 5, growingStyle: 'container' }));
    const comNames = nameSet([...com.bestMatch, ...com.alsoConsider]);
    const backNames = nameSet([...back.bestMatch, ...back.alsoConsider]);
    // Commercial should carry sorghum / wheat / corn; backyard should not
    // surface the industrial grains as container backyard suggestions.
    expect(comNames.has('Sorghum') || comNames.has('Wheat') || comNames.has('Corn')).toBe(true);
    expect(backNames.has('Sorghum')).toBe(false);
    expect(backNames.has('Wheat')).toBe(false);
  });
});
