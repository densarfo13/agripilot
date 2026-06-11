/**
 * PilotAnalyticsRuntime.ts — unified track() helper + storage.
 *
 * Sprint #188. Sibling to the older
 * `src/runtime/outcomeIntelligence/PilotAnalyticsRuntime.ts`
 * (sprint #157 — read-side aggregator). This module is the
 * WRITE side: call sites invoke `trackPilotEvent({ eventType, … })`
 * and the payload is sanitized, stamped, and appended to
 * localStorage under the canonical key.
 *
 * Pure / SSR-safe / frozen returns / never throws. Reads from
 * window are guarded; no-op on the server.
 *
 * Storage:
 *   localStorage[PILOT_EVENTS_STORAGE_KEY] = JSON.stringify(array)
 *   FIFO-capped at PILOT_EVENTS_MAX_RETAINED (5000).
 *
 * Privacy:
 *   Every payload runs through sanitizeMetadata() from
 *   PilotEventContracts BEFORE write. Sensitive substrings are
 *   stripped; unknown metadata keys are dropped. The result is
 *   what's persisted.
 */

import {
  PILOT_EVENTS_STORAGE_KEY,
  PILOT_EVENTS_MAX_RETAINED,
  PILOT_ROLES,
  PILOT_MODES,
  sanitizeMetadata,
  isValidEventName,
  isValidRole,
  isValidMode,
} from './PilotEventContracts';
import type {
  PilotEventName, PilotEventPayload, PilotRole, PilotMode,
} from './PilotEventContracts';

export const PILOT_ANALYTICS_RUNTIME_VERSION = 'pilot-analytics-runtime-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _hasWindow = (): boolean =>
  _safe(() => typeof window !== 'undefined' && !!window, false);
const _hasStorage = (): boolean =>
  _safe(() => _hasWindow() && !!window.localStorage, false);

function _readEvents(): PilotEventPayload[] {
  if (!_hasStorage()) return [];
  return _safe(() => {
    const raw = window.localStorage.getItem(PILOT_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as PilotEventPayload[]) : [];
  }, [] as PilotEventPayload[]);
}

function _writeEvents(events: PilotEventPayload[]): void {
  if (!_hasStorage()) return;
  _safe(() => {
    const capped = events.length > PILOT_EVENTS_MAX_RETAINED
      ? events.slice(events.length - PILOT_EVENTS_MAX_RETAINED)
      : events;
    window.localStorage.setItem(
      PILOT_EVENTS_STORAGE_KEY, JSON.stringify(capped));
  }, undefined);
}

// ─── Public API ───────────────────────────────────────────────

export interface TrackPilotEventInput {
  eventType: PilotEventName;
  role?:     string;
  mode?:     string;
  language?: string;
  success?:  boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Append a sanitized event to localStorage. No-op on the server.
 * Never throws. Returns the persisted payload (or null on
 * invalid input / no storage).
 */
export function trackPilotEvent(
  input: TrackPilotEventInput,
): Readonly<PilotEventPayload> | null {
  return _safe(() => {
    if (!input || !isValidEventName(input.eventType)) return null;
    const role: PilotRole | 'unknown' = isValidRole(input.role)
      ? input.role : 'unknown';
    const mode: PilotMode | 'unknown' = isValidMode(input.mode)
      ? input.mode : 'unknown';
    const language = typeof input.language === 'string'
      && input.language.length > 0 && input.language.length <= 8
      ? input.language : 'unknown';
    const route = _safe(() => {
      if (!_hasWindow()) return '';
      const p = window.location && window.location.pathname;
      return typeof p === 'string' ? p.slice(0, 120) : '';
    }, '');
    const ts = _safe(() => Date.now(), 0);
    const payload: PilotEventPayload = Object.freeze({
      eventType: input.eventType,
      role,
      mode,
      language,
      route,
      success: input.success !== false,
      ts,
      metadata: sanitizeMetadata(input.metadata),
    });
    const events = _readEvents();
    events.push(payload);
    _writeEvents(events);
    return payload;
  }, null);
}

/**
 * Read the raw event log. Never throws.
 */
export function readPilotEvents(): ReadonlyArray<PilotEventPayload> {
  return Object.freeze(_readEvents());
}

/**
 * Count events by type within the last `windowMs` (default 7 days).
 * Used by the metrics aggregator + report generator.
 */
export function countByType(windowMs: number = 7 * 24 * 3600 * 1000):
  Readonly<Record<string, number>> {
  return _safe(() => {
    const now = _safe(() => Date.now(), 0);
    const cutoff = now - windowMs;
    const out: Record<string, number> = {};
    for (const e of _readEvents()) {
      if (e.ts < cutoff) continue;
      out[e.eventType] = (out[e.eventType] || 0) + 1;
    }
    return Object.freeze(out);
  }, Object.freeze({}));
}

/**
 * Distinct active routes within window — proxy for engagement.
 */
export function countDistinctActiveDays(windowMs: number = 30 * 24 * 3600 * 1000):
  number {
  return _safe(() => {
    const now = _safe(() => Date.now(), 0);
    const cutoff = now - windowMs;
    const days = new Set<string>();
    for (const e of _readEvents()) {
      if (e.ts < cutoff) continue;
      const d = new Date(e.ts);
      days.add(d.toISOString().slice(0, 10));
    }
    return days.size;
  }, 0);
}

/**
 * Reset (used by integration tests; not exposed in UI).
 */
export function _resetPilotEvents(): void {
  if (!_hasStorage()) return;
  _safe(() => window.localStorage.removeItem(PILOT_EVENTS_STORAGE_KEY), undefined);
}

export const _internal = Object.freeze({
  PILOT_ANALYTICS_RUNTIME_VERSION,
  trackPilotEvent, readPilotEvents, countByType,
  countDistinctActiveDays, _resetPilotEvents,
});

export default trackPilotEvent;
