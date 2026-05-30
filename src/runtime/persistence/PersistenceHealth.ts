/**
 * src/runtime/persistence/PersistenceHealth.ts — pure probe of
 * the application's current persistence mode. Composition only —
 * never opens a database connection itself; reads the canonical
 * /api/health envelope OR build-time injected flags.
 *
 * Pure. SSR-safe. Never throws.
 */

import {
  PERSISTENCE_MODE, PERSISTENCE_RUNTIME_VERSION,
  type PersistenceHealth, type PersistenceModeValue,
} from './persistenceContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * In-memory cache of the most recent server-side persistence
 * probe. Updated when `refreshPersistenceHealth()` is called
 * (typically once at App boot + on demand from QA). Never throws.
 */
let _cache: PersistenceHealth | null = null;

function _isProduction(): boolean {
  return _safe(() => {
    // Vite injects import.meta.env.PROD at build time.
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) return true;
    } catch { /* swallow */ }
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return true;
    return false;
  }, false);
}

function _emptyHealth(): PersistenceHealth {
  return Object.freeze({
    runtimeVersion:          PERSISTENCE_RUNTIME_VERSION,
    initialized:             false,
    mode:                    PERSISTENCE_MODE.UNAVAILABLE,
    databaseUrlPresent:      false,
    prismaClientReady:       false,
    migrationsApplied:       false,
    productionWritesEnabled: false,
    writeEndpointsSafe:      true,
    isProduction:            _isProduction(),
    criticalWritesPersisted: false,
  });
}

/**
 * persistenceHealth — synchronous read of the cached probe.
 * Returns a frozen envelope. Defaults to unavailable until
 * refreshPersistenceHealth() resolves.
 */
export function persistenceHealth(): PersistenceHealth {
  return _safe(() => _cache || _emptyHealth(), _emptyHealth());
}

/**
 * refreshPersistenceHealth — async fetch of /api/health to probe
 * the server's actual persistence state. Updates the local cache.
 * Returns the new envelope. Never throws — failure resolves to
 * the unavailable envelope.
 *
 * The server's /api/health endpoint is expected to include:
 *   {
 *     persistence: {
 *       mode: 'postgres' | 'in_memory' | 'unavailable',
 *       databaseUrlPresent: boolean,
 *       prismaClientReady: boolean,
 *       migrationsApplied: boolean,
 *     }
 *   }
 *
 * If the server does NOT yet emit this shape, the probe falls
 * back to the unavailable envelope — honest degradation.
 */
export async function refreshPersistenceHealth(): Promise<PersistenceHealth> {
  return _safe(async () => {
    if (typeof fetch === 'undefined') {
      const fb = _emptyHealth();
      _cache = fb;
      return fb;
    }
    try {
      const res = await fetch('/api/health', { credentials: 'include' });
      if (!res || !res.ok) {
        const fb: PersistenceHealth = Object.freeze({
          ..._emptyHealth(),
          probeError: 'health_endpoint_unreachable',
          lastProbedAt: new Date().toISOString(),
        });
        _cache = fb;
        return fb;
      }
      const json = await res.json();
      const p = (json && json.persistence) || {};
      const mode: PersistenceModeValue =
        p.mode === PERSISTENCE_MODE.POSTGRES    ? PERSISTENCE_MODE.POSTGRES
      : p.mode === PERSISTENCE_MODE.IN_MEMORY   ? PERSISTENCE_MODE.IN_MEMORY
      :                                           PERSISTENCE_MODE.UNAVAILABLE;
      const isProd = _isProduction();
      // Production writes only enabled when mode === postgres AND
      // migrations applied. In production, in_memory is NEVER
      // allowed.
      const productionWritesEnabled =
        mode === PERSISTENCE_MODE.POSTGRES
        && !!p.migrationsApplied;
      const writeEndpointsSafe =
        productionWritesEnabled || !isProd;
      // criticalWritesPersisted — server emits this once
      // npm run validate:persistence has been run against the live
      // DB. Fall back to productionWritesEnabled for honest default.
      const criticalWritesPersisted =
        typeof p.criticalWritesPersisted === 'boolean'
          ? !!p.criticalWritesPersisted
          : productionWritesEnabled;
      const fresh: PersistenceHealth = Object.freeze({
        runtimeVersion:          PERSISTENCE_RUNTIME_VERSION,
        initialized:             true,
        mode,
        databaseUrlPresent:      !!p.databaseUrlPresent,
        prismaClientReady:       !!p.prismaClientReady,
        migrationsApplied:       !!p.migrationsApplied,
        productionWritesEnabled,
        writeEndpointsSafe,
        isProduction:            isProd,
        criticalWritesPersisted,
        lastProbedAt:            new Date().toISOString(),
      });
      _cache = fresh;
      return fresh;
    } catch (e: any) {
      const fb: PersistenceHealth = Object.freeze({
        ..._emptyHealth(),
        probeError: 'fetch_failed',
        lastProbedAt: new Date().toISOString(),
      });
      _cache = fb;
      return fb;
    }
  }, _emptyHealth() as any) as Promise<PersistenceHealth>;
}

export function installPersistenceHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__persistenceHealth !== 'function') {
      w.__persistenceHealth = function () {
        const out = persistenceHealth();
        try { console.log('[Farroway · Persistence]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    if (typeof w.__refreshPersistenceHealth !== 'function') {
      w.__refreshPersistenceHealth = function () {
        return refreshPersistenceHealth();
      };
    }
    // Kick off a refresh on boot — non-blocking.
    try { refreshPersistenceHealth(); } catch { /* swallow */ }
    return true;
  }, false);
}
