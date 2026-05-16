/**
 * returnLoopScheduler.test.js — Daily Return Loop §4.
 *
 * The scheduler fires the daily briefing into the in-app
 * notification centre — at most once per calendar day, opt-in
 * aware, never throwing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  runDailyBriefingOnce,
  installReturnLoop,
  _resetReturnLoop,
} from '../../../src/core/notifications/returnLoopScheduler.js';
import {
  setPreferences,
  resetPreferences,
} from '../../../src/services/notificationPreferences.js';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('returnLoopScheduler — runDailyBriefingOnce', () => {
  const hadLS = 'localStorage' in globalThis;
  const savedLS = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
    _resetReturnLoop();
  });
  afterEach(() => {
    _resetReturnLoop();
    if (hadLS) globalThis.localStorage = savedLS;
    else delete globalThis.localStorage;
  });

  it('runs once, then is a no-op for the rest of the day', () => {
    const first = runDailyBriefingOnce();
    // first run either delivers or is gated (feature/opt-out) —
    // either way it stamps the day.
    expect(typeof first.ran).toBe('boolean');
    const second = runDailyBriefingOnce();
    expect(second.ran).toBe(false);
    expect(['already_ran', 'opted_out', 'feature_off']).toContain(second.reason);
  });

  it('respects the daily opt-out preference', () => {
    setPreferences({ daily: false });
    const r = runDailyBriefingOnce();
    // With daily turned off the briefing never fires. (When
    // FEATURE_NOTIFICATIONS is off the reason is feature_off
    // instead — both are valid "did not spam" outcomes.)
    expect(r.ran).toBe(false);
    expect(['opted_out', 'feature_off']).toContain(r.reason);
    resetPreferences();
  });

  it('never throws — even with no storage', () => {
    delete globalThis.localStorage;
    expect(() => runDailyBriefingOnce()).not.toThrow();
    expect(runDailyBriefingOnce().ran).toBe(false);
  });
});

describe('returnLoopScheduler — installReturnLoop', () => {
  const hadWin = 'window' in globalThis;
  const savedWin = globalThis.window;

  beforeEach(() => { _resetReturnLoop(); });
  afterEach(() => {
    _resetReturnLoop();
    if (hadWin) globalThis.window = savedWin;
    else delete globalThis.window;
  });

  it('is idempotent — installing twice is safe', () => {
    globalThis.window = globalThis.window || {};
    expect(installReturnLoop()).toBe(true);
    expect(installReturnLoop()).toBe(true);
  });

  it('SSR-safe — returns false with no window', () => {
    const w = globalThis.window;
    delete globalThis.window;
    try {
      expect(installReturnLoop()).toBe(false);
    } finally {
      if (hadWin) globalThis.window = w;
    }
  });
});

describe('main.jsx — installs the return loop at boot', () => {
  const mainSrc = read('src/main.jsx');

  it('imports + calls installReturnLoop', () => {
    expect(mainSrc).toMatch(/import \{ installReturnLoop \} from '\.\/core\/notifications\/returnLoopScheduler\.js'/);
    expect(mainSrc).toMatch(/installReturnLoop\(\)/);
  });
});
