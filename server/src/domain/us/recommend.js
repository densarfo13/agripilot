/**
 * recommend.js — top-level recommendation entry point.
 *
 * Given a farmer context (country, state, farmType, growingStyle,
 * purpose, beginnerLevel, currentMonth), this module returns the
 * bucketed list the API exposes to the frontend.
 *
 *   const out = recommendCropsForUSFarm(ctx);
 *   out.location          { country, state, displayRegion, climateSubregion }
 *   out.bestMatch         [ {name, score, reasons, tags, ...} ]
 *   out.alsoConsider      [ ... ]
 *   out.notRecommendedNow [ ... ]
 *
 * Pure function — no DB, no HTTP, easy to unit-test.
 */

import { resolveLocationProfile, US_STATES } from './usStates.js';
import { RULE_INDEX } from './cropRules.js';
import { scoreCrop, buildRecommendationBuckets } from './scoringEngine.js';

const VALID_FARM_TYPES = new Set(['backyard', 'small_farm', 'commercial']);
const VALID_BEGINNER_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const VALID_GROWING_STYLES = new Set(['container', 'raised_bed', 'in_ground', 'mixed']);
const VALID_PURPOSES = new Set(['home_food', 'sell_locally', 'learning', 'mixed']);

/**
 * Validate + normalize the inbound context. Returns either
 * { ok: true, ctx } or { ok: false, error: 'reason' }.
 */
export function validateRecommendationContext(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'missing_body' };
  const country = String(input.country || 'USA').toUpperCase();
  if (!['USA', 'US'].includes(country)) return { ok: false, error: 'unsupported_country' };

  const stateProfile = resolveLocationProfile(input.state);
  if (!stateProfile) return { ok: false, error: 'unknown_state' };

  const farmType = String(input.farmType || '').toLowerCase();
  if (!VALID_FARM_TYPES.has(farmType)) return { ok: false, error: 'invalid_farm_type' };

  const beginnerLevel = input.beginnerLevel
    ? String(input.beginnerLevel).toLowerCase()
    : 'beginner';
  if (!VALID_BEGINNER_LEVELS.has(beginnerLevel)) return { ok: false, error: 'invalid_beginner_level' };

  const growingStyle = input.growingStyle
    ? String(input.growingStyle).toLowerCase()
    : null;
  if (growingStyle && !VALID_GROWING_STYLES.has(growingStyle)) {
    return { ok: false, error: 'invalid_growing_style' };
  }

  const purpose = input.purpose
    ? String(input.purpose).toLowerCase()
    : null;
  if (purpose && !VALID_PURPOSES.has(purpose)) {
    return { ok: false, error: 'invalid_purpose' };
  }

  const currentMonth = Number.isFinite(input.currentMonth)
    ? clampMonth(input.currentMonth)
    : new Date().getMonth() + 1;

  return {
    ok: true,
    ctx: {
      country: 'USA',
      stateProfile,
      farmType,
      beginnerLevel,
      growingStyle,
      purpose,
      currentMonth,
    },
  };
}

function clampMonth(m) {
  const n = Math.round(Number(m));
  if (n < 1) return 1;
  if (n > 12) return 12;
  return n;
}

/**
 * Return the list of candidate rules for the given farm type and
 * subregion. Small-farm falls back to commercial when a specific
 * small-farm row isn't present (seed coverage is still growing).
 */
export function getCandidateRules({ farmType, climateSubregion }) {
  const bySubregion = RULE_INDEX[farmType] || {};
  const rows = bySubregion[climateSubregion] || [];
  if (farmType === 'small_farm' && rows.length === 0) {
    return (RULE_INDEX.commercial || {})[climateSubregion] || [];
  }
  return rows;
}

/**
 * Main entry point — returns the full bucketed recommendation payload.
 */
export function recommendCropsForUSFarm(input) {
  const v = validateRecommendationContext(input);
  if (!v.ok) {
    return { ok: false, error: v.error };
  }
  const { ctx } = v;

  const rules = getCandidateRules({
    farmType: ctx.farmType,
    climateSubregion: ctx.stateProfile.climateSubregion,
  });

  const scored = [];
  const seen = new Set();
  for (const rule of rules) {
    // In the unlikely case of duplicate (crop, farmType, subregion)
    // rows, keep the first (seed authority) and skip the rest.
    const sig = `${rule.crop}:${rule.farmType}:${rule.climateSubregion}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    const rec = scoreCrop({ rule, stateProfile: ctx.stateProfile, ctx });
    if (rec) scored.push(rec);
  }

  scored.sort((a, b) => b.score - a.score);
  const buckets = buildRecommendationBuckets(scored);

  return {
    ok: true,
    location: {
      country: 'USA',
      state: ctx.stateProfile.name,
      stateCode: ctx.stateProfile.code,
      displayRegion: ctx.stateProfile.displayRegion,
      displayRegionLabel: ctx.stateProfile.displayRegionLabel,
      climateSubregion: ctx.stateProfile.climateSubregion,
    },
    farmType: ctx.farmType,
    beginnerLevel: ctx.beginnerLevel,
    growingStyle: ctx.growingStyle,
    purpose: ctx.purpose,
    currentMonth: ctx.currentMonth,
    ...buckets,
  };
}

/** Exported for diagnostics / tooling. */
export const _DOMAIN = { US_STATES };
