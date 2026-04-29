/**
 * src/intelligence/index.js — invisible intelligence layer.
 *
 * Single public adapter the rest of the app calls into:
 *
 *   import { rankFarmIntelligence } from '../intelligence';
 *   const result = rankFarmIntelligence({ farm, candidates, weather });
 *   // result.primary       — at most 1 task to show as PrimaryTaskCard
 *   // result.secondaries   — at most 2 to show as SecondaryTaskList
 *   // result.signals       — full internal snapshot (weather / pest / stage / yield / satellite)
 *   // result.confidence    — { level: 'low'|'medium'|'high', points, missing }
 *
 * Strict invariants
 * ─────────────────
 *   • The adapter is OPT-IN. The existing taskEngine + farmer pages
 *     keep producing their own task lists; nothing here forces them
 *     to consume this output.
 *   • The function is SYNCHRONOUS. Callers don't have to await — the
 *     ranker uses the synchronous mock satellite path. To use a real
 *     async satellite provider, call `prefetchSatelliteSignals`
 *     beforehand and pass the result via the `satellite` override.
 *   • No translation, no rendering. The caller already has localised
 *     task labels via the existing taskEngine output; this adapter
 *     just reorders + clips that list.
 *   • Never throws — bad input degrades to an empty result so a
 *     render path can't crash on a missing weather payload.
 *
 * Re-exports
 * ──────────
 * Each underlying module is re-exported so consumers that need the
 * raw helpers (tests, analytics, future detail screens) don't have
 * to deep-import.
 */

import { getSatelliteSignalsSync, getSatelliteSignals, setProvider } from './satelliteSignals.js';
import { deriveWeatherRisk } from './weatherRiskModel.js';
import { derivePestRisk }    from './pestDiseaseRisk.js';
import { resolveStage }      from './cropStageModel.js';
import { forecastYield }     from './yieldForecast.js';
import { rankCandidates }    from './recommendationRanker.js';
import { scoreConfidence }   from './confidenceScoring.js';

export {
  getSatelliteSignals,        // async — for callers wiring a real provider
  getSatelliteSignalsSync,
  setProvider as setSatelliteProvider,
  deriveWeatherRisk,
  derivePestRisk,
  resolveStage,
  forecastYield,
  rankCandidates,
  scoreConfidence,
};

/**
 * Rank a set of candidate tasks for a farm using the intelligence
 * layer. Returns at most 1 primary + 2 secondary tasks plus the
 * internal signal snapshot for telemetry / debug.
 *
 * @param {object} input
 * @param {object} input.farm                farm shape (crop, stage, planting, lat/lng, score)
 * @param {object[]} input.candidates        already-localised tasks from taskEngine
 * @param {object} [input.weather]           current weather payload (WeatherContext)
 * @param {object} [input.satellite]         pre-fetched signal; overrides the sync mock
 * @returns {{
 *   primary:     object|null,
 *   secondaries: object[],
 *   signals:     {
 *     weatherRisk: object|null,
 *     pestRisk:    object|null,
 *     stageInfo:   object|null,
 *     yieldInfo:   object|null,
 *     satellite:   object|null,
 *   },
 *   confidence:  { level: 'low'|'medium'|'high', points: number, missing: string[] },
 * }}
 */
export function rankFarmIntelligence(input = {}) {
  // Defensive top-level try/catch — any bug in a downstream module
  // collapses to an empty result instead of breaking the consumer's
  // render pass.
  try {
    const farm = (input.farm && typeof input.farm === 'object') ? input.farm : null;
    const candidates = Array.isArray(input.candidates) ? input.candidates : [];
    const weather = input.weather && typeof input.weather === 'object' ? input.weather : null;

    // Resolve each layer in turn. Each layer is independently safe;
    // a missing input degrades to 'unknown' rather than throwing.
    const weatherRisk = deriveWeatherRisk(weather);
    const stageInfo   = resolveStage(farm);
    // `crop` is canonical (canonicalizeFarmPayload in lib/api.js).
    const pestRisk    = derivePestRisk({
      crop:        farm?.crop,
      stage:       stageInfo?.stage,
      weatherRisk,
    });

    // Satellite — caller can override with a pre-fetched async result.
    let satellite = (input.satellite && typeof input.satellite === 'object') ? input.satellite : null;
    if (!satellite) {
      const lat = _num(farm?.lat ?? farm?.location?.lat);
      const lng = _num(farm?.lng ?? farm?.location?.lng);
      satellite = getSatelliteSignalsSync({ lat, lng });
    }

    const yieldInfo = forecastYield({ farm: farm || {}, signals: satellite });

    const ranked = rankCandidates({
      candidates,
      weatherRisk,
      pestRisk,
      stageInfo,
      yieldInfo,
    });

    const confidence = scoreConfidence({
      weatherRisk, pestRisk, stageInfo, yieldInfo, satellite,
    });

    return Object.freeze({
      primary:     ranked.primary,
      secondaries: ranked.secondaries,
      signals: Object.freeze({
        weatherRisk, pestRisk, stageInfo, yieldInfo, satellite,
      }),
      confidence,
    });
  } catch {
    return Object.freeze({
      primary:     null,
      secondaries: [],
      signals: Object.freeze({
        weatherRisk: null, pestRisk: null, stageInfo: null,
        yieldInfo: null, satellite: null,
      }),
      confidence: Object.freeze({ level: 'low', points: 0, missing: ['error'] }),
    });
  }
}

/**
 * Pre-fetch the satellite signal for a farm, so a caller that wants
 * to use a real (async) provider can hand the result to
 * `rankFarmIntelligence` synchronously on the next render. No-op
 * when no provider is wired — returns the mock.
 */
export async function prefetchSatelliteSignals(farm) {
  const lat = _num(farm?.lat ?? farm?.location?.lat);
  const lng = _num(farm?.lng ?? farm?.location?.lng);
  return getSatelliteSignals({ lat, lng });
}

function _num(v) {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
