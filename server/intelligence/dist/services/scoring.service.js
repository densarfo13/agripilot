/**
 * Farroway Intelligence — Scoring Service
 *
 * Pure computation module implementing all 4 scoring formulas.
 * NO database access — callers are responsible for fetching data.
 * All functions are synchronous.
 */
// ── Configurable Weight Constants ──
export const SCORING_WEIGHTS = Object.freeze({
    farmPestRisk: Object.freeze({
        image_score: 0.30,
        verification_score: 0.20,
        crop_vulnerability_score: 0.10,
        weather_score: 0.10,
        historical_score: 0.05,
        proximity_score: 0.15,
        verification_response_score: 0.10,
    }),
    hotspotScore: Object.freeze({
        ndvi_deviation: 0.35,
        area_ratio: 0.20,
        persistence: 0.15,
        proximity_to_reports: 0.10,
        weather_correlation: 0.20,
    }),
    regionalOutbreak: Object.freeze({
        report_density: 0.25,
        spread_velocity: 0.10,
        severity_average: 0.20,
        crop_overlap: 0.15,
        weather_favorability: 0.15,
        confirmation_rate: 0.15,
    }),
    alertConfidence: Object.freeze({
        data_quality: 0.15,
        source_agreement: 0.25,
        historical_accuracy: 0.35,
        verification_completeness: 0.15,
        temporal_consistency: 0.10,
    }),
});
// ── Risk Level Thresholds ──
export const RISK_THRESHOLDS = Object.freeze({
    low: Object.freeze({ min: 0, max: 39 }),
    moderate: Object.freeze({ min: 40, max: 64 }),
    high: Object.freeze({ min: 65, max: 79 }),
    urgent: Object.freeze({ min: 80, max: 100 }),
});
// ── Crop Stage Vulnerability Lookup ──
const CROP_STAGE_VULNERABILITY = {
    maize: {
        seedling: 85,
        vegetative: 50,
        flowering: 80,
        grain_fill: 60,
        maturity: 30,
    },
    wheat: {
        seedling: 80,
        tillering: 55,
        flowering: 85,
        grain_fill: 55,
        maturity: 25,
    },
    rice: {
        seedling: 90,
        vegetative: 45,
        flowering: 80,
        grain_fill: 50,
        maturity: 20,
    },
    soybean: {
        seedling: 85,
        vegetative: 50,
        flowering: 75,
        pod_fill: 55,
        maturity: 25,
    },
    cotton: {
        seedling: 80,
        vegetative: 45,
        flowering: 75,
        boll_development: 60,
        maturity: 30,
    },
    sorghum: {
        seedling: 80,
        vegetative: 50,
        flowering: 75,
        grain_fill: 55,
        maturity: 25,
    },
};
const DEFAULT_VULNERABILITY = 50;
// ── Verification Question Categories ──
const PEST_INDICATING_QUESTIONS = new Set([
    'leaves_eaten',
    'spreading',
    'insects_visible',
    'widespread',
]);
const ENVIRONMENTAL_QUESTIONS = new Set([
    'recent_rain',
    'recent_heat',
]);
// ── Helper Functions ──
/**
 * Clamp a numeric value between min and max bounds.
 */
export function clamp(value, min = 0, max = 100) {
    if (Number.isNaN(value))
        return min;
    return Math.min(max, Math.max(min, value));
}
/**
 * Compute a weighted sum from component values and their weights.
 * Missing components default to 0. Result is clamped 0-100.
 */
export function weightedSum(components, weights) {
    let sum = 0;
    for (const key of Object.keys(weights)) {
        const value = components[key] ?? 0;
        sum += clamp(value, 0, 100) * weights[key];
    }
    return clamp(sum);
}
// ── Risk/Severity/Alert Classification ──
/**
 * Map a 0-100 score to a RiskLevel.
 */
export function riskLevelFromScore(score) {
    const s = clamp(score);
    if (s >= RISK_THRESHOLDS.urgent.min)
        return 'urgent';
    if (s >= RISK_THRESHOLDS.high.min)
        return 'high';
    if (s >= RISK_THRESHOLDS.moderate.min)
        return 'moderate';
    return 'low';
}
/**
 * Map a 0-100 hotspot score to a HotspotSeverity.
 * Uses the same numeric bands as RiskLevel but with domain-specific labels.
 */
export function severityFromHotspotScore(score) {
    const s = clamp(score);
    if (s >= 80)
        return 'critical';
    if (s >= 65)
        return 'high';
    if (s >= 40)
        return 'moderate';
    return 'low';
}
/**
 * Map a 0-100 outbreak score to an AlertLevel.
 */
export function alertLevelFromOutbreakScore(score) {
    const s = clamp(score);
    if (s >= 80)
        return 'urgent';
    if (s >= 65)
        return 'high_risk';
    if (s >= 40)
        return 'elevated';
    return 'watch';
}
// ── Domain Helpers ──
/**
 * Lookup crop stage vulnerability (0-100) based on crop type and growth stage.
 * Seedling and flowering stages are most vulnerable.
 * Returns a default mid-range value for unknown combinations.
 */
export function computeCropStageVulnerability(cropType, growthStage) {
    const crop = cropType.toLowerCase().trim();
    const stage = growthStage.toLowerCase().trim();
    return CROP_STAGE_VULNERABILITY[crop]?.[stage] ?? DEFAULT_VULNERABILITY;
}
/**
 * Convert farmer yes/no/unsure questionnaire answers into a 0-100 risk signal.
 *
 * - "yes" to pest-indicating questions (leaves_eaten, spreading, insects_visible,
 *   widespread) contributes significant risk.
 * - "yes" to environmental questions (recent_rain, recent_heat) adds moderate risk.
 * - "unsure" contributes a small amount.
 * - "no" contributes nothing.
 */
export function computeVerificationSignal(answers) {
    const PEST_YES_POINTS = 18;
    const PEST_UNSURE_POINTS = 6;
    const ENV_YES_POINTS = 8;
    const ENV_UNSURE_POINTS = 3;
    let score = 0;
    for (const [question, answer] of Object.entries(answers)) {
        const normalised = answer.toLowerCase().trim();
        const key = question.toLowerCase().trim();
        if (PEST_INDICATING_QUESTIONS.has(key)) {
            if (normalised === 'yes')
                score += PEST_YES_POINTS;
            else if (normalised === 'unsure')
                score += PEST_UNSURE_POINTS;
        }
        else if (ENVIRONMENTAL_QUESTIONS.has(key)) {
            if (normalised === 'yes')
                score += ENV_YES_POINTS;
            else if (normalised === 'unsure')
                score += ENV_UNSURE_POINTS;
        }
    }
    return clamp(score);
}
// ── Internal: Build a ScoringResult ──
function buildResult(components, weights, levelFn) {
    const score = weightedSum(components, weights);
    return {
        score,
        level: levelFn(score),
        components: Object.fromEntries(Object.keys(weights).map((k) => [k, clamp(components[k] ?? 0, 0, 100)])),
    };
}
// ── Formula 1: Farm Pest Risk Score ──
export function computeFarmPestRisk(components) {
    return buildResult(components, SCORING_WEIGHTS.farmPestRisk, riskLevelFromScore);
}
// ── Formula 2: Hotspot Score ──
export function computeHotspotScore(components) {
    return buildResult(components, SCORING_WEIGHTS.hotspotScore, severityFromHotspotScore);
}
// ── Formula 3: Regional Outbreak Score ──
export function computeRegionalOutbreakScore(components) {
    return buildResult(components, SCORING_WEIGHTS.regionalOutbreak, alertLevelFromOutbreakScore);
}
// ── Formula 4: Alert Confidence Score ──
export function computeAlertConfidence(components) {
    return buildResult(components, SCORING_WEIGHTS.alertConfidence, riskLevelFromScore);
}
//# sourceMappingURL=scoring.service.js.map