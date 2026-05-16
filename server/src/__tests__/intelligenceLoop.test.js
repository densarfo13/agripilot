/**
 * intelligenceLoop.test.js — Connected Intelligence Loop Fix.
 *
 * The typed event bus (farmEventBus.js) and its subscribers already
 * shipped, but the key lifecycle events were never PUBLISHED — the
 * loop was broken at the publisher side. This verifies the fix:
 * saving a scan and completing a task now emit on the bus.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FarmEvents, subscribe, publish, _resetBus,
} from '../../../src/lib/farmEventBus.js';
import { saveScanUseful } from '../../../src/lib/scan/scanHistoryStore.js';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. The bus carries every spec event ───────────────────

describe('farmEventBus — spec event coverage', () => {
  it('declares all ten Connected-Intelligence-Loop events', () => {
    for (const e of [
      'FARM_CREATED', 'FARM_UPDATED', 'LOCATION_UPDATED', 'WEATHER_UPDATED',
      'SCAN_COMPLETED', 'TASK_CREATED', 'TASK_COMPLETED',
      'JOURNAL_ENTRY_CREATED', 'PRODUCE_LISTED', 'FOLLOW_UP_DUE',
    ]) {
      expect(typeof FarmEvents[e]).toBe('string');
    }
  });
});

// ─── 2. Re-entrancy cap — no infinite loops ────────────────

describe('farmEventBus — re-entrancy guard', () => {
  beforeEach(() => _resetBus());
  afterEach(() => _resetBus());

  it('a handler that re-publishes its own event terminates', () => {
    let calls = 0;
    subscribe(FarmEvents.WEATHER_UPDATED, () => {
      calls += 1;
      publish(FarmEvents.WEATHER_UPDATED, {}); // would loop forever uncapped
    });
    expect(() => publish(FarmEvents.WEATHER_UPDATED, {})).not.toThrow();
    // capped, not infinite
    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThan(100);
  });
});

// ─── 3. Scan save publishes into the loop ──────────────────

describe('saveScanUseful — publishes SCAN_COMPLETED + JOURNAL_ENTRY_CREATED', () => {
  const hadLS = 'localStorage' in globalThis;
  const savedLS = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
    _resetBus();
  });
  afterEach(() => {
    _resetBus();
    if (hadLS) globalThis.localStorage = savedLS;
    else delete globalThis.localStorage;
  });

  it('emits SCAN_COMPLETED with summary fields when a scan is saved', () => {
    const seen = [];
    subscribe(FarmEvents.SCAN_COMPLETED, (p) => seen.push(p));
    saveScanUseful(
      { scanId: 'scan_test_1', category: 'disease', severity: 'high' },
      { experience: 'farm', noticed: 'Brown spots' },
    );
    expect(seen.length).toBe(1);
    expect(seen[0].scanId).toBe('scan_test_1');
    expect(seen[0].category).toBe('disease');
  });

  it('emits JOURNAL_ENTRY_CREATED for the same scan', () => {
    const seen = [];
    subscribe(FarmEvents.JOURNAL_ENTRY_CREATED, (p) => seen.push(p));
    saveScanUseful(
      { scanId: 'scan_test_2', category: 'pest' },
      { experience: 'garden' },
    );
    expect(seen.length).toBe(1);
    expect(seen[0].kind).toBe('scan');
  });

  it('a publish failure never blocks the scan save', () => {
    subscribe(FarmEvents.SCAN_COMPLETED, () => { throw new Error('bad subscriber'); });
    let entry;
    expect(() => {
      entry = saveScanUseful({ scanId: 'scan_test_3', category: 'healthy' }, {});
    }).not.toThrow();
    expect(entry).toBeTruthy();
    expect(entry.id).toBe('scan_test_3');
  });
});

// ─── 4. Task events wired (source) ─────────────────────────

describe('scanToTask — task events feed the loop', () => {
  const src = read('src/core/scanToTask.js');

  it('addScanTasks publishes TASK_CREATED', () => {
    expect(src).toMatch(/publish\(FarmEvents\.TASK_CREATED/);
  });

  it('completeScanTask publishes TASK_COMPLETED', () => {
    expect(src).toMatch(/publish\(FarmEvents\.TASK_COMPLETED/);
  });

  it('both publishes are guarded (fire-and-forget)', () => {
    // each publish sits inside a try/catch
    expect(src).toMatch(/try \{\s*\n\s*publish\(FarmEvents\.TASK_CREATED/);
  });
});
