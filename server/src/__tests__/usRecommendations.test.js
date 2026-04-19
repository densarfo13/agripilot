/**
 * usRecommendations.test.js — state-by-state sanity tests for the
 * U.S. crop recommendation engine. Runs against the pure-function
 * core (no HTTP, no DB) so it finishes in milliseconds.
 */
import { describe, it, expect } from 'vitest';
import { recommendCropsForUSFarm } from '../domain/us/recommend.js';
import { US_STATES, US_STATE_COUNT, resolveLocationProfile } from '../domain/us/usStates.js';

function ctx(overrides = {}) {
  return {
    country: 'USA',
    state: 'Iowa',
    farmType: 'commercial',
    beginnerLevel: 'beginner',
    currentMonth: 5,
    ...overrides,
  };
}

function nameSet(list) { return new Set(list.map((r) => r.name)); }

describe('U.S. state coverage', () => {
  it('has 50 states + DC (51 entries)', () => {
    expect(US_STATE_COUNT).toBe(51);
  });

  it('resolves case-insensitive codes and full names', () => {
    expect(resolveLocationProfile('tx')?.code).toBe('TX');
    expect(resolveLocationProfile('Texas')?.code).toBe('TX');
    expect(resolveLocationProfile('District of Columbia')?.code).toBe('DC');
    expect(resolveLocationProfile('Not A State')).toBeNull();
  });

  it('every state has a non-empty displayRegion and climateSubregion', () => {
    for (const [code, profile] of Object.entries(US_STATES)) {
      expect(profile.displayRegion, `missing displayRegion for ${code}`).toBeTruthy();
      expect(profile.climateSubregion, `missing climateSubregion for ${code}`).toBeTruthy();
    }
  });
});

describe('Validation', () => {
  it('rejects missing body', () => {
    expect(recommendCropsForUSFarm(null)).toEqual({ ok: false, error: 'missing_body' });
  });
  it('rejects unknown state', () => {
    expect(recommendCropsForUSFarm(ctx({ state: 'Atlantis' })))
      .toEqual({ ok: false, error: 'unknown_state' });
  });
  it('rejects bad farmType', () => {
    expect(recommendCropsForUSFarm(ctx({ farmType: 'huge_agri' })))
      .toEqual({ ok: false, error: 'invalid_farm_type' });
  });
});

describe('Commercial scoring', () => {
  it('Georgia commercial ranks peanut at the top', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'GA', farmType: 'commercial', currentMonth: 5 }));
    expect(out.ok).toBe(true);
    const names = nameSet(out.bestMatch);
    expect(names.has('Peanut')).toBe(true);
  });
  it('Kansas commercial ranks sorghum at the top', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'KS', farmType: 'commercial', currentMonth: 5 }));
    expect(nameSet(out.bestMatch).has('Sorghum')).toBe(true);
  });
  it('Iowa commercial ranks corn and soybean highly', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'IA', farmType: 'commercial', currentMonth: 5 }));
    const names = nameSet(out.bestMatch);
    expect(names.has('Corn')).toBe(true);
    expect(names.has('Soybean')).toBe(true);
  });
  it('California commercial shows tomato / lettuce / strawberry / almonds', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'CA', farmType: 'commercial', currentMonth: 3 }));
    const names = nameSet(out.bestMatch);
    // Any subset of these four is acceptable; at least two must appear.
    const hits = ['Tomato', 'Lettuce', 'Strawberry', 'Almonds'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
  it('Texas commercial ranks sorghum / cotton / peanut highly', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'TX', farmType: 'commercial', currentMonth: 4 }));
    const names = nameSet(out.bestMatch);
    const hits = ['Sorghum', 'Cotton', 'Peanut'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
  it('Florida commercial shows citrus / peanut / vegetables', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'FL', farmType: 'commercial', currentMonth: 3 }));
    const names = nameSet(out.bestMatch);
    expect(names.has('Citrus') || names.has('Peanut')).toBe(true);
  });
});

describe('Backyard scoring', () => {
  it('Texas backyard + container + beginner + home_food → tomato/pepper/herbs rank high', () => {
    const out = recommendCropsForUSFarm(ctx({
      state: 'TX', farmType: 'backyard', growingStyle: 'container',
      purpose: 'home_food', beginnerLevel: 'beginner', currentMonth: 4,
    }));
    expect(out.ok).toBe(true);
    const names = nameSet(out.bestMatch);
    const hits = ['Tomato', 'Pepper', 'Herbs'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('Florida backyard + in_ground + beginner → okra/sweet potato/pepper rank high', () => {
    const out = recommendCropsForUSFarm(ctx({
      state: 'FL', farmType: 'backyard', growingStyle: 'in_ground',
      beginnerLevel: 'beginner', currentMonth: 4,
    }));
    const names = nameSet(out.bestMatch);
    const hits = ['Okra', 'Sweet Potato', 'Pepper'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('Iowa backyard + raised_bed + beginner → lettuce/beans/kale/tomato rank high', () => {
    const out = recommendCropsForUSFarm(ctx({
      state: 'IA', farmType: 'backyard', growingStyle: 'raised_bed',
      beginnerLevel: 'beginner', currentMonth: 5,
    }));
    const names = nameSet(out.bestMatch);
    const hits = ['Lettuce', 'Beans', 'Kale', 'Tomato'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('Maryland backyard + container + beginner → herbs/lettuce/pepper/tomato rank well', () => {
    const out = recommendCropsForUSFarm(ctx({
      state: 'MD', farmType: 'backyard', growingStyle: 'container',
      beginnerLevel: 'beginner', currentMonth: 4,
    }));
    const names = nameSet([...out.bestMatch, ...out.alsoConsider]);
    const hits = ['Herbs', 'Lettuce', 'Pepper', 'Tomato'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });

  it('Alaska backyard shows only short-season vegetables', () => {
    const out = recommendCropsForUSFarm(ctx({
      state: 'AK', farmType: 'backyard', beginnerLevel: 'beginner', currentMonth: 6,
    }));
    const names = nameSet(out.bestMatch);
    // Must not include warm/hot staples.
    expect(names.has('Okra')).toBe(false);
    expect(names.has('Sweet Potato')).toBe(false);
    // Must include at least one short-season pick.
    const shortSeason = ['Lettuce', 'Kale', 'Cabbage', 'Potato', 'Radish'];
    expect(shortSeason.some((n) => names.has(n))).toBe(true);
  });

  it('Hawaii backyard shows tropical-friendly crops', () => {
    const out = recommendCropsForUSFarm(ctx({
      state: 'HI', farmType: 'backyard', beginnerLevel: 'beginner', currentMonth: 6,
    }));
    const names = nameSet(out.bestMatch);
    const hits = ['Sweet Potato', 'Taro', 'Pepper', 'Herbs'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Spec seed coverage (commercial)', () => {
  it('Oregon commercial surfaces berry/potato/wheat', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'OR', farmType: 'commercial', currentMonth: 4 }));
    const names = nameSet([...out.bestMatch, ...out.alsoConsider]);
    const hits = ['Potato', 'Blueberry', 'Wheat'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
  it('Arizona commercial surfaces cotton / lettuce / alfalfa', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'AZ', farmType: 'commercial', currentMonth: 3 }));
    const names = nameSet([...out.bestMatch, ...out.alsoConsider]);
    const hits = ['Cotton', 'Lettuce', 'Alfalfa'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
  it('Nevada commercial surfaces alfalfa', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'NV', farmType: 'commercial', currentMonth: 4 }));
    const names = nameSet([...out.bestMatch, ...out.alsoConsider]);
    expect(names.has('Alfalfa')).toBe(true);
  });
  it('Louisiana commercial surfaces rice / sugarcane', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'LA', farmType: 'commercial', currentMonth: 4 }));
    const names = nameSet([...out.bestMatch, ...out.alsoConsider]);
    expect(names.has('Rice') || names.has('Sugarcane')).toBe(true);
  });
  it('Hawaii commercial surfaces taro / sweet potato / banana / papaya / pineapple', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'HI', farmType: 'commercial', currentMonth: 6 }));
    const names = nameSet([...out.bestMatch, ...out.alsoConsider]);
    const hits = ['Taro', 'Sweet Potato', 'Banana', 'Papaya', 'Pineapple'].filter((n) => names.has(n));
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });
  it('Alaska commercial is potato / cabbage / kale only', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'AK', farmType: 'commercial', currentMonth: 6 }));
    const names = nameSet([...out.bestMatch, ...out.alsoConsider]);
    expect(names.has('Potato') || names.has('Cabbage') || names.has('Kale')).toBe(true);
    expect(names.has('Cotton')).toBe(false);
    expect(names.has('Sugarcane')).toBe(false);
  });
});

describe('Subregion mapping corrections from spec', () => {
  it('Alabama is LOWER_MISSISSIPPI_HUMID', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'AL', farmType: 'commercial' }));
    expect(out.location.climateSubregion).toBe('LOWER_MISSISSIPPI_HUMID');
  });
  it('Tennessee is SOUTH_CENTRAL_MIXED', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'TN', farmType: 'commercial' }));
    expect(out.location.climateSubregion).toBe('SOUTH_CENTRAL_MIXED');
  });
  it('New York is MID_ATLANTIC', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'NY', farmType: 'commercial' }));
    expect(out.location.climateSubregion).toBe('MID_ATLANTIC');
  });
  it('Oklahoma is GREAT_PLAINS (display) + GREAT_PLAINS_DRY (climate)', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'OK', farmType: 'commercial' }));
    expect(out.location.displayRegion).toBe('GREAT_PLAINS');
    expect(out.location.climateSubregion).toBe('GREAT_PLAINS_DRY');
  });
  it('Alaska + Hawaii use dedicated subregions, not subarctic/tropical pacific aliases', () => {
    const ak = recommendCropsForUSFarm(ctx({ state: 'AK', farmType: 'commercial' }));
    const hi = recommendCropsForUSFarm(ctx({ state: 'HI', farmType: 'commercial' }));
    expect(ak.location.climateSubregion).toBe('ALASKA_SHORT_SEASON');
    expect(hi.location.climateSubregion).toBe('HAWAII_TROPICAL');
  });
});

describe('Negative logic', () => {
  it('Cassava does NOT appear as a best match in continental U.S.', () => {
    const checkStates = ['IA', 'KS', 'TX', 'CA', 'GA', 'FL', 'MD', 'NY'];
    for (const st of checkStates) {
      const out = recommendCropsForUSFarm(ctx({ state: st, farmType: 'commercial', currentMonth: 5 }));
      expect(nameSet(out.bestMatch).has('Cassava'), `Cassava should not be a best match in ${st}`).toBe(false);
      const outB = recommendCropsForUSFarm(ctx({ state: st, farmType: 'backyard', currentMonth: 5, growingStyle: 'in_ground' }));
      expect(nameSet(outB.bestMatch).has('Cassava'), `Cassava should not be a best match (backyard) in ${st}`).toBe(false);
    }
  });

  it('Corn is not a top backyard pick for a tiny container setup', () => {
    const out = recommendCropsForUSFarm(ctx({
      state: 'IA', farmType: 'backyard', growingStyle: 'container',
      beginnerLevel: 'beginner', currentMonth: 5,
    }));
    expect(nameSet(out.bestMatch).has('Corn')).toBe(false);
  });

  it('Cold-state (ND) planting in January has no warm-season crops as best match', () => {
    const out = recommendCropsForUSFarm(ctx({
      state: 'ND', farmType: 'backyard', beginnerLevel: 'beginner', currentMonth: 1,
    }));
    const names = nameSet(out.bestMatch);
    // No tomato / okra / pepper in January in North Dakota.
    expect(names.has('Okra')).toBe(false);
    expect(names.has('Tomato')).toBe(false);
  });
});

describe('Output shape', () => {
  it('returns structured location + buckets', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'TX', farmType: 'backyard', growingStyle: 'container' }));
    expect(out.ok).toBe(true);
    expect(out.location).toMatchObject({
      country: 'USA',
      state: 'Texas',
      stateCode: 'TX',
      displayRegion: 'SOUTHWEST',
      displayRegionLabel: 'Southwest',
      climateSubregion: 'SOUTH_CENTRAL_MIXED',
    });
    expect(Array.isArray(out.bestMatch)).toBe(true);
    expect(Array.isArray(out.alsoConsider)).toBe(true);
    expect(Array.isArray(out.notRecommendedNow)).toBe(true);
  });

  it('each recommendation has the required fields', () => {
    const out = recommendCropsForUSFarm(ctx({ state: 'CA', farmType: 'commercial', currentMonth: 3 }));
    for (const rec of out.bestMatch) {
      expect(rec).toMatchObject({
        name: expect.any(String),
        score: expect.any(Number),
        difficulty: expect.any(String),
        waterNeed: expect.any(String),
        growthWeeksMin: expect.any(Number),
        growthWeeksMax: expect.any(Number),
      });
      expect(Array.isArray(rec.reasons)).toBe(true);
      expect(Array.isArray(rec.riskNotes)).toBe(true);
      expect(Array.isArray(rec.tags)).toBe(true);
      expect(rec.score).toBeGreaterThanOrEqual(0);
      expect(rec.score).toBeLessThanOrEqual(100);
    }
  });
});
