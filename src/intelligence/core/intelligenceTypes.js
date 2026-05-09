/**
 * intelligenceTypes — frozen constant maps + JSDoc type contracts
 * for the May 2026 invisible-intelligence architecture.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Every other module in `intelligence/core/` consumes these
 * constants. Pulling them into a leaf file (no imports) keeps
 * the orchestrator's import graph acyclic and lets the test
 * suite assert exact strings without grepping multiple files.
 *
 * EXPORT CONTRACT
 *   • `Object.freeze` everything so a downstream caller can't
 *     mutate the shared shape across components.
 *   • String literal unions instead of TS enums (this codebase
 *     is JS-only — TS migration is a future rename).
 *   • JSDoc typedefs for the IDE — no runtime cost.
 */

// ─── Confidence tiers (spec §12) ─────────────────────────────────
export const CONFIDENCE = Object.freeze({
  LOW:    'low',
  MEDIUM: 'medium',
  HIGH:   'high',
});

// Band thresholds for converting a 0..1 score to a tier. Tuned
// conservatively — when in doubt, return LOW so the farmer-facing
// adapter shows "Needs review" instead of overclaiming.
export const CONFIDENCE_BANDS = Object.freeze({
  LOW_MAX:    0.45,
  MEDIUM_MAX: 0.75,
});

// ─── Priority bands (spec §4 — internal only) ────────────────────
export const PRIORITY = Object.freeze({
  LOW:    'low',
  MEDIUM: 'medium',
  HIGH:   'high',
  URGENT: 'urgent',
});

// ─── Risk types (spec §6) ────────────────────────────────────────
export const RISK_TYPE = Object.freeze({
  WEATHER:           'weather_risk',
  MOISTURE:          'moisture_risk',
  PEST:              'pest_risk',
  DISEASE:           'disease_risk',
  HARVEST_DELAY:     'harvest_delay_risk',
  BUYER_READINESS:   'buyer_readiness_risk',
  DATA_CONFIDENCE:   'data_confidence_risk',
});

export const RISK_BAND = Object.freeze({
  LOW:    'low',
  MEDIUM: 'medium',
  HIGH:   'high',
});

// ─── Prediction types (spec §3) ──────────────────────────────────
export const PREDICTION_TYPE = Object.freeze({
  TASK_NUDGE:          'task_nudge',
  WEATHER_PREP:        'weather_prep',
  SCAN_FOLLOWUP:       'scan_followup',
  SOIL_FOLLOWUP:       'soil_followup',
  HARVEST_LISTING:     'harvest_listing',
  LOCATION_SETUP:      'location_setup',
  GROWTH_MOMENTUM:     'growth_momentum',
  GENERIC:             'generic',
});

// ─── Outcome event types (spec §5) ───────────────────────────────
export const OUTCOME_EVENT = Object.freeze({
  TASK_VIEWED:                'task_viewed',
  TASK_COMPLETED:             'task_completed',
  TASK_SKIPPED:               'task_skipped',
  SCAN_COMPLETED:             'scan_completed',
  SOIL_CHECK_COMPLETED:       'soil_check_completed',
  RECOMMENDATION_USED:        'recommendation_used',
  RECOMMENDATION_IGNORED:     'recommendation_ignored',
  PRODUCE_LISTED:             'produce_listed',
  BUYER_INTEREST_RECEIVED:    'buyer_interest_received',
  FUNDING_CLICKED:            'funding_clicked',
  SUPPORT_REQUESTED:          'support_requested',
});

// ─── Trust / verification (spec §7) ──────────────────────────────
//
// Internal-only flags. Farmer-facing wording is calm + positive
// (see farmerInsightAdapter.js). The flag names below NEVER reach
// the farmer UI — they exist for moderation surfaces and admin
// triage only.
export const TRUST_FLAG = Object.freeze({
  DUPLICATE_LISTING:        'duplicate_listing',
  IMPOSSIBLE_QUANTITY:      'impossible_quantity',
  REPEATED_UPLOAD_FAILURE:  'repeated_upload_failure',
  INCONSISTENT_REGION:      'inconsistent_region',
  SUSPICIOUS_BUYER_REQUEST: 'suspicious_buyer_request',
  MISSING_VERIFICATION:     'missing_verification',
  FREQUENT_LISTING_EDITS:   'frequent_listing_edits',
});

// User-facing verification states — intentionally calm + actionable.
// Spec §7 forbids "Low Trust", "Suspicious", "Risky", "Fraud". The
// strings below are the ONLY values allowed to surface in farmer UI.
export const VERIFICATION_STATE = Object.freeze({
  IN_PROGRESS: 'verification_in_progress',
  COMPLETE:    'verification_complete',
  ENHANCED:    'verification_enhanced',
});

// ─── Source tags (spec §11 — IntelligenceEvent) ──────────────────
export const SOURCE = Object.freeze({
  RULE_ENGINE:    'rule_engine',
  USER_OUTCOME:   'user_outcome',
  PREDICTION:     'prediction',
  RISK_ESTIMATE:  'risk_estimate',
  TRUST_SIGNAL:   'trust_signal',
  OPTIMIZATION:   'optimization_run',
  ADAPTER:        'farmer_adapter',
});

// ─── Forbidden user-facing wording (spec §13) ────────────────────
//
// The farmerInsightAdapter strips any of these substrings (case-
// insensitive) before rendering. The list is the safety net of
// last resort — modules above the adapter must already speak in
// calm, action-framed language.
export const FORBIDDEN_USER_WORDING = Object.freeze([
  'fraud',
  'fraudulent',
  'risky',
  'suspicious',
  'low trust',
  'high risk',
  'risk score',
  'fraud score',
  'scam',
  'definitely diseased',
  '100% accurate',
  'guaranteed',
  'this will cure',
  'exact disease',
  'exact dosage',
]);

/**
 * @typedef {Object} IntelligenceContext
 * @property {string|null}  userId
 * @property {'farmer'|'gardener'|'buyer'|'ngo'|'admin'|null} role
 * @property {'farm'|'garden'|null} mode
 * @property {string|null}  region
 * @property {object|null}  weather
 * @property {string|null}  crop
 * @property {string|null}  cropStage
 * @property {number|null}  farmSize
 * @property {string|null}  gardenContainer
 * @property {Array<object>} scanHistory
 * @property {Array<object>} soilChecks
 * @property {Array<object>} tasks
 * @property {Array<object>} progressEvents
 * @property {Array<object>} produceListings
 * @property {Array<object>} buyerInterest
 * @property {Array<object>} fundingMatches
 * @property {string|null}  language
 * @property {string}       timestamp - ISO8601
 */

/**
 * @typedef {Object} Prediction
 * @property {string} predictionType
 * @property {string} recommendedAction
 * @property {string} reason
 * @property {'low'|'medium'|'high'} confidence
 * @property {string} timeWindow         - human-readable, e.g. "today"
 * @property {string} userFacingText     - calm, action-framed
 * @property {object} internalSignals    - opaque to farmer UI
 */

/**
 * @typedef {Object} Recommendation
 * @property {number} score              - INTERNAL ONLY (0..1)
 * @property {'low'|'medium'|'high'} confidence
 * @property {'low'|'medium'|'high'|'urgent'} priority
 * @property {string} explanation        - INTERNAL only
 */

/**
 * @typedef {Object} RiskEstimate
 * @property {string} riskType
 * @property {'low'|'medium'|'high'} probabilityBand
 * @property {'low'|'medium'|'high'} confidence
 * @property {string} reason             - INTERNAL
 * @property {string} recommendedAction
 * @property {string} userFacingText     - calm, action-framed
 */

/**
 * @typedef {Object} TrustSignals
 * @property {string} verificationState
 * @property {Array<string>} internalRiskFlags  - INTERNAL only
 * @property {string} recommendedModerationAction
 */

/**
 * @typedef {Object} FarmerInsight
 * @property {string} title
 * @property {string} message
 * @property {string} actionLabel
 * @property {string} actionRoute
 * @property {string} timeEstimate
 * @property {'low'|'medium'|'high'|null} confidenceLabel
 */

const _module = {
  CONFIDENCE,
  CONFIDENCE_BANDS,
  PRIORITY,
  RISK_TYPE,
  RISK_BAND,
  PREDICTION_TYPE,
  OUTCOME_EVENT,
  TRUST_FLAG,
  VERIFICATION_STATE,
  SOURCE,
  FORBIDDEN_USER_WORDING,
};
export default _module;
