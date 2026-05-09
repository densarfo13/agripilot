/**
 * intelligenceContext — normalizes ad-hoc input into a stable
 * IntelligenceContext shape that every downstream engine
 * (prediction, scoring, risk, trust, optimization) consumes.
 *
 * RULES (spec §2)
 *   • Tolerates EVERY missing field — never throws.
 *   • Returns a frozen, fully-populated object so consumers can
 *     read any property without `?.` chains.
 *   • Default values use `null` for scalars, `[]` for lists.
 *   • Timestamp is always present (ISO8601 UTC).
 */

import { CONFIDENCE } from './intelligenceTypes.js';

/**
 * Coerce an arbitrary value to a string when it's truthy and a
 * primitive; otherwise return null. Lets us safely unwrap input
 * shapes like `{ region: 'NG-Lagos' }` or `{ region: null }` or
 * `{ region: undefined }` without `typeof` ladders at the call
 * site.
 */
function _str(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function _arr(v) {
  return Array.isArray(v) ? v : [];
}

function _num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a normalized intelligence context. Tolerates partial
 * input, never throws, returns a frozen envelope safe for every
 * downstream engine.
 *
 * @param {object} [input]
 * @returns {import('./intelligenceTypes.js').IntelligenceContext}
 */
export function buildIntelligenceContext(input = {}) {
  const safe = (input && typeof input === 'object') ? input : {};
  let timestamp = '';
  try { timestamp = new Date().toISOString(); }
  catch { timestamp = ''; }

  // Coerce role/mode to the canonical lower-case forms used by
  // every downstream engine. Unknown values fall through to null
  // so the engines hit their generic-fallback branches instead
  // of guessing.
  const rawRole = _str(safe.role);
  const role = (rawRole && ['farmer', 'gardener', 'buyer', 'ngo', 'admin'].includes(rawRole.toLowerCase()))
    ? rawRole.toLowerCase() : null;
  const rawMode = _str(safe.mode);
  const mode = (rawMode === 'farm' || rawMode === 'garden') ? rawMode : null;

  // Profile sub-block (May 2026 regional-funding fix). The
  // raw input may carry `profile.experienceLevel` /
  // `profile.farmerType` from auth; we copy the small flat
  // fields that downstream engines actually read so the
  // canonical context isn't a hostile filter for them.
  const rawProfile = (safe.profile && typeof safe.profile === 'object') ? safe.profile : {};
  const profile = Object.freeze({
    experienceLevel: _str(rawProfile.experienceLevel),
    farmerType:      _str(rawProfile.farmerType),
  });

  return Object.freeze({
    userId:           _str(safe.userId),
    role,
    mode,
    // ISO-3166 country code (e.g. 'us', 'gh', 'ng'). Distinct
    // from `region` (state/county) so the funding scorer can
    // weight country + region independently.
    country:          _str(safe.country),
    region:           _str(safe.region),
    weather:          (safe.weather && typeof safe.weather === 'object') ? safe.weather : null,
    crop:             _str(safe.crop),
    cropStage:        _str(safe.cropStage),
    farmSize:         _num(safe.farmSize),
    gardenContainer:  _str(safe.gardenContainer),
    scanHistory:      _arr(safe.scanHistory),
    soilChecks:       _arr(safe.soilChecks),
    tasks:            _arr(safe.tasks),
    progressEvents:   _arr(safe.progressEvents),
    produceListings:  _arr(safe.produceListings),
    buyerInterest:    _arr(safe.buyerInterest),
    fundingMatches:   _arr(safe.fundingMatches),
    language:         _str(safe.language),
    profile,
    timestamp,
  });
}

/**
 * Cheap probe — returns true when the supplied context carries
 * enough signal for a confident recommendation. Used by engines
 * to decide between the "rule-based confident" branch and the
 * "calm fallback" branch, NOT to gate any action behind a hard
 * check. Engines must always return SOMETHING usable even when
 * this is false.
 *
 * @param {import('./intelligenceTypes.js').IntelligenceContext} ctx
 * @returns {'low'|'medium'|'high'}
 */
export function contextSignalStrength(ctx) {
  if (!ctx) return CONFIDENCE.LOW;
  let score = 0;
  if (ctx.region)          score += 1;
  if (ctx.weather)         score += 1;
  if (ctx.crop)            score += 1;
  if (ctx.cropStage)       score += 1;
  if (ctx.scanHistory.length > 0) score += 1;
  if (ctx.tasks.length > 0)       score += 1;
  if (score >= 4) return CONFIDENCE.HIGH;
  if (score >= 2) return CONFIDENCE.MEDIUM;
  return CONFIDENCE.LOW;
}

const _module = { buildIntelligenceContext, contextSignalStrength };
export default _module;
