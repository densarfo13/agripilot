/**
 * fundingRecommendationEngine.js — pure recommendation function for
 * the Funding Hub.
 *
 * Position
 * ────────
 * Sister to the existing `src/funding/fundingMatcher.js` (which
 * scores live opportunities against a specific farm). This engine
 * filters + ranks the static catalog in `src/config/fundingConfig.js`
 * by the consumer's region and role context.
 *
 * Strict-rule audit
 *   • Pure / no I/O / no React / no global state.
 *   • Never throws; missing/unknown inputs degrade to the global
 *     catalog.
 *   • Output shape matches the spec: `{title, category, description,
 *     bestFor, eligibilityHint, nextStep, priority, externalUrl,
 *     sourceType, ...}`. The returned cards carry the catalog id so
 *     consumers can wire analytics + dedupe.
 */

import {
  FUNDING_CATALOG,
  getRegionFundingCatalog,
} from '../config/fundingConfig.js';

/** @typedef {import('../config/fundingConfig.js').FundingCategory} FundingCategory */
/** @typedef {import('../config/fundingConfig.js').FundingUserRole} FundingUserRole */
/** @typedef {import('../config/fundingConfig.js').FundingExperience} FundingExperience */

const DEFAULT_LIMIT = 12;

function _matchesArray(field, value) {
  if (!Array.isArray(field) || field.length === 0) return false;
  return field.includes(value);
}

/**
 * Score each card against the input. The score drives the
 * "Recommended for you" ordering; the priority field acts as a
 * tiebreaker so explicit catalog priority always wins for cards
 * with the same fit.
 *
 *   role match           +30
 *   experience match     +20
 *   country exact match  +25
 *   global card bonus    +5  (so generics surface for unknown
 *                              regions without overshadowing
 *                              region-tagged cards)
 *
 * priority drops the score by `priority` so 1 ≻ 2 ≻ 3.
 * Final score is clamped into [0, 100].
 */
function _score(card, input) {
  let s = 0;
  if (input.userRole && _matchesArray(card.userRoles, input.userRole)) s += 30;
  if (input.experienceType && _matchesArray(card.experiences, input.experienceType)) s += 20;
  if (input.country && _matchesArray(card.countries, input.country)) s += 25;
  if (Array.isArray(card.countries) && card.countries.includes('Default')) s += 5;
  if (Number.isFinite(card.priority)) s -= card.priority;
  if (s < 0) s = 0;
  if (s > 100) s = 100;
  return s;
}

/**
 * Filter step. We KEEP a card when:
 *   • country matches OR card is tagged Default (global), AND
 *   • experienceType matches when provided, AND
 *   • userRole matches when provided.
 *
 * `null` / `undefined` for any input is treated as "no filter" —
 * catalog cards must still match by their own role/experience tags.
 */
function _filter(card, input) {
  // Country filter — strict for region-tagged cards, but always
  // allow Default cards through so unknown regions still see the
  // global pool.
  if (input.country) {
    const inCountry = _matchesArray(card.countries, input.country);
    const inDefault = _matchesArray(card.countries, 'Default');
    if (!inCountry && !inDefault) return false;
  }
  // Experience filter — when provided, must match.
  if (input.experienceType) {
    if (!_matchesArray(card.experiences, input.experienceType)) return false;
  }
  // Role filter — when provided, must match.
  if (input.userRole) {
    if (!_matchesArray(card.userRoles, input.userRole)) return false;
  }
  return true;
}

/**
 * Build the recommendation list.
 *
 * @param {object} input
 * @param {string} [input.country]
 * @param {string} [input.region]
 * @param {string} [input.farmType]
 * @param {string} [input.cropId]
 * @param {FundingUserRole} [input.userRole]
 * @param {number} [input.farmSize]
 * @param {FundingExperience} [input.experienceType]
 * @param {number} [input.limit]
 * @returns {Array<object>}  catalog cards augmented with a numeric
 *                            `_score` for diagnostics; consumers
 *                            should ignore that field for display.
 */
export function recommendFundingPrograms(input = {}) {
  const limit = Number.isFinite(input.limit) && input.limit > 0
    ? Math.floor(input.limit)
    : DEFAULT_LIMIT;
  const safeInput = {
    country:        input.country || null,
    region:         input.region  || null,
    farmType:       input.farmType || null,
    cropId:         input.cropId   || null,
    userRole:       input.userRole || null,
    farmSize:       Number.isFinite(input.farmSize) ? input.farmSize : null,
    experienceType: input.experienceType || null,
  };
  const filtered = FUNDING_CATALOG.filter((card) => _filter(card, safeInput));
  const scored = filtered.map((card) => ({
    ...card,
    _score: _score(card, safeInput),
  }));
  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    // Stable tie-break by id so the same input always yields the
    // same order.
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  return scored.slice(0, limit);
}

/**
 * groupByCategory — convenience for the Hub UI which renders by
 * section. Returns a Map<FundingCategory, card[]> preserving the
 * upstream score order within each bucket.
 */
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

/**
 * getRegionFundingCatalogForCountry — pass-through to the config so
 * callers don't need to import two modules. Useful for surfaces that
 * want the country-specific list without engine filtering (e.g. a
 * "see everything available in your country" link).
 */
export function getRegionFundingCatalogForCountry(country) {
  return getRegionFundingCatalog(country);
}
