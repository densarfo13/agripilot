/**
 * renderLocalizedMessage.js — the ONE renderer used by Home,
 * Progress, Tasks, onboarding, completion cards, offline
 * helpers, and the voice layer.
 *
 * Contract:
 *
 *   renderLocalizedMessage(payload, t) → string
 *
 * Where `payload` is a LocalizedPayload:
 *   { key, params?, fallback?, mode? }
 *
 * Resolution order:
 *   1. If payload.key resolves to a non-key string via t(), use it.
 *      (t() that returns the key itself means "no translation".)
 *   2. If payload.fallback is a usable string, use it.
 *   3. Otherwise return the key itself so at least SOMETHING
 *      renders — better than empty UI.
 *
 * Params are interpolated via double-brace: {{name}} or {name}.
 */

import {
  isLocalizedPayload, isRenderedString,
} from './localizedPayload.js';

/** Cheap {{name}} / {name} interpolation. */
function interpolate(template, params = {}) {
  if (!template) return template;
  return String(template).replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, k) => {
    const v = params[k];
    return v == null ? '' : String(v);
  });
}

/**
 * renderLocalizedMessage — pure. Never throws; always returns
 * a string. Safe with a missing translator (falls through to
 * fallback → key).
 */
export function renderLocalizedMessage(payload, t) {
  if (typeof payload === 'string') {
    // Caller accidentally passed a finished string. Return it
    // so rendering stays functional, but dev assertions elsewhere
    // will flag this as a likely leakage.
    return payload;
  }
  if (!isLocalizedPayload(payload)) {
    return (payload && payload.fallback) || '';
  }
  const { key, params = {}, fallback = '' } = payload;
  if (typeof t === 'function') {
    const resolved = t(key, params);
    if (typeof resolved === 'string' && resolved && resolved !== key) {
      // Some t() implementations don't interpolate themselves — do it here.
      return interpolate(resolved, params);
    }
  }
  if (fallback) return interpolate(fallback, params);
  return key; // deliberate: render SOMETHING so UI isn't blank
}

/**
 * renderLocalizedList — convenience for rendering an array of
 * payloads in order. Useful for progress insights.
 */
export function renderLocalizedList(payloads = [], t) {
  if (!Array.isArray(payloads)) return [];
  return payloads.map((p) => renderLocalizedMessage(p, t));
}

/**
 * looksLikeRawKey — predicate for the no-English-leak dev
 * warning. True when the final rendered output looks like an
 * untranslated i18n key (e.g. "insight.good_week").
 */
export function looksLikeRawKey(rendered) {
  if (typeof rendered !== 'string' || !rendered) return false;
  // Single token with dots and no spaces → almost certainly a key.
  return /^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/.test(rendered);
}

/** Re-export for consumers that only want one import path. */
export { isLocalizedPayload, isRenderedString };
