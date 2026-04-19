/**
 * analyticsEnvelope.js — builds the metadata envelope every
 * analytics event carries. Keeping this in one place means every
 * send site (onboarding, Today, marketplace, buyer) attaches the
 * same shape, so the server-side validator can be strict.
 *
 * Shape produced:
 *   {
 *     type:       <event name>,
 *     timestamp:  <ms>,
 *     sessionId:  <string>,
 *     mode:       'backyard' | 'farm' | 'unknown',
 *     language:   'en' | 'hi' | ...,
 *     country:    'GH' | null,
 *     stateCode:  'AP' | null,
 *     online:     true | false,
 *     confidence: { level, score } | null,
 *     meta:       { ...caller-provided fields },
 *   }
 *
 * Never put raw PII in meta. Event senders should only include
 * ids, enum-ish strings, and numeric signals.
 */

const SESSION_KEY = 'farroway.analytics.session.v1';
const ONBOARDING_START_KEY = 'farroway.analytics.onboardingStartedAt.v1';

function hasStorage() {
  try { return typeof window !== 'undefined' && !!window.localStorage; }
  catch { return false; }
}

function randomId(prefix = 'sess') {
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${r}`;
}

export function getOrCreateSessionId() {
  if (!hasStorage()) return randomId();
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh = randomId();
    window.localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return randomId();
  }
}

export function markOnboardingStarted(now = Date.now()) {
  if (!hasStorage()) return now;
  try {
    const existing = window.localStorage.getItem(ONBOARDING_START_KEY);
    if (existing) return Number(existing);
    window.localStorage.setItem(ONBOARDING_START_KEY, String(now));
    return now;
  } catch {
    return now;
  }
}

export function getOnboardingStartedAt() {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_START_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function clearOnboardingStart() {
  if (!hasStorage()) return;
  try { window.localStorage.removeItem(ONBOARDING_START_KEY); }
  catch { /* noop */ }
}

/**
 * Milliseconds since onboarding first started, or null if it was
 * never marked.
 */
export function getTimeSinceOnboardingStart(now = Date.now()) {
  const started = getOnboardingStartedAt();
  if (!started || !Number.isFinite(started)) return null;
  const delta = now - started;
  return delta < 0 ? 0 : delta;
}

function isOnline() {
  if (typeof navigator === 'undefined') return true;
  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
}

/**
 * buildAnalyticsMetadata — assemble the envelope. `overrides` lets
 * tests + callers inject any field for non-browser contexts.
 */
export function buildAnalyticsMetadata(input = {}, overrides = {}) {
  const now = overrides.timestamp ?? Date.now();
  return {
    type:      input.type || input.eventType || 'unknown',
    timestamp: now,
    sessionId: overrides.sessionId ?? getOrCreateSessionId(),
    mode:      normalizeMode(input.mode ?? overrides.mode),
    language:  input.language ?? overrides.language ?? 'en',
    country:   input.country  ?? overrides.country  ?? null,
    stateCode: input.stateCode ?? overrides.stateCode ?? null,
    online:    overrides.online ?? isOnline(),
    confidence: normalizeConfidence(input.confidence ?? overrides.confidence),
    timeSinceOnboardingStart:
      overrides.timeSinceOnboardingStart ?? getTimeSinceOnboardingStart(now),
    meta: sanitizeMeta(input.meta || {}),
  };
}

function normalizeMode(m) {
  const v = String(m || '').toLowerCase();
  if (v === 'backyard' || v === 'farm') return v;
  return 'unknown';
}

function normalizeConfidence(c) {
  if (!c || typeof c !== 'object') return null;
  const level = String(c.level || '').toLowerCase();
  const score = Number(c.score);
  if (!['low', 'medium', 'high'].includes(level)) return null;
  return {
    level,
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
  };
}

const BANNED_META_KEYS = new Set([
  'password', 'token', 'authToken', 'accessToken',
  'creditCard', 'ssn', 'phone', 'email',
]);

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (BANNED_META_KEYS.has(k)) continue;
    if (v === undefined) continue;
    // Refuse to embed anything that looks structurally like a secret
    if (typeof v === 'string' && v.length > 2000) continue;
    out[k] = v;
  }
  return out;
}

export const _internal = {
  SESSION_KEY, ONBOARDING_START_KEY, BANNED_META_KEYS,
  normalizeMode, normalizeConfidence, sanitizeMeta,
};
