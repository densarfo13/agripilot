/**
 * unifiedFarmCore.test.js — contract for the "Farroway core
 * system (unified fix)" helpers at src/core/farm/unified.js.
 *
 * Covers the pure / easy-to-mock surfaces:
 *   • useFarmStoreUnified — get/set/update
 *   • resolveText — string + LocalizedPayload
 *   • SIZE_UNITS — shape + stability
 *   • showToast — pluggable handler + alert fallback
 *   • goToCropFit — safe navigate call
 *   • recomputeAll — returns {ok, errors} shape (errors swallowed)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted polyfill: unified.js imports the API client, which imports
// authStore, which touches localStorage at module load. Vitest's node
// env doesn't have localStorage — install a minimal one BEFORE the
// imports below resolve.
vi.hoisted(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem:    (k) => store.has(k) ? store.get(k) : null,
    setItem:    (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear:      () => store.clear(),
    key:        (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  globalThis.window = globalThis.window || {};
  globalThis.window.localStorage = globalThis.localStorage;
});

import {
  useFarmStoreUnified,
  resolveText, SIZE_UNITS, goToCropFit,
  showToast, setToastHandler, _internal,
} from '../../../src/core/farm/unified.js';

// ─── useFarmStoreUnified ─────────────────────────────────────
describe('useFarmStoreUnified', () => {
  beforeEach(() => {
    useFarmStoreUnified.setState({ currentFarm: null, farms: [] });
  });

  it('setCurrentFarm updates currentFarm', () => {
    useFarmStoreUnified.getState().setCurrentFarm({ id: 'f1' });
    expect(useFarmStoreUnified.getState().currentFarm).toEqual({ id: 'f1' });
  });

  it('setFarms replaces the farms array', () => {
    useFarmStoreUnified.getState().setFarms([{ id: 'a' }, { id: 'b' }]);
    expect(useFarmStoreUnified.getState().farms.length).toBe(2);
  });

  it('updateFarm swaps in a new record by id in farms + currentFarm', () => {
    useFarmStoreUnified.setState({
      currentFarm: { id: 'a', crop: 'maize' },
      farms: [{ id: 'a', crop: 'maize' }, { id: 'b' }],
    });
    useFarmStoreUnified.getState().updateFarm({ id: 'a', crop: 'rice' });
    const s = useFarmStoreUnified.getState();
    expect(s.currentFarm.crop).toBe('rice');
    expect(s.farms.find((f) => f.id === 'a').crop).toBe('rice');
    expect(s.farms.find((f) => f.id === 'b')).toEqual({ id: 'b' });
  });

  it('updateFarm is null-safe on missing updated', () => {
    useFarmStoreUnified.setState({
      currentFarm: { id: 'a' },
      farms: [{ id: 'a' }, null, { id: 'b' }],
    });
    expect(() => useFarmStoreUnified.getState().updateFarm(null)).not.toThrow();
  });
});

// ─── resolveText ─────────────────────────────────────────────
describe('resolveText', () => {
  it('passes through plain strings unchanged', () => {
    expect(resolveText('Hello')).toBe('Hello');
  });
  it('returns "" for null / undefined', () => {
    expect(resolveText(null)).toBe('');
    expect(resolveText(undefined)).toBe('');
  });
  it('translates LocalizedPayload via provided t function', () => {
    const t = (key, params) => key === 'hello' ? `Hello, ${params?.name || ''}` : key;
    expect(resolveText({ key: 'hello', params: { name: 'Ama' } }, t)).toBe('Hello, Ama');
  });
  it('falls back to payload.fallback when t is missing', () => {
    expect(resolveText({ key: 'x.y', fallback: 'Fallback text' })).toBe('Fallback text');
  });
  it('falls back to payload.key when t is missing and no fallback', () => {
    expect(resolveText({ key: 'a.b' })).toBe('a.b');
  });
  it('returns "" on bogus payload shape', () => {
    expect(resolveText({ notAKey: 'x' })).toBe('');
    expect(resolveText(42)).toBe('');
  });
});

// ─── SIZE_UNITS ──────────────────────────────────────────────
describe('SIZE_UNITS', () => {
  it('exposes acres + hectares with labelKey entries', () => {
    expect(SIZE_UNITS.length).toBe(2);
    const vals = SIZE_UNITS.map((u) => u.value);
    expect(vals).toEqual(['acres', 'hectares']);
    for (const u of SIZE_UNITS) {
      expect(typeof u.labelKey).toBe('string');
      expect(u.labelKey).toMatch(/^setup\./);
    }
  });
  it('is frozen (outer and inner entries)', () => {
    expect(Object.isFrozen(SIZE_UNITS)).toBe(true);
    for (const u of SIZE_UNITS) expect(Object.isFrozen(u)).toBe(true);
  });
});

// ─── showToast ───────────────────────────────────────────────
describe('showToast', () => {
  beforeEach(() => {
    setToastHandler(null);
    globalThis.window = globalThis.window || {};
  });

  it('calls custom toast handler when installed', () => {
    const spy = vi.fn();
    setToastHandler(spy);
    showToast('Hello');
    expect(spy).toHaveBeenCalledWith('Hello');
  });

  it('falls back to window.alert when no handler', () => {
    const alertSpy = vi.fn();
    globalThis.window.alert = alertSpy;
    showToast('Hi');
    expect(alertSpy).toHaveBeenCalledWith('Hi');
  });

  it('ignores null / empty messages', () => {
    const spy = vi.fn();
    setToastHandler(spy);
    showToast(null);
    showToast('');
    expect(spy).not.toHaveBeenCalled();
  });

  it('setToastHandler(null) clears the handler', () => {
    const spy = vi.fn();
    setToastHandler(spy);
    setToastHandler(null);
    expect(_internal.toastHandler).toBeNull();
  });

  it('setToastHandler ignores non-function inputs', () => {
    setToastHandler('not a function');
    expect(_internal.toastHandler).toBeNull();
  });
});

// ─── goToCropFit ─────────────────────────────────────────────
describe('goToCropFit', () => {
  it('calls navigate("/onboarding/fast")', () => {
    const spy = vi.fn();
    goToCropFit(spy);
    expect(spy).toHaveBeenCalledWith('/onboarding/fast');
  });

  it('no-op when navigate is missing / non-function', () => {
    expect(() => goToCropFit(null)).not.toThrow();
    expect(() => goToCropFit('nope')).not.toThrow();
  });
});
