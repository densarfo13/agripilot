/**
 * localizedPayload.js — contract for the structured payloads
 * every engine should emit instead of pre-rendered strings.
 *
 * Shape:
 *   {
 *     key:      string         // translation key (required)
 *     params:   object          // interpolation vars (optional)
 *     severity: string          // 'positive'|'neutral'|'warning'|'critical'
 *     confidence: string        // 'high'|'medium'|'low'
 *     voice:    { text?, langHint? }    // explicit voice override (rare)
 *     fallback: string          // absolute fallback text when key missing
 *     mode:     string          // 'normal'|'assistive'  — rendering hint
 *   }
 *
 * Rules (from spec):
 *   • engines MUST emit this shape; never a pre-rendered string
 *   • `key` is the only required field
 *   • `params` is a flat object of primitives (no nested objects)
 *   • `fallback` is the very last resort — NOT the default output
 *   • severity/confidence/mode are render hints, not copy
 *
 * This module is test-pure — no React, no browser APIs.
 */

const VALID_SEVERITY  = new Set(['positive', 'neutral', 'warning', 'critical']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);
const VALID_MODE      = new Set(['normal', 'assistive']);

/**
 * isLocalizedPayload — true when the value satisfies the shape.
 * Soft — returns boolean, does not throw.
 */
export function isLocalizedPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (typeof payload.key !== 'string' || !payload.key) return false;
  if ('params' in payload && payload.params !== null) {
    if (typeof payload.params !== 'object') return false;
  }
  if ('severity' in payload && payload.severity != null
      && !VALID_SEVERITY.has(payload.severity)) return false;
  if ('confidence' in payload && payload.confidence != null
      && !VALID_CONFIDENCE.has(payload.confidence)) return false;
  if ('mode' in payload && payload.mode != null
      && !VALID_MODE.has(payload.mode)) return false;
  return true;
}

/**
 * validateLocalizedPayload — verbose form that returns a
 * {ok, reasons} object for dev assertions.
 */
export function validateLocalizedPayload(payload) {
  const reasons = [];
  if (!payload || typeof payload !== 'object') {
    reasons.push('not_an_object');
    return { ok: false, reasons };
  }
  if (typeof payload.key !== 'string' || !payload.key) reasons.push('missing_key');
  if ('params' in payload && payload.params !== null
      && typeof payload.params !== 'object') reasons.push('params_not_object');
  if ('severity' in payload && payload.severity != null
      && !VALID_SEVERITY.has(payload.severity)) reasons.push('invalid_severity');
  if ('confidence' in payload && payload.confidence != null
      && !VALID_CONFIDENCE.has(payload.confidence)) reasons.push('invalid_confidence');
  if ('mode' in payload && payload.mode != null
      && !VALID_MODE.has(payload.mode)) reasons.push('invalid_mode');
  return { ok: reasons.length === 0, reasons };
}

/**
 * makeLocalizedPayload — tiny factory. Ensures the resulting
 * object is frozen so engines can't accidentally mutate it
 * after handing it to the renderer.
 */
export function makeLocalizedPayload(key, params = {}, extra = {}) {
  if (typeof key !== 'string' || !key) {
    throw new TypeError('makeLocalizedPayload: key is required');
  }
  const out = { key, params: params || {}, ...extra };
  return Object.freeze(out);
}

/**
 * isRenderedString — a heuristic that detects when something
 * that should have been a LocalizedPayload came through as a
 * final string. Used by dev assertions. A plain string that is
 * NOT just an i18n key (i18n keys look like dotted.identifiers)
 * is flagged as a rendered string.
 */
export function isRenderedString(value) {
  if (typeof value !== 'string') return false;
  if (!value) return false;
  // Bare i18n key: letters/numbers/dots/underscores, no whitespace.
  const looksLikeKey = /^[a-z][a-zA-Z0-9_.]*$/i.test(value);
  if (looksLikeKey) return false;
  return true;
}

export const _internal = { VALID_SEVERITY, VALID_CONFIDENCE, VALID_MODE };
