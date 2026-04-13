/**
 * Farroway Intelligence Module — Types, DTOs, and Constants
 *
 * Component interface names match the product specification EXACTLY.
 * Scoring weights reference these same keys.
 */

import type { Request } from 'express';

// ---------------------------------------------------------------------------
// Enum-like const objects
// ---------------------------------------------------------------------------

export const ImageType = {
  leaf_closeup: 'leaf_closeup',
  whole_plant: 'whole_plant',
  field_wide: 'field_wide',
  hotspot_photo: 'hotspot_photo',
  followup: 'followup',
} as const;
export type ImageType = (typeof ImageType)[keyof typeof ImageType];

export const LikelyIssue = {
  pest: 'pest',
  disease: 'disease',
  nutrient_deficiency: 'nutrient_deficiency',
  water_heat_stress: 'water_heat_stress',
  uncertain: 'uncertain',
} as const;
export type LikelyIssue = (typeof LikelyIssue)[keyof typeof LikelyIssue];

export const ReportStatus = {
  open: 'open',
  under_review: 'under_review',
  confirmed: 'confirmed',
  resolved: 'resolved',
  false_positive: 'false_positive',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const VerificationQuestion = {
  leaves_eaten: 'leaves_eaten',
  spreading: 'spreading',
  insects_visible: 'insects_visible',
  widespread: 'widespread',
  recent_rain: 'recent_rain',
  recent_heat: 'recent_heat',
} as const;
export type VerificationQuestion = (typeof VerificationQuestion)[keyof typeof VerificationQuestion];

export const AnswerValue = {
  yes: 'yes',
  no: 'no',
  unsure: 'unsure',
} as const;
export type AnswerValue = (typeof AnswerValue)[keyof typeof AnswerValue];

export const HotspotSeverity = {
  low: 'low',
  moderate: 'moderate',
  high: 'high',
  critical: 'critical',
} as const;
export type HotspotSeverity = (typeof HotspotSeverity)[keyof typeof HotspotSeverity];

export const HotspotStatus = {
  active: 'active',
  inspected: 'inspected',
  resolved: 'resolved',
  false_alarm: 'false_alarm',
} as const;
export type HotspotStatus = (typeof HotspotStatus)[keyof typeof HotspotStatus];

export const AlertLevel = {
  watch: 'watch',
  elevated: 'elevated',
  high_risk: 'high_risk',
  urgent: 'urgent',
} as const;
export type AlertLevel = (typeof AlertLevel)[keyof typeof AlertLevel];

export const SentStatus = {
  pending: 'pending',
  sent: 'sent',
  suppressed: 'suppressed',
  expired: 'expired',
} as const;
export type SentStatus = (typeof SentStatus)[keyof typeof SentStatus];

export const OutcomeStatus = {
  improved: 'improved',
  same: 'same',
  worse: 'worse',
  resolved: 'resolved',
  uncertain: 'uncertain',
} as const;
export type OutcomeStatus = (typeof OutcomeStatus)[keyof typeof OutcomeStatus];

export const FeedbackValue = {
  accurate: 'accurate',
  partially_accurate: 'partially_accurate',
  inaccurate: 'inaccurate',
} as const;
export type FeedbackValue = (typeof FeedbackValue)[keyof typeof FeedbackValue];

export const RiskLevel = {
  low: 'low',
  moderate: 'moderate',
  high: 'high',
  urgent: 'urgent',
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const TrendDirection = {
  rising: 'rising',
  stable: 'stable',
  declining: 'declining',
} as const;
export type TrendDirection = (typeof TrendDirection)[keyof typeof TrendDirection];

// ---------------------------------------------------------------------------
// DTOs — input types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scoring component types — names match the product formulas EXACTLY
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}
