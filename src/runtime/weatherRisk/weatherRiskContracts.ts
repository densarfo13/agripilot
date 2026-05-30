/**
 * src/runtime/weatherRisk/weatherRiskContracts.ts — frozen types
 * + risk-level enum + banned wording for the Weather Risk runtime.
 */

export const WEATHER_RISK_RUNTIME_VERSION = 'weather-risk-v1';

export const WEATHER_RISK_LEVEL = Object.freeze({
  LOW:     'low',
  MEDIUM:  'medium',
  HIGH:    'high',
  UNKNOWN: 'unknown',
} as const);

export type WeatherRiskLevelValue =
  typeof WEATHER_RISK_LEVEL[keyof typeof WEATHER_RISK_LEVEL];

export interface WeatherRiskAdvisory {
  level:        WeatherRiskLevelValue;
  category:     string;        // 'fungal' | 'heat_stress' | 'irrigation_delay' | 'wind_damage' | 'unknown'
  headline:     string;        // safe-wording
  body:         string;        // safe-wording
  validUntil?:  string;        // ISO
}

export interface WeatherRiskResult {
  plantId:        string;
  scanId:         string;
  region?:        string;
  advisories:     ReadonlyArray<WeatherRiskAdvisory>;
  overallRisk:    WeatherRiskLevelValue;
  needsReview:    boolean;
  timestamp:      string;
}

export interface WeatherRiskHealth {
  runtimeVersion:    string;
  initialized:       boolean;
  weatherRiskReady:  boolean;
  advisoryCategories: ReadonlyArray<string>;
}

/** Forbidden tokens — CI-enforced. */
export const WEATHER_BANNED_WORDING = Object.freeze([
  'guaranteed',
  'definitely',
  'confirmed',
] as const);
