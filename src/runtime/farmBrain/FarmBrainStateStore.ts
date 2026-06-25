/**
 * FarmBrainStateStore.ts — FARM_BRAIN_STATE_V1.
 *
 * The SINGLE FarmBrain cache (RULE 15 — no duplicate calculations). Screens
 * read `getFarmBrainState()` ONLY (RULE 2); events flow in through
 * `dispatchFarmEvent()` (RULE 1). Subscribe for reactive screens.
 *
 * Everything is best-effort and never throws — FarmBrain must never break a
 * screen. State is held in memory + mirrored to localStorage as a CACHE only
 * (the durable source of truth stays in Postgres via the existing sync).
 */
import {
  FarmBrainState, FarmEvent, FarmEventType, emptyFarmBrainState, FARM_BRAIN_STATE_VERSION,
} from './FarmBrainStateContracts';
import { reduceFarmBrainState, FarmBrainSignals } from './FarmBrainStateEngine';

const CACHE_KEY = 'farroway_farmbrain_state_v1';
const _safe = <T>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

type Listener = (s: FarmBrainState) => void;

let _state: FarmBrainState = _hydrate();
const _listeners = new Set<Listener>();
let _lastEventKey = '';     // de-dupe identical back-to-back events (RULE 15)

function _hydrate(): FarmBrainState {
  return _safe(() => {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
    if (!raw) return emptyFarmBrainState();
    const parsed = JSON.parse(raw);
    return parsed && parsed.version === FARM_BRAIN_STATE_VERSION ? parsed : emptyFarmBrainState();
  }, emptyFarmBrainState());
}

function _persist(s: FarmBrainState): void {
  _safe(() => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  }, undefined);
}

function _now(): number {
  // App runtime (browser) — Date.now() is fine here; the reducer stays pure.
  return _safe(() => Date.now(), 0);
}

/** RULE 2 — the one read every screen uses. Returns the cached canonical state. */
export function getFarmBrainState(): FarmBrainState {
  return _state;
}

/** Subscribe to state changes; returns an unsubscribe fn. */
export function subscribeFarmBrain(fn: Listener): () => void {
  if (typeof fn === 'function') _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/**
 * RULE 1 + RULE 4 — every event recalculates FarmBrain. Idempotent for
 * identical back-to-back events (single cache, no duplicate calculations).
 */
export function dispatchFarmEvent(
  type: FarmEventType,
  signals: FarmBrainSignals = {},
  payload?: any,
): FarmBrainState {
  return _safe(() => {
    const event: FarmEvent = { type, at: _now(), payload };
    // De-dupe: same type + same scan/confidence fingerprint → skip recompute.
    const key = type + ':' + _safe(() => JSON.stringify(signals.farmBrain || payload || ''), '');
    if (key === _lastEventKey && type !== 'task_completed') return _state;
    _lastEventKey = key;

    const next = reduceFarmBrainState(_state, event, signals);
    if (next === _state) return _state;
    _state = next;
    _persist(next);
    for (const l of _listeners) _safe(() => l(next), undefined);
    return next;
  }, _state);
}

/** Reset to the honest empty state (used by tests + full UI reset). */
export function resetFarmBrainState(): void {
  _state = emptyFarmBrainState();
  _lastEventKey = '';
  _persist(_state);
  for (const l of _listeners) _safe(() => l(_state), undefined);
}

/** Health envelope (RULE 16 telemetry) — install once from boot. */
export function farmBrainStateHealth() {
  const s = _state;
  return Object.freeze({
    ok: true,
    version: s.version,
    ready: s.version === FARM_BRAIN_STATE_VERSION,
    hasFirstScan: s.hasFirstScan,
    updatedAt: s.updatedAt,
    lastEvent: s.lastEvent,
    confidence: s.confidence,
    healthBand: s.farmHealth.band,
    // Honest provenance: which fields have no live feed (never fabricated).
    noLiveFeed: Object.freeze(
      ['marketReadiness', 'fundingEligibility', 'buyerReadiness']
        .filter((k) => (s as any)[k] && (s as any)[k].status === 'no_live_feed')),
    listeners: _listeners.size,
    singleCache: true,
  });
}

export function installFarmBrainStateHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__farmBrainStateHealth) return;
    Object.defineProperty(window, '__farmBrainStateHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => farmBrainStateHealth(),
    });
  }, undefined);
}
