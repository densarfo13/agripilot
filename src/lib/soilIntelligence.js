/**
 * soilIntelligence.js — invisible soil context layer.
 *
 *   const soil = await fetchSoilForCoords(lat, lng, soilFetcher);
 *   if (soil) {
 *     todayEngine.enrich({ soil });
 *     taskEngine.enrich({ soil });
 *     scanResult.context.soil = soil;
 *     weatherAdvice.soil = soil;
 *   }
 *
 * Core rule
 * ─────────
 *   Soil improves RECOMMENDATIONS, not the dashboard. Home never
 *   shows pH numbers, never shows percent-clay readings, never
 *   shows mineral content. The farmer sees calm guidance:
 *
 *     "Your soil holds water well — ease back on irrigation today."
 *     "Sandy soil drains fast — water in shorter, more frequent
 *      doses."
 *
 *   Behind the scenes, soil signals influence the daily plan, task
 *   timing, scan result context, and weather advice. The technical
 *   data stays in the engine.
 *
 * Canonical 4-field shape (spec)
 * ──────────────────────────────
 *   {
 *     soilType:     'Loam' | 'Sandy' | 'Clay' | 'Silt' | 'Loamy sand' | 'Clay loam' | null,
 *     moistureRisk: 'low' | 'medium' | 'high' | null,
 *     fertilityHint: string | null,    // calm sentence
 *     farmingAction: string | null,    // single imperative action
 *   }
 *
 * The shape is FROZEN; UI can't mutate canonical strings.
 *
 * Failure handling (spec: "no error to user")
 * ──────────────────────────────────────────
 *   • fetchSoilForCoords(...) NEVER throws — returns null on any
 *     failure (network, malformed JSON, timeout, missing fetcher).
 *   • normalizeSoilData(raw) returns null when input can't be
 *     normalised — surface skips the soil block cleanly.
 *   • enrichWithSoilContext({ ... }, null) → passes through
 *     unchanged. Soil enrichment is purely additive — the caller
 *     can always render without soil if it's missing.
 *
 * Strict-rule audit
 *   • Pure helpers (normalizer / enricher). Never throw.
 *   • Async fetcher injectable for tests.
 *   • Raw soil values (pH, sand %, clay %, organic carbon, etc.)
 *     are NEVER part of the public return shape — pinned by tests
 *     that scan the output for the keys 'ph', 'sand', 'clay',
 *     'silt', 'organicCarbon' and assert they're absent.
 */

// ─── Soil-type derivation table ───────────────────────────────
// Per the USDA soil texture triangle, simplified. Inputs are
// percent sand / silt / clay (each 0-100). Returns a calm,
// non-technical type label.

function _soilTypeFromComposition(sandPct, siltPct, clayPct) {
  const s = Number(sandPct);
  const si = Number(siltPct);
  const c = Number(clayPct);
  if (!Number.isFinite(s) || !Number.isFinite(si) || !Number.isFinite(c)) return null;

  if (c >= 40)                  return 'Clay';
  if (c >= 27 && s <= 45)       return 'Clay loam';
  if (s >= 70)                  return 'Sandy';
  if (s >= 50 && c < 20)        return 'Loamy sand';
  if (si >= 50 && c < 27)       return 'Silt';
  // Balanced middle — the most productive soil type for most crops.
  return 'Loam';
}

// ─── Moisture-risk derivation ──────────────────────────────────
// "Risk" here means "risk of moisture problems":
//   • high  = soil holds water too well → waterlogging risk after
//             rain / over-irrigation
//   • low   = soil drains fast → drought stress risk in dry spells
//   • medium = balanced

function _moistureRiskFromType(soilType, recentRainfallMm) {
  if (!soilType) return null;
  const rain = Number(recentRainfallMm);
  switch (soilType) {
    case 'Clay':
    case 'Clay loam':
      // Clay holds water → waterlogging risk especially after rain.
      return (Number.isFinite(rain) && rain >= 20) ? 'high' : 'medium';
    case 'Sandy':
    case 'Loamy sand':
      // Sandy drains fast → drought risk especially in dry spells.
      return (Number.isFinite(rain) && rain <= 2) ? 'high' : 'medium';
    case 'Silt':
    case 'Loam':
    default:
      return 'low';
  }
}

// ─── Fertility hint — calm, non-numeric ────────────────────────

function _fertilityHintFromSoil(soilType, phRange) {
  // phRange is one of: 'acidic' | 'neutral' | 'alkaline' | null.
  // We DO NOT surface the numeric pH — only the qualitative range.
  if (phRange === 'acidic') {
    return 'Soil reads slightly acidic — many crops still grow well, but leafy greens may benefit from lime over time.';
  }
  if (phRange === 'alkaline') {
    return 'Soil reads slightly alkaline — some crops grow well, others may need a mulch or compost top-up.';
  }
  if (phRange === 'neutral') {
    return 'Soil chemistry reads balanced — most crops grow well here.';
  }
  // Type-driven fallback when pH info missing.
  switch (soilType) {
    case 'Clay':
    case 'Clay loam':
      return 'This soil holds nutrients well; compost helps with structure.';
    case 'Sandy':
    case 'Loamy sand':
      return 'Sandy soils need regular compost or organic matter to hold nutrients.';
    case 'Silt':
    case 'Loam':
      return 'A balanced soil — easy to work and good for most crops.';
    default:
      return null;
  }
}

// ─── Farming action — single imperative ────────────────────────

function _farmingActionFromMoisture(moistureRisk, soilType) {
  if (!moistureRisk) return null;
  if (moistureRisk === 'high' && (soilType === 'Clay' || soilType === 'Clay loam')) {
    return 'Hold off on watering today — heavy soil is still wet from earlier rain.';
  }
  if (moistureRisk === 'high' && (soilType === 'Sandy' || soilType === 'Loamy sand')) {
    return 'Water in shorter, more frequent doses — sandy soil drains quickly.';
  }
  if (moistureRisk === 'medium' && (soilType === 'Clay' || soilType === 'Clay loam')) {
    return 'Water sparingly — clay-rich soil keeps moisture longer than it looks.';
  }
  if (moistureRisk === 'medium' && (soilType === 'Sandy' || soilType === 'Loamy sand')) {
    return 'Check soil moisture by hand before watering — sandy soils dry faster than they look.';
  }
  return 'Soil moisture looks balanced — water as your usual routine suggests.';
}

// ─── pH qualitative bucket (never surfaces the number) ─────────

function _phRangeFrom(rawPh) {
  const n = Number(rawPh);
  if (!Number.isFinite(n)) return null;
  if (n < 6.0) return 'acidic';
  if (n > 7.5) return 'alkaline';
  return 'neutral';
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Normalise a raw soil-API response into the calm 4-field shape.
 *
 * Accepts the typical shape from public soil endpoints
 * (SoilGrids / OpenLandMap / etc.):
 *   { sand, silt, clay, ph, organicCarbon, ... }
 *
 * Plus an optional `recentRainfallMm` to refine moisture risk.
 *
 * @param {object} raw
 * @param {object} [context]  — { recentRainfallMm }
 * @returns {object|null}     — null when input can't be normalised
 */
export function normalizeSoilData(raw, context) {
  if (!raw || typeof raw !== 'object') return null;
  const ctx = (context && typeof context === 'object') ? context : {};

  const soilType = _soilTypeFromComposition(raw.sand, raw.silt, raw.clay);
  if (!soilType) return null;

  const moistureRisk = _moistureRiskFromType(soilType, ctx.recentRainfallMm);
  const phRange = _phRangeFrom(raw.ph);
  const fertilityHint = _fertilityHintFromSoil(soilType, phRange);
  const farmingAction = _farmingActionFromMoisture(moistureRisk, soilType);

  return Object.freeze({
    soilType,
    moistureRisk,
    fertilityHint,
    farmingAction,
  });
}

/**
 * Resolve soil context for a coordinate. The actual fetcher is
 * INJECTED so callers can swap implementations + tests can stub.
 * When no fetcher is provided OR it throws OR it returns garbage,
 * the helper returns null — the surface skips soil enrichment
 * cleanly (spec rule: "show no error to user").
 *
 * @param {number} lat
 * @param {number} lng
 * @param {(lat, lng) => Promise<object>} [fetcher]
 * @param {object} [options]  — { recentRainfallMm, signal? }
 * @returns {Promise<object|null>}
 */
export async function fetchSoilForCoords(lat, lng, fetcher, options) {
  if (typeof fetcher !== 'function') return null;
  if (typeof lat !== 'number' || !Number.isFinite(lat))  return null;
  if (typeof lng !== 'number' || !Number.isFinite(lng)) return null;

  try {
    const raw = await fetcher(lat, lng);
    return normalizeSoilData(raw, options);
  } catch {
    // Per spec: API failure shows no error to the user. We just
    // return null so the caller falls back to weather + crop
    // guidance.
    return null;
  }
}

/**
 * Enrich a recommendation / task / scan-result / weather-advice
 * object with calm soil context. Pure pass-through when soil is
 * null (the spec's "fallback to weather + crop guidance" path).
 *
 * The enriched object exposes ONLY the 4 calm fields under a
 * `soilContext` key — never the raw soil data, never the pH
 * number, never the percent compositions.
 *
 * @param {object} target            — anything with a strings shape
 * @param {object|null} soil         — normalizeSoilData output
 * @returns {object}                  — new object, never mutates input
 */
export function enrichWithSoilContext(target, soil) {
  const safe = (target && typeof target === 'object') ? target : {};
  if (!soil || typeof soil !== 'object') {
    return { ...safe };
  }
  // Defensive: only the 4 canonical fields surface, even if the
  // caller accidentally passed a richer object.
  const sanitised = {
    soilType:      soil.soilType      || null,
    moistureRisk:  soil.moistureRisk  || null,
    fertilityHint: soil.fertilityHint || null,
    farmingAction: soil.farmingAction || null,
  };
  return { ...safe, soilContext: Object.freeze(sanitised) };
}

/**
 * Whether the soil context is rich enough to actually influence
 * the caller's recommendation. When false, the surface should
 * fall through to weather + crop guidance — no soil hint UI.
 *
 * @param {object|null} soil
 * @returns {boolean}
 */
export function hasActionableSoil(soil) {
  if (!soil || typeof soil !== 'object') return false;
  return !!(soil.soilType && (soil.fertilityHint || soil.farmingAction));
}

export default {
  normalizeSoilData,
  fetchSoilForCoords,
  enrichWithSoilContext,
  hasActionableSoil,
};
