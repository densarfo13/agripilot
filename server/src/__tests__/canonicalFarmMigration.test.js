/**
 * canonicalFarmMigration.test.js — single-source-of-truth migration
 * + Zustand stores + resolveCropName + diagnostics.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  useCanonicalFarmStore, DEFAULT_FARM, CANONICAL_FARM_STORAGE_KEY,
} from '../../../src/store/canonicalFarmStore.js';
import {
  useLanguageStore, LANGUAGE_STORAGE_KEY,
} from '../../../src/store/languageStore.js';
import {
  migrateLegacyFarmState, LEGACY_FARM_KEYS,
} from '../../../src/bootstrap/migrateLegacyFarmState.js';
import { resolveCropName } from '../../../src/utils/resolveCropName.js';
import {
  installFarmAuditDiagnostics, runFarmAudit,
} from '../../../src/lib/farmAuditDiagnostics.js';

function _stubLocalStorage() {
  if (typeof globalThis.localStorage === 'undefined') {
    const _store = new Map();
    globalThis.localStorage = {
      getItem:    (k) => _store.has(k) ? _store.get(k) : null,
      setItem:    (k, v) => _store.set(k, String(v)),
      removeItem: (k) => _store.delete(k),
      clear:      () => _store.clear(),
      get length() { return _store.size; },
      key: (i) => Array.from(_store.keys())[i] || null,
    };
  } else {
    try { globalThis.localStorage.clear(); } catch { /* swallow */ }
  }
}

beforeEach(() => {
  _stubLocalStorage();
  try { useCanonicalFarmStore.getState().clearFarm(); } catch { /* swallow */ }
  try { useCanonicalFarmStore.setState({ hydrated: false }); } catch { /* swallow */ }
});

// ═══ canonicalFarmStore ══════════════════════════════════════

describe('useCanonicalFarmStore', () => {
  it('exposes DEFAULT_FARM shape', () => {
    expect(DEFAULT_FARM.id).toBeNull();
    expect(DEFAULT_FARM.crop).toBe('');
    expect(DEFAULT_FARM.type).toBe('farm');
    expect(DEFAULT_FARM.progressStage).toBe('early_growth');
  });

  it('CANONICAL_FARM_STORAGE_KEY matches spec', () => {
    expect(CANONICAL_FARM_STORAGE_KEY).toBe('farroway-canonical-farm-v2');
  });

  it('initial state has DEFAULT_FARM', () => {
    const s = useCanonicalFarmStore.getState();
    expect(s.activeFarm.crop).toBe('');
    expect(s.hydrated).toBe(false);
  });

  it('updateFarm merges partial updates', () => {
    useCanonicalFarmStore.getState().updateFarm({ crop: 'pepper', name: 'Sunny Field' });
    const s = useCanonicalFarmStore.getState();
    expect(s.activeFarm.crop).toBe('pepper');
    expect(s.activeFarm.name).toBe('Sunny Field');
  });

  it('replaceFarm wipes and refills', () => {
    useCanonicalFarmStore.getState().updateFarm({ crop: 'pepper', name: 'A' });
    useCanonicalFarmStore.getState().replaceFarm({ crop: 'cassava' });
    const s = useCanonicalFarmStore.getState();
    expect(s.activeFarm.crop).toBe('cassava');
    expect(s.activeFarm.name).toBe('');
  });

  it('clearFarm returns to defaults', () => {
    useCanonicalFarmStore.getState().updateFarm({ crop: 'pepper' });
    useCanonicalFarmStore.getState().clearFarm();
    expect(useCanonicalFarmStore.getState().activeFarm.crop).toBe('');
  });

  it('setHydrated flips the flag', () => {
    useCanonicalFarmStore.getState().setHydrated(true);
    expect(useCanonicalFarmStore.getState().hydrated).toBe(true);
  });

  it('garbage to updateFarm is a no-op-safe', () => {
    expect(() => useCanonicalFarmStore.getState().updateFarm(null)).not.toThrow();
    expect(() => useCanonicalFarmStore.getState().updateFarm('hi')).not.toThrow();
  });
});

// ═══ languageStore ═══════════════════════════════════════════

describe('useLanguageStore', () => {
  it('default language is en', () => {
    expect(useLanguageStore.getState().language).toBe('en');
  });

  it('LANGUAGE_STORAGE_KEY matches spec', () => {
    expect(LANGUAGE_STORAGE_KEY).toBe('farroway-language-v2');
  });

  it('setLanguage accepts supported codes', () => {
    useLanguageStore.getState().setLanguage('tw');
    expect(useLanguageStore.getState().language).toBe('tw');
  });

  it('coerces region suffix (en-US → en)', () => {
    useLanguageStore.getState().setLanguage('en-US');
    expect(useLanguageStore.getState().language).toBe('en');
  });

  it('falls back to en on unsupported code', () => {
    useLanguageStore.getState().setLanguage('xx');
    expect(useLanguageStore.getState().language).toBe('en');
  });

  it('garbage input → en', () => {
    useLanguageStore.getState().setLanguage(null);
    expect(useLanguageStore.getState().language).toBe('en');
  });
});

// ═══ resolveCropName ═════════════════════════════════════════

describe('resolveCropName', () => {
  it('prefers cropDisplayName', () => {
    expect(resolveCropName({
      cropDisplayName: 'Aburo', crop: 'maize',
    })).toBe('Aburo');
  });

  it('falls back to crop', () => {
    expect(resolveCropName({ crop: 'pepper' })).toBe('pepper');
  });

  it('returns "your crop" for null', () => {
    expect(resolveCropName(null)).toBe('your crop');
    expect(resolveCropName(undefined)).toBe('your crop');
    expect(resolveCropName({})).toBe('your crop');
  });

  it('trims whitespace', () => {
    expect(resolveCropName({ cropDisplayName: '   ' })).toBe('your crop');
    expect(resolveCropName({ cropDisplayName: '  Pepper  ' })).toBe('Pepper');
  });

  it('never throws on garbage', () => {
    expect(() => resolveCropName('string')).not.toThrow();
    expect(() => resolveCropName(42)).not.toThrow();
  });
});

// ═══ migrateLegacyFarmState ══════════════════════════════════

describe('migrateLegacyFarmState', () => {
  it('legacy keys list contains the 13 spec entries + more (defense-in-depth)', () => {
    expect(LEGACY_FARM_KEYS).toContain('farm');
    expect(LEGACY_FARM_KEYS).toContain('farmData');
    expect(LEGACY_FARM_KEYS).toContain('myFarm');
    expect(LEGACY_FARM_KEYS).toContain('selectedFarm');
    expect(LEGACY_FARM_KEYS).toContain('currentFarm');
    expect(LEGACY_FARM_KEYS).toContain('gardenFarm');
    expect(LEGACY_FARM_KEYS).toContain('userFarm');
    expect(LEGACY_FARM_KEYS).toContain('farmProfile');
    expect(LEGACY_FARM_KEYS).toContain('activeFarm');
  });

  it('noop when localStorage is empty', () => {
    const r = migrateLegacyFarmState();
    expect(r.summary).toBe('no_legacy_signal_found');
    expect(r.canonicalExisted).toBe(false);
  });

  it('drops legacy keys when canonical exists', () => {
    localStorage.setItem(CANONICAL_FARM_STORAGE_KEY,
      JSON.stringify({ state: { activeFarm: { ...DEFAULT_FARM, crop: 'pepper' } } }));
    localStorage.setItem('farm', JSON.stringify({ crop: 'cassava' }));
    localStorage.setItem('selectedFarm', JSON.stringify({ crop: 'cassava' }));
    const r = migrateLegacyFarmState();
    expect(r.canonicalExisted).toBe(true);
    expect(r.droppedKeys).toContain('farm');
    expect(r.droppedKeys).toContain('selectedFarm');
    expect(localStorage.getItem('farm')).toBeNull();
    expect(localStorage.getItem('selectedFarm')).toBeNull();
  });

  it('promotes first legacy farm into canonical when canonical missing', () => {
    localStorage.setItem('selectedFarm', JSON.stringify({
      cropType: 'pepper', name: 'Sunny Field',
    }));
    const r = migrateLegacyFarmState();
    expect(r.promotedFrom).toBe('selectedFarm');
    expect(r.promotedFarm.crop).toBe('pepper');
    expect(r.promotedFarm.name).toBe('Sunny Field');
    const canonical = JSON.parse(localStorage.getItem(CANONICAL_FARM_STORAGE_KEY));
    expect(canonical.state.activeFarm.crop).toBe('pepper');
  });

  it('drops every legacy key after promotion', () => {
    localStorage.setItem('farm', JSON.stringify({ cropType: 'pepper' }));
    localStorage.setItem('farmData', JSON.stringify({ crop: 'pepper' }));
    localStorage.setItem('currentFarm', JSON.stringify({ crop: 'pepper' }));
    migrateLegacyFarmState();
    expect(localStorage.getItem('farm')).toBeNull();
    expect(localStorage.getItem('farmData')).toBeNull();
    expect(localStorage.getItem('currentFarm')).toBeNull();
  });

  it('handles zustand-envelope shape in legacy slots', () => {
    localStorage.setItem('farroway:activeFarm:v1', JSON.stringify({
      state: { activeFarm: { cropId: 'pepper', name: 'X' } },
    }));
    const r = migrateLegacyFarmState();
    expect(r.promotedFarm).toBeTruthy();
    expect(r.promotedFarm.crop).toBe('pepper');
  });

  it('handles malformed JSON gracefully', () => {
    localStorage.setItem('farm', 'not-json{{{');
    expect(() => migrateLegacyFarmState()).not.toThrow();
  });

  it('never throws on garbage state', () => {
    expect(() => migrateLegacyFarmState()).not.toThrow();
  });
});

// ═══ Diagnostics ═════════════════════════════════════════════

describe('runFarmAudit + installFarmAuditDiagnostics', () => {
  it('reports canonicalExists=false on empty', () => {
    const a = runFarmAudit();
    expect(a.canonicalExists).toBe(false);
    expect(a.legacyKeysRemaining.length).toBe(0);
    expect(a.clean).toBe(true);
  });

  it('reports canonicalExists=true after migration', () => {
    localStorage.setItem(CANONICAL_FARM_STORAGE_KEY,
      JSON.stringify({ state: { activeFarm: { crop: 'pepper' } } }));
    const a = runFarmAudit();
    expect(a.canonicalExists).toBe(true);
    expect(a.canonicalData.state.activeFarm.crop).toBe('pepper');
  });

  it('lists lingering legacy keys', () => {
    localStorage.setItem('selectedFarm', JSON.stringify({ crop: 'pepper' }));
    localStorage.setItem('myFarm', JSON.stringify({ crop: 'pepper' }));
    const a = runFarmAudit();
    expect(a.legacyKeysRemaining).toContain('selectedFarm');
    expect(a.legacyKeysRemaining).toContain('myFarm');
    expect(a.clean).toBe(false);
  });

  it('installFarmAuditDiagnostics is SSR-safe (no window)', () => {
    if (typeof window === 'undefined') {
      expect(installFarmAuditDiagnostics()).toBe(false);
    } else {
      expect(installFarmAuditDiagnostics()).toBe(true);
      expect(installFarmAuditDiagnostics()).toBe(true); // idempotent
    }
  });
});

// ═══ End-to-end migration → store → resolve ══════════════════

describe('end-to-end: legacy → canonical → resolveCropName', () => {
  it('legacy "pepper" survives the migration and renders correctly', () => {
    localStorage.setItem('selectedFarm', JSON.stringify({
      cropType: 'pepper', name: 'Sunny Field',
    }));
    const r = migrateLegacyFarmState();
    expect(r.promotedFarm.crop).toBe('pepper');
    // Confirm resolveCropName picks it up from the promoted record.
    // cropDisplayName is the localized capitalized form ("Pepper");
    // resolveCropName prefers it over the canonical cropId.
    const farm = r.promotedFarm;
    expect(resolveCropName(farm).toLowerCase()).toBe('pepper');
  });
});
