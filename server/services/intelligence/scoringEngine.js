// ─── Intelligence Scoring Engine ───────────────────────────────────────────
// All scoring formulas for Farroway intelligence pipeline.
// Weights are configurable constants — adjust as models improve.

/**
 * Configurable weight sets for each scoring formula.
 * Adjust these as real model performance data becomes available.
 */
export const SCORING_WEIGHTS = {
  farmPestRisk: {
    image_score: 0.30,
    field_stress_score: 0.20,
    crop_stage_vulnerability: 0.10,
    weather_suitability: 0.10,
    nearby_outbreak_density: 0.15,
    farm_history_score: 0.05,
    verification_response_score: 0.10,
  },
  hotspot: {
    anomaly_intensity: 0.35,
    temporal_change: 0.20,
    cluster_compactness: 0.15,
    crop_sensitivity: 0.10,
    local_validation_evidence: 0.20,
  },
  regionalOutbreak: {
    confirmed_reports: 0.25,
    unconfirmed_signals: 0.10,
    satellite_anomalies: 0.20,
    weather_favorability: 0.15,
    seasonal_baseline_match: 0.15,
    intervention_failure_rate: 0.15,
  },
  alertConfidence: {
    model_confidence: 0.35,
    signal_agreement: 0.25,
    data_quality: 0.15,
    spatial_relevance: 0.15,
    recent_trend_strength: 0.10,
  },
};

/**
 * Risk level thresholds derived from farm pest risk score.
 */
export const RISK_THRESHOLDS = {
  low: { min: 0, max: 39, label: 'low' },
  moderate: { min: 40, max: 64, label: 'moderate' },
  high: { min: 65, max: 79, label: 'high' },
  urgent: { min: 80, max: 100, label: 'urgent' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to the 0–100 range.
 * @param {number} value
 * @returns {number}
 */
function clamp(value) {
  return Math.min(100, Math.max(0, value));
}

/**
 * Compute a weighted sum from a components object and a weights map.
 * Missing components default to 0.
 * @param {Record<string, number>} components
 * @param {Record<string, number>} weights
 * @returns {number} Clamped 0–100
 */
function weightedSum(components, weights) {
  let sum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const value = typeof components[key] === 'number' ? components[key] : 0;
    sum += clamp(value) * weight;
  }
  return clamp(sum);
}

// ─── Scoring Functions ─────────────────────────────────────────────────────

/**
 * Compute the Farm Pest Risk score.
 * @param {object} components - Keys: image_score, field_stress_score, crop_stage_vulnerability,
 *   weather_suitability, nearby_outbreak_density, farm_history_score, verification_response_score
 * @returns {Promise<{ score: number, level: string, components: object }>}
 */
export async function computeFarmPestRisk(components) {
  const score = weightedSum(components, SCORING_WEIGHTS.farmPestRisk);
  const level = riskLevelFromScore(score);
  console.log(`[Intelligence] Farm pest risk computed: score=${score.toFixed(1)}, level=${level}`);
  return { score: Math.round(score * 100) / 100, level, components };
}

/**
 * Compute the Hotspot score for a detected anomaly zone.
 * @param {object} components - Keys: anomaly_intensity, temporal_change, cluster_compactness,
 *   crop_sensitivity, local_validation_evidence
 * @returns {Promise<{ score: number, components: object }>}
 */
export async function computeHotspotScore(components) {
  const score = weightedSum(components, SCORING_WEIGHTS.hotspot);
  console.log(`[Intelligence] Hotspot score computed: ${score.toFixed(1)}`);
  return { score: Math.round(score * 100) / 100, components };
}

/**
 * Compute the Regional Outbreak score.
 * @param {object} components - Keys: confirmed_reports, unconfirmed_signals, satellite_anomalies,
 *   weather_favorability, seasonal_baseline_match, intervention_failure_rate
 * @returns {Promise<{ score: number, components: object }>}
 */
export async function computeRegionalOutbreakScore(components) {
  const score = weightedSum(components, SCORING_WEIGHTS.regionalOutbreak);
  console.log(`[Intelligence] Regional outbreak score computed: ${score.toFixed(1)}`);
  return { score: Math.round(score * 100) / 100, components };
}

/**
 * Compute the Alert Confidence score.
 * @param {object} components - Keys: model_confidence, signal_agreement, data_quality,
 *   spatial_relevance, recent_trend_strength
 * @returns {Promise<{ score: number, components: object }>}
 */
export async function computeAlertConfidence(components) {
  const score = weightedSum(components, SCORING_WEIGHTS.alertConfidence);
  console.log(`[Intelligence] Alert confidence computed: ${score.toFixed(1)}`);
  return { score: Math.round(score * 100) / 100, components };
}

/**
 * Map a numeric score (0–100) to a risk level string.
 * @param {number} score
 * @returns {string} 'low' | 'moderate' | 'high' | 'urgent'
 */
export function riskLevelFromScore(score) {
  const s = clamp(score);
  if (s >= RISK_THRESHOLDS.urgent.min) return 'urgent';
  if (s >= RISK_THRESHOLDS.high.min) return 'high';
  if (s >= RISK_THRESHOLDS.moderate.min) return 'moderate';
  return 'low';
}
