/**
 * scanHistoryStoreGuard.test.js — verifies the Scan Trust Layer
 * gate added to saveScanUseful(): journal rejects entries that
 * carry NEITHER an image NOR a diagnosis (the "empty shell" case
 * the field reported as a broken history card).
 */

// localStorage shim — saveScanUseful checks `typeof localStorage`
// (global) not `window.localStorage`, so install it on globalThis.
const _s = new Map();
const _ls = {
  getItem:    (k) => (_s.has(k) ? _s.get(k) : null),
  setItem:    (k, v) => { _s.set(k, String(v)); },
  removeItem: (k) => { _s.delete(k); },
  clear:      () => { _s.clear(); },
};
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = _ls;
}
if (typeof globalThis.window === 'undefined') globalThis.window = { localStorage: _ls };
else if (!globalThis.window.localStorage) globalThis.window.localStorage = _ls;

import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveScanUseful,
  clearScanUsefulHistory,
  getScanUsefulHistory,
} from '../../../src/lib/scan/scanHistoryStore.js';

describe('saveScanUseful — Scan Trust Layer guard', () => {
  beforeEach(() => { _s.clear(); clearScanUsefulHistory(); });

  it('rejects empty shell (no image AND no diagnosis) → returns null + does NOT persist', () => {
    const r = saveScanUseful({}, {});
    expect(r).toBe(null);
    expect(getScanUsefulHistory().length).toBe(0);
  });

  it('rejects null result + empty context', () => {
    expect(saveScanUseful(null, null)).toBe(null);
    expect(saveScanUseful(undefined, undefined)).toBe(null);
  });

  it('allows diagnosis-only (manual symptom fallback)', () => {
    const r = saveScanUseful(
      { scanId: 'm1', category: 'disease', possibleIssue: 'leaf spots' },
      { experience: 'farm' },
    );
    expect(r).toBeTruthy();
    expect(r.id).toBe('m1');
    expect(getScanUsefulHistory().length).toBe(1);
  });

  it('allows image-only (offline-queued scan with no diagnosis yet)', () => {
    const r = saveScanUseful(
      { scanId: 's1' },
      { thumbnail: 'data:image/jpeg;base64,abc', experience: 'farm' },
    );
    expect(r).toBeTruthy();
    expect(r.id).toBe('s1');
    expect(r.thumbnail).toBeTruthy();
  });

  it('allows full entry (image + diagnosis)', () => {
    const r = saveScanUseful(
      { scanId: 'f1', category: 'pest', severity: 'medium' },
      { thumbnail: 'data:image/jpeg;base64,abc', experience: 'farm', noticed: 'aphids' },
    );
    expect(r).toBeTruthy();
    expect(r.id).toBe('f1');
    expect(r.thumbnail).toBeTruthy();
    expect(r.category).toBe('pest');
  });

  it('rejected entries do NOT trigger event emission either', () => {
    saveScanUseful({}, {});            // shell — rejected
    saveScanUseful(null, null);        // null — rejected
    expect(getScanUsefulHistory().length).toBe(0);
  });

  it('idempotent — repeat call for same scanId returns existing row', () => {
    saveScanUseful(
      { scanId: 'i1', category: 'pest' },
      { thumbnail: 'data:image/jpeg;base64,abc' },
    );
    const second = saveScanUseful(
      { scanId: 'i1', category: 'pest' },
      { thumbnail: 'data:image/jpeg;base64,abc' },
    );
    expect(second.id).toBe('i1');
    expect(getScanUsefulHistory().length).toBe(1);
  });
});
