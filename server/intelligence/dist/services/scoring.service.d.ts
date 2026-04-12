/**
 * Farroway Intelligence — Scoring Service
 *
 * Pure computation module implementing all 4 scoring formulas.
 * NO database access — callers are responsible for fetching data.
 * All functions are synchronous.
 */
import type { FarmPestRiskComponents, HotspotScoreComponents, RegionalOutbreakComponents, AlertConfidenceComponents, ScoringResult, RiskLevel, HotspotSeverity, AlertLevel } from '../types/index.js';
export declare const SCORING_WEIGHTS: Readonly<{
    farmPestRisk: Readonly<{
        image_score: 0.3;
        verification_score: 0.2;
        crop_vulnerability_score: 0.1;
        weather_score: 0.1;
        historical_score: 0.05;
        proximity_score: 0.15;
        verification_response_score: 0.1;
    }>;
    hotspotScore: Readonly<{
        ndvi_deviation: 0.35;
        area_ratio: 0.2;
        persistence: 0.15;
        proximity_to_reports: 0.1;
        weather_correlation: 0.2;
    }>;
    regionalOutbreak: Readonly<{
        report_density: 0.25;
        spread_velocity: 0.1;
        severity_average: 0.2;
        crop_overlap: 0.15;
        weather_favorability: 0.15;
        confirmation_rate: 0.15;
    }>;
    alertConfidence: Readonly<{
        data_quality: 0.15;
        source_agreement: 0.25;
        historical_accuracy: 0.35;
        verification_completeness: 0.15;
        temporal_consistency: 0.1;
    }>;
}>;
export declare const RISK_THRESHOLDS: Readonly<{
    low: Readonly<{
        min: 0;
        max: 39;
    }>;
    moderate: Readonly<{
        min: 40;
        max: 64;
    }>;
    high: Readonly<{
        min: 65;
        max: 79;
    }>;
    urgent: Readonly<{
        min: 80;
        max: 100;
    }>;
}>;
/**
 * Clamp a numeric value between min and max bounds.
 */
export declare function clamp(value: number, min?: number, max?: number): number;
/**
 * Compute a weighted sum from component values and their weights.
 * Missing components default to 0. Result is clamped 0-100.
 */
export declare function weightedSum(components: Record<string, number>, weights: Record<string, number>): number;
/**
 * Map a 0-100 score to a RiskLevel.
 */
export declare function riskLevelFromScore(score: number): RiskLevel;
/**
 * Map a 0-100 hotspot score to a HotspotSeverity.
 * Uses the same numeric bands as RiskLevel but with domain-specific labels.
 */
export declare function severityFromHotspotScore(score: number): HotspotSeverity;
/**
 * Map a 0-100 outbreak score to an AlertLevel.
 */
export declare function alertLevelFromOutbreakScore(score: number): AlertLevel;
/**
 * Lookup crop stage vulnerability (0-100) based on crop type and growth stage.
 * Seedling and flowering stages are most vulnerable.
 * Returns a default mid-range value for unknown combinations.
 */
export declare function computeCropStageVulnerability(cropType: string, growthStage: string): number;
/**
 * Convert farmer yes/no/unsure questionnaire answers into a 0-100 risk signal.
 *
 * - "yes" to pest-indicating questions (leaves_eaten, spreading, insects_visible,
 *   widespread) contributes significant risk.
 * - "yes" to environmental questions (recent_rain, recent_heat) adds moderate risk.
 * - "unsure" contributes a small amount.
 * - "no" contributes nothing.
 */
export declare function computeVerificationSignal(answers: Record<string, string>): number;
export declare function computeFarmPestRisk(components: FarmPestRiskComponents): ScoringResult;
export declare function computeHotspotScore(components: HotspotScoreComponents): ScoringResult;
export declare function computeRegionalOutbreakScore(components: RegionalOutbreakComponents): ScoringResult;
export declare function computeAlertConfidence(components: AlertConfidenceComponents): ScoringResult;
//# sourceMappingURL=scoring.service.d.ts.map