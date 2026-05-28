/**
 * classifierAvailability.js — Wave 8 honest classifier capability detection.
 *
 *   import {
 *     getClassifierCapabilities, recordClassifierExecution,
 *     recordFallbackUsed, getScanHealthSnapshot,
 *   } from 'src/runtime/scan/classifierAvailability.js';
 *
 * Why this exists
 * ───────────────
 *   The `mlScan` feature flag has been "on" for some time, but the
 *   real classifier endpoint (`scanApiEnabled`) is OFF in production.
 *   That means every scan currently returns `mlScanAnalyzer.js`'s
 *   SAFE_FALLBACK envelope — cautious wording, no real AI inference.
 *
 *   For App Store review safety we must NEVER tell the user a result
 *   came from AI when it didn't. This module tracks the runtime
 *   truth so:
 *     • `__scanRuntimeHealth()` reports `classifierExecuted=false`
 *       and `fallbackUsed=true` when the rule path was taken
 *     • ScanResultCard / message copy can suppress AI claims when
 *       `realClassifierAvailable` is false
 *     • CI gates can verify no UI surface promises diagnosis without
 *       a backing classifier run
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • No PII; counters + last-execution timestamps only.
 *   • Module-level state, idempotent install.
 */

const RUNTIME_VERSION = 'classifier-availability-v1';

const _state = {
  // Capability flags — set by env / runtime probe.
  realClassifierAvailable: false,
  classifierEndpoint:      null,
  scanApiEnabled:          false,
  mlScanFlagOn:            false,
  // Per-session telemetry.
  scansAttempted:          0,
  classifierExecutions:    0,
  fallbackUses:            0,
  imageValidations:        0,
  imageValidationFails:    0,
  resultValid:             0,
  resultInvalid:           0,
  lastClassifierAt:        null,
  lastFallbackReason:      null,
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

/**
 * Detect real-classifier availability from build-time + runtime hints.
 * Called once at install; can be re-called when env changes.
 *
 *   @param {{
 *     mlScanFlagOn?: boolean,
 *     scanApiEnabled?: boolean,
 *     classifierEndpoint?: string|null,
 *   }} hints
 */
export function detectClassifierAvailability(hints) {
  const h = hints || {};
  _state.mlScanFlagOn = !!h.mlScanFlagOn;
  _state.scanApiEnabled = !!h.scanApiEnabled;
  _state.classifierEndpoint = h.classifierEndpoint || null;
  // The classifier is "really available" only when BOTH the UI flag
  // is on AND the API path is wired AND an endpoint is known.
  _state.realClassifierAvailable =
    _state.mlScanFlagOn
    && _state.scanApiEnabled
    && !!_state.classifierEndpoint;
  return Object.freeze({
    ok: true,
    realClassifierAvailable: _state.realClassifierAvailable,
  });
}

/**
 * Record a real classifier execution (the API path actually ran
 * and returned a structured envelope).
 */
export function recordClassifierExecution(envelope) {
  _state.classifierExecutions += 1;
  _state.lastClassifierAt = _now();
  if (envelope && envelope.imageValidated) _state.imageValidations += 1;
  if (envelope && envelope.imageValidated === false) _state.imageValidationFails += 1;
  if (envelope && envelope.resultValid) _state.resultValid += 1;
  if (envelope && envelope.resultValid === false) _state.resultInvalid += 1;
}

/**
 * Record that the rule-based fallback was used instead of the
 * real classifier. The reason is one of:
 *   - 'classifier_unavailable'  (no endpoint reachable)
 *   - 'image_validation_failed' (preprocessing rejected the image)
 *   - 'classifier_threw'        (API errored)
 *   - 'classifier_timeout'      (slow path; hit timeout)
 *   - 'flag_off'                (mlScan flag explicitly off)
 *   - 'safe_fallback'           (intentional cautious-mode path)
 */
export function recordFallbackUsed(reason) {
  _state.fallbackUses += 1;
  _state.lastFallbackReason = typeof reason === 'string'
    ? reason : 'unknown';
}

/**
 * Record that an image was validated (or rejected) by the
 * preprocessing pipeline. This is independent of classifier run —
 * the validation can succeed even when the classifier didn't
 * execute (and vice versa).
 */
export function recordImageValidation(ok) {
  _state.scansAttempted += 1;
  if (ok) _state.imageValidations += 1;
  else _state.imageValidationFails += 1;
}

/**
 * Wave-8 mandated diagnostic shape.
 */
export function getScanHealthSnapshot() {
  // Image validated and result valid are cumulative session stats.
  return Object.freeze({
    runtimeVersion:           RUNTIME_VERSION,
    realClassifierAvailable:  _state.realClassifierAvailable,
    classifierExecuted:       _state.classifierExecutions > 0,
    fallbackUsed:             _state.fallbackUses > 0,
    imageValidated:           _state.imageValidations > 0,
    resultValid:              _state.resultValid > 0,
    classifierEndpoint:       _state.classifierEndpoint,
    scanApiEnabled:           _state.scanApiEnabled,
    mlScanFlagOn:             _state.mlScanFlagOn,
    counters: Object.freeze({
      scansAttempted:         _state.scansAttempted,
      classifierExecutions:   _state.classifierExecutions,
      fallbackUses:           _state.fallbackUses,
      imageValidations:       _state.imageValidations,
      imageValidationFails:   _state.imageValidationFails,
      resultValid:            _state.resultValid,
      resultInvalid:          _state.resultInvalid,
    }),
    lastClassifierAt:         _state.lastClassifierAt,
    lastFallbackReason:       _state.lastFallbackReason,
  });
}

/**
 * Canonical honest-fallback message for the result card when no
 * real classifier was used. Localized at the call site via tSafe.
 */
export const FALLBACK_MESSAGE_KEY = 'scan.fallback.honest';
export const FALLBACK_MESSAGE_DEFAULT =
  'We could not confirm the issue from this photo. '
  + 'Try a clearer image or inspect manually.';

export function _resetForTests() {
  _state.realClassifierAvailable = false;
  _state.classifierEndpoint = null;
  _state.scanApiEnabled = false;
  _state.mlScanFlagOn = false;
  _state.scansAttempted = 0;
  _state.classifierExecutions = 0;
  _state.fallbackUses = 0;
  _state.imageValidations = 0;
  _state.imageValidationFails = 0;
  _state.resultValid = 0;
  _state.resultInvalid = 0;
  _state.lastClassifierAt = null;
  _state.lastFallbackReason = null;
}
