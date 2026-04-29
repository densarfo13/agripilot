/**
 * aliases.js — named re-exports of the intelligence layer under
 * the public-spec wording (`riskEngine`, `cropStageEngine`,
 * `satelliteMock`, `recommendationEngine`, `priorityEngine`).
 *
 * Why this file exists
 * ────────────────────
 * The intelligence layer's internal modules are split for
 * testability — `weatherRiskModel` and `pestDiseaseRisk` are
 * separate files, even though the spec talks about a single
 * `riskEngine`. Rather than rename the implementation files (and
 * risk breaking imports inside `intelligence/index.js`), this
 * shim presents the spec-named surface alongside the existing
 * one. Callers can import either:
 *
 *   import { riskEngine, cropStageEngine } from '../intelligence/aliases.js';
 *   // or:
 *   import { deriveWeatherRisk, derivePestRisk } from '../intelligence';
 *
 * Both routes hit the same code path — no duplication.
 *
 * Strict rules
 * ────────────
 *   • Pure shim. Never adds behaviour, never throws.
 *   • Functions delegate verbatim to the underlying modules.
 *   • `riskEngine.derive(...)` combines weather + pest in one call
 *     because the spec talks about a unified "riskEngine"
 *     (pest + rain + drought) — we surface that unified shape
 *     while the underlying split stays for testability.
 */

import {
  deriveWeatherRisk, WEATHER_LEVELS,
} from './weatherRiskModel.js';
import {
  derivePestRisk, PEST_LEVELS,
} from './pestDiseaseRisk.js';
import {
  estimateStageFromPlanting, resolveStage, STAGE_ORDER,
} from './cropStageModel.js';
import {
  getSatelliteSignals, getSatelliteSignalsSync,
  setProvider, clearProvider, SIGNAL_KEYS,
} from './satelliteSignals.js';
import {
  rankCandidates,
} from './recommendationRanker.js';
import {
  scoreConfidence,
} from './confidenceScoring.js';
import {
  recommendForFarm, generateCandidatesFromSignals, TASK_KEYS,
} from './recommendationEngine.js';

/**
 * riskEngine — combined view: weather + pest in a single call.
 * The two underlying functions stay independently importable
 * (and independently testable) — this just bundles them.
 */
export const riskEngine = Object.freeze({
  // Returns { weather: {...}, pest: {...} } in one round-trip.
  // Drought / dry-spell pressure surfaces inside `weather.signals`
  // (`dry_spell`, `hot`) — same vocabulary as the rest of the
  // intelligence layer.
  derive(input = {}) {
    try {
      const weather = deriveWeatherRisk(input.weather);
      const pest = derivePestRisk({
        crop:        input.crop,
        stage:       input.stage,
        weatherRisk: weather,
      });
      return Object.freeze({ weather, pest });
    } catch {
      return Object.freeze({
        weather: { level: 'unknown', signals: [] },
        pest:    { level: 'unknown', signals: [] },
      });
    }
  },
  weather: deriveWeatherRisk,
  pest:    derivePestRisk,
  WEATHER_LEVELS,
  PEST_LEVELS,
});

/**
 * cropStageEngine — planting-date driven stage estimator.
 * `resolve(farm)` is the recommended call: farmer-declared
 * stage wins, falls back to the planting-date estimate.
 */
export const cropStageEngine = Object.freeze({
  resolve:                 resolveStage,
  estimateFromPlanting:    estimateStageFromPlanting,
  STAGE_ORDER,
});

/**
 * satelliteMock — current default mode of the satellite layer.
 * `getSync({ lat, lng })` returns the deterministic mock; install
 * a real provider via `setProvider(fn)` to switch to a live API.
 */
export const satelliteMock = Object.freeze({
  getSync:        getSatelliteSignalsSync,
  getAsync:       getSatelliteSignals,
  setProvider,
  clearProvider,
  SIGNAL_KEYS,
});

/**
 * recommendationEngine — generates 1 primary + 2 secondary tasks
 * from raw signals (no upstream candidate list required). When
 * upstream HAS a candidate list, prefer `rankFarmIntelligence`
 * from `intelligence/index.js` so the existing engine's ordering
 * is preserved on ties.
 */
export const recommendationEngine = Object.freeze({
  recommend:             recommendForFarm,
  generateFromSignals:   generateCandidatesFromSignals,
  TASK_KEYS,
});

/**
 * priorityEngine — re-orders pre-existing candidate tasks.
 * The clip to 1 primary + 2 secondary is done inside the ranker
 * itself; callers don't have to slice afterwards.
 */
export const priorityEngine = Object.freeze({
  rank: rankCandidates,
});

// Confidence is internal-only per the spec. Re-exported here for
// telemetry callers that legitimately need to read it (e.g. ops
// dashboards), NOT for farmer-facing UI to render directly.
export { scoreConfidence };
