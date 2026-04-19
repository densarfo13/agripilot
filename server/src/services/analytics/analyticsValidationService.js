/**
 * analyticsValidationService.js — stateless guard that every
 * analytics ingest endpoint must run events through before
 * accepting them. Catches:
 *
 *   • Unknown or misspelled event types
 *   • Missing required fields (type, timestamp)
 *   • Obviously bad timestamps (future by >1h, ancient by >1y)
 *   • Forbidden meta keys (PII)
 *   • Oversized meta (>4KB JSON)
 *   • Funnel events without a recognized step
 *
 * Output shape:
 *   { valid: boolean, reasons: string[], normalized?: Event }
 *
 * The validator never throws — callers can decide whether to 4xx
 * on invalid, to silently drop, or to route to a quarantine table.
 */

import {
  ALL_DECISION_EVENT_VALUES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEP_ORDER,
} from './decisionEventTypes.js';

const ONE_HOUR_MS       = 60 * 60 * 1000;
const ONE_YEAR_MS       = 365 * 24 * 60 * 60 * 1000;
const MAX_META_BYTES    = 4 * 1024;

const BANNED_META_KEYS = new Set([
  'password', 'token', 'authToken', 'accessToken',
  'creditCard', 'ssn', 'ssnNumber', 'phone', 'email',
]);

const VALID_MODES      = new Set(['backyard', 'farm', 'unknown']);
const VALID_LEVELS     = new Set(['low', 'medium', 'high']);
const FUNNEL_EVENT_SET = new Set(Object.values(FUNNEL_EVENT_TYPES));

/**
 * validateAnalyticsEvent — single event path.
 *
 * @param {object} event
 * @param {object} [opts]
 * @param {Set<string>} [opts.allowlist] extra accepted types (e.g.
 *        onboarding_* constants loaded from eventLogService).
 * @param {number} [opts.now] override clock for tests.
 */
export function validateAnalyticsEvent(event, opts = {}) {
  const reasons = [];
  if (!event || typeof event !== 'object') {
    return { valid: false, reasons: ['event_not_object'] };
  }

  const type = String(event.type || '').trim();
  if (!type) reasons.push('missing_type');

  const allowlist = opts.allowlist instanceof Set
    ? new Set([...ALL_DECISION_EVENT_VALUES, ...opts.allowlist])
    : ALL_DECISION_EVENT_VALUES;

  if (type && !allowlist.has(type)) {
    reasons.push('unknown_type');
  }

  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const ts = Number(event.timestamp);
  if (!Number.isFinite(ts)) {
    reasons.push('missing_timestamp');
  } else {
    if (ts - now > ONE_HOUR_MS) reasons.push('timestamp_too_far_future');
    if (now - ts > ONE_YEAR_MS) reasons.push('timestamp_too_old');
  }

  if (event.mode != null && !VALID_MODES.has(String(event.mode))) {
    reasons.push('invalid_mode');
  }

  if (event.confidence != null) {
    const c = event.confidence;
    if (typeof c !== 'object') reasons.push('invalid_confidence_shape');
    else {
      if (!VALID_LEVELS.has(String(c.level))) reasons.push('invalid_confidence_level');
      if (c.score != null && !Number.isFinite(Number(c.score))) reasons.push('invalid_confidence_score');
    }
  }

  // Funnel events require a step name from the known order.
  if (FUNNEL_EVENT_SET.has(type)) {
    const step = event.meta?.step;
    if (!step)                                     reasons.push('funnel_event_missing_step');
    else if (!FUNNEL_STEP_ORDER.includes(step))    reasons.push('funnel_event_unknown_step');
  }

  // Meta hygiene
  if (event.meta != null) {
    if (typeof event.meta !== 'object') {
      reasons.push('invalid_meta_shape');
    } else {
      for (const k of Object.keys(event.meta)) {
        if (BANNED_META_KEYS.has(k)) reasons.push(`banned_meta_key:${k}`);
      }
      let json = '';
      try { json = JSON.stringify(event.meta); } catch { reasons.push('meta_not_serializable'); }
      if (json && json.length > MAX_META_BYTES) reasons.push('meta_too_large');
    }
  }

  const valid = reasons.length === 0;
  return valid ? { valid, reasons, normalized: normalize(event) } : { valid, reasons };
}

/**
 * validateBatch — validate an array of events, keep the good ones.
 * Returns both the accepted list and a per-index error report so
 * ingestion endpoints can tell clients what was rejected.
 */
export function validateBatch(events, opts = {}) {
  const accepted = [];
  const rejected = [];
  if (!Array.isArray(events)) {
    return { accepted, rejected: [{ index: -1, reasons: ['body_not_array'] }] };
  }
  for (let i = 0; i < events.length; i += 1) {
    const res = validateAnalyticsEvent(events[i], opts);
    if (res.valid) accepted.push(res.normalized);
    else           rejected.push({ index: i, reasons: res.reasons });
  }
  return { accepted, rejected };
}

function normalize(event) {
  return {
    type: String(event.type),
    timestamp: Number(event.timestamp),
    sessionId: event.sessionId ? String(event.sessionId) : null,
    mode: event.mode ? String(event.mode) : 'unknown',
    language: event.language ? String(event.language) : null,
    country: event.country ? String(event.country) : null,
    stateCode: event.stateCode ? String(event.stateCode) : null,
    online: typeof event.online === 'boolean' ? event.online : null,
    confidence: event.confidence || null,
    timeSinceOnboardingStart: Number.isFinite(event.timeSinceOnboardingStart)
      ? Number(event.timeSinceOnboardingStart)
      : null,
    meta: event.meta && typeof event.meta === 'object' ? { ...event.meta } : {},
    clientKey: event.clientKey ? String(event.clientKey) : null,
  };
}

export const _internal = {
  ONE_HOUR_MS, ONE_YEAR_MS, MAX_META_BYTES, BANNED_META_KEYS,
  VALID_MODES, VALID_LEVELS, FUNNEL_EVENT_SET, normalize,
};
