/**
 * eventLogger.test.js — deterministic contract for the NGO event log.
 *
 * Spec §11 checklist (subset — analytics has its own file):
 *   1. logEvent writes an event with id / type / farmId / ts / payload
 *   2. duplicate ids are dropped (idempotent)
 *   3. getFarmTimeline returns ordered ascending
 *   4. isFarmActive respects the 7-day window
 *   5. safe when empty / no storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  logEvent,
  getEvents,
  clearEvents,
  getFarmTimeline,
  isFarmActive,
  EVENT_TYPES,
  _keys,
} from '../../../src/lib/events/eventLogger.js';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => map.has(k) ? map.get(k) : null,
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    },
  };
  return map;
}

const T = (days) => Date.now() - days * 24 * 3600 * 1000;

describe('eventLogger — basic writes', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('logEvent writes a full row', () => {
    const e = logEvent({
      farmId: 'farm_1', type: 'task_completed',
      payload: { taskId: 't_1' }, timestamp: 123,
    });
    expect(e).toBeTruthy();
    expect(e.id).toBeTruthy();
    expect(e.type).toBe('task_completed');
    expect(e.farmId).toBe('farm_1');
    expect(e.payload).toEqual({ taskId: 't_1' });
    expect(e.timestamp).toBe(123);
    expect(getEvents()).toHaveLength(1);
  });

  it('rejects unknown types', () => {
    const e = logEvent({ farmId: 'f1', type: 'make_tea' });
    expect(e).toBeNull();
    expect(getEvents()).toHaveLength(0);
  });

  it('rejects missing type', () => {
    expect(logEvent({ farmId: 'f1' })).toBeNull();
    expect(logEvent({})).toBeNull();
  });

  it('id-dedup: logging the same id twice is a no-op', () => {
    const e1 = logEvent({ id: 'x', farmId: 'f1', type: 'login' });
    const e2 = logEvent({ id: 'x', farmId: 'f1', type: 'login' });
    expect(e1).toBeTruthy();
    expect(e2).toBeNull();
    expect(getEvents()).toHaveLength(1);
  });

  it('EVENT_TYPES is stable and frozen', () => {
    expect(Object.isFrozen(EVENT_TYPES)).toBe(true);
    for (const t of ['task_completed','task_feedback','farm_created','farm_updated','login']) {
      expect(EVENT_TYPES).toContain(t);
    }
  });
});

// ─── Timeline (spec §2) ────────────────────────────────────────────
describe('getFarmTimeline', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('returns only events for the given farm, ordered ascending', () => {
    logEvent({ farmId: 'f1', type: 'farm_created', timestamp: 10 });
    logEvent({ farmId: 'f2', type: 'farm_created', timestamp: 20 });
    logEvent({ farmId: 'f1', type: 'task_completed', timestamp: 40 });
    logEvent({ farmId: 'f1', type: 'task_feedback', timestamp: 30 });

    const tl = getFarmTimeline('f1');
    expect(tl.map((e) => e.timestamp)).toEqual([10, 30, 40]);
    expect(tl.every((e) => e.farmId === 'f1')).toBe(true);
  });

  it('empty / unknown farm → []', () => {
    expect(getFarmTimeline(null)).toEqual([]);
    expect(getFarmTimeline('ghost')).toEqual([]);
  });
});

// ─── Active-farmer (spec §3) ───────────────────────────────────────
describe('isFarmActive', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('true when any event occurred in the last 7 days', () => {
    logEvent({ farmId: 'f1', type: 'task_completed', timestamp: T(3) });
    expect(isFarmActive('f1')).toBe(true);
  });

  it('false when the most recent event is older than window', () => {
    logEvent({ farmId: 'f1', type: 'task_completed', timestamp: T(30) });
    expect(isFarmActive('f1')).toBe(false);
  });

  it('window is configurable', () => {
    logEvent({ farmId: 'f1', type: 'task_completed', timestamp: T(10) });
    expect(isFarmActive('f1', { windowDays: 14 })).toBe(true);
    expect(isFarmActive('f1', { windowDays: 7  })).toBe(false);
  });

  it('empty farm → false, never throws', () => {
    expect(isFarmActive('f1')).toBe(false);
    expect(isFarmActive(null)).toBe(false);
  });
});

// ─── Safety ───────────────────────────────────────────────────────
describe('eventLogger — safety', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('no localStorage → reads return [], writes silently no-op', () => {
    delete globalThis.window;
    expect(getEvents()).toEqual([]);
    expect(logEvent({ farmId: 'f1', type: 'login' })).toBeTruthy(); // gen'd id ok, write no-op
    expect(getEvents()).toEqual([]);
  });

  it('clearEvents empties the log', () => {
    logEvent({ farmId: 'f1', type: 'login' });
    clearEvents();
    expect(getEvents()).toEqual([]);
  });

  it('storage key is namespaced under farroway.*', () => {
    expect(_keys.STORAGE_KEY.startsWith('farroway.')).toBe(true);
  });
});
