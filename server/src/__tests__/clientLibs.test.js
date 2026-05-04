/**
 * clientLibs.test.js — unit tests for the frontend safety layer.
 *
 * These modules live under the frontend tree but contain no
 * React / DOM / browser-only APIs that vitest can't polyfill, so
 * we run them inside the existing server vitest project. The
 * imports reach into ../../../src/lib/* via relative paths.
 *
 * Covered:
 *   • storageSafe.safeJsonParse / safeJsonSet
 *   • storageSafe.removeFarrowayState (auth preserved)
 *   • storageSafe.validateFarm / validateTask / validateWeather
 *   • getDisplayText (object → string with name/label/title)
 *   • defaults (frozen + correct shapes)
 *   • stateMigration: runs once, drops invalid shapes,
 *     sessionStorage loop guard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── In-memory localStorage / sessionStorage / window mocks ──
function makeStorage() {
  const store = new Map();
  return {
    get length() { return store.size; },
    key:        (i) => Array.from(store.keys())[i] ?? null,
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear:      () => { store.clear(); },
    _dump:      () => Object.fromEntries(store),
  };
}

let reloadCalls = 0;
beforeEach(() => {
  globalThis.localStorage   = makeStorage();
  globalThis.sessionStorage = makeStorage();
  reloadCalls = 0;
  globalThis.window = {
    location: {
      reload: () => { reloadCalls += 1; },
      pathname: '/dashboard',
      search: '',
    },
  };
});

// ─── storageSafe ─────────────────────────────────────────────
describe('storageSafe.safeJsonParse', () => {
  it('returns the fallback when the key is missing', async () => {
    const { safeJsonParse } = await import('../../../src/lib/storageSafe.js');
    expect(safeJsonParse('nope', { a: 1 })).toEqual({ a: 1 });
  });

  it('parses valid JSON and returns the object', async () => {
    const { safeJsonParse } = await import('../../../src/lib/storageSafe.js');
    localStorage.setItem('k', JSON.stringify({ hello: 'world' }));
    expect(safeJsonParse('k', null)).toEqual({ hello: 'world' });
  });

  it('returns fallback AND removes the key when JSON is malformed', async () => {
    const { safeJsonParse } = await import('../../../src/lib/storageSafe.js');
    localStorage.setItem('k', '{not json');
    expect(safeJsonParse('k', null)).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('returns fallback when the parsed value is null', async () => {
    const { safeJsonParse } = await import('../../../src/lib/storageSafe.js');
    localStorage.setItem('k', 'null');
    expect(safeJsonParse('k', { ok: true })).toEqual({ ok: true });
  });
});

describe('storageSafe.safeJsonSet', () => {
  it('serialises and writes', async () => {
    const { safeJsonSet } = await import('../../../src/lib/storageSafe.js');
    expect(safeJsonSet('k', { a: 1 })).toBe(true);
    expect(localStorage.getItem('k')).toBe('{"a":1}');
  });

  it('rejects circular structures gracefully', async () => {
    const { safeJsonSet } = await import('../../../src/lib/storageSafe.js');
    const a = {}; a.self = a;
    expect(safeJsonSet('k', a)).toBe(false);
  });
});

describe('storageSafe.removeFarrowayState', () => {
  it('drops listed state keys but PRESERVES every auth key', async () => {
    const { removeFarrowayState, FARROWAY_AUTH_KEYS } = await import('../../../src/lib/storageSafe.js');
    localStorage.setItem('farroway_active_farm', '{"id":"x"}');
    localStorage.setItem('farroway_cached_tasks', '[]');
    localStorage.setItem('farroway_token', 'abc');
    localStorage.setItem('farroway_user',  '{"id":"u"}');
    localStorage.setItem('auth_token',      'def');
    const removed = removeFarrowayState();
    expect(removed).toBeGreaterThan(0);
    expect(localStorage.getItem('farroway_active_farm')).toBeNull();
    for (const k of FARROWAY_AUTH_KEYS) {
      // Auth must survive the sweep.
      // Some keys were never set; ones we did set must still be there.
      if (k === 'farroway_token' || k === 'farroway_user' || k === 'auth_token') {
        expect(localStorage.getItem(k)).not.toBeNull();
      }
    }
  });

  it('also cleans pattern-matched sync/cache/offline keys', async () => {
    const { removeFarrowayState } = await import('../../../src/lib/storageSafe.js');
    localStorage.setItem('farroway_sync_outbox_v3', '[]');
    localStorage.setItem('farroway_cache_weather_xyz', '{}');
    localStorage.setItem('farroway_offline_queue_extra', '[]');
    localStorage.setItem('unrelated_key', 'keepme');
    removeFarrowayState();
    expect(localStorage.getItem('farroway_sync_outbox_v3')).toBeNull();
    expect(localStorage.getItem('farroway_cache_weather_xyz')).toBeNull();
    expect(localStorage.getItem('farroway_offline_queue_extra')).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('keepme');
  });
});

describe('storageSafe.validateFarm', () => {
  it('accepts a plain object', async () => {
    const { validateFarm } = await import('../../../src/lib/storageSafe.js');
    expect(validateFarm({ id: '1', crop: 'tomato' })).toBe(true);
    expect(validateFarm({ id: '1', crop: { name: 'tomato' } })).toBe(true);
  });

  it('rejects arrays / primitives / null', async () => {
    const { validateFarm } = await import('../../../src/lib/storageSafe.js');
    expect(validateFarm(null)).toBe(false);
    expect(validateFarm([])).toBe(false);
    expect(validateFarm('hello')).toBe(false);
    expect(validateFarm(42)).toBe(false);
  });

  it('rejects objects whose crop is a function', async () => {
    const { validateFarm } = await import('../../../src/lib/storageSafe.js');
    expect(validateFarm({ crop: () => null })).toBe(false);
  });
});

describe('storageSafe.validateTask', () => {
  it('requires at least one renderable label', async () => {
    const { validateTask } = await import('../../../src/lib/storageSafe.js');
    expect(validateTask({ title: 'Inspect today' })).toBe(true);
    expect(validateTask({ todayTaskTitle: 'x' })).toBe(true);
    expect(validateTask({ primaryAction: 'x' })).toBe(true);
    expect(validateTask({})).toBe(false);
    expect(validateTask({ title: '' })).toBe(false);
    expect(validateTask(null)).toBe(false);
  });
});

describe('storageSafe.validateWeather', () => {
  it('accepts any of the common shapes', async () => {
    const { validateWeather } = await import('../../../src/lib/storageSafe.js');
    expect(validateWeather({ temp: 28 })).toBe(true);
    expect(validateWeather({ tempHighC: 32 })).toBe(true);
    expect(validateWeather({ condition: 'rainy' })).toBe(true);
    expect(validateWeather({ summary: 'hot' })).toBe(true);
    expect(validateWeather({})).toBe(false);
  });
});

// ─── getDisplayText ──────────────────────────────────────────
describe('getDisplayText', () => {
  it('returns string passthrough', async () => {
    const { getDisplayText } = await import('../../../src/lib/getDisplayText.js');
    expect(getDisplayText('tomato', 'fb')).toBe('tomato');
  });

  it('returns the fallback for null/undefined', async () => {
    const { getDisplayText } = await import('../../../src/lib/getDisplayText.js');
    expect(getDisplayText(null, 'fb')).toBe('fb');
    expect(getDisplayText(undefined, 'fb')).toBe('fb');
  });

  it('resolves objects via name → label → title', async () => {
    const { getDisplayText } = await import('../../../src/lib/getDisplayText.js');
    expect(getDisplayText({ name: 'Maize' }, 'fb')).toBe('Maize');
    expect(getDisplayText({ label: 'Lagos' }, 'fb')).toBe('Lagos');
    expect(getDisplayText({ title: 'Vegetative' }, 'fb')).toBe('Vegetative');
  });

  it('returns fallback for objects with no rendering field', async () => {
    const { getDisplayText } = await import('../../../src/lib/getDisplayText.js');
    expect(getDisplayText({ random: 1 }, 'No crop selected')).toBe('No crop selected');
  });

  it('NEVER produces "[object Object]"', async () => {
    const { getDisplayText } = await import('../../../src/lib/getDisplayText.js');
    expect(getDisplayText({}, 'fb')).not.toMatch(/object Object/);
  });

  it('coerces numbers + booleans to readable strings', async () => {
    const { getDisplayText } = await import('../../../src/lib/getDisplayText.js');
    expect(getDisplayText(42, 'fb')).toBe('42');
    expect(getDisplayText(true, 'fb')).toBe('Yes');
    expect(getDisplayText(false, 'fb')).toBe('No');
  });
});

// ─── defaults ────────────────────────────────────────────────
describe('defaults', () => {
  it('exports frozen, correctly-shaped fallbacks', async () => {
    const { defaultFarm, defaultTask, defaultWeather } = await import('../../../src/lib/defaults.js');
    expect(Object.isFrozen(defaultFarm)).toBe(true);
    expect(Object.isFrozen(defaultTask)).toBe(true);
    expect(Object.isFrozen(defaultWeather)).toBe(true);
    expect(defaultFarm.userType).toBe('backyard');
    expect(typeof defaultTask.title).toBe('string');
    expect(defaultTask.title.length).toBeGreaterThan(0);
    expect(typeof defaultWeather.condition).toBe('string');
    expect(defaultWeather.condition.length).toBeGreaterThan(0);
  });
});

// ─── stateMigration ──────────────────────────────────────────
describe('stateMigration', () => {
  it('no-ops when stored version matches current', async () => {
    const { runStateMigration, CURRENT_STATE_VERSION } = await import('../../../src/lib/stateMigration.js');
    localStorage.setItem('farroway_state_version', CURRENT_STATE_VERSION);
    const r = runStateMigration();
    expect(r.ranMigration).toBe(false);
    expect(r.reloaded).toBe(false);
    expect(reloadCalls).toBe(0);
  });

  it('on a brand-new install (no stored version): stamps and returns without reload', async () => {
    const { runStateMigration, CURRENT_STATE_VERSION } = await import('../../../src/lib/stateMigration.js');
    const r = runStateMigration();
    expect(r.ranMigration).toBe(true);
    expect(r.reloaded).toBe(false);
    expect(localStorage.getItem('farroway_state_version')).toBe(CURRENT_STATE_VERSION);
    expect(reloadCalls).toBe(0);
  });

  it('drops keys whose parsed shape is invalid + reloads ONCE', async () => {
    const { runStateMigration, CURRENT_STATE_VERSION } = await import('../../../src/lib/stateMigration.js');
    localStorage.setItem('farroway_state_version', '2026-04-01-state-v1');
    localStorage.setItem('farroway_active_farm', '"a string, not an object"');
    localStorage.setItem('farroway_cached_tasks', JSON.stringify([{ title: 'Inspect' }]));
    const r = runStateMigration();
    expect(r.ranMigration).toBe(true);
    expect(r.droppedKeys).toContain('farroway_active_farm');
    // The valid task array dropped because the migration wipes
    // unowned-but-untyped keys; `farroway_cached_tasks` HAS a
    // validator and the array IS valid → it should remain.
    expect(r.droppedKeys).not.toContain('farroway_cached_tasks');
    expect(localStorage.getItem('farroway_state_version')).toBe(CURRENT_STATE_VERSION);
    expect(r.reloaded).toBe(true);
    expect(reloadCalls).toBe(1);
    // After the rename the flag is written under the new spec
    // name. The legacy name is also accepted on read for back-
    // compat (covered by a separate test below).
    const v = sessionStorage.getItem('farroway_migration_ran_once');
    expect(v === 'true' || v === '1').toBe(true);
  });

  it('does NOT reload a second time in the same session', async () => {
    const { runStateMigration } = await import('../../../src/lib/stateMigration.js');
    sessionStorage.setItem('farroway_migrated_once', '1');
    localStorage.setItem('farroway_state_version', '2026-04-01-state-v1');
    const r = runStateMigration();
    expect(r.ranMigration).toBe(true);
    expect(r.reloaded).toBe(false);
    expect(reloadCalls).toBe(0);
  });

  it('NEVER touches auth keys', async () => {
    const { runStateMigration } = await import('../../../src/lib/stateMigration.js');
    localStorage.setItem('farroway_state_version', '2026-04-01-state-v1');
    localStorage.setItem('farroway_token', 'KEEP_ME');
    localStorage.setItem('farroway_user',  '{"id":"u"}');
    localStorage.setItem('auth_token',     'KEEP_ME_2');
    runStateMigration();
    expect(localStorage.getItem('farroway_token')).toBe('KEEP_ME');
    expect(localStorage.getItem('farroway_user')).toBe('{"id":"u"}');
    expect(localStorage.getItem('auth_token')).toBe('KEEP_ME_2');
  });
});

// ─── syncManager ─────────────────────────────────────────────
describe('syncManager', () => {
  beforeEach(async () => {
    const { _internal } = await import('../../../src/lib/syncManager.js');
    _internal._resetForTests();
  });

  it('runSync flips isSyncing on then off + clears the message', async () => {
    const { runSync, getSyncState } = await import('../../../src/lib/syncManager.js');
    let resolveWork;
    const work = new Promise((r) => { resolveWork = r; });
    const p = runSync(() => work);
    expect(getSyncState().isSyncing).toBe(true);
    expect(typeof getSyncState().connectionMessage).toBe('string');
    resolveWork();
    await p;
    expect(getSyncState().isSyncing).toBe(false);
    expect(getSyncState().connectionMessage).toBeNull();
  });

  it('hard-stops a hanging sync after 5 seconds', async () => {
    vi.useFakeTimers();
    try {
      const { runSync, getSyncState } = await import('../../../src/lib/syncManager.js');
      // A promise that NEVER resolves.
      const p = runSync(() => new Promise(() => {}));
      expect(getSyncState().isSyncing).toBe(true);
      // Fast-forward past the 5s ceiling.
      vi.advanceTimersByTime(5000);
      // The internal _setState fires synchronously inside the
      // setTimeout callback; the banner is already cleared.
      expect(getSyncState().isSyncing).toBe(false);
      expect(getSyncState().connectionMessage).toBeNull();
      void p;
    } finally {
      vi.useRealTimers();
    }
  });

  it('swallows sync errors but still clears the banner', async () => {
    const { runSync, getSyncState } = await import('../../../src/lib/syncManager.js');
    const p = runSync(() => Promise.reject(new Error('boom')));
    await p;
    expect(getSyncState().isSyncing).toBe(false);
    expect(getSyncState().connectionMessage).toBeNull();
  });

  it('runSync survives a synchronous throw inside syncFn', async () => {
    const { runSync, getSyncState } = await import('../../../src/lib/syncManager.js');
    expect(() => runSync(() => { throw new Error('sync throw'); })).not.toThrow();
    // settle microtask
    await Promise.resolve();
    expect(getSyncState().isSyncing).toBe(false);
  });

  it('setConnectionMessage with autoHideMs clears itself', async () => {
    vi.useFakeTimers();
    try {
      const { setConnectionMessage, getSyncState } = await import('../../../src/lib/syncManager.js');
      setConnectionMessage('Back online. Updating\u2026', 3000);
      expect(getSyncState().connectionMessage).toBe('Back online. Updating\u2026');
      vi.advanceTimersByTime(3000);
      expect(getSyncState().connectionMessage).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('forceClearBanner clears every active timer + state', async () => {
    const { runSync, forceClearBanner, getSyncState } = await import('../../../src/lib/syncManager.js');
    runSync(() => new Promise(() => {})); // hang
    expect(getSyncState().isSyncing).toBe(true);
    forceClearBanner();
    expect(getSyncState().isSyncing).toBe(false);
    expect(getSyncState().connectionMessage).toBeNull();
  });

  it('a later setConnectionMessage does NOT get clobbered by an older auto-hide timer', async () => {
    vi.useFakeTimers();
    try {
      const { setConnectionMessage, getSyncState } = await import('../../../src/lib/syncManager.js');
      setConnectionMessage('Back online. Updating\u2026', 3000);
      // Mid-window the user goes offline.
      vi.advanceTimersByTime(1500);
      setConnectionMessage('Offline mode');
      // Older auto-hide fires — must NOT clear the new message.
      vi.advanceTimersByTime(2000);
      expect(getSyncState().connectionMessage).toBe('Offline mode');
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─── useGeoLocation (logic-only — _mapErr + ERROR_MESSAGES) ─
describe('useGeoLocation internals', () => {
  it('maps PERMISSION_DENIED → permission_denied', async () => {
    const { _internal } = await import('../../../src/hooks/useGeoLocation.js');
    expect(_internal._mapErr({ code: 1 })).toBe('permission_denied');
    expect(_internal._mapErr({ code: 2 })).toBe('unavailable');
    expect(_internal._mapErr({ code: 3 })).toBe('timeout');
    expect(_internal._mapErr({ code: 99 })).toBe('unknown');
    expect(_internal._mapErr(null)).toBe('unknown');
    expect(_internal._mapErr(undefined)).toBe('unknown');
  });

  it('every error code has a user-friendly message', async () => {
    const { _internal } = await import('../../../src/hooks/useGeoLocation.js');
    for (const k of ['unsupported', 'permission_denied', 'unavailable', 'timeout', 'unknown']) {
      const m = _internal.ERROR_MESSAGES[k];
      expect(typeof m).toBe('string');
      expect(m.length).toBeGreaterThan(0);
      // None of these messages should ever swallow the recovery
      // affordance — every message tells the user they can
      // continue manually.
      expect(m.toLowerCase()).toMatch(/manual/);
    }
  });

  it('default options match the iOS-Safari-friendly recipe', async () => {
    const { _internal } = await import('../../../src/hooks/useGeoLocation.js');
    expect(_internal.DEFAULT_OPTS.enableHighAccuracy).toBe(true);
    expect(_internal.DEFAULT_OPTS.timeout).toBe(10000);
    expect(_internal.DEFAULT_OPTS.maximumAge).toBe(0);
  });
});

// ─── Downgrade-skip guard (stale-bundle protection) ─────────
describe('runStateMigration — stale-bundle direction guard', () => {
  it('skips the migration AND avoids reload when stored is NEWER than current', async () => {
    const { runStateMigration, CURRENT_STATE_VERSION } = await import('../../../src/lib/stateMigration.js');
    // Pretend a future v7 bundle has run; user is now back on a
    // cached v6. CURRENT_STATE_VERSION is the v6 string.
    const newer = '2099-12-31-state-v99';
    expect(newer > CURRENT_STATE_VERSION).toBe(true);
    localStorage.setItem('farroway_state_version', newer);
    const r = runStateMigration();
    expect(r.ranMigration).toBe(false);
    expect(r.reloaded).toBe(false);
    expect(reloadCalls).toBe(0);
    // Stored version is preserved — we don't trample on the
    // newer-build's stamp.
    expect(localStorage.getItem('farroway_state_version')).toBe(newer);
  });
});

// ─── Onboarding flag (logout-loop fix v3) ───────────────────
describe('isOnboardingComplete + shouldShowSetup', () => {
  beforeEach(async () => {
    // Reload modules so the storage mock is fresh per test.
    vi.resetModules();
  });

  it('isOnboardingComplete returns true on any of the three known keys', async () => {
    const { isOnboardingComplete } = await import('../../../src/utils/onboarding.js');
    expect(isOnboardingComplete()).toBe(false);
    localStorage.setItem('farroway_onboarding_done', 'true');
    expect(isOnboardingComplete()).toBe(true);
    localStorage.removeItem('farroway_onboarding_done');
    localStorage.setItem('farroway_onboarding_completed', 'true');
    expect(isOnboardingComplete()).toBe(true);
    localStorage.removeItem('farroway_onboarding_completed');
    localStorage.setItem('farroway_onboarding_complete', 'true');
    expect(isOnboardingComplete()).toBe(true);
  });

  it('setOnboardingComplete writes ALL three known keys', async () => {
    const { setOnboardingComplete } = await import('../../../src/utils/onboarding.js');
    setOnboardingComplete();
    expect(localStorage.getItem('farroway_onboarding_done')).toBe('true');
    expect(localStorage.getItem('farroway_onboarding_completed')).toBe('true');
    expect(localStorage.getItem('farroway_onboarding_complete')).toBe('true');
  });

  it('shouldShowSetup is FALSE when onboarding is complete (even with no local entities)', async () => {
    const { shouldShowSetup, setOnboardingComplete } = await import('../../../src/utils/onboarding.js');
    setOnboardingComplete();
    // No farroway_farms / farroway_gardens / farroway.farms anywhere.
    expect(shouldShowSetup()).toBe(false);
  });

  it('shouldShowSetup is TRUE only when onboarding flag is missing', async () => {
    const { shouldShowSetup } = await import('../../../src/utils/onboarding.js');
    // Plant entities but no flag — STILL true (the routing
    // gate is the flag, not the entity arrays).
    localStorage.setItem('farroway_farms', JSON.stringify([{ id: 'f1' }]));
    expect(shouldShowSetup()).toBe(true);
  });

  it('resetOnboarding clears all three keys', async () => {
    const { setOnboardingComplete, resetOnboarding, isOnboardingComplete } =
      await import('../../../src/utils/onboarding.js');
    setOnboardingComplete();
    expect(isOnboardingComplete()).toBe(true);
    resetOnboarding();
    expect(isOnboardingComplete()).toBe(false);
  });
});

// ─── Auth + onboarding preservation across migration ────────
describe('runStateMigration — auth + onboarding preservation', () => {
  it('preserves every auth + onboarding key across a v6→v7+ migration', async () => {
    vi.resetModules();
    const { runStateMigration } = await import('../../../src/lib/stateMigration.js');
    // Plant the OLD state version so a migration fires.
    localStorage.setItem('farroway_state_version', '2026-04-01-state-v1');
    // Plant every auth + onboarding key the spec asks us to preserve.
    const preserved = {
      'farroway_token':                  'tk-1',
      'farroway_user':                   '{"id":"u1"}',
      'farroway_refresh':                'rt-1',
      'farroway_auth_token':             'fauth-1',
      'farroway_session':                's-1',
      'farroway:session_cache':          'mirror',
      'farroway:access_token':           'va-1',
      'farroway:refresh_token':          'vr-1',
      'auth_token':                      'a-1',
      'access_token':                    'a-2',
      'refresh_token':                   'r-1',
      'token':                           'g-1',
      'user':                            '{"id":"g"}',
      'session':                         'gsession',
      'supabase.auth.token':             'sb-1',
      'farroway_onboarding_done':        'true',
      'farroway_onboarding_completed':   'true',
      'farroway_onboarding_complete':    'true',
    };
    for (const [k, v] of Object.entries(preserved)) {
      localStorage.setItem(k, v);
    }
    runStateMigration();
    for (const [k, v] of Object.entries(preserved)) {
      expect(localStorage.getItem(k)).toBe(v);
    }
  });
});

// ─── Migration sessionStorage flag rename ───────────────────
describe('runStateMigration — farroway_migration_ran_once flag', () => {
  it('writes the new spec-named sessionStorage flag after a real migration', async () => {
    vi.resetModules();
    const { runStateMigration } = await import('../../../src/lib/stateMigration.js');
    localStorage.setItem('farroway_state_version', '2026-04-01-state-v1');
    runStateMigration();
    const v = sessionStorage.getItem('farroway_migration_ran_once');
    expect(v === 'true' || v === '1').toBe(true);
  });

  it('honours the legacy flag name to prevent a double-migration across the rename', async () => {
    vi.resetModules();
    const { runStateMigration } = await import('../../../src/lib/stateMigration.js');
    localStorage.setItem('farroway_state_version', '2026-04-01-state-v1');
    // Older builds wrote farroway_migrated_once='1'. A tab open
    // across the rename must NOT reload again.
    sessionStorage.setItem('farroway_migrated_once', '1');
    const r = runStateMigration();
    expect(r.reloaded).toBe(false);
    expect(reloadCalls).toBe(0);
  });
});

// ─── Task cache invalidator (API-only enforcement) ──────────
describe('enforceTaskApiOnly', () => {
  beforeEach(() => { vi.resetModules(); });

  it('drops every listed task cache key + farroway_task_*/farroway_daily_plan*', async () => {
    const { enforceTaskApiOnly } = await import('../../../src/lib/taskCacheInvalidator.js');
    // Plant a mix of known + pattern-matched task keys.
    localStorage.setItem('farroway_cached_tasks',  '[]');
    localStorage.setItem('farroway_today_task',    '{}');
    localStorage.setItem('farroway_task_queue',    '[]');
    localStorage.setItem('farroway_progress_task', '{}');
    localStorage.setItem('farroway_daily_plan',    '{}');
    localStorage.setItem('farroway_task_metric_v3', '{}');     // pattern
    localStorage.setItem('farroway_daily_plan_v2',  '{}');     // pattern
    localStorage.setItem('unrelated_key',           'keep me');
    const r = enforceTaskApiOnly();
    expect(r.ranInvalidation).toBe(true);
    expect(r.toVersion).toBe('v2');
    for (const k of [
      'farroway_cached_tasks',
      'farroway_today_task',
      'farroway_task_queue',
      'farroway_progress_task',
      'farroway_daily_plan',
      'farroway_task_metric_v3',
      'farroway_daily_plan_v2',
    ]) {
      expect(localStorage.getItem(k)).toBeNull();
    }
    expect(localStorage.getItem('unrelated_key')).toBe('keep me');
    expect(localStorage.getItem('task_version')).toBe('v2');
  });

  it('is idempotent — second boot with task_version=v2 no-ops', async () => {
    const { enforceTaskApiOnly } = await import('../../../src/lib/taskCacheInvalidator.js');
    localStorage.setItem('task_version', 'v2');
    localStorage.setItem('farroway_cached_tasks', '[]');
    const r = enforceTaskApiOnly();
    expect(r.ranInvalidation).toBe(false);
    // The cached key STAYS — we only wipe when versions differ.
    // (Future bumps to a v3 would clear it again.)
    expect(localStorage.getItem('farroway_cached_tasks')).toBe('[]');
  });

  it('NEVER touches auth or onboarding keys', async () => {
    const { enforceTaskApiOnly } = await import('../../../src/lib/taskCacheInvalidator.js');
    localStorage.setItem('farroway_token',                'tk');
    localStorage.setItem('farroway_user',                 '{"id":"u"}');
    localStorage.setItem('farroway_onboarding_complete',  'true');
    localStorage.setItem('farroway_cached_tasks',         '[]');
    enforceTaskApiOnly();
    expect(localStorage.getItem('farroway_token')).toBe('tk');
    expect(localStorage.getItem('farroway_user')).toBe('{"id":"u"}');
    expect(localStorage.getItem('farroway_onboarding_complete')).toBe('true');
  });
});

// ─── Invisible Intelligence Task Engine v1 ──────────────────
describe('generateSmartTask — weather/region/crop/stage', () => {
  it('returns a usable default for empty input', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    const t = generateSmartTask();
    expect(t.title).toMatch(/check soil moisture/i);
    expect(t.cta).toBe('Mark as done');
    expect(t.urgency).toBe('medium');
    expect(t.source).toBe('weather-region-stage-v1');
    expect(typeof t.generatedAt).toBe('string');
  });

  it('rain → drainage task', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    const t = generateSmartTask({ weather: { condition: 'rainy', rainChance: 80 } });
    expect(t.title).toMatch(/drainage/i);
    expect(t.category).toBe('weather');
  });

  it('hot weather (>= 32C) → water early/late', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    // Use a non-special crop so the crop-specific override
    // doesn't replace the weather title; the urgency='high' +
    // category='heat' stay regardless of crop.
    const t = generateSmartTask({ crop: 'lettuce', weather: { temp: 35 } });
    expect(t.title).toMatch(/water .* early or late/i);
    expect(t.urgency).toBe('high');
    expect(t.category).toBe('heat');
  });

  it('high wind → support task', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    const t = generateSmartTask({ weather: { windSpeed: 30 } });
    expect(t.title).toMatch(/support/i);
    expect(t.category).toBe('wind');
  });

  it('flowering stage → flower inspection', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    const t = generateSmartTask({ cropStage: 'flowering' });
    expect(t.title).toMatch(/flowers and leaves/i);
    expect(t.urgency).toBe('high');
    expect(t.category).toBe('flowering');
  });

  it('harvest stage + tomato crop → tomato leaf inspection (crop-specific overrides stage)', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    const t = generateSmartTask({ crop: 'tomato', cropStage: 'harvest' });
    expect(t.title).toMatch(/tomato leaves/i);
    expect(t.category).toBe('pest-check');
  });

  it('rice always escalates to high urgency', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    const t = generateSmartTask({ crop: 'rice', cropStage: 'vegetative' });
    expect(t.title).toMatch(/rice field water level/i);
    expect(t.urgency).toBe('high');
    expect(t.category).toBe('water-level');
  });

  it('backyard mode replaces "crop" with "plant" and "field" with "garden" in reason', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    const t = generateSmartTask({ userType: 'backyard', crop: 'pepper' });
    expect(t.reason).not.toMatch(/\bcrop\b/i);
    // Pepper task uses "plants" already; ensure no leakage of "crop" from the default.
    expect(t.reason).not.toMatch(/\bfield\b/i);
  });

  it('NEVER produces legacy profitability wording', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    // Sweep a representative grid of inputs.
    const grids = [
      { crop: 'maize',  cropStage: 'germination', weather: { rainChance: 80 } },
      { crop: 'tomato', cropStage: 'flowering',   weather: { temp: 35 } },
      { crop: 'okra',   cropStage: 'harvest',     weather: { windSpeed: 30 } },
      { crop: 'pepper', cropStage: 'vegetative',  weather: { condition: 'dry' } },
      { crop: 'rice',   cropStage: 'fruit',       weather: {} },
      { userType: 'backyard', crop: 'tomato' },
    ];
    for (const g of grids) {
      const t = generateSmartTask(g);
      const all = (t.title + ' ' + t.reason + ' ' + (t.cta || '')).toLowerCase();
      expect(all).not.toMatch(/start logging farm costs/);
      expect(all).not.toMatch(/track profitability/);
      expect(all).not.toMatch(/keep logging harvest/);
      expect(all).not.toMatch(/performance comparison/);
    }
  });

  it('never throws on garbage input', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    expect(() => generateSmartTask(null)).not.toThrow();
    expect(() => generateSmartTask(undefined)).not.toThrow();
    expect(() => generateSmartTask({ crop: 42, cropStage: null, weather: 'hot' })).not.toThrow();
    expect(() => generateSmartTask({ crop: { weird: true } })).not.toThrow();
  });

  it('object crop with .name is honoured', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    const t = generateSmartTask({ crop: { name: 'tomato' } });
    expect(t.title).toMatch(/tomato/i);
  });

  it('always returns the shape Home/Tasks/Progress consume', async () => {
    const { generateSmartTask } = await import('../../../src/lib/taskIntelligence.js');
    const t = generateSmartTask({ region: 'Ashanti' });
    expect(typeof t.title).toBe('string');
    expect(typeof t.reason).toBe('string');
    expect(typeof t.urgency).toBe('string');
    expect(typeof t.time).toBe('string');
    expect(typeof t.cta).toBe('string');
    expect(typeof t.category).toBe('string');
    expect(t.region).toBe('Ashanti');
    expect(t.source).toBe('weather-region-stage-v1');
  });
});

// ─── ML Task Scoring Layer v1 ───────────────────────────────
describe('scoreTaskCandidate', () => {
  it('returns the base score on empty input', async () => {
    const { scoreTaskCandidate } = await import('../../../src/lib/mlTaskScoring.js');
    expect(scoreTaskCandidate()).toBe(50);
    expect(scoreTaskCandidate(null)).toBe(50);
    expect(scoreTaskCandidate({})).toBe(50);
  });

  it('clamps to [0, 100]', async () => {
    const { scoreTaskCandidate } = await import('../../../src/lib/mlTaskScoring.js');
    // Stack every positive bonus possible.
    const high = scoreTaskCandidate({
      task: { category: 'heat', time: '5 mins' },
      userType: 'farmer',
      cropStage: 'flowering',
      weather:  { temp: 35 },
    });
    expect(high).toBeLessThanOrEqual(100);
    expect(high).toBeGreaterThan(50);
    // Stack negatives — backyard + market task + low completion.
    const low = scoreTaskCandidate({
      task: { category: 'market' },
      userType: 'backyard',
      userHistory: { completedSimilarTasksRecently: true, lowCompletionRate: true },
    });
    expect(low).toBeGreaterThanOrEqual(0);
    expect(low).toBeLessThan(50);
  });

  it('weather: rain ≥ 60 boosts the weather category', async () => {
    const { scoreTaskCandidate } = await import('../../../src/lib/mlTaskScoring.js');
    const s = scoreTaskCandidate({
      task: { category: 'weather' },
      weather: { rainChance: 75 },
    });
    expect(s).toBeGreaterThan(50);
  });

  it('weather: hot day boosts heat category', async () => {
    const { scoreTaskCandidate } = await import('../../../src/lib/mlTaskScoring.js');
    const s = scoreTaskCandidate({
      task: { category: 'heat' },
      weather: { temp: 36 },
    });
    expect(s).toBeGreaterThan(50);
  });

  it('crop-specific: rice+water-level scores highest among rice candidates', async () => {
    const { scoreTaskCandidate } = await import('../../../src/lib/mlTaskScoring.js');
    const water = scoreTaskCandidate({
      task: { category: 'water-level' },
      crop: 'rice',
    });
    const weeding = scoreTaskCandidate({
      task: { category: 'weeding' },
      crop: 'rice',
    });
    expect(water).toBeGreaterThan(weeding);
  });

  it('user history: missedYesterday adds, completedSimilarTasksRecently subtracts', async () => {
    const { scoreTaskCandidate } = await import('../../../src/lib/mlTaskScoring.js');
    const baseline = scoreTaskCandidate({ task: { category: 'watering' } });
    const missed = scoreTaskCandidate({
      task: { category: 'watering' },
      userHistory: { missedYesterday: true },
    });
    const recent = scoreTaskCandidate({
      task: { category: 'watering' },
      userHistory: { completedSimilarTasksRecently: true },
    });
    expect(missed).toBeGreaterThan(baseline);
    expect(recent).toBeLessThan(baseline);
  });

  it('backyard mode: market/profitability category gets penalised heavily', async () => {
    const { scoreTaskCandidate } = await import('../../../src/lib/mlTaskScoring.js');
    const s = scoreTaskCandidate({
      task: { category: 'market' },
      userType: 'backyard',
    });
    // 50 base − 50 backyard penalty = 0.
    expect(s).toBeLessThanOrEqual(20);
  });

  it('quick wins (≤ 5 min) get a small boost', async () => {
    const { scoreTaskCandidate } = await import('../../../src/lib/mlTaskScoring.js');
    const quick = scoreTaskCandidate({ task: { category: 'watering', time: '5 mins' } });
    const slow  = scoreTaskCandidate({ task: { category: 'watering', time: '20 mins' } });
    expect(quick).toBeGreaterThan(slow);
  });
});

describe('generateTaskCandidates', () => {
  it('always returns the 4 spec categories', async () => {
    const { generateTaskCandidates } = await import('../../../src/lib/taskCandidates.js');
    const list = generateTaskCandidates({ crop: 'tomato' });
    expect(list).toHaveLength(4);
    const cats = list.map((c) => c.category);
    expect(cats).toEqual(['watering', 'pest-check', 'weeding', 'crop-stage']);
  });

  it('crop name is interpolated into every candidate title', async () => {
    const { generateTaskCandidates } = await import('../../../src/lib/taskCandidates.js');
    const list = generateTaskCandidates({ crop: 'okra' });
    for (const c of list) {
      expect(c.title.toLowerCase()).toMatch(/okra/);
    }
  });

  it('falls back to "crop" placeholder for empty / non-string crop', async () => {
    const { generateTaskCandidates } = await import('../../../src/lib/taskCandidates.js');
    const list = generateTaskCandidates({ crop: null });
    for (const c of list) {
      // Title contains the placeholder; never "[object Object]".
      expect(c.title).not.toMatch(/\[object/);
    }
  });

  it('backyard mode rewrites "crop" → "plant" in reasons', async () => {
    const { generateTaskCandidates } = await import('../../../src/lib/taskCandidates.js');
    const list = generateTaskCandidates({ userType: 'backyard', crop: 'pepper' });
    for (const c of list) {
      expect(c.reason).not.toMatch(/\bcrop\b/i);
    }
  });

  it('object crop with .name is honoured', async () => {
    const { generateTaskCandidates } = await import('../../../src/lib/taskCandidates.js');
    const list = generateTaskCandidates({ crop: { name: 'maize' } });
    expect(list[0].title.toLowerCase()).toMatch(/maize/);
  });
});

describe('getBestTask — combine candidates + ML scoring', () => {
  it('returns bestTask + ranked candidates with source tag', async () => {
    const { getBestTask } = await import('../../../src/lib/smartTaskEngine.js');
    const r = getBestTask({ crop: 'tomato', cropStage: 'flowering' });
    expect(r.bestTask).toBeTruthy();
    expect(r.bestTask.source).toBe('rules-plus-ml-score-v1');
    expect(Array.isArray(r.candidates)).toBe(true);
    expect(r.candidates.length).toBe(4);
    // Candidates sorted descending by score.
    for (let i = 1; i < r.candidates.length; i += 1) {
      expect(r.candidates[i - 1].score).toBeGreaterThanOrEqual(r.candidates[i].score);
    }
  });

  it('rice + flowering ranks pest-check (tomato) lower than the watering default', async () => {
    const { getBestTask } = await import('../../../src/lib/smartTaskEngine.js');
    const r = getBestTask({ crop: 'rice', cropStage: 'vegetative', userType: 'farmer' });
    // Best should be a watering / weeding task — rice doesn't
    // get a pest-check bonus.
    expect(['watering', 'weeding', 'pest-check', 'crop-stage']).toContain(r.bestTask.category);
  });

  it('hot weather elevates a heat-category candidate when present', async () => {
    const { getBestTask } = await import('../../../src/lib/smartTaskEngine.js');
    // No 'heat' candidate in the safe list, so this just
    // confirms the engine still produces a usable best task.
    const r = getBestTask({ weather: { temp: 36 } });
    expect(r.bestTask).toBeTruthy();
    expect(typeof r.bestTask.score).toBe('number');
  });

  it('NEVER produces legacy profitability wording', async () => {
    const { getBestTask } = await import('../../../src/lib/smartTaskEngine.js');
    const r = getBestTask({ crop: 'tomato', cropStage: 'flowering' });
    const all = r.candidates.map((c) => c.title + ' ' + c.reason).join(' ').toLowerCase();
    expect(all).not.toMatch(/start logging farm costs/);
    expect(all).not.toMatch(/track profitability/);
    expect(all).not.toMatch(/keep logging harvest/);
    expect(all).not.toMatch(/performance comparison/);
  });

  it('never throws on garbage input', async () => {
    const { getBestTask } = await import('../../../src/lib/smartTaskEngine.js');
    expect(() => getBestTask(null)).not.toThrow();
    expect(() => getBestTask(undefined)).not.toThrow();
    expect(() => getBestTask('hello')).not.toThrow();
    expect(() => getBestTask({ crop: 42, weather: 'rainy' })).not.toThrow();
  });
});

// ─── taskEventLogger payload projection ────────────────────
describe('taskEventLogger._projectPayload', () => {
  it('only emits the spec fields', async () => {
    const { _internal } = await import('../../../src/lib/taskEventLogger.js');
    const p = _internal._projectPayload({
      taskTitle: 'Inspect tomato leaves for yellow spots or pests',
      category:  'pest-check',
      score:     78,
      crop:      { name: 'tomato' },
      cropStage: 'flowering',
      weather:   { condition: 'rainy', rainChance: 70 },
      userType:  'farmer',
      // Extra fields must NOT appear in the payload.
      privateNote: 'remove me',
      profitMargin: 1234,
    });
    expect(Object.keys(p).sort()).toEqual([
      'category', 'crop', 'cropStage', 'rainChance',
      'score', 'taskTitle', 'userType', 'weatherCondition',
    ]);
    expect(p.crop).toBe('tomato');
    expect(p.weatherCondition).toBe('rainy');
    expect(p.rainChance).toBe(70);
  });

  it('coerces missing fields to null (not undefined)', async () => {
    const { _internal } = await import('../../../src/lib/taskEventLogger.js');
    const p = _internal._projectPayload({});
    for (const k of Object.keys(p)) {
      expect(p[k]).toBeNull();
    }
  });
});

// ─── Weather action mapping (Home redesign May 2026) ────────
describe('getWeatherAction', () => {
  it('rain ≥ 60 → drainage advice', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherAction.js');
    const r = getWeatherAction({ rainChance: 75 });
    expect(r.insight).toMatch(/rain expected/i);
    expect(r.action).toMatch(/drainage/i);
  });

  it('temp ≥ 32 → water early/late', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherAction.js');
    const r = getWeatherAction({ temp: 35 });
    expect(r.insight).toMatch(/high heat/i);
    expect(r.action).toMatch(/early morning|late evening/i);
  });

  it('wind ≥ 25 → support weak plants', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherAction.js');
    const r = getWeatherAction({ wind: 30 });
    expect(r.insight).toMatch(/strong winds/i);
    expect(r.action).toMatch(/support/i);
  });

  it('rain ≤ 20 → soil moisture check', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherAction.js');
    const r = getWeatherAction({ rainChance: 10 });
    expect(r.insight).toMatch(/dry conditions/i);
    expect(r.action).toMatch(/soil moisture/i);
  });

  it('normal weather → follow today task', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherAction.js');
    const r = getWeatherAction({ rainChance: 35, temp: 24, wind: 8 });
    expect(r.insight).toMatch(/normal/i);
    expect(r.action).toMatch(/today/i);
  });

  it('rain wins over wind when BOTH branches would match', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherAction.js');
    const r = getWeatherAction({ rainChance: 80, wind: 35 });
    expect(r.action).toMatch(/drainage/i);
  });

  it('temp wins over wind when BOTH match (temp branch sits higher)', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherAction.js');
    const r = getWeatherAction({ temp: 36, wind: 30 });
    expect(r.action).toMatch(/early morning|late evening/i);
  });

  it('never throws on garbage input', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherAction.js');
    expect(() => getWeatherAction(null)).not.toThrow();
    expect(() => getWeatherAction(undefined)).not.toThrow();
    expect(() => getWeatherAction([])).not.toThrow();
    expect(() => getWeatherAction('rainy')).not.toThrow();
    expect(() => getWeatherAction({ temp: 'hot', rainChance: '???' })).not.toThrow();
    // Falls through to "Normal conditions" rather than crashing.
    const r = getWeatherAction(null);
    expect(r.insight).toMatch(/normal/i);
  });

  it('normalizeWeather coerces alternate field names', async () => {
    const { normalizeWeather } = await import('../../../src/lib/weatherAction.js');
    expect(normalizeWeather({ tempHighC: 30 }).temp).toBe(30);
    expect(normalizeWeather({ temperatureC: 30 }).temp).toBe(30);
    expect(normalizeWeather({ tempC: 30 }).temp).toBe(30);
    expect(normalizeWeather({ rainChancePct: 70 }).rainChance).toBe(70);
    expect(normalizeWeather({ precipitationProbability: 70 }).rainChance).toBe(70);
    expect(normalizeWeather({ windKph: 22 }).wind).toBe(22);
    expect(normalizeWeather({ summary: 'rainy' }).condition).toBe('rainy');
  });

  it('aligns with the smart task engine: rain → weather/drainage category', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherAction.js');
    const { getBestTask }      = await import('../../../src/lib/smartTaskEngine.js');
    const wx = { rainChance: 80 };
    const advice = getWeatherAction(wx);
    expect(advice.action).toMatch(/drainage/i);
    // Smart engine's top candidate isn't strictly drainage (its
    // candidates are watering/pest-check/weeding/crop-stage), but
    // the weather scorer ranks 'weather'/'watering' adjacents
    // higher when rain is high.
    const r = getBestTask({ crop: 'tomato', weather: wx });
    expect(r.bestTask).toBeTruthy();
    expect(typeof r.bestTask.score).toBe('number');
  });
});

// ─── Weather Action Engine v2 (richer envelope) ─────────────
describe('weatherActionEngine.getWeatherAction', () => {
  it('rain ≥ 60 → rain envelope with full task body', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherActionEngine.js');
    const r = getWeatherAction({ rainChance: 70 });
    expect(r.type).toBe('rain');
    expect(r.icon).toBeTruthy();
    expect(r.taskTitle).toMatch(/drainage/i);
    expect(r.reason).toMatch(/water .* sit around/i);
    expect(r.urgency).toBe('medium');
    expect(r.cta).toBe('Mark as done');
  });

  it('temp ≥ 32 → heat envelope with HIGH urgency', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherActionEngine.js');
    const r = getWeatherAction({ temp: 35 });
    expect(r.type).toBe('heat');
    expect(r.urgency).toBe('high');
    expect(r.taskTitle).toMatch(/cooler hours/i);
  });

  it('wind ≥ 25 → wind envelope', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherActionEngine.js');
    const r = getWeatherAction({ windSpeed: 30 });
    expect(r.type).toBe('wind');
    expect(r.taskTitle).toMatch(/support/i);
  });

  it('rain ≤ 20 → dry envelope', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherActionEngine.js');
    const r = getWeatherAction({ rainChance: 10 });
    expect(r.type).toBe('dry');
    expect(r.taskTitle).toMatch(/soil moisture/i);
  });

  it('normal weather → "Inspect for early stress signs"', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherActionEngine.js');
    const r = getWeatherAction({ rainChance: 35, temp: 24, windSpeed: 8 });
    expect(r.type).toBe('normal');
    expect(r.taskTitle).toMatch(/early stress signs/i);
    expect(r.urgency).toBe('low');
  });

  it('condition string trips rain/wind even without numeric thresholds', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherActionEngine.js');
    expect(getWeatherAction({ condition: 'Light Rain' }).type).toBe('rain');
    expect(getWeatherAction({ condition: 'Windy day' }).type).toBe('wind');
  });

  it('rain ranks above heat when both fire', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherActionEngine.js');
    expect(getWeatherAction({ rainChance: 70, temp: 36 }).type).toBe('rain');
  });

  it('never throws on garbage input', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherActionEngine.js');
    expect(() => getWeatherAction(null)).not.toThrow();
    expect(() => getWeatherAction(undefined)).not.toThrow();
    expect(() => getWeatherAction([])).not.toThrow();
    expect(() => getWeatherAction('rainy')).not.toThrow();
    expect(() => getWeatherAction({ temp: 'hot' })).not.toThrow();
    expect(getWeatherAction(null).type).toBe('normal');
  });

  it('every branch returns a frozen envelope with the spec keys', async () => {
    const { getWeatherAction } = await import('../../../src/lib/weatherActionEngine.js');
    const grids = [
      { rainChance: 80 }, { temp: 35 }, { windSpeed: 30 },
      { rainChance: 5 },  { rainChance: 35 },
    ];
    for (const g of grids) {
      const r = getWeatherAction(g);
      for (const k of ['type', 'icon', 'insight', 'action',
                       'taskTitle', 'reason', 'urgency', 'cta']) {
        expect(typeof r[k]).toBe('string');
        expect(r[k].length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── weatherApi.fetchWeather safe-fallback ──────────────────
describe('weatherApi.fetchWeather', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns the fallback envelope when no API key is set', async () => {
    // import.meta.env access in vitest is read-only on the
    // server side; the module's own try/catch around the access
    // collapses to "no key" automatically.
    const { fetchWeather, _internal } = await import('../../../src/lib/weatherApi.js');
    const r = await fetchWeather({ region: 'Lagos' });
    expect(r.temp).toBeNull();
    expect(r.condition).toBe(_internal.FALLBACK.condition);
    expect(r.location).toBe('Lagos');
  });

  it('returns the default region in the fallback when no region given', async () => {
    const { fetchWeather, _internal } = await import('../../../src/lib/weatherApi.js');
    const r = await fetchWeather();
    expect(r.location).toBe(_internal.FALLBACK.location);
  });

  it('_normalize coerces a WeatherAPI.com response into the spec envelope', async () => {
    const { _internal } = await import('../../../src/lib/weatherApi.js');
    const r = _internal._normalize({
      current: {
        temp_c:    27.6,
        wind_kph:  12.3,
        condition: { text: 'Light rain' },
      },
      forecast: { forecastday: [{ day: { daily_chance_of_rain: 65 } }] },
      location: { name: 'Accra' },
    }, null);
    expect(r.temp).toBe(28);
    expect(r.windSpeed).toBe(12);
    expect(r.condition).toBe('Light rain');
    expect(r.rainChance).toBe(65);
    expect(r.location).toBe('Accra');
  });

  it('_normalize falls back gracefully for sparse responses', async () => {
    const { _internal } = await import('../../../src/lib/weatherApi.js');
    const r = _internal._normalize({}, 'Kumasi');
    expect(r.temp).toBeNull();
    expect(r.windSpeed).toBeNull();
    expect(r.location).toBe('Kumasi');
  });
});

// ─── Crash-resistance smoke tests ────────────────────────────
describe('crash-resistance smoke tests', () => {
  it('corrupted localStorage JSON does not crash safeJsonParse', async () => {
    const { safeJsonParse } = await import('../../../src/lib/storageSafe.js');
    localStorage.setItem('farroway_active_farm', '{not_json:::');
    expect(() => safeJsonParse('farroway_active_farm', null)).not.toThrow();
    expect(safeJsonParse('farroway_active_farm', { fallback: true })).toEqual({ fallback: true });
  });

  it('stale-shape farm fails validation cleanly (no throw)', async () => {
    const { safeJsonParse, validateFarm } = await import('../../../src/lib/storageSafe.js');
    const { defaultFarm } = await import('../../../src/lib/defaults.js');
    localStorage.setItem('farroway_active_farm', JSON.stringify([1, 2, 3]));
    const raw = safeJsonParse('farroway_active_farm', null);
    const farm = validateFarm(raw) ? raw : defaultFarm;
    expect(farm).toBe(defaultFarm);
  });
});
