/**
 * Farroway Intelligence — Scoring Service
 *
 * Pure computation module implementing all 4 scoring formulas.
 * NO database access — callers fetch data, this module computes.
 * All weights are read from config/thresholds (hot-reloadable from DB).
 *
 * Formula component names match the product specification EXACTLY.
 */
import { getRiskThresholds, getFarmRiskWeights, getHotspotWeights, getOutbreakWeights, getAlertConfidenceWeights, } from '../config/thresholds.js';
// ── Crop Stage Vulnerability Lookup ──
const CROP_STAGE_VULNERABILITY = {
    maize: { seedling: 85, vegetative: 50, flowering: 80, grain_fill: 60, maturity: 30 },
    wheat: { seedling: 80, tillering: 55, flowering: 85, grain_fill: 55, maturity: 25 },
    rice: { seedling: 90, vegetative: 45, flowering: 80, grain_fill: 50, maturity: 20 },
    soybean: { seedling: 85, vegetative: 50, flowering: 75, pod_fill: 55, maturity: 25 },
    cotton: { seedling: 80, vegetative: 45, flowering: 75, boll_development: 60, maturity: 30 },
    sorghum: { seedling: 80, vegetative: 50, flowering: 75, grain_fill: 55, maturity: 25 },
    cassava: { seedling: 75, vegetative: 40, tuber_formation: 55, maturity: 20 },
    beans: { seedling: 85, vegetative: 50, flowering: 80, pod_fill: 55, maturity: 25 },
};
const DEFAULT_VULNERABILITY = 50;
// ── Verification question scoring ──
const PEST_INDICATING = new Set(['leaves_eaten', 'spreading', 'insects_visible', 'widespread']);
const ENVIRONMENTAL = new Set(['recent_rain', 'recent_heat']);
// ── Helpers ──
export function clamp(value, min = 0, max = 100) {
    if (Number.isNaN(value))
        return min;
    return Math.min(max, Math.max(min, value));
}
export function weightedSum(components, weights) {
    let sum = 0;
    for (const key of Object.keys(weights)) {
        sum += clamp(components[key] ?? 0, 0, 100) * weights[key];
    }
    return clamp(sum);
}
// ── Risk/Severity/Alert classification (configurable thresholds) ──
export function riskLevelFromScore(score) {
    const s = clamp(score);
    const t = getRiskThresholds();
    if (s > t.high_max)
        return 'urgent';
    if (s > t.moderate_max)
        return 'high';
    if (s > t.low_max)
        return 'moderate';
    return 'low';
}
export function severityFromHotspotScore(score) {
    const s = clamp(score);
    const t = getRiskThresholds();
    if (s > t.high_max)
        return 'critical';
    if (s > t.moderate_max)
        return 'high';
    if (s > t.low_max)
        return 'moderate';
    return 'low';
}
export function alertLevelFromOutbreakScore(score) {
    const s = clamp(score);
    const t = getRiskThresholds();
    if (s > t.high_max)
        return 'urgent';
    if (s > t.moderate_max)
        return 'high_risk';
    if (s > t.low_max)
        return 'elevated';
    return 'watch';
}
// ── Domain helpers ──
export function computeCropStageVulnerability(cropType, growthStage) {
    const crop = cropType.toLowerCase().trim();
    const stage = growthStage.toLowerCase().trim();
    return CROP_STAGE_VULNERABILITY[crop]?.[stage] ?? DEFAULT_VULNERABILITY;
}
export function computeVerificationSignal(answers) {
    let score = 0;
    for (const [question, answer] of Object.entries(answers)) {
        const key = question.toLowerCase().trim();
        const val = answer.toLowerCase().trim();
        if (PEST_INDICATING.has(key)) {
            if (val === 'yes')
                score += 18;
            else if (val === 'unsure')
                score += 6;
        }
        else if (ENVIRONMENTAL.has(key)) {
            if (val === 'yes')
                score += 8;
            else if (val === 'unsure')
                score += 3;
        }
    }
    return clamp(score);
}
// ── Internal builder ──
function buildResult(components, weights, levelFn) {
    const score = weightedSum(components, weights);
    return {
        score,
        level: levelFn(score),
        components: Object.fromEntries(Object.keys(weights).map((k) => [k, clamp(components[k] ?? 0, 0, 100)])),
    };
}
// ── Formula 1: Farm Pest Risk ──
//
// farm_pest_risk =
//   (image_score * 0.30) +
//   (field_stress_score * 0.20) +
//   (crop_stage_vulnerability * 0.10) +
//   (weather_suitability * 0.10) +
//   (nearby_outbreak_density * 0.15) +
//   (farm_history_score * 0.05) +
//   (verification_response_score * 0.10)
export function computeFarmPestRisk(components) {
    return buildResult(components, getFarmRiskWeights(), riskLevelFromScore);
}
// ── Formula 2: Hotspot Score ──
//
// hotspot_score =
//   (anomaly_intensity * 0.35) +
//   (temporal_change * 0.20) +
//   (cluster_compactness * 0.15) +
//   (crop_sensitivity * 0.10) +
//   (local_validation_evidence * 0.20)
export function computeHotspotScore(components) {
    return buildResult(components, getHotspotWeights(), severityFromHotspotScore);
}
// ── Formula 3: Regional Outbreak Score ──
//
// regional_outbreak_score =
//   (confirmed_reports * 0.25) +
//   (unconfirmed_signals * 0.10) +
//   (satellite_anomalies * 0.20) +
//   (weather_favorability * 0.15) +
//   (seasonal_baseline_match * 0.15) +
//   (intervention_failure_rate * 0.15)
export function computeRegionalOutbreakScore(components) {
    return buildResult(components, getOutbreakWeights(), alertLevelFromOutbreakScore);
}
// ── Formula 4: Alert Confidence ──
//
// alert_confidence =
//   (model_confidence * 0.35) +
//   (signal_agreement * 0.25) +
//   (data_quality * 0.15) +
//   (spatial_relevance * 0.15) +
//   (recent_trend_strength * 0.10)
export function computeAlertConfidence(components) {
    return buildResult(components, getAlertConfidenceWeights(), riskLevelFromScore);
}
//# sourceMappingURL=scoring.service.js.map