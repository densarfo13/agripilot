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
  classifierProvider:      null,
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
 * Synchronous, preserved for callers that need a quick read after
 * install — but does NOT make the network probe. Use
 * `probeClassifierAvailability()` for the authoritative server probe.
 */
export function detectClassifierAvailability(hints) {
  const h = hints || {};
  _state.mlScanFlagOn = !!h.mlScanFlagOn;
  _state.scanApiEnabled = !!h.scanApiEnabled;
  _state.classifierEndpoint = h.classifierEndpoint || null;
  return Object.freeze({
    ok: true,
    realClassifierAvailable: _state.realClassifierAvailable,
  });
}

/**
 * RC1 — authoritative classifier availability via the server
 * /api/health/scan-provider endpoint. Replaces the frontend-only
 * VITE_SCAN_API_URL probe.
 *
 *   await probeClassifierAvailability()
 *   → { provider, configured, realClassifierAvailable, reason? }
 *
 * Behaviour:
 *   • GET /api/health/scan-provider
 *   • 2xx + classifierAvailable === true  → realClassifierAvailable = true
 *   • non-2xx OR fetch threw               → realClassifierAvailable = false
 *                                             reason = 'scan_provider_health_unreachable'
 *   • Cached for 5 minutes so the readiness diagnostic doesn't
 *     hammer the endpoint on every call.
 *   • Never throws.
 */
const PROBE_CACHE_MS = 5 * 60 * 1000;
let _probeCache = null;     // { at, result }
let _probeInflight = null;  // dedupe concurrent probes

export async function probeClassifierAvailability(opts) {
  const force = !!(opts && opts.force);
  const now = Date.now();
  if (!force && _probeCache && (now - _probeCache.at) < PROBE_CACHE_MS) {
    return _probeCache.result;
  }
  if (_probeInflight) return _probeInflight;
  _probeInflight = (async () => {
    let result;
    try {
      const res = await fetch('/api/health/scan-provider', {
        method:  'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
      });
      if (!res || !res.ok) {
        result = Object.freeze({
          provider: 'unknown',
          configured: false,
          realClassifierAvailable: false,
          reason: 'scan_provider_health_unreachable',
        });
      } else {
        const data = await res.json().catch(() => null);
        const provider = (data && data.provider) || 'unknown';
        const configured = !!(data && data.configured);
        const available  = !!(data && data.classifierAvailable);
        result = Object.freeze({
          provider,
          configured,
          realClassifierAvailable: available,
          reason: available ? null : 'classifier_not_available',
        });
        // Mirror onto module state so synchronous getters reflect
        // the latest authoritative read.
        _state.realClassifierAvailable = available;
        _state.classifierProvider = provider;
      }
    } catch {
      result = Object.freeze({
        provider: 'unknown',
        configured: false,
        realClassifierAvailable: false,
        reason: 'scan_provider_health_unreachable',
      });
    }
    _probeCache = { at: now, result };
    _probeInflight = null;
    return result;
  })();
  return _probeInflight;
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
    classifierProvider:       _state.classifierProvider,
    provider:                 _state.classifierProvider, // alias
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
