/**
 * Farroway Intelligence Module — Types, DTOs, and Constants
 *
 * Component interface names match the product specification EXACTLY.
 * Scoring weights reference these same keys.
 */
import type { Request } from 'express';
export declare const ImageType: {
    readonly leaf_closeup: "leaf_closeup";
    readonly whole_plant: "whole_plant";
    readonly field_wide: "field_wide";
    readonly hotspot_photo: "hotspot_photo";
    readonly followup: "followup";
};
export type ImageType = (typeof ImageType)[keyof typeof ImageType];
export declare const LikelyIssue: {
    readonly pest: "pest";
    readonly disease: "disease";
    readonly nutrient_deficiency: "nutrient_deficiency";
    readonly water_heat_stress: "water_heat_stress";
    readonly uncertain: "uncertain";
};
export type LikelyIssue = (typeof LikelyIssue)[keyof typeof LikelyIssue];
export declare const ReportStatus: {
    readonly open: "open";
    readonly under_review: "under_review";
    readonly confirmed: "confirmed";
    readonly resolved: "resolved";
    readonly false_positive: "false_positive";
};
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];
export declare const VerificationQuestion: {
    readonly leaves_eaten: "leaves_eaten";
    readonly spreading: "spreading";
    readonly insects_visible: "insects_visible";
    readonly widespread: "widespread";
    readonly recent_rain: "recent_rain";
    readonly recent_heat: "recent_heat";
};
export type VerificationQuestion = (typeof VerificationQuestion)[keyof typeof VerificationQuestion];
export declare const AnswerValue: {
    readonly yes: "yes";
    readonly no: "no";
    readonly unsure: "unsure";
};
export type AnswerValue = (typeof AnswerValue)[keyof typeof AnswerValue];
export declare const HotspotSeverity: {
    readonly low: "low";
    readonly moderate: "moderate";
    readonly high: "high";
    readonly critical: "critical";
};
export type HotspotSeverity = (typeof HotspotSeverity)[keyof typeof HotspotSeverity];
export declare const HotspotStatus: {
    readonly active: "active";
    readonly inspected: "inspected";
    readonly resolved: "resolved";
    readonly false_alarm: "false_alarm";
};
export type HotspotStatus = (typeof HotspotStatus)[keyof typeof HotspotStatus];
export declare const AlertLevel: {
    readonly watch: "watch";
    readonly elevated: "elevated";
    readonly high_risk: "high_risk";
    readonly urgent: "urgent";
};
export type AlertLevel = (typeof AlertLevel)[keyof typeof AlertLevel];
export declare const SentStatus: {
    readonly pending: "pending";
    readonly sent: "sent";
    readonly suppressed: "suppressed";
    readonly expired: "expired";
};
export type SentStatus = (typeof SentStatus)[keyof typeof SentStatus];
export declare const OutcomeStatus: {
    readonly improved: "improved";
    readonly same: "same";
    readonly worse: "worse";
    readonly resolved: "resolved";
    readonly uncertain: "uncertain";
};
export type OutcomeStatus = (typeof OutcomeStatus)[keyof typeof OutcomeStatus];
export declare const FeedbackValue: {
    readonly accurate: "accurate";
    readonly partially_accurate: "partially_accurate";
    readonly inaccurate: "inaccurate";
};
export type FeedbackValue = (typeof FeedbackValue)[keyof typeof FeedbackValue];
export declare const RiskLevel: {
    readonly low: "low";
    readonly moderate: "moderate";
    readonly high: "high";
    readonly urgent: "urgent";
};
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];
export declare const TrendDirection: {
    readonly rising: "rising";
    readonly stable: "stable";
    readonly declining: "declining";
};
export type TrendDirection = (typeof TrendDirection)[keyof typeof TrendDirection];
export interface CreatePestImageDto {
    profileId: string;
    imageType: ImageType;
    imageUrl: string;
    gpsLat?: number;
    gpsLng?: number;
}
export interface CreatePestReportDto {
    profileId: string;
    imageIds: string[];
    cropCycleId?: string;
    verificationAnswers: Record<string, string>;
    notes?: string;
}
export interface CreateTreatmentDto {
    pestReportId: string;
    actionTaken: string;
    productUsed?: string;
    notes?: string;
    actionDate?: string;
}
export interface CreateOutcomeDto {
    treatmentActionId: string;
    outcomeStatus: OutcomeStatus;
    followupNotes?: string;
    followupImageUrl?: string;
    followupDate?: string;
}
export interface SubmitFeedbackDto {
    userFeedback: FeedbackValue;
    helpfulScore?: number;
    confirmedIssue?: string;
    notes?: string;
}
export interface IngestSatelliteDto {
    profileId: string;
    scanDate: string;
    imagerySource?: string;
    cloudCover?: number;
    rawMetadata?: Record<string, unknown>;
}
export interface IngestDroneDto {
    profileId: string;
    hotspotZoneId?: string;
    flightDate: string;
    imageBundleUrl?: string;
    metadata?: Record<string, unknown>;
}
export interface ReviewReportDto {
    status: ReportStatus;
    notes?: string;
}
export interface ValidateBoundaryDto {
    validated: boolean;
    notes?: string;
}
/**
 * farm_pest_risk =
 *   (image_score * 0.30) +
 *   (field_stress_score * 0.20) +
 *   (crop_stage_vulnerability * 0.10) +
 *   (weather_suitability * 0.10) +
 *   (nearby_outbreak_density * 0.15) +
 *   (farm_history_score * 0.05) +
 *   (verification_response_score * 0.10)
 */
export interface FarmPestRiskComponents {
    image_score: number;
    field_stress_score: number;
    crop_stage_vulnerability: number;
    weather_suitability: number;
    nearby_outbreak_density: number;
    farm_history_score: number;
    verification_response_score: number;
}
/**
 * hotspot_score =
 *   (anomaly_intensity * 0.35) +
 *   (temporal_change * 0.20) +
 *   (cluster_compactness * 0.15) +
 *   (crop_sensitivity * 0.10) +
 *   (local_validation_evidence * 0.20)
 */
export interface HotspotScoreComponents {
    anomaly_intensity: number;
    temporal_change: number;
    cluster_compactness: number;
    crop_sensitivity: number;
    local_validation_evidence: number;
}
/**
 * regional_outbreak_score =
 *   (confirmed_reports * 0.25) +
 *   (unconfirmed_signals * 0.10) +
 *   (satellite_anomalies * 0.20) +
 *   (weather_favorability * 0.15) +
 *   (seasonal_baseline_match * 0.15) +
 *   (intervention_failure_rate * 0.15)
 */
export interface RegionalOutbreakComponents {
    confirmed_reports: number;
    unconfirmed_signals: number;
    satellite_anomalies: number;
    weather_favorability: number;
    seasonal_baseline_match: number;
    intervention_failure_rate: number;
}
/**
 * alert_confidence =
 *   (model_confidence * 0.35) +
 *   (signal_agreement * 0.25) +
 *   (data_quality * 0.15) +
 *   (spatial_relevance * 0.15) +
 *   (recent_trend_strength * 0.10)
 */
export interface AlertConfidenceComponents {
    model_confidence: number;
    signal_agreement: number;
    data_quality: number;
    spatial_relevance: number;
    recent_trend_strength: number;
}
/** Generic wrapper returned by any scoring function. */
export interface ScoringResult {
    score: number;
    level: string;
    components: Record<string, number>;
}
/** Alert evaluation pipeline result. */
export interface AlertEvaluationResult {
    created: boolean;
    alert: any | null;
    suppressed: boolean;
    suppressedReason: string | null;
}
export interface AuthUser {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
}
export interface AuthRequest extends Request {
    user: AuthUser;
}
//# sourceMappingURL=index.d.ts.map