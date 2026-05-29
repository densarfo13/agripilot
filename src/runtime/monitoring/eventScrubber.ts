/**
 * src/runtime/monitoring/eventScrubber.ts — Removes PII from
 * monitored event payloads before they leave the runtime.
 *
 * Drops every key on MONITORING_PII_DROP_LIST + redacts anything
 * that pattern-matches an email, phone number, or bearer-style
 * token. Pure: no fetch, no localStorage, no console output.
 *
 * Callers (MonitoringClient.captureEvent / captureError) MUST
 * pipe payloads through `scrubEvent` before forwarding to the
 * error reporter or performance log.
 */

import { MONITORING_PII_DROP_LIST } from './monitoringContracts';

export const EVENT_SCRUBBER_VERSION =
  'farroway-event-scrubber-v1';

const REDACTED = '[redacted]';

const EMAIL_RE  = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE  = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._\-]{8,}/gi;

const DROP_SET: ReadonlySet<string> = new Set(
  MONITORING_PII_DROP_LIST.map((k) => k.toLowerCase()),
);

function _scrubString(s: string): string {
  return s
    .replace(BEARER_RE, REDACTED)
    .replace(EMAIL_RE, REDACTED)
    .replace(PHONE_RE, REDACTED);
}

function _isDroppedKey(key: string): boolean {
  const k = key.toLowerCase();
  if (DROP_SET.has(k)) return true;
  // Conservative pattern match — any key containing one of the
  // drop-list words is also dropped (e.g. "user_email",
  // "access_token", "session_cookie").
  for (const banned of DROP_SET) {
    if (k.includes(banned)) return true;
  }
  return false;
}

/**
 * Returns a defensive copy of `payload` with PII keys dropped
 * and PII-shaped strings redacted. Recurses one level into
 * nested objects; deeper trees are stringified + redacted to
 * keep the runtime bounded.
 */
export function scrubEvent(
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(payload)) {
    if (_isDroppedKey(key)) continue;
    const v = (payload as Record<string, unknown>)[key];
    if (v == null) {
      out[key] = v;
      continue;
    }
    if (typeof v === 'string') {
      out[key] = _scrubString(v);
      continue;
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      out[key] = v;
      continue;
    }
    if (typeof v === 'object') {
      try {
        const json = JSON.stringify(v);
        out[key] = _scrubString(json);
      } catch {
        out[key] = REDACTED;
      }
      continue;
    }
    out[key] = REDACTED;
  }
  return out;
}

/**
 * Convenience: returns `true` if a single value would be
 * dropped or redacted by `scrubEvent`.
 */
export function isPotentialPii(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return (
    EMAIL_RE.test(value) ||
    PHONE_RE.test(value) ||
    BEARER_RE.test(value)
  );
}
