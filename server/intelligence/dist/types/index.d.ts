/**
 * Farroway Intelligence Module — Types, DTOs, and Constants
 *
 * All interfaces, DTOs, and enum-like constants used across the
 * intelligence system (pest reports, satellite/drone ingestion,
 * scoring, alerting, and admin review).
 */
import type { Request } from 'express';
/** The kind of image captured for a pest observation. */
export declare const ImageType: {
    readonly leaf_closeup: "leaf_closeup";
    readonly whole_plant: "whole_plant";
    readonly field_wide: "field_wide";
    readonly hotspot_photo: "hotspot_photo";
    readonly followup: "followup";
};
export type ImageType = (typeof ImageType)[keyof typeof ImageType];
/** High-level category the system suspects for a pest report. */
export declare const LikelyIssue: {
    readonly pest: "pest";
    readonly disease: "disease";
    readonly nutrient_deficiency: "nutrient_deficiency";
    readonly water_heat_stress: "water_heat_stress";
    readonly uncertain: "uncertain";
};
export type LikelyIssue = (typeof LikelyIssue)[keyof typeof LikelyIssue];
/** Lifecycle status of a pest report. */
export declare const ReportStatus: {
    readonly open: "open";
    readonly under_review: "under_review";
    readonly confirmed: "confirmed";
    readonly resolved: "resolved";
    readonly false_positive: "false_positive";
};
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];
/** Guided verification questions presented to the farmer. */
export declare const VerificationQuestion: {
    readonly leaves_eaten: "leaves_eaten";
    readonly spreading: "spreading";
    readonly insects_visible: "insects_visible";
    readonly widespread: "widespread";
    readonly recent_rain: "recent_rain";
    readonly recent_heat: "recent_heat";
};
export type VerificationQuestion = (typeof VerificationQuestion)[keyof typeof VerificationQuestion];
/** Possible answers a farmer can give to a verification question. */
export declare const AnswerValue: {
    readonly yes: "yes";
    readonly no: "no";
    readonly unsure: "unsure";
};
export type AnswerValue = (typeof AnswerValue)[keyof typeof AnswerValue];
/** Severity level assigned to a satellite/drone hotspot zone. */
export declare const HotspotSeverity: {
    readonly low: "low";
    readonly moderate: "moderate";
    readonly high: "high";
    readonly critical: "critical";
};
export type HotspotSeverity = (typeof HotspotSeverity)[keyof typeof HotspotSeverity];
/** Lifecycle status of a hotspot zone. */
export declare const HotspotStatus: {
    readonly active: "active";
    readonly inspected: "inspected";
    readonly resolved: "resolved";
    readonly false_alarm: "false_alarm";
};
export type HotspotStatus = (typeof HotspotStatus)[keyof typeof HotspotStatus];
/** Alert urgency tier. */
export declare const AlertLevel: {
    readonly watch: "watch";
    readonly elevated: "elevated";
    readonly high_risk: "high_risk";
    readonly urgent: "urgent";
};
export type AlertLevel = (typeof AlertLevel)[keyof typeof AlertLevel];
/** Delivery status of a notification/alert. */
export declare const SentStatus: {
    readonly pending: "pending";
    readonly sent: "sent";
    readonly suppressed: "suppressed";
    readonly expired: "expired";
};
export type SentStatus = (typeof SentStatus)[keyof typeof SentStatus];
/** Outcome observed after a treatment action. */
export declare const OutcomeStatus: {
    readonly improved: "improved";
    readonly same: "same";
    readonly worse: "worse";
    readonly resolved: "resolved";
};
export type OutcomeStatus = (typeof OutcomeStatus)[keyof typeof OutcomeStatus];
/** Farmer feedback on how accurate the system's assessment was. */
export declare const FeedbackValue: {
    readonly accurate: "accurate";
    readonly partially_accurate: "partially_accurate";
    readonly inaccurate: "inaccurate";
};
export type FeedbackValue = (typeof FeedbackValue)[keyof typeof FeedbackValue];
/** General risk classification used across scoring outputs. */
export declare const RiskLevel: {
    readonly low: "low";
    readonly moderate: "moderate";
    readonly high: "high";
    readonly urgent: "urgent";
};
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];
/** Direction of a metric trend over time. */
export declare const TrendDirection: {
    readonly rising: "rising";
    readonly stable: "stable";
    readonly declining: "declining";
};
export type TrendDirection = (typeof TrendDirection)[keyof typeof TrendDirection];
/** Payload for uploading a single pest-related image. */
export interface CreatePestImageDto {
    profileId: string;
    imageType: ImageType;
    imageUrl: string;
    gpsLat?: number;
    gpsLng?: number;
}
/** Payload for creating a new pest report (one or more images + answers). */
export interface CreatePestReportDto {
    profileId: string;
    imageIds: string[];
    cropCycleId?: string;
    /** Keys are VerificationQuestion values; values are AnswerValue values. */
    verificationAnswers: Record<string, string>;
    notes?: string;
}
/** Payload for recording a treatment action against a pest report. */
export interface CreateTreatmentDto {
    pestReportId: string;
    actionTaken: string;
    productUsed?: string;
    notes?: string;
    actionDate?: string;
}
/** Payload for recording the outcome of a treatment action. */
export interface CreateOutcomeDto {
    treatmentActionId: string;
    outcomeStatus: OutcomeStatus;
    followupNotes?: string;
    followupImageUrl?: string;
    followupDate?: string;
}
/** Payload for farmer feedback on the system's assessment accuracy. */
export interface SubmitFeedbackDto {
    userFeedback: FeedbackValue;
    helpfulScore?: number;
    confirmedIssue?: string;
    notes?: string;
}
/** Payload for ingesting a satellite scan for a farm profile. */
export interface IngestSatelliteDto {
    profileId: string;
    scanDate: string;
    imagerySource?: string;
    cloudCover?: number;
    rawMetadata?: Record<string, unknown>;
}
/** Payload for ingesting drone flight data for a farm profile. */
export interface IngestDroneDto {
    profileId: string;
    hotspotZoneId?: string;
    flightDate: string;
    imageBundleUrl?: string;
    metadata?: Record<string, unknown>;
}
/** Payload for an admin reviewing a pest report. */
export interface ReviewReportDto {
    status: ReportStatus;
    notes?: string;
}
/** Payload for validating a farm boundary after satellite ingest. */
export interface ValidateBoundaryDto {
    validated: boolean;
    notes?: string;
}
/** Breakdown of the seven components that produce a farm-level pest risk score. */
export interface FarmPestRiskComponents {
    image_score: number;
    verification_score: number;
    crop_vulnerability_score: number;
    weather_score: number;
    historical_score: number;
    proximity_score: number;
    verification_response_score: number;
}
/** Breakdown of the five components that produce a hotspot severity score. */
export interface HotspotScoreComponents {
    ndvi_deviation: number;
    area_ratio: number;
    persistence: number;
    proximity_to_reports: number;
    weather_correlation: number;
}
/** Breakdown of the six components that produce a regional outbreak score. */
export interface RegionalOutbreakComponents {
    report_density: number;
    spread_velocity: number;
    severity_average: number;
    crop_overlap: number;
    weather_favorability: number;
    confirmation_rate: number;
}
/** Breakdown of the five components that determine alert confidence. */
export interface AlertConfidenceComponents {
    data_quality: number;
    source_agreement: number;
    historical_accuracy: number;
    verification_completeness: number;
    temporal_consistency: number;
}
/** Generic wrapper returned by any scoring function. */
export interface ScoringResult {
    /** Final composite score (0-100). */
    score: number;
    /** Optional risk/severity level derived from the score. */
    level?: string;
    /** Individual component scores that were combined. */
    components: Record<string, number>;
}
/** Result of evaluating whether an alert should be created. */
export interface AlertEvaluationResult {
    /** Whether a new alert was actually created. */
    created: boolean;
    /** The alert entity if one was created, otherwise null. */
    alert: any | null;
    /** Whether creation was suppressed by dedup or noise rules. */
    suppressed: boolean;
    /** Human-readable reason the alert was suppressed, if applicable. */
    suppressedReason: string | null;
}
/** Tunable parameters that control alert creation behaviour. */
export interface AlertConfig {
    /** Minimum confidence score (0-100) required to emit an alert. */
    confidenceThreshold: number;
    /** Hours within which a duplicate alert for the same entity is suppressed. */
    duplicateWindowHours: number;
    /** Hours within which a recent treatment action suppresses a new alert. */
    recentActionWindowHours: number;
    /** Minimum noise-filtered score below which alerts are suppressed. */
    noiseThreshold: number;
    /** Rolling window (days) used for noise filtering. */
    noiseWindowDays: number;
}
/** Named weight maps for each scoring formula. */
export interface ScoringWeights {
    farmPestRisk: Record<string, number>;
    hotspot: Record<string, number>;
    regionalOutbreak: Record<string, number>;
    alertConfidence: Record<string, number>;
}
/** Authenticated user attached to every request by the auth middleware. */
export interface AuthUser {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
}
/** Express Request extended with the authenticated user context. */
export interface AuthRequest extends Request {
    user: AuthUser;
}
//# sourceMappingURL=index.d.ts.map