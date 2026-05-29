// Farroway Monitoring Runtime - ErrorReporter
// Pure runtime: no React, no fetch, no localStorage writes.

import {
  MONITORED_EVENTS,
  MONITORING_PII_DROP_LIST,
  isMonitoredEvent,
  type ErrorEnvelope,
} from "./monitoringContracts";

export const ERROR_REPORTER_VERSION = "farroway-monitoring-error-reporter-v1";

const _isObj = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object";
const _arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const _str = (v: unknown): string => (typeof v === "string" ? v : "");
const _safe = <T,>(fn: () => T, fb: T): T => {
  try {
    return fn();
  } catch {
    return fb;
  }
};

const MAX_BUFFER = 200;
const _buffer: ErrorEnvelope[] = [];

interface StoredError extends ErrorEnvelope {
  readonly detail: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

const _storedBuffer: StoredError[] = [];

const _now = (): string =>
  _safe(() => new Date().toISOString(), "1970-01-01T00:00:00.000Z");

const _genId = (): string =>
  _safe(
    () =>
      "err_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10),
    "err_unknown"
  );

const _stripPII = (
  input: unknown
): Readonly<Record<string, unknown>> => {
  return _safe(() => {
    if (!_isObj(input)) return Object.freeze({} as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    const dropSet = new Set(MONITORING_PII_DROP_LIST.map((k) => k.toLowerCase()));
    const keys = Object.keys(input);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const lower = k.toLowerCase();
      if (dropSet.has(lower)) continue;
      // Defensive: also drop keys that contain banned substrings
      let banned = false;
      for (const d of dropSet) {
        if (lower.indexOf(d) !== -1) {
          banned = true;
          break;
        }
      }
      if (banned) continue;
      const val = input[k];
      // Recursively strip nested objects
      if (_isObj(val)) {
        out[k] = _stripPII(val);
      } else if (Array.isArray(val)) {
        out[k] = val.map((v) => (_isObj(v) ? _stripPII(v) : v));
      } else {
        out[k] = val;
      }
    }
    return Object.freeze(out);
  }, Object.freeze({} as Record<string, unknown>));
};

const _trySendToSentry = (
  event: string,
  detail: string,
  metadata: Readonly<Record<string, unknown>>
): void => {
  _safe(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      Sentry?: {
        captureMessage?: (msg: string, ctx?: unknown) => void;
        captureException?: (err: unknown, ctx?: unknown) => void;
      };
    };
    const sentry = w.Sentry;
    if (!sentry) return;
    if (typeof sentry.captureMessage === "function") {
      sentry.captureMessage(`[monitoring] ${event}: ${detail}`, {
        level: "error",
        extra: metadata,
      });
    }
  }, undefined);
};

export interface ReportErrorInput {
  event: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

const _emptyEnvelope = (event: string): ErrorEnvelope =>
  Object.freeze({
    ok: false,
    eventId: "",
    event: _str(event),
    capturedAt: _now(),
  });

export const reportError = (input: ReportErrorInput): ErrorEnvelope => {
  return _safe(() => {
    if (!_isObj(input)) return _emptyEnvelope("");
    const event = _str(input.event);
    if (!isMonitoredEvent(event)) {
      return _emptyEnvelope(event);
    }
    const detail = _str(input.detail);
    const metadata = _stripPII(input.metadata);
    const envelope: ErrorEnvelope = Object.freeze({
      ok: true,
      eventId: _genId(),
      event,
      capturedAt: _now(),
    });

    // Ring buffer (frozen envelopes only)
    _buffer.push(envelope);
    if (_buffer.length > MAX_BUFFER) _buffer.shift();

    const stored: StoredError = Object.freeze({
      ...envelope,
      detail,
      metadata,
    });
    _storedBuffer.push(stored);
    if (_storedBuffer.length > MAX_BUFFER) _storedBuffer.shift();

    _trySendToSentry(event, detail, metadata);

    return envelope;
  }, _emptyEnvelope(_isObj(input) ? _str(input.event) : ""));
};

export interface ListErrorsOptions {
  limit?: number;
  event?: string;
}

export const listErrors = (
  options?: ListErrorsOptions
): ReadonlyArray<ErrorEnvelope> => {
  return _safe(() => {
    const opts = _isObj(options) ? options : {};
    const limit =
      typeof opts.limit === "number" && opts.limit > 0
        ? Math.min(opts.limit, MAX_BUFFER)
        : MAX_BUFFER;
    const eventFilter = _str(opts.event);
    let result: ErrorEnvelope[] = _buffer.slice();
    if (eventFilter) {
      result = result.filter((e) => e.event === eventFilter);
    }
    if (result.length > limit) {
      result = result.slice(result.length - limit);
    }
    return Object.freeze(result.slice());
  }, Object.freeze([] as ErrorEnvelope[]));
};

export interface ErrorReporterSnapshot {
  readonly total: number;
  readonly counts: Readonly<Record<string, number>>;
  readonly bufferSize: number;
  readonly maxBuffer: number;
  readonly version: string;
}

export const errorReporterSnapshot = (): ErrorReporterSnapshot => {
  return _safe(() => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < MONITORED_EVENTS.length; i++) {
      counts[MONITORED_EVENTS[i]] = 0;
    }
    for (let i = 0; i < _buffer.length; i++) {
      const ev = _buffer[i].event;
      counts[ev] = (counts[ev] || 0) + 1;
    }
    return Object.freeze({
      total: _buffer.length,
      counts: Object.freeze(counts),
      bufferSize: _buffer.length,
      maxBuffer: MAX_BUFFER,
      version: ERROR_REPORTER_VERSION,
    });
  }, Object.freeze({
    total: 0,
    counts: Object.freeze({} as Record<string, number>),
    bufferSize: 0,
    maxBuffer: MAX_BUFFER,
    version: ERROR_REPORTER_VERSION,
  }));
};

export const errorReporterReady = (): boolean => true;
