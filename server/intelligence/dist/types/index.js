/**
 * Farroway Intelligence Module — Types, DTOs, and Constants
 *
 * Component interface names match the product specification EXACTLY.
 * Scoring weights reference these same keys.
 */
// ---------------------------------------------------------------------------
// Enum-like const objects
// ---------------------------------------------------------------------------
export const ImageType = {
    leaf_closeup: 'leaf_closeup',
    whole_plant: 'whole_plant',
    field_wide: 'field_wide',
    hotspot_photo: 'hotspot_photo',
    followup: 'followup',
};
export const LikelyIssue = {
    pest: 'pest',
    disease: 'disease',
    nutrient_deficiency: 'nutrient_deficiency',
    water_heat_stress: 'water_heat_stress',
    uncertain: 'uncertain',
};
export const ReportStatus = {
    open: 'open',
    under_review: 'under_review',
    confirmed: 'confirmed',
    resolved: 'resolved',
    false_positive: 'false_positive',
};
export const VerificationQuestion = {
    leaves_eaten: 'leaves_eaten',
    spreading: 'spreading',
    insects_visible: 'insects_visible',
    widespread: 'widespread',
    recent_rain: 'recent_rain',
    recent_heat: 'recent_heat',
};
export const AnswerValue = {
    yes: 'yes',
    no: 'no',
    unsure: 'unsure',
};
export const HotspotSeverity = {
    low: 'low',
    moderate: 'moderate',
    high: 'high',
    critical: 'critical',
};
export const HotspotStatus = {
    active: 'active',
    inspected: 'inspected',
    resolved: 'resolved',
    false_alarm: 'false_alarm',
};
export const AlertLevel = {
    watch: 'watch',
    elevated: 'elevated',
    high_risk: 'high_risk',
    urgent: 'urgent',
};
export const SentStatus = {
    pending: 'pending',
    sent: 'sent',
    suppressed: 'suppressed',
    expired: 'expired',
};
export const OutcomeStatus = {
    improved: 'improved',
    same: 'same',
    worse: 'worse',
    resolved: 'resolved',
    uncertain: 'uncertain',
};
export const FeedbackValue = {
    accurate: 'accurate',
    partially_accurate: 'partially_accurate',
    inaccurate: 'inaccurate',
};
export const RiskLevel = {
    low: 'low',
    moderate: 'moderate',
    high: 'high',
    urgent: 'urgent',
};
export const TrendDirection = {
    rising: 'rising',
    stable: 'stable',
    declining: 'declining',
};
//# sourceMappingURL=index.js.map