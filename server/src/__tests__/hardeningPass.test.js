/**
 * hardeningPass.test.js — recommendation guardrails + status
 * transition helpers + analytics event log + sale-credibility
 * enforcement + offline-queue helpers.
 *
 * 6 sections:
 *   1. validateRecommendationInputs
 *   2. applyWeatherTimingGuardrails / applyRegionCropGuardrails
 *   3. applyConfidenceDowngrade + getRecommendationSanityChecks
 *   4. transitionListingStatus / transitionInterestStatus
 *   5. createListing now requires a cropCycle (unless admin)
 *   6. eventLogService (pure + stub-prisma)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateRecommendationInputs,
  applyWeatherTimingGuardrails,
  applyRegionCropGuardrails,
  applyConfidenceDowngrade,
  getRecommendationSanityChecks,
} from '../services/recommendations/recommendationGuardrails.js';
import {
  transitionListingStatus, transitionInterestStatus,
} from '../services/market/statusTransitions.js';
import {
  logEvent, getEventCounts, getConversionMetrics, EVENT_TYPES,
} from '../services/analytics/eventLogService.js';
import { createListing } from '../services/market/marketService.js';

// ─── 1. validateRecommendationInputs ─────────────────────
describe('validateRecommendationInputs', () => {
  it('accepts a complete US input', () => {
    const out = validateRecommendationInputs({
      country: 'US', state: 'MD', farmType: 'backyard',
      beginnerLevel: 'beginner', growingStyle: 'raised_bed',
      currentMonth: 4,
    });
    expect(out.valid).toBe(true);
    expect(out.errors).toEqual({});
  });

  it('requires a state for US', () => {
    const out = validateRecommendationInputs({ country: 'US' });
    expect(out.valid).toBe(false);
    expect(out.errors.state).toBe('required_for_us');
  });

  it('rejects invalid enums', () => {
    const out = validateRecommendationInputs({
      country: 'US', state: 'MD',
      farmType: 'space_station',
      growingStyle: 'hydroponic_lab',
    });
    expect(out.errors.farmType).toBe('invalid_enum');
    expect(out.errors.growingStyle).toBe('invalid_enum');
  });

  it('rejects invalid months', () => {
    const out = validateRecommendationInputs({ country: 'US', state: 'MD', currentMonth: 14 });
    expect(out.errors.currentMonth).toBe('invalid_month');
  });

  it('warns when state is missing (accuracy concern)', () => {
    const out = validateRecommendationInputs({ country: 'GH' });
    expect(out.valid).toBe(true);
    expect(out.warnings.location).toBe('state_missing_reduces_accuracy');
  });
});

// ─── 2. Weather + region guardrails ──────────────────────
describe('applyWeatherTimingGuardrails', () => {
  it('softens planting for rain-sensitive crops with heavy rain soon', () => {
    const out = applyWeatherTimingGuardrails(
      { crop: 'tomato' },
      { rainMmNext24h: 30, rainChancePct: 90 },
    );
    expect(out.softenPlanting).toBe(true);
    expect(out.warningKey).toBe('recommendation.warning.heavyRainSoon');
  });

  it('does not soften when the crop is not rain-sensitive', () => {
    const out = applyWeatherTimingGuardrails(
      { crop: 'sorghum' },
      { rainMmNext24h: 30, rainChancePct: 90 },
    );
    expect(out.softenPlanting).toBe(false);
  });

  it('does not soften on clear forecast', () => {
    const out = applyWeatherTimingGuardrails(
      { crop: 'tomato' },
      { rainMmNext24h: 0, rainChancePct: 10 },
    );
    expect(out.softenPlanting).toBe(false);
  });
});

describe('applyRegionCropGuardrails', () => {
  it('caps tropical crops outside tropical US regions', () => {
    const out = applyRegionCropGuardrails(
      { crop: 'cassava' },
      { country: 'US', climateSubregion: 'MID_ATLANTIC' },
    );
    expect(out.capScore).toBeLessThanOrEqual(50);
    expect(out.warningKey).toBe('recommendation.warning.tropicalOutsideClimate');
  });

  it('allows tropical crops in Florida / Hawaii', () => {
    const out = applyRegionCropGuardrails(
      { crop: 'cassava' },
      { country: 'US', climateSubregion: 'FLORIDA_SUBTROPICAL' },
    );
    expect(out.capScore).toBeUndefined();
  });

  it('warns on off-season planting', () => {
    const out = applyRegionCropGuardrails(
      { crop: 'tomato', plantingStatus: 'avoid' },
      { country: 'US', climateSubregion: 'MID_ATLANTIC' },
    );
    expect(out.warningKey).toBe('recommendation.warning.offSeason');
  });
});

// ─── 3. Confidence downgrade + composite check ──────────
describe('applyConfidenceDowngrade', () => {
  it('downgrades when state is missing in US', () => {
    expect(applyConfidenceDowngrade('high', { region: { country: 'US' } })).toBe('medium');
  });

  it('caps at low for browse-only support depth', () => {
    expect(applyConfidenceDowngrade('high', {
      crop: { supportDepth: 'BROWSE_ONLY' },
    })).toBe('low');
  });

  it('caps at low for COMING_SOON countries', () => {
    expect(applyConfidenceDowngrade('high', {
      region: { supportTier: 'COMING_SOON' },
    })).toBe('low');
  });

  it('keeps high confidence when data is complete', () => {
    expect(applyConfidenceDowngrade('high', {
      region: { country: 'US', stateCode: 'MD', supportTier: 'FULL_SUPPORT' },
      crop: { supportDepth: 'FULLY_GUIDED' },
    })).toBe('high');
  });
});

describe('getRecommendationSanityChecks', () => {
  it('emits weather + region warnings and confidence downgrade together', () => {
    const out = getRecommendationSanityChecks({
      input: { country: 'US', state: 'MD', currentMonth: 4 },
      region: { country: 'US', climateSubregion: 'MID_ATLANTIC', supportTier: 'FULL_SUPPORT' },
      crop: { crop: 'cassava', confidence: 'medium', supportDepth: 'BROWSE_ONLY' },
      weather: { rainMmNext24h: 0, rainChancePct: 5 },
    });
    expect(out.warnings).toContain('recommendation.warning.tropicalOutsideClimate');
    expect(out.confidence).toBe('low');
    expect(out.metadata.climateSubregion).toBe('MID_ATLANTIC');
    expect(out.metadata.guardrailsApplied).toContain('regionCrop');
  });
});

// ─── 4. Status transition services ───────────────────────
function makeListingStub(initial = {}) {
  const listing = { id: 'L1', farmerId: 'u-farmer', status: 'active', ...initial };
  const interests = new Map();
  return {
    _state: { listing, interests },
    cropListing: {
      findUnique: async ({ where }) => where.id === listing.id ? listing : null,
      update: async ({ where, data }) => {
        Object.assign(listing, data);
        return listing;
      },
    },
    marketInterest: {
      findUnique: async ({ where, include }) => {
        const row = interests.get(where.id);
        if (!row) return null;
        return include?.listing ? { ...row, listing } : row;
      },
      update: async ({ where, data }) => {
        const row = interests.get(where.id);
        Object.assign(row, data);
        return row;
      },
    },
  };
}

describe('transitionListingStatus', () => {
  it('allows active → sold', async () => {
    const prisma = makeListingStub({ status: 'active' });
    const out = await transitionListingStatus(prisma, {
      user: { id: 'u-farmer' }, id: 'L1', to: 'sold',
    });
    expect(out.listing.status).toBe('sold');
  });

  it('rejects sold → active for non-admins', async () => {
    const prisma = makeListingStub({ status: 'sold' });
    await expect(transitionListingStatus(prisma, {
      user: { id: 'u-farmer' }, id: 'L1', to: 'active',
    })).rejects.toThrow('invalid_status_transition');
  });

  it('admin override bypasses the machine', async () => {
    const prisma = makeListingStub({ status: 'sold' });
    const out = await transitionListingStatus(prisma, {
      user: { id: 'u-admin', role: 'admin' }, id: 'L1', to: 'active',
    });
    expect(out.listing.status).toBe('active');
  });

  it('rejects non-owner non-admin', async () => {
    const prisma = makeListingStub();
    await expect(transitionListingStatus(prisma, {
      user: { id: 'u-other' }, id: 'L1', to: 'sold',
    })).rejects.toThrow('forbidden');
  });
});

describe('transitionInterestStatus', () => {
  it('pending → accepted works for the listing owner', async () => {
    const prisma = makeListingStub();
    prisma._state.interests.set('I1', { id: 'I1', listingId: 'L1', buyerId: 'u-buyer', status: 'pending' });
    const out = await transitionInterestStatus(prisma, {
      user: { id: 'u-farmer' }, id: 'I1', to: 'accepted',
    });
    expect(out.interest.status).toBe('accepted');
  });

  it('rejects pending → pending', async () => {
    const prisma = makeListingStub();
    prisma._state.interests.set('I1', { id: 'I1', listingId: 'L1', buyerId: 'u-buyer', status: 'pending' });
    await expect(transitionInterestStatus(prisma, {
      user: { id: 'u-farmer' }, id: 'I1', to: 'pending',
    })).rejects.toThrow('invalid_status_transition');
  });

  it('rejects accepted → declined (one-shot)', async () => {
    const prisma = makeListingStub();
    prisma._state.interests.set('I1', { id: 'I1', listingId: 'L1', buyerId: 'u-buyer', status: 'accepted' });
    await expect(transitionInterestStatus(prisma, {
      user: { id: 'u-farmer' }, id: 'I1', to: 'declined',
    })).rejects.toThrow('invalid_status_transition');
  });
});

// ─── 5. Supply credibility — listing requires harvest ───
describe('createListing supply credibility', () => {
  function makePrismaStub() {
    const listings = new Map();
    let seq = 0;
    return {
      _state: { listings },
      cropListing: {
        create: async ({ data }) => {
          const id = 'L' + (++seq);
          const row = { id, ...data, status: data.status || 'draft', createdAt: new Date(), updatedAt: new Date() };
          listings.set(id, row);
          return row;
        },
      },
      eventLog: { create: async () => null },
    };
  }

  it('blocks farmer-created listing without a crop cycle', async () => {
    const prisma = makePrismaStub();
    await expect(createListing(prisma, {
      user: { id: 'u-farmer' },
      data: { cropKey: 'tomato', quantity: 10, quality: 'high', country: 'US' },
    })).rejects.toThrow('listing_requires_harvest_context');
  });

  it('allows listing WITH a crop cycle id', async () => {
    const prisma = makePrismaStub();
    const out = await createListing(prisma, {
      user: { id: 'u-farmer' },
      data: { cropKey: 'tomato', quantity: 10, quality: 'high', country: 'US', cropCycleId: 'c1' },
    });
    expect(out.listing.cropCycleId).toBe('c1');
  });

  it('allows explicit manual override (admin tooling)', async () => {
    const prisma = makePrismaStub();
    const out = await createListing(prisma, {
      user: { id: 'u-farmer' },
      allowManualWithoutHarvest: true,
      data: { cropKey: 'tomato', quantity: 10, quality: 'high', country: 'US' },
    });
    expect(out.listing.cropKey).toBe('tomato');
  });

  it('allows admin users to create without a cycle', async () => {
    const prisma = makePrismaStub();
    const out = await createListing(prisma, {
      user: { id: 'u-admin', role: 'admin' },
      data: { cropKey: 'tomato', quantity: 10, quality: 'high', country: 'US' },
    });
    expect(out.listing.cropKey).toBe('tomato');
  });
});

// ─── 6. Event log service ────────────────────────────────
describe('eventLogService', () => {
  let prisma;
  beforeEach(() => {
    const rows = [];
    prisma = {
      _state: { rows },
      eventLog: {
        create: async ({ data }) => {
          const row = { id: 'E' + (rows.length + 1), occurredAt: new Date(), ...data };
          rows.push(row);
          return row;
        },
        groupBy: async ({ by, where, _count }) => {
          let filtered = rows;
          if (where?.eventType?.in) filtered = filtered.filter((r) => where.eventType.in.includes(r.eventType));
          const buckets = {};
          for (const r of filtered) buckets[r.eventType] = (buckets[r.eventType] || 0) + 1;
          return Object.entries(buckets).map(([eventType, n]) => ({ eventType, _count: { _all: n } }));
        },
      },
    };
  });

  it('logEvent rejects unknown event types silently (returns null)', async () => {
    const out = await logEvent(prisma, {
      user: { id: 'u1' }, eventType: 'definitely_not_a_thing',
    });
    expect(out).toBeNull();
    expect(prisma._state.rows).toHaveLength(0);
  });

  it('logEvent persists a known event', async () => {
    const out = await logEvent(prisma, {
      user: { id: 'u1' }, eventType: EVENT_TYPES.HARVEST_SUBMITTED,
      metadata: { cropKey: 'tomato' },
    });
    expect(out.eventType).toBe('harvest_submitted');
    expect(prisma._state.rows).toHaveLength(1);
  });

  it('getConversionMetrics derives honest rates', async () => {
    await logEvent(prisma, { user: { id: 'u1' }, eventType: EVENT_TYPES.HARVEST_SUBMITTED });
    await logEvent(prisma, { user: { id: 'u1' }, eventType: EVENT_TYPES.HARVEST_SUBMITTED });
    await logEvent(prisma, { user: { id: 'u1' }, eventType: EVENT_TYPES.LISTING_CREATED });
    await logEvent(prisma, { user: { id: 'u2' }, eventType: EVENT_TYPES.BUYER_INTEREST_SUBMITTED });
    await logEvent(prisma, { user: { id: 'u2' }, eventType: EVENT_TYPES.INTEREST_ACCEPTED });
    await logEvent(prisma, { user: { id: 'u3' }, eventType: EVENT_TYPES.INTEREST_DECLINED });

    const m = await getConversionMetrics(prisma, {});
    expect(m.harvestToListingRate).toBeCloseTo(0.5);
    expect(m.interestsPerListing).toBe(1);
    expect(m.acceptRate).toBeCloseTo(0.5);
  });

  it('getConversionMetrics returns nulls when denominators are zero', async () => {
    const m = await getConversionMetrics(prisma, {});
    expect(m.harvestToListingRate).toBeNull();
    expect(m.interestsPerListing).toBeNull();
    expect(m.acceptRate).toBeNull();
  });
});
