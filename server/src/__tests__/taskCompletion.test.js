/**
 * taskCompletion.test.js — locks the task-completion store
 * contract. Runs in a happy-dom / jsdom-ish environment; we stub
 * window.localStorage directly to avoid depending on an active
 * environment configuration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal in-memory localStorage shim so the store works without
// a real browser environment. Assigned globally BEFORE the module
// under test is imported.
const mem = new Map();
globalThis.window = globalThis.window || {};
globalThis.window.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
// Silence the CustomEvent dispatch in non-DOM environments.
globalThis.window.dispatchEvent = () => true;
globalThis.CustomEvent = globalThis.CustomEvent || class {
  constructor(type, init) { this.type = type; this.detail = init && init.detail; }
};

import {
  listCompletedIds, markTaskDone, unmarkTaskDone, clearDay, _internal,
} from '../../../src/lib/intelligence/taskCompletion.js';

beforeEach(() => { mem.clear(); });

describe('taskCompletion store', () => {
  it('listCompletedIds returns empty set when nothing stored', () => {
    expect(listCompletedIds('farm-1')).toEqual(new Set());
  });

  it('markTaskDone adds id + persists', () => {
    const set = markTaskDone('farm-1', 'mid.scout_pests');
    expect(set.has('mid.scout_pests')).toBe(true);
    // Re-read from storage to prove persistence.
    expect(listCompletedIds('farm-1').has('mid.scout_pests')).toBe(true);
  });

  it('double-mark is idempotent', () => {
    markTaskDone('farm-1', 't1');
    const after = markTaskDone('farm-1', 't1');
    expect(after.size).toBe(1);
  });

  it('unmarkTaskDone removes id', () => {
    markTaskDone('farm-1', 't1');
    markTaskDone('farm-1', 't2');
    unmarkTaskDone('farm-1', 't1');
    const ids = listCompletedIds('farm-1');
    expect(ids.has('t1')).toBe(false);
    expect(ids.has('t2')).toBe(true);
  });

  it('scopes completions per farm', () => {
    markTaskDone('farm-1', 't1');
    markTaskDone('farm-2', 't1');
    unmarkTaskDone('farm-1', 't1');
    expect(listCompletedIds('farm-1').has('t1')).toBe(false);
    expect(listCompletedIds('farm-2').has('t1')).toBe(true);
  });

  it('scopes completions per date', () => {
    markTaskDone('farm-1', 't1', '2026-05-15');
    markTaskDone('farm-1', 't2', '2026-05-16');
    expect(listCompletedIds('farm-1', '2026-05-15').has('t1')).toBe(true);
    expect(listCompletedIds('farm-1', '2026-05-15').has('t2')).toBe(false);
    expect(listCompletedIds('farm-1', '2026-05-16').has('t2')).toBe(true);
  });

  it('clearDay wipes a specific date', () => {
    markTaskDone('farm-1', 't1', '2026-05-15');
    markTaskDone('farm-1', 't2', '2026-05-16');
    clearDay('farm-1', '2026-05-15');
    expect(listCompletedIds('farm-1', '2026-05-15').size).toBe(0);
    expect(listCompletedIds('farm-1', '2026-05-16').has('t2')).toBe(true);
  });

  it('rejects bad inputs gracefully', () => {
    expect(listCompletedIds(null)).toEqual(new Set());
    expect(markTaskDone(null, 't1')).toEqual(new Set());
    expect(markTaskDone('farm-1', null)).toEqual(new Set());
  });

  it('trimOldDates drops entries older than TRIM_DAYS', () => {
    const old = '2020-01-01';
    const recent = _internal.ymd(new Date());
    const byFarm = {
      'farm-1': {
        [old]:    { ids: ['x'], at: {} },
        [recent]: { ids: ['y'], at: {} },
      },
    };
    const trimmed = _internal.trimOldDates(byFarm);
    expect(trimmed['farm-1'][old]).toBeUndefined();
    expect(trimmed['farm-1'][recent]).toBeTruthy();
  });
});
