/**
 * farmIntelligence/index.js — Phase 10 composite runtime.
 *
 *   import { computeFarmIntelligence,
 *            installFarmIntelligenceGlobal,
 *            FARM_INTELLIGENCE_VERSION }
 *     from 'src/runtime/farmIntelligence/index.js';
 *
 * What this is
 * ────────────
 *   Single chokepoint that runs every wave-10 sub-engine and
 *   returns one frozen envelope the UI / diagnostics subscribe to:
 *
 *     {
 *       runtimeVersion,
 *       generatedAt,
 *       farmHealth,         // farmHealthScore.js
 *       fieldRisk,          // fieldRiskEngine.js
 *       weatherActions,     // smartWeatherAction.js
 *       cropStage,          // cropStageEngine.js
 *       trustScore,         // trustScore.js
 *       deferred,           // {yieldPrediction, profitPrediction,
 *                           //  buyerMatching, grantDiscovery,
 *                           //  satellite, askFarroway} — each
 *                           //  honestly null in Phase 10
 *     }
 *
 * Strict-rule audit
 *   • Pure runtime composition. Never throws.
 *   • Sub-engines are pure functions; this layer adds NO state.
 *   • Frozen envelope. No PII.
 *   • Deferred capabilities are explicitly named — the runtime
 *     does NOT silently emit fake predictions when their data is
 *     missing.
 */

import { computeFarmHealthScore } from './farmHealthScore.js';
import { computeFieldRisk }       from './fieldRiskEngine.js';
import { deriveSmartWeatherActions } from './smartWeatherAction.js';
import { deriveCropStage }        from './cropStageEngine.js';
import { computeTrustScore }      from './trustScore.js';

export const FARM_INTELLIGENCE_VERSION = 'farm-intelligence-v1';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

/**
 * @param {{
 *   farm?: Object,
 *   healthSignals?: Object,
 *   riskSignals?: Object,
 *   forecast?: Object,
 *   cropInput?: { cropName, plantingDate, now? },
 *   trustSignals?: Object,
 * }} ctx
 */
export function computeFarmIntelligence(ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  return Object.freeze({
    runtimeVersion: FARM_INTELLIGENCE_VERSION,
    generatedAt:    _now(),
    farmHealth:     _safe(() => computeFarmHealthScore(c.healthSignals || {}), null),
    fieldRisk:      _safe(() => computeFieldRisk(c.riskSignals || {}),         null),
    weatherActions: _safe(() => deriveSmartWeatherActions(c.forecast || {}),   Object.freeze([])),
    cropStage:      _safe(() => deriveCropStage(c.cropInput || {}),            null),
    trustScore:     _safe(() => computeTrustScore(c.trustSignals || {}),       null),
    // Deferred capabilities — explicitly named so callers can see
    // what's coming. Phase 10 ships the core 5 engines above;
    // these stay `null` until their data + integrations land.
    deferred: Object.freeze({
      yieldPrediction:   null,  // needs region price + historical-yield feeds
      profitPrediction:  null,  // needs cost basis + market price feeds
      buyerMatching:     null,  // gated by marketplace flag (RC1 OFF)
      grantDiscovery:    null,  // needs partner-program registry
      orgDashboard:      null,  // NgoDashboardV1 exists; gated by flag
      investorDashboard: null,  // MetricsDashboard exists; gated by flag
      satellite:         null,  // needs Sentinel Hub backend (out of scope)
      askFarroway:       null,  // voice TTS already shipped (Phase 9);
                                //   intent recognition pending
    }),
  });
}

/**
 * Pin `window.__farmIntelligence` so DevTools / __appStoreReadiness
 * can introspect the composite without re-importing the engines.
 */
export function installFarmIntelligenceGlobal() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.__farmIntelligence === 'function') return true;
    window.__farmIntelligence = function (ctx) {
      const out = computeFarmIntelligence(ctx || {});
      try { console.log('[Farroway · Farm Intelligence]', out); }
      catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
}

// Re-exports for sub-engine consumers.
export { computeFarmHealthScore, HEALTH_WEIGHTS, HEALTH_BAND_THRESHOLDS }
  from './farmHealthScore.js';
export { computeFieldRisk, RISK_KIND } from './fieldRiskEngine.js';
export { deriveSmartWeatherActions, WEATHER_ACTION_KIND }
  from './smartWeatherAction.js';
export { deriveCropStage, CROP_STAGE } from './cropStageEngine.js';
export { computeTrustScore, TRUST_BANDS, TRUST_WEIGHTS } from './trustScore.js';
