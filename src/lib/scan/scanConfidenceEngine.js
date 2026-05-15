/**
 * scanConfidenceEngine — single source of truth for the 4-tier
 * scan confidence presented to the farmer.
 *
 *   import { resolveScanConfidence, CONFIDENCE_TIERS }
 *     from '../lib/scan/scanConfidenceEngine.js';
 *
 *   const tier = resolveScanConfidence({
 *     apiConfidence:  'high',       // backend's claim
 *     qualityReport:  qualityReport, // from analyzeImageQuality
 *     retryAttempts:  0,
 *   });
 *   //   { tier: 'High'|'Moderate'|'Low'|'Needs review',
 *   //     reason, allowSave: true, allowFollowUp: true,
 *   //     allowManualSelect: true, allowRetry: true }
 *
 * Why this engine
 *   The backend returns a confidence value but it's just one
 *   signal. The pre-upload image quality, the number of retry
 *   attempts, and the presence of a manual fallback all need to
 *   feed into the SINGLE label the farmer sees. The engine
 *   guarantees:
 *     - we NEVER claim High when image quality is poor
 *     - even Low confidence still allows save / follow-up /
 *       manual select / retry (spec §6 - low-confidence fallback)
 *     - the tier label uses farmer-friendly wording
 *       (High / Moderate / Low / Needs review)
 *
 * Strict-rule audit
 *   * Pure function. Frozen output. Never throws.
 *   * No raw numeric scores leak (consistent with the rest of
 *     the scan surface).
 *   * Even at the lowest tier, every recovery action is allowed
 *     so the user is never dead-ended.
 */

export const CONFIDENCE_TIERS = Object.freeze({
  HIGH:         'High',
  MODERATE:     'Moderate',
  LOW:          'Low',
  NEEDS_REVIEW: 'Needs review',
});

const _BASE_FROM_API = {
  high:            CONFIDENCE_TIERS.HIGH,
  high_likelihood: CONFIDENCE_TIERS.HIGH,
  very_high:       CONFIDENCE_TIERS.HIGH,
  medium:          CONFIDENCE_TIERS.MODERATE,
  moderate:        CONFIDENCE_TIERS.MODERATE,
  likely:          CONFIDENCE_TIERS.MODERATE,
  possible:        CONFIDENCE_TIERS.LOW,
  low:             CONFIDENCE_TIERS.LOW,
  needs_closer_photo: CONFIDENCE_TIERS.NEEDS_REVIEW,
};

function _safeLower(v) {
  return typeof v === 'string' ? v.toLowerCase().trim() : '';
}

function _normaliseBase(apiConfidence) {
  const k = _safeLower(apiConfidence);
  return _BASE_FROM_API[k] || CONFIDENCE_TIERS.NEEDS_REVIEW;
}

function _qualityIssueCount(qualityReport) {
  if (!qualityReport || !Array.isArray(qualityReport.issues)) return 0;
  return qualityReport.issues.length;
}

function _hasSevereQualityIssue(qualityReport) {
  if (!qualityReport || !Array.isArray(qualityReport.issues)) return false;
  // Any one of these alone is severe enough to disqualify "High".
  const SEVERE = new Set(['blurry', 'too_dark', 'tiny_payload']);
  return qualityReport.issues.some((i) => SEVERE.has(String(i)));
}

function _reasonForTier(tier, qualityReport, retryAttempts) {
  const issues = qualityReport && Array.isArray(qualityReport.issues)
                  ? qualityReport.issues : [];
  if (tier === CONFIDENCE_TIERS.HIGH) {
    return 'Photo + analysis both look clear.';
  }
  if (tier === CONFIDENCE_TIERS.MODERATE) {
    if (issues.length === 0) return 'The analyzer is fairly sure, but a clearer photo would confirm it.';
    return 'A small photo issue lowered the confidence — a retake may help.';
  }
  if (tier === CONFIDENCE_TIERS.LOW) {
    if (issues.length >= 2) return 'Multiple photo issues are limiting confidence.';
    if (retryAttempts > 0)  return 'Several attempts have not resolved cleanly — try the manual selection.';
    return 'Confidence is low. A clearer photo or manual selection will help.';
  }
  return 'This needs a closer look. Retake the photo or pick a symptom manually.';
}

/**
 * Resolve the final confidence tier the UI should render.
 *
 * @param {object} input
 * @param {string} [input.apiConfidence]    backend confidence
 * @param {object} [input.qualityReport]    analyzeImageQuality output
 * @param {number} [input.retryAttempts=0]
 * @returns {object} frozen envelope
 */
export function resolveScanConfidence(input) {
  try {
    const safe = (input && typeof input === 'object') ? input : {};
    let tier = _normaliseBase(safe.apiConfidence);
    const issueCount = _qualityIssueCount(safe.qualityReport);
    const retryAttempts = Number.isFinite(safe.retryAttempts) ? safe.retryAttempts : 0;

    // Spec §3 + §7 - poor image quality NEVER claims High.
    if (tier === CONFIDENCE_TIERS.HIGH && (_hasSevereQualityIssue(safe.qualityReport) || issueCount >= 1)) {
      tier = CONFIDENCE_TIERS.MODERATE;
    }
    if (tier === CONFIDENCE_TIERS.MODERATE && issueCount >= 2) {
      tier = CONFIDENCE_TIERS.LOW;
    }
    if (tier === CONFIDENCE_TIERS.LOW && (issueCount >= 3 || retryAttempts >= 2)) {
      tier = CONFIDENCE_TIERS.NEEDS_REVIEW;
    }

    return Object.freeze({
      tier,
      reason: _reasonForTier(tier, safe.qualityReport, retryAttempts),
      // Spec §6 — every tier ALLOWS every recovery action.
      // The user is never dead-ended; the difference is only
      // which action the UI promotes first.
      allowSave:         true,
      allowFollowUp:     true,
      allowManualSelect: true,
      allowRetry:        true,
      // Hint to the UI on which action to surface most prominently.
      promote: tier === CONFIDENCE_TIERS.HIGH        ? 'save'
             : tier === CONFIDENCE_TIERS.MODERATE    ? 'save'
             : tier === CONFIDENCE_TIERS.LOW         ? 'retry'
             :                                         'manual_select',
    });
  } catch {
    return Object.freeze({
      tier:              CONFIDENCE_TIERS.NEEDS_REVIEW,
      reason:            'This needs a closer look. Retake the photo or pick a symptom manually.',
      allowSave:         true,
      allowFollowUp:     true,
      allowManualSelect: true,
      allowRetry:        true,
      promote:           'manual_select',
    });
  }
}

const _module = {
  CONFIDENCE_TIERS,
  resolveScanConfidence,
};
export default _module;
