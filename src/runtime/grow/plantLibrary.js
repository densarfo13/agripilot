/**
 * runtime/grow/plantLibrary.js — Phase 12 global plant library
 * search interface.
 *
 *   import {
 *     plantLibrary, plantLibrarySearch,
 *     PLANT_LIBRARY_VERSION,
 *   } from 'src/runtime/grow/plantLibrary.js';
 *
 * What this is
 * ────────────
 *   Thin wrapper around the plant DB search that gives the UI
 *   a stable contract:
 *     • plantLibrary({type})    — paginated listing by type
 *     • plantLibrarySearch({query, type}) — search by name /
 *       scientificName / local name
 *
 *   The starter DB ships 50 well-curated plants. The 9,500+
 *   target is named-deferred — this engine surfaces the
 *   `librarySize` vs `specTarget` so QA can see the runway.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Reads plant DB only.
 *   • No fetch.
 */

import {
  PLANT_DB, PLANT_DB_STATS, PLANTS_BY_TYPE,
  searchPlants, plantsByType, findPlant,
} from '../../data/plants/index.js';

export const PLANT_LIBRARY_VERSION = 'plant-library-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

export function plantLibrary(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    const type   = _str(c.type);
    const limit  = _num(c.limit)  || 20;
    const offset = _num(c.offset) || 0;
    const pool   = type ? plantsByType(type) : PLANT_DB;
    const slice  = pool.slice(offset, offset + limit);
    return Object.freeze({
      runtimeVersion: PLANT_LIBRARY_VERSION,
      type, offset, limit,
      total:        pool.length,
      librarySize:  PLANT_DB.length,
      items: Object.freeze(slice),
      stats: PLANT_DB_STATS,
      deferred: Object.freeze({
        librarySize:
          'starter database ships 50 curated plants; spec target '
          + 'is 9,500+ entries (content-team backlog)',
        localNames:
          'multi-locale local names per plant not yet wired',
      }),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_LIBRARY_VERSION,
    type: '', offset: 0, limit: 0, total: 0, librarySize: 0,
    items: Object.freeze([]), stats: PLANT_DB_STATS,
    deferred: Object.freeze({}),
  }));
}

export function plantLibrarySearch(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    const query = _str(c.query);
    const type  = _str(c.type);
    const limit = _num(c.limit) || 20;
    const hits  = searchPlants(query, { type, limit });
    return Object.freeze({
      runtimeVersion: PLANT_LIBRARY_VERSION,
      query, type, count: hits.length,
      items: hits,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_LIBRARY_VERSION,
    query: '', type: '', count: 0, items: Object.freeze([]),
  }));
}

// Convenience re-export for diagnostics
export const _refs = Object.freeze({
  PLANTS_BY_TYPE, findPlant,
});
