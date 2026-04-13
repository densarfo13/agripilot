/**
 * Configurable scoring thresholds and weights.
 *
 * Defaults are compiled-in. At boot, loadThresholdsFromDb() merges any
 * overrides from the v2_scoring_config table (hot-reloadable via
 * reloadThresholds()).
 *
 * All weights are keyed by the EXACT formula component names specified
 * in the product requirements.
 */

// @ts-ignore — JS module
import prisma from '../lib/prisma.js';

// ── Risk level boundaries ──

export interface RiskThresholds {
  low_max: number;
  moderate_max: number;
  high_max: number;
}

// ── Scoring weight maps (one per formula) ──

export interface FarmRiskWeights {
  image_score: number;
  field_stress_score: number;
  crop_stage_vulnerability: number;
  weather_suitability: number;
  nearby_outbreak_density: number;
  farm_history_score: number;
  verification_response_score: number;
}

export interface HotspotWeights {
  anomaly_intensity: number;
  temporal_change: number;
  cluster_compactness: number;
  crop_sensitivity: number;
  local_validation_evidence: number;
}

export interface OutbreakWeights {
  confirmed_reports: number;
  unconfirmed_signals: number;
  satellite_anomalies: number;
  weather_favorability: number;
  seasonal_baseline_match: number;
  intervention_failure_rate: number;
}

export interface AlertConfidenceWeights {
  model_confidence: number;
  signal_agreement: number;
  data_quality: number;
  spatial_relevance: number;
  recent_trend_strength: number;
}

export interface AlertConfig {
  confidenceThreshold: number;
  duplicateWindowHours: number;
  recentActionWindowHours: number;
  noiseThreshold: number;
  noiseWindowDays: number;
  defaultExpiryHours: number;
}

// ── Compiled-in defaults (match the product spec exactly) ──

const DEFAULTS = {
  riskThresholds: {
    low_max: 39,
    moderate_max: 64,
    high_max: 79,
  } as RiskThresholds,

  farmRiskWeights: {
    image_score: 0.30,
    field_stress_score: 0.20,
    crop_stage_vulnerability: 0.10,
    weather_suitability: 0.10,
    nearby_outbreak_density: 0.15,
    farm_history_score: 0.05,
    verification_response_score: 0.10,
  } as FarmRiskWeights,

  hotspotWeights: {
    anomaly_intensity: 0.35,
    temporal_change: 0.20,
    cluster_compactness: 0.15,
    crop_sensitivity: 0.10,
    local_validation_evidence: 0.20,
  } as HotspotWeights,

  outbreakWeights: {
    confirmed_reports: 0.25,
    unconfirmed_signals: 0.10,
    satellite_anomalies: 0.20,
    weather_favorability: 0.15,
    seasonal_baseline_match: 0.15,
    intervention_failure_rate: 0.15,
  } as OutbreakWeights,

  alertConfidenceWeights: {
    model_confidence: 0.35,
    signal_agreement: 0.25,
    data_quality: 0.15,
    spatial_relevance: 0.15,
    recent_trend_strength: 0.10,
  } as AlertConfidenceWeights,

  alertConfig: {
    confidenceThreshold: 55,
    duplicateWindowHours: 24,
    recentActionWindowHours: 48,
    noiseThreshold: 3,
    noiseWindowDays: 7,
    defaultExpiryHours: 72,
  } as AlertConfig,
};

// ── Mutable runtime state ──

let _riskThresholds = { ...DEFAULTS.riskThresholds };
let _farmRiskWeights = { ...DEFAULTS.farmRiskWeights };
let _hotspotWeights = { ...DEFAULTS.hotspotWeights };
let _outbreakWeights = { ...DEFAULTS.outbreakWeights };
let _alertConfidenceWeights = { ...DEFAULTS.alertConfidenceWeights };
let _alertConfig = { ...DEFAULTS.alertConfig };

// ── Accessors (frozen to prevent accidental mutation) ──

export function getRiskThresholds(): Readonly<RiskThresholds> {
  return _riskThresholds;
}
export function getFarmRiskWeights(): Readonly<FarmRiskWeights> {
  return _farmRiskWeights;
}
export function getHotspotWeights(): Readonly<HotspotWeights> {
  return _hotspotWeights;
}
export function getOutbreakWeights(): Readonly<OutbreakWeights> {
  return _outbreakWeights;
}
export function getAlertConfidenceWeights(): Readonly<AlertConfidenceWeights> {
  return _alertConfidenceWeights;
}
export function getAlertConfig(): Readonly<AlertConfig> {
  return _alertConfig;
}

// ── DB loader ──

async function loadConfigRow(key: string): Promise<any | null> {
  try {
    const rows: any[] = await (prisma as any).$queryRaw`
      SELECT value FROM v2_scoring_config WHERE key = ${key} LIMIT 1
    `;
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null; // table may not exist yet
  }
}

/**
 * Load/reload thresholds from v2_scoring_config table.
 * Falls back to compiled-in defaults for any missing keys.
 * Safe to call at any time — merges over defaults.
 */
export async function loadThresholdsFromDb(): Promise<void> {
  const [rt, frw, hw, ow, acw, ac] = await Promise.all([
    loadConfigRow('risk_thresholds'),
    loadConfigRow('farm_risk_weights'),
    loadConfigRow('hotspot_weights'),
    loadConfigRow('outbreak_weights'),
    loadConfigRow('alert_confidence_weights'),
    loadConfigRow('alert_config'),
  ]);

  if (rt) _riskThresholds = { ...DEFAULTS.riskThresholds, ...rt };
  if (frw) _farmRiskWeights = { ...DEFAULTS.farmRiskWeights, ...frw };
  if (hw) _hotspotWeights = { ...DEFAULTS.hotspotWeights, ...hw };
  if (ow) _outbreakWeights = { ...DEFAULTS.outbreakWeights, ...ow };
  if (acw) _alertConfidenceWeights = { ...DEFAULTS.alertConfidenceWeights, ...acw };
  if (ac) _alertConfig = { ...DEFAULTS.alertConfig, ...ac };

  console.log('[config] Scoring thresholds loaded');
}
