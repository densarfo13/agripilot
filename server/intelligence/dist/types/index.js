/**
 * Farroway Intelligence Module — Types, DTOs, and Constants
 *
 * All interfaces, DTOs, and enum-like constants used across the
 * intelligence system (pest reports, satellite/drone ingestion,
 * scoring, alerting, and admin review).
 */
// ---------------------------------------------------------------------------
// Enum-like const objects
// ---------------------------------------------------------------------------
/** The kind of image captured for a pest observation. */
export const ImageType = {
    leaf_closeup: 'leaf_closeup',
    whole_plant: 'whole_plant',
    field_wide: 'field_wide',
    hotspot_photo: 'hotspot_photo',
    followup: 'followup',
};
/** High-level category the system suspects for a pest report. */
export const LikelyIssue = {
    pest: 'pest',
    disease: 'disease',
    nutrient_deficiency: 'nutrient_deficiency',
    water_heat_stress: 'water_heat_stress',
    uncertain: 'uncertain',
};
/** Lifecycle status of a pest report. */
export const ReportStatus = {
    open: 'open',
    under_review: 'under_review',
    confirmed: 'confirmed',
    resolved: 'resolved',
    false_positive: 'false_positive',
};
/** Guided verification questions presented to the farmer. */
export const VerificationQuestion = {
    leaves_eaten: 'leaves_eaten',
    spreading: 'spreading',
    insects_visible: 'insects_visible',
    widespread: 'widespread',
    recent_rain: 'recent_rain',
    recent_heat: 'recent_heat',
};
/** Possible answers a farmer can give to a verification question. */
export const AnswerValue = {
    yes: 'yes',
    no: 'no',
    unsure: 'unsure',
};
/** Severity level assigned to a satellite/drone hotspot zone. */
export const HotspotSeverity = {
    low: 'low',
    moderate: 'moderate',
    high: 'high',
    critical: 'critical',
};
/** Lifecycle status of a hotspot zone. */
export const HotspotStatus = {
    active: 'active',
    inspected: 'inspected',
    resolved: 'resolved',
    false_alarm: 'false_alarm',
};
/** Alert urgency tier. */
export const AlertLevel = {
    watch: 'watch',
    elevated: 'elevated',
    high_risk: 'high_risk',
    urgent: 'urgent',
};
/** Delivery status of a notification/alert. */
export const SentStatus = {
    pending: 'pending',
    sent: 'sent',
    suppressed: 'suppressed',
    expired: 'expired',
};
/** Outcome observed after a treatment action. */
export const OutcomeStatus = {
    improved: 'improved',
    same: 'same',
    worse: 'worse',
    resolved: 'resolved',
};
/** Farmer feedback on how accurate the system's assessment was. */
export const FeedbackValue = {
    accurate: 'accurate',
    partially_accurate: 'partially_accurate',
    inaccurate: 'inaccurate',
};
/** General risk classification used across scoring outputs. */
export const RiskLevel = {
    low: 'low',
    moderate: 'moderate',
    high: 'high',
    urgent: 'urgent',
};
/** Direction of a metric trend over time. */
export const TrendDirection = {
    rising: 'rising',
    stable: 'stable',
    declining: 'declining',
};
//# sourceMappingURL=index.js.map