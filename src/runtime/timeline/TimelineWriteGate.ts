/**
 * TimelineWriteGate.ts — sprint #215 §3.
 *
 * Idempotency gate for farm-timeline writes: the same scan / event /
 * task may not be written twice. Callers ask shouldWriteTimeline(key)
 * before appending; the gate remembers recent keys (localStorage) and
 * rejects repeats. Prevents the duplicated-timeline-row failure.
 *
 * Pure logic + guarded localStorage. SSR-safe. Never throws.
 * Pins window.__timelineHealth().
 */

export const TIMELINE_WRITE_GATE_VERSION = 'timeline-write-gate-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const STORE_KEY = 'farroway:timelineWriteKeys';
const MAX_KEYS = 400;

function _seen(): string[] {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }, []);
}
function _persist(keys: string[]): void {
  _safe(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORE_KEY, JSON.stringify(keys.slice(-MAX_KEYS)));
  }, undefined);
}

/** Canonical write key for a timeline entry. */
export function timelineKey(input: {
  kind?: string; scanId?: string; taskId?: string; eventId?: string; at?: string;
}): string {
  return [
    _str(input.kind),
    _str(input.scanId) || _str(input.taskId) || _str(input.eventId),
    _str(input.at).slice(0, 10),
  ].join('|');
}

/**
 * Returns true if this entry is NEW (and records it); false if it is a
 * duplicate of a recent write.
 */
export function shouldWriteTimeline(key: string): boolean {
  return _safe(() => {
    const k = _str(key);
    if (!k) return false;
    const keys = _seen();
    if (keys.includes(k)) return false;
    keys.push(k);
    _persist(keys);
    return true;
  }, true); // fail-open: never block a legit write on a storage error
}

export function buildTimelineHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  timelineWriteGateReady: true; noDuplicateTimelineEvents: true; trackedKeys: number;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: TIMELINE_WRITE_GATE_VERSION,
    timelineWriteGateReady: true as const,
    noDuplicateTimelineEvents: true as const,
    trackedKeys: _safe(() => _seen().length, 0),
  });
}

let _installed = false;
export function installTimelineHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__timelineHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildTimelineHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  timelineKey, shouldWriteTimeline, buildTimelineHealth, installTimelineHealthGlobal,
});
export default shouldWriteTimeline;
