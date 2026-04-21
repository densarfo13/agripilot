/**
 * locationIntelligence.test.js — Location Intelligence Engine suite.
 *
 * Covers spec §9:
 *   1. regionProfile mapping works
 *   2. crop recommendation returns valid result
 *   3. daily task always returns at least one task
 *   4. risk engine returns valid level
 *   5. integration does not break existing flows (issue creation)
 *   6. fallback works when data missing
 */

import { describe, it, expect, beforeEach } from 'vitest';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
    addEventListener: () => {}, removeEventListener: () => {},
  };
}

import {
  getRegionProfile,
} from '../../../src/lib/location/regionProfile.js';
import {
  getBestCrops,
} from '../../../src/lib/crops/recommendationEngine.js';
import {
  getDailyTask,
} from '../../../src/lib/tasks/dailyTaskEngine.js';
import {
  getRisk,
} from '../../../src/lib/risk/riskEngine.js';
import {
  setRegionProfileCached, getRegionProfileCached,
  setLastRecommendation,  getLastRecommendation,
  setLastRisk,            getLastRisk,
} from '../../../src/store/farrowayLocal.js';
import {
  createIssue, _internal as issueInternal,
} from '../../../src/lib/issues/issueStore.js';

const JAN = new Date(2026, 0, 15);  // winter in NH
const JUL = new Date(2026, 6, 15);  // summer in NH

beforeEach(() => {
  installLocalStorage();
  issueInternal.clearAll();
});

// ─── Region profile ──────────────────────────────────────────────
describe('getRegionProfile', () => {
  it('GH defaults to tropical / high rainfall', () => {
    const p = getRegionProfile({ countryCode: 'GH', now: JUL });
    expect(p.climate).toBe('tropical');
    expect(p.rainfallPattern).toBe('high');
    expect(p.season).toBe('wet'); // July in tropical
    expect(p.source).toBe('country_default');
  });

  it('US default is temperate moderate', () => {
    const p = getRegionProfile({ countryCode: 'US', state: 'NY', now: JAN });
    expect(p.climate).toBe('temperate');
    expect(p.season).toBe('winter');
    expect(p.source).toBe('country_default');
  });

  it('US Florida is tropical (state override)', () => {
    const p = getRegionProfile({ countryCode: 'US', state: 'FL', now: JUL });
    expect(p.climate).toBe('tropical');
    expect(p.rainfallPattern).toBe('high');
    expect(p.source).toBe('rule_match');
  });

  it('US Arizona is arid', () => {
    const p = getRegionProfile({ countryCode: 'US', state: 'AZ', now: JUL });
    expect(p.climate).toBe('arid');
    expect(p.rainfallPattern).toBe('low');
    expect(p.source).toBe('rule_match');
  });

  it('IN Rajasthan is arid (state override)', () => {
    const p = getRegionProfile({ countryCode: 'IN', state: 'RJ', now: JUL });
    expect(p.climate).toBe('arid');
  });

  it('Unknown country → fallback temperate', () => {
    const p = getRegionProfile({ countryCode: 'ZZ', now: JUL });
    expect(p.climate).toBe('temperate');
    expect(p.source).toBe('fallback');
  });

  it('month drives season for temperate', () => {
    const w = getRegionProfile({ countryCode: 'FR', now: JAN });
    const s = getRegionProfile({ countryCode: 'FR', now: JUL });
    expect(w.season).toBe('winter');
    expect(s.season).toBe('summer');
  });

  it('output is frozen', () => {
    const p = getRegionProfile({ countryCode: 'GH', now: JUL });
    expect(Object.isFrozen(p)).toBe(true);
  });
});

// ─── Crop recommendation ─────────────────────────────────────────
describe('getBestCrops', () => {
  it('tropical → cassava is top', () => {
    const rp = getRegionProfile({ countryCode: 'GH', now: new Date(2026, 2, 1) }); // March, dry-ish
    const r = getBestCrops({ regionProfile: rp });
    expect(r.best).toBeTruthy();
    expect(typeof r.best).toBe('string');
    // Season may reorder — allow drought-resistant override when dry.
    expect(['cassava', 'sorghum', 'millet']).toContain(r.best);
    expect(r.alternatives.length).toBeGreaterThan(0);
  });

  it('temperate → wheat is top in shoulder season', () => {
    const rp = getRegionProfile({ countryCode: 'FR', now: new Date(2026, 3, 1) }); // spring
    const r = getBestCrops({ regionProfile: rp });
    expect(r.best).toBe('wheat');
  });

  it('arid → sorghum is top', () => {
    const rp = getRegionProfile({ countryCode: 'US', state: 'AZ', now: JUL });
    const r = getBestCrops({ regionProfile: rp });
    expect(['sorghum', 'millet']).toContain(r.best);
  });

  it('dry season promotes drought-resistant to the top', () => {
    // Tropical country but "dry" season → sorghum should surface.
    const rp = getRegionProfile({ countryCode: 'GH', now: new Date(2026, 0, 1) }); // Jan → dry
    expect(rp.season).toBe('dry');
    const r = getBestCrops({ regionProfile: rp });
    expect(['sorghum', 'millet', 'cassava']).toContain(r.best);
  });

  it('missing regionProfile → safe fallback', () => {
    const r = getBestCrops({});
    expect(r.best).toBeTruthy();
    expect(r.source).toBe('fallback');
  });

  it('output is frozen with reason + reasonKey', () => {
    const rp = getRegionProfile({ countryCode: 'GH', now: JUL });
    const r = getBestCrops({ regionProfile: rp });
    expect(Object.isFrozen(r)).toBe(true);
    expect(r.reason).toBeTruthy();
    expect(r.reasonKey).toMatch(/^crops\.reason\./);
  });
});

// ─── Daily task ──────────────────────────────────────────────────
describe('getDailyTask', () => {
  it('always returns at least one primaryTask', () => {
    const r1 = getDailyTask({});
    expect(r1.primaryTask).toBeTruthy();
    expect(r1.primaryTask.id).toBeTruthy();
    const r2 = getDailyTask({ crop: 'maize', stage: 'mid_growth' });
    expect(r2.primaryTask).toBeTruthy();
  });

  it('rain + harvest → harvest_early', () => {
    const r = getDailyTask({
      crop: 'maize', stage: 'harvest',
      weather: { status: 'rain_expected' },
    });
    expect(r.primaryTask.id).toBe('loc.harvest_early');
    expect(r.primaryTask.priority).toBe('high');
  });

  it('dry + planting → irrigate_before_planting', () => {
    const r = getDailyTask({
      crop: 'maize', stage: 'planting',
      weather: { status: 'low_rain' },
    });
    expect(r.primaryTask.id).toBe('loc.irrigate_before_planting');
  });

  it('planting (no weather) → prepare_and_plant', () => {
    const r = getDailyTask({ crop: 'maize', stage: 'planting' });
    expect(r.primaryTask.id).toBe('loc.prepare_and_plant');
  });

  it('wet season bumps the secondary drainage check', () => {
    const rp = getRegionProfile({ countryCode: 'GH', now: JUL });
    const r = getDailyTask({
      crop: 'maize', stage: 'planting', regionProfile: rp,
    });
    expect(r.primaryTask.id).toBe('loc.prepare_and_plant');
    expect(r.secondaryTask && r.secondaryTask.id).toBe('loc.check_drainage');
  });

  it('completely empty input → always produces SOME primaryTask', () => {
    const r = getDailyTask({});
    expect(r.primaryTask).toBeTruthy();
    expect(typeof r.primaryTask.id).toBe('string');
    expect(r.primaryTask.id.length).toBeGreaterThan(0);
  });

  it('output is frozen', () => {
    const r = getDailyTask({ crop: 'maize', stage: 'planting' });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.primaryTask)).toBe(true);
  });
});

// ─── Risk engine ─────────────────────────────────────────────────
describe('getRisk', () => {
  it('tropical + wet + cassava → high pest risk', () => {
    const rp = getRegionProfile({ countryCode: 'GH', now: JUL });
    const r = getRisk({ crop: 'cassava', regionProfile: rp });
    expect(r.level).toBe('high');
    expect(r.type).toBe('pest');
  });

  it('temperate + winter → low risk', () => {
    const rp = getRegionProfile({ countryCode: 'FR', now: JAN });
    const r = getRisk({ crop: 'wheat', regionProfile: rp });
    expect(r.level).toBe('low');
  });

  it('arid + dry → medium weather risk', () => {
    const rp = getRegionProfile({ countryCode: 'US', state: 'AZ', now: JAN });
    const r = getRisk({ crop: 'sorghum', regionProfile: rp });
    expect(r.level).toBe('medium');
    expect(r.type).toBe('weather');
  });

  it('repeated issues bump level by one band', () => {
    const rp = getRegionProfile({ countryCode: 'US', state: 'AZ', now: JAN });
    const base = getRisk({ crop: 'sorghum', regionProfile: rp });
    const boosted = getRisk({ crop: 'sorghum', regionProfile: rp, recentIssueCount: 5 });
    const order = ['low', 'medium', 'high'];
    expect(order.indexOf(boosted.level)).toBeGreaterThanOrEqual(order.indexOf(base.level));
    expect(boosted.reasons.some((r) => r.rule === 'repeated_farm_issues')).toBe(true);
  });

  it('missing regionProfile → safe low default', () => {
    const r = getRisk({ crop: 'maize' });
    expect(r.level).toBe('low');
    expect(Object.isFrozen(r)).toBe(true);
  });
});

// ─── Integration: issue creation attaches region + riskLevel ─────
describe('issue creation attaches location intelligence', () => {
  it('stamps region + riskLevel when the location is an ISO country code', () => {
    const iss = createIssue({
      farmerId: 'u1', farmId: 'f1',
      issueType: 'pest', description: 'armyworms', crop: 'cassava',
      location: 'GH',
      autoTriage: false,
    });
    expect(iss.region).toBe('*');   // GH country-default, no state
    expect(['low', 'medium', 'high']).toContain(iss.riskLevel);
  });

  it('falls back cleanly when location isn\u2019t an ISO code', () => {
    const iss = createIssue({
      issueType: 'pest', description: 'x', crop: 'maize',
      location: 'Somewhere Remote', autoTriage: false,
    });
    // riskLevel is null when we can't derive a regionProfile.
    expect(iss.region).toBe('Somewhere Remote');
    expect(iss.riskLevel).toBeNull();
  });

  it('issue creation still works with no location at all', () => {
    const iss = createIssue({
      issueType: 'pest', description: 'x', crop: 'maize',
      autoTriage: false,
    });
    expect(iss).toBeTruthy();
    expect(iss.region).toBeNull();
    expect(iss.riskLevel).toBeNull();
  });
});

// ─── Storage helpers ─────────────────────────────────────────────
describe('farrowayLocal location-intelligence cache', () => {
  it('regionProfile round-trips', () => {
    const p = getRegionProfile({ countryCode: 'GH', now: JUL });
    setRegionProfileCached(p);
    const back = getRegionProfileCached();
    expect(back).toBeTruthy();
    expect(back.climate).toBe('tropical');
    expect(back.cachedAt).toBeGreaterThan(0);
  });

  it('lastRecommendation + lastRisk round-trip', () => {
    const rp = getRegionProfile({ countryCode: 'GH', now: JUL });
    setLastRecommendation(getBestCrops({ regionProfile: rp }));
    setLastRisk(getRisk({ crop: 'cassava', regionProfile: rp }));
    expect(getLastRecommendation().best).toBeTruthy();
    expect(getLastRisk().level).toBeTruthy();
  });

  it('null input to cache setters is a no-op', () => {
    expect(setRegionProfileCached(null)).toBe(false);
    expect(setLastRecommendation(undefined)).toBe(false);
    expect(setLastRisk(null)).toBe(false);
  });
});
