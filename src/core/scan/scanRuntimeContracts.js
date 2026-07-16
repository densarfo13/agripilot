/**
 * scanRuntimeContracts.js — result + analysis-input contracts.
 *
 * Combines spec §11 (assertValidScanInput) + §12 (scanResultContract)
 * + §13 (lowConfidenceRule) into one focused module. These are
 * pure validators — they NEVER call the classifier, NEVER touch
 * the store. They only answer "is this allowed?"
 *
 *   import {
 *     assertValidScanInput, validateScanResult, isLowConfidenceAllowed,
 *   } from 'src/core/scan/scanRuntimeContracts.js';
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Every visible string is a tSafe envelope.
 */

const CONTRACT_VERSION = 'scan-contracts-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ─── §11 AI analysis input guard ─────────────────────────────

/**
 * Classifier may run ONLY when every documented precondition is
 * satisfied. Returns `{ allowed, reason }`. Never throws.
 */
export function assertValidScanInput(input) {
  return _safe(() => {
    if (!_isObj(input)) {
      return _freeze({ allowed: false, reason: 'no_input' });
    }
    const sessionId = _str(input.sessionId);
    if (!sessionId) return _freeze({ allowed: false, reason: 'no_session_id' });

    const activeSessionId = _str(input.activeSessionId);
    if (!activeSessionId) return _freeze({ allowed: false, reason: 'no_active_session' });
    if (sessionId !== activeSessionId) {
      return _freeze({ allowed: false, reason: 'stale_session' });
    }
    if (!input.imageValid) return _freeze({ allowed: false, reason: 'image_invalid' });
    if (!_str(input.previewUrl)) return _freeze({ allowed: false, reason: 'preview_missing' });
    if (!input.normalizedBlob && !input.normalizedDataUrl) {
      return _freeze({ allowed: false, reason: 'normalized_blob_missing' });
    }
    if (!input.persisted) return _freeze({ allowed: false, reason: 'not_persisted' });
    const state = _str(input.state);
    if (state !== 'IMAGE_READY' && state !== 'PREPROCESSING') {
      return _freeze({ allowed: false, reason: 'wrong_state', currentState: state });
    }
    return _freeze({ allowed: true, reason: null });
  }, _freeze({ allowed: false, reason: 'guard_error' }));
}

// ─── §12 Result contract ─────────────────────────────────────

const REQUIRED_RESULT_FIELDS = Object.freeze([
  'sessionId', 'imageId', 'imagePreviewUrl', 'imageHash',
  'imageValidated', 'classifierInputVerified',
  'diagnosis', 'confidenceTone', 'timestamp',
]);

/**
 * Build the spec §12 result envelope WITHOUT losing the classifier's
 * intelligence fields.
 *
 * ROOT-CAUSE NOTE (field screenshots, 2026-07-16): ScanRuntime used to build
 * this envelope inline as an 11-field WHITELIST ("Pass-through additional
 * optional fields" — which passed exactly two). Everything else the server +
 * engine produced — identificationState, requiresConfirmation,
 * confirmationCandidates, topCandidates, plantName, confidencePct,
 * mythosDecision, scanRecovery — was silently discarded at the LAST step
 * before setResult. Result: the confirm button NEVER rendered on any device,
 * every scan fell to the "couldn't confidently name this plant" dead-end, and
 * zero farmer confirmations were ever recorded, regardless of what the server
 * resolved. Two earlier fixes (server literal, LOW-state contract) were
 * correct but invisible because this strip sat downstream of both.
 *
 * Contract: spread the RAW classifier envelope first, then stamp the §12
 * fields on top (they win). validateScanResult only checks the §12 fields,
 * so extra fields never fail validation. Pure; never throws.
 */
export function buildResultEnvelope(raw, ctx) {
  return _safe(() => {
    const r = _isObj(raw) ? raw : {};
    const c = _isObj(ctx) ? ctx : {};
    return Object.freeze({
      // ── FULL intelligence pass-through (server decision, candidates,
      //    confirmation contract, recovery envelope, FarmBrain, …) ──
      ...r,
      // ── Spec §12 contract fields (always present; override raw) ──
      sessionId:               c.sessionId ?? null,
      imageId:                 c.imageId ?? null,
      imagePreviewUrl:         c.previewUrl ?? null,
      imageHash:               c.imageId ?? null,
      imageValidated:          true,
      classifierInputVerified: true,
      // Same guarantee the classifier makes ('Needs Review' floor) — a
      // missing headline must NEVER hard-fail the whole scan at validation.
      diagnosis:               _str(r.diagnosis) || _str(r.possibleIssue) || 'Needs Review',
      confidenceTone:          _str(r.confidenceTone) || 'medium_confidence',
      timestamp:               Date.now(),
      severity:                _str(r.severity) || null,
      recommendation:          r.recommendation || null,
    });
  }, Object.freeze({}));
}

/**
 * Reject scan results that don't carry full image linkage.
 * Returns `{ valid, reason, missing? }`.
 */
export function validateScanResult(result) {
  return _safe(() => {
    if (!_isObj(result)) return _freeze({ valid: false, reason: 'no_result' });
    const missing = [];
    for (const field of REQUIRED_RESULT_FIELDS) {
      const v = result[field];
      if (v == null || v === '') missing.push(field);
    }
    if (missing.length > 0) {
      return _freeze({
        valid: false,
        reason: 'missing_required_fields',
        missing: Object.freeze(missing),
      });
    }
    if (result.imageValidated !== true) {
      return _freeze({ valid: false, reason: 'image_not_validated' });
    }
    if (result.classifierInputVerified !== true) {
      return _freeze({ valid: false, reason: 'classifier_input_not_verified' });
    }
    return _freeze({ valid: true, reason: null });
  }, _freeze({ valid: false, reason: 'validate_error' }));
}

// ─── §13 Low-confidence rule ─────────────────────────────────

/**
 * Low confidence is valid ONLY after a successful classifier run
 * on a valid image. Returns `{ allowed, reason }`.
 */
export function isLowConfidenceAllowed(input) {
  return _safe(() => {
    if (!_isObj(input)) return _freeze({ allowed: false, reason: 'no_input' });
    if (!input.imageValid) {
      return _freeze({ allowed: false, reason: 'image_invalid' });
    }
    if (!input.analysisCompleted) {
      return _freeze({ allowed: false, reason: 'analysis_not_completed' });
    }
    if (!_str(input.previewUrl)) {
      return _freeze({ allowed: false, reason: 'preview_missing' });
    }
    return _freeze({ allowed: true, reason: null });
  }, _freeze({ allowed: false, reason: 'rule_error' }));
}

// ─── Invalid-image messaging (§13) ───────────────────────────

/**
 * The single tSafe envelope shown when an image fails to load.
 * Surfaces render this instead of inventing their own copy so
 * "Photo could not be loaded" is consistent everywhere.
 */
export function invalidImageMessage() {
  return Object.freeze({
    key:      'scan.image.invalid',
    fallback: 'Photo could not be loaded. Please choose the photo again.',
  });
}

// ─── Helpers ─────────────────────────────────────────────────

function _freeze(o) {
  return Object.freeze({ contractVersion: CONTRACT_VERSION, ...o,
    checkedAt: Date.now() });
}

export const _internal = Object.freeze({
  REQUIRED_RESULT_FIELDS, CONTRACT_VERSION,
});

const _module = {
  assertValidScanInput, validateScanResult,
  isLowConfidenceAllowed, invalidImageMessage, _internal,
};
export default _module;
