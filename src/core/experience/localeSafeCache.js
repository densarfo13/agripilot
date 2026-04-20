/**
 * localeSafeCache.js — §3. Thin wrapper around any key-value
 * cache (localStorage / IndexedDB / in-memory) that REFUSES
 * to persist pre-rendered English strings. This is how we
 * stop language-leak regressions at the storage boundary.
 *
 * Contract:
 *
 *   persistStructuredOnly(backend, key, value)
 *     • value must NOT contain a rendered string in any
 *       known payload field (insight/title/subtitle/why/next)
 *     • violates → dev warning + refuse to persist, returns false
 *     • otherwise → backend.setItem(key, JSON.stringify(value))
 *
 *   readStructured(backend, key)
 *     • JSON.parse with safe fallback to null
 *
 *   shouldRehydrateOnLocaleChange(prevLocale, nextLocale)
 *     • predicate used by consumers to decide whether to
 *       re-run their renderer on locale switch
 *
 * The backend is injectable so tests don't need localStorage.
 */

import { isLocalizedPayload, isRenderedString } from '../i18n/localizedPayload.js';

const PAYLOAD_FIELDS = Object.freeze([
  'insight', 'title', 'subtitle', 'why', 'next',
  'encouragement', 'message', 'headline',
]);

/** Walk top-level fields and flag ones that carry rendered strings. */
function detectRenderedStrings(value) {
  if (!value || typeof value !== 'object') return [];
  const offenders = [];
  for (const field of PAYLOAD_FIELDS) {
    const v = value[field];
    if (v == null) continue;
    if (typeof v === 'string' && isRenderedString(v)) offenders.push(field);
    // nested payload objects must satisfy isLocalizedPayload
    if (typeof v === 'object' && !isLocalizedPayload(v)
        && !Array.isArray(v)) {
      // unstructured nested object — inspect one level deeper
      for (const k of Object.keys(v)) {
        if (typeof v[k] === 'string' && isRenderedString(v[k])) {
          offenders.push(`${field}.${k}`);
        }
      }
    }
  }
  return offenders;
}

function isDev() {
  if (typeof window === 'undefined') return false;
  const env = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV)
    || 'development';
  return env !== 'production';
}

function warn(reason, details = {}) {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.warn('[farroway.cache]', reason, { ...details, at: new Date().toISOString() });
}

/**
 * persistStructuredOnly — validates and stores. Returns true
 * on success, false when rejected.
 */
export function persistStructuredOnly(backend, key, value) {
  if (!backend || typeof backend.setItem !== 'function') return false;
  if (!key || typeof key !== 'string') return false;

  const offenders = detectRenderedStrings(value);
  if (offenders.length > 0) {
    warn('refused to cache pre-rendered strings', { key, offenders });
    return false;
  }

  try {
    backend.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    warn('cache backend setItem failed', { key, message: err?.message });
    return false;
  }
}

/** readStructured — parse safely; returns null on any error. */
export function readStructured(backend, key) {
  if (!backend || typeof backend.getItem !== 'function') return null;
  if (!key || typeof key !== 'string') return null;
  try {
    const raw = backend.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

/** Does the consumer need to rerender after a locale switch? */
export function shouldRehydrateOnLocaleChange(prevLocale, nextLocale) {
  if (prevLocale == null || nextLocale == null) return false;
  if (typeof prevLocale !== 'string' || typeof nextLocale !== 'string') return false;
  return prevLocale !== nextLocale;
}

export const _internal = { PAYLOAD_FIELDS, detectRenderedStrings };
