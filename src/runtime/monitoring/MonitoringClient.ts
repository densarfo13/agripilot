/**
 * src/runtime/monitoring/MonitoringClient.ts — Single-call surface
 * for emitting monitored events from anywhere in the app.
 *
 * Wraps ErrorReporter + PerformanceSignals so callers don't need
 * to know which subsystem owns which event. All payloads run
 * through `scrubEvent` (eventScrubber.ts) before they leave the
 * runtime; nothing on MONITORING_PII_DROP_LIST is ever forwarded.
 *
 * Pure runtime: no React, no fetch, no localStorage writes.
 */

import {
  MONITORED_EVENTS,
  type MonitoredEvent,
} from './monitoringContracts';
import { reportError } from './ErrorReporter';
import { markSignal } from './PerformanceSignals';
import { scrubEvent } from './eventScrubber';

export const MONITORING_CLIENT_VERSION =
  'farroway-monitoring-client-v1';

const _str = (v: unknown): string =>
  typeof v === 'string' ? v : '';
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Returns `true` if the given event name is on the spec
 * MONITORED_EVENTS allowlist.
 */
export function isAllowedEvent(event: unknown): boolean {
  return _safe(() => MONITORED_EVENTS.indexOf(_str(event)) !== -1, false);
}

export interface CaptureEventResult {
  readonly ok: boolean;
  readonly event: string;
  readonly reason: string;
}

/**
 * Capture a monitored event with an optional payload. Unknown
 * events are dropped silently (`ok:false`) so a typo never
 * forwards arbitrary keys to the reporter.
 */
export function captureEvent(
  event: MonitoredEvent,
  payload: Record<string, unknown> = {},
): CaptureEventResult {
  return _safe(() => {
    const name = _str(event);
    if (!isAllowedEvent(name)) {
      return Object.freeze({
        ok: false,
        event: name,
        reason: 'unknown_event_dropped',
      });
    }
    const scrubbed = scrubEvent(payload);
    if (/error|fail|crash|rate_limited/.test(name)) {
      reportError({ event: name, payload: scrubbed });
    } else {
      markSignal(name, scrubbed);
    }
    return Object.freeze({
      ok: true,
      event: name,
      reason: 'captured',
    });
  }, Object.freeze({
    ok: false,
    event: _str(event),
    reason: 'client_threw',
  }));
}

/**
 * Convenience: capture an error event with a structured payload
 * derived from a JS Error. Always runs through `scrubEvent`.
 */
export function captureError(
  event: MonitoredEvent,
  err: unknown,
  extra: Record<string, unknown> = {},
): CaptureEventResult {
  const e = err as { message?: unknown; name?: unknown } | null;
  const payload = {
    ...extra,
    error_message: _str(e?.message),
    error_name: _str(e?.name),
  };
  return captureEvent(event, payload);
}
