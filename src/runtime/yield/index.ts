/**
 * src/runtime/yield/index.ts — barrel for Yield Intelligence
 * runtime suite.
 */

export {
  evaluate, getLatestYieldForPlant,
  yieldIntelligenceHealth, installYieldIntelligenceGlobal,
  type YieldEvaluateInput,
} from './YieldIntelligenceRuntime';

export {
  evaluateYieldRisk, YIELD_RISK_ENGINE_VERSION,
  type YieldRiskInput, type YieldRiskOutput,
} from './YieldRiskEngine';

export {
  evaluateYieldForecast, YIELD_FORECAST_ENGINE_VERSION,
  type YieldForecastInput,
} from './YieldForecastEngine';

export {
  hasSufficientData, composeSafeMessage,
  YIELD_SIGNAL_ENGINE_VERSION,
  type YieldSignalInput,
} from './YieldSignalEngine';

export {
  YIELD_RUNTIME_VERSION,
  YIELD_RISK,
  YIELD_BANNED_WORDING, YIELD_SAFE_VERBS,
  YIELD_STORAGE_KEY, YIELD_HISTORY_CAP,
  type YieldRiskValue,
  type YieldForecastBand,
  type YieldRiskDriver,
  type YieldRecommendedAction,
  type YieldIntelligenceResult,
  type YieldIntelligenceHealth,
} from './yieldContracts';
