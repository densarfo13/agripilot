/**
 * fundingRecommendationEngine.js — pure recommendation + readiness
 * engine for the Smart Funding Hub.
 *
 * Spec port note
 * ──────────────
 * The design doc was written in TypeScript. This file is JavaScript
 * with JSDoc types — the runtime contract is identical.
 *
 * Public API (Apr 2026)
 * ─────────────────────
 *   getFundingRecommendations(ctx) →
 *     { readinessScore, recommendations, readinessTips }
 *   calculateFundingReadiness(ctx) → number  (0..100)
 *
 * Back-compat shim
 *   recommendFundingPrograms(ctx) — older caller shape; returns
 *     just the `recommendations` array. Kept so the rest of the
 *     app doesn't need a coordinated swap.
 *   groupByCategory(cards) — unchanged.
 *
 * Strict-rule audit
 *   • Pure / no I/O / no React / no global state.
 *   • Never throws; missing/unknown inputs degrade to the global
 *     catalog and a 0% readiness score.
 *   • Conservative match reasons — "may be useful", "based on
 *     your location", never "you qualify".
 */

import { FUNDING_PROGRAMS, getRegionFundingCatalog } from '../config/fundingConfig.js';

/** @typedef {import('../config/fundingConfig.js').FundingCategory} FundingCategory */
/** @typedef {import('../config/fundingConfig.js').FundingUserRole} FundingUserRole */
/** @typedef {import('../config/fundingConfig.js').FundingExperience} FundingExperience */
/** @typedef {import('../config/fundingConfig.js').FundingPriority} FundingPriority */

/**
 * @typedef {Object} FundingUserContext
 * @property {string}  [country]
 * @property {string}  [region]
 * @property {string}  [farmType]
 * @property {string}  [cropId]
 * @property {FundingUserRole} [userRole]
 * @property {string|number}   [farmSize]
 * @property {FundingExperience} [experienceType]
 * @property {boolean} [profileCompleted]
 * @property {boolean} [locationConfirmed]
 * @property {boolean} [cropAdded]
 * @property {boolean} [farmSizeAdded]
 * @property {boolean} [hasPhotosOrScanHistory]
 * @property {number}  [completedTasksLast7Days]
 * @property {number}  [activeDaysLast7Days]
 */

const DEFAULT_LIMIT = 5;
const MIN_MATCH_SCORE = 20;

/**
 * Normalise a card's country into the array shape the engine
 * uses internally. Older payloads (pre-Apr 2026 schema) used
 * `countries: string[]`; the new shape is `country: string`. We
 * accept both transparently.
 */
function _cardCountries(card) {
  if (Array.isArray(card?.countries)) return card.countries;
  if (typeof card?.country === 'string') return [card.country];
  return [];
}

function _matchesArray(field, value) {
  if (!Array.isArray(field) || field.length === 0) return false;
  return field.includes(value);
}

/**
 * Score one card against the user context. Mirrors the spec's
 * scoring (§2 in the design doc): country match + role match +
 * experience match + farm-type match + priority bonus.
 *
 * Total score is capped at 100; cards that don't clear
 * MIN_MATCH_SCORE are filtered out by the caller.
 */
function _scoreProgram(program, ctx) {
  let score = 0;
  const countries = _cardCountries(program);

  // Country match — exact wins big; 'global' is a small bonus so
  // global cards still surface for unknown regions without
  // overshadowing region-tagged ones.
  if (ctx.country && countries.includes(ctx.country)) score += 40;
  else if (countries.includes('global') || countries.includes('Default')) score += 15;

  // Region match (string equality — region names are rare; this
  // is a small bump on top of country match for callers that
  // pass region info).
  if (ctx.region && program.region && program.region === ctx.region) score += 10;

  // Farm-type slug match — `bestFor` carries slugs like
  // 'small_farm' / 'backyard' so the lookup is direct.
  if (ctx.farmType && _matchesArray(program.bestFor, ctx.farmType)) score += 25;

  // Experience-class match — gives a softer boost when a farm-
  // type slug isn't passed but we know the experience class.
  if (ctx.experienceType === 'backyard'
    && program.bestFor && program.bestFor.some((x) => x === 'backyard' || x === 'home_garden')) {
    score += 20;
  }
  if (ctx.experienceType === 'farm'
    && program.bestFor && program.bestFor.some((x) =>
      x === 'small_farm' || x === 'community_farm' || x === 'ngo_program' || x === 'large_farm'
    )) {
    score += 15;
  }

  // Role match — NGO-shaped roles favour NGO / partnership /
  // food-security / climate-smart cards.
  if (ctx.userRole === 'ngo_admin'
    && (program.category === 'ngo'
      || program.category === 'partnership'
      || program.category === 'food_security'
      || program.category === 'climate_smart')) {
    score += 15;
  }
  if (ctx.userRole && _matchesArray(program.userRoles, ctx.userRole)) {
    score += 10;
  }

  // Priority bonus — string priority replaces the legacy numeric
  // 1..5. high → +15, medium → +8, low → 0.
  if (program.priority === 'high')   score += 15;
  if (program.priority === 'medium') score += 8;

  if (score < 0)   score = 0;
  if (score > 100) score = 100;
  return score;
}

/**
 * Match-reason string for the FundingCard chip. Conservative —
 * the spec disallows any "you qualify" / "approved" wording.
 */
function _buildMatchReason(program, ctx, readiness) {
  const countries = _cardCountries(program);
  if (ctx.country && countries.includes(ctx.country) && readiness >= 70) {
    return 'Strong match based on your location, profile, and recent activity.';
  }
  if (ctx.country && countries.includes(ctx.country)) {
    return 'Relevant based on your location and farm profile.';
  }
  if (countries.includes('global') || countries.includes('Default')) {
    return 'Useful general support option while Farroway learns more about your region.';
  }
  return 'May be useful based on your profile.';
}

/**
 * @param {FundingUserContext} ctx
 * @returns {number}  readiness score in [0, 100]
 */
export function calculateFundingReadiness(ctx = {}) {
  let score = 0;
  if (ctx.profileCompleted) score += 20;
  if (ctx.locationConfirmed || ctx.country) score += 20;
  if (ctx.cropAdded || ctx.cropId) score += 15;
  if (ctx.farmSizeAdded || ctx.farmSize) score += 10;
  if (ctx.hasPhotosOrScanHistory) score += 10;

  const taskScore  = Math.min((Number(ctx.completedTasksLast7Days) || 0) * 3, 15);
  const activeScore = Math.min((Number(ctx.activeDaysLast7Days) || 0) * 2, 10);
  score += taskScore + activeScore;

  if (!Number.isFinite(score) || score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}

/**
 * Build the full Smart Funding response.
 *
 * @param {FundingUserContext} ctx
 * @returns {{
 *   readinessScore: number,
 *   recommendations: Array<object>,
 *   readinessTips: string[]
 * }}
 */
export function getFundingRecommendations(ctx = {}) {
  const readinessScore = calculateFundingReadiness(ctx);

  const scored = FUNDING_PROGRAMS
    .map((program) => {
      const matchScore = _scoreProgram(program, ctx);
      return {
        ...program,
        // Normalise country for callers expecting either shape.
        countries: _cardCountries(program),
        matchScore,
        matchReason: _buildMatchReason(program, ctx, readinessScore),
      };
    })
    .filter((p) => p.matchScore > MIN_MATCH_SCORE)
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      // Stable secondary sort by id so the same input yields a
      // stable order across renders.
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    })
    .slice(0, DEFAULT_LIMIT);

  const readinessTips = [];
  if (!ctx.locationConfirmed && !ctx.country)        readinessTips.push('Add your farm or garden location.');
  if (!ctx.cropAdded && !ctx.cropId)                 readinessTips.push('Add the crop or plant you are growing.');
  if (!ctx.farmSizeAdded && !ctx.farmSize)           readinessTips.push('Add your farm or garden size if you know it.');
  if (!ctx.hasPhotosOrScanHistory)                   readinessTips.push('Add photos or scan history to strengthen your profile.');
  if ((Number(ctx.completedTasksLast7Days) || 0) < 3) readinessTips.push('Complete more daily actions to build activity history.');

  return { readinessScore, recommendations: scored, readinessTips };
}

// ─── Back-compat shims ─────────────────────────────────────────

/**
 * @deprecated Use `getFundingRecommendations(ctx).recommendations`.
 * Kept so any consumer that imported the older array-only helper
 * keeps working without a coordinated swap.
 */
export function recommendFundingPrograms(input = {}) {
  return getFundingRecommendations(input).recommendations;
}

/** Group recommendations by category — unchanged behaviour. */
export function groupByCategory(cards) {
  const map = new Map();
  if (!Array.isArray(cards)) return map;
  for (const card of cards) {
    const cat = card?.category || 'partnership';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(card);
  }
  return map;
}

/** Re-export for callers that imported the helper from this module. */
export function getRegionFundingCatalogForCountry(country) {
  return getRegionFundingCatalog(country);
}
