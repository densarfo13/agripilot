/**
 * runtime/grow/flowerLibrary.ts — Global Flower Library.
 *
 *   import {
 *     flowerLibrary, filterFlowers, searchFlowers,
 *     FLOWER_FILTERS, FLOWER_LIBRARY_VERSION,
 *   } from 'src/runtime/grow/flowerLibrary';
 *
 *   flowerLibrary({
 *     filters: [FLOWER_FILTERS.BLOOMING, FLOWER_FILTERS.POLLINATOR_FRIENDLY],
 *     query:  'rose',
 *     season: 'spring',
 *     limit:  20,
 *   });
 *
 * What this is
 * ────────────
 *   The browsing surface on top of the curated flower DB.
 *   Composes the existing plant-DB search with the 8 spec'd
 *   filter buckets:
 *
 *     BLOOMING            (currently in season)
 *     PERENNIAL
 *     ANNUAL
 *     FULL_SUN
 *     PARTIAL_SHADE
 *     POLLINATOR_FRIENDLY (pollinatorValue >= 7)
 *     DROUGHT_RESISTANT
 *     INDOOR_FRIENDLY
 *
 *   The result envelope feeds:
 *     • Scan integration       — scanGrowType.tagScanWithGrowType
 *                                already resolves any flower ID
 *                                in this DB; new entries flow in
 *                                automatically.
 *     • Garden Mode            — gardenMode.resolveGardenMode
 *                                already maps growType='flower'
 *                                to Garden labels.
 *     • Tasks                  — flowerAdvisor reads the same DB
 *                                rows for today-task derivation.
 *     • Weather Intelligence   — diseaseForecast / pestRiskEngine
 *                                read .diseases per plant.
 *     • Pollinator Intelligence — pollinatorEngine reads .attracts;
 *                                this engine ALSO surfaces the
 *                                explicit pollinatorValue tier.
 *     • Companion Planting     — companionEngine reads
 *                                .companionPlants / .avoidPlants.
 *
 *   Honest scope: the spec asks for 500+ flowers. This engine
 *   ships against a 50-entry curated starter set with the 500+
 *   target named in `deferred.libraryTarget`. Filters + search
 *   scale linearly so a content-team expansion does NOT require
 *   engine changes.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — reads plant DB.
 *   • No fetch. No persistence writes.
 *   • Filter intersection is conservative — a flower must satisfy
 *     ALL active filters (AND, not OR) so the UX feels intentional.
 */

import { plantsByType, searchPlants } from '../../data/plants/index.js';

export const FLOWER_LIBRARY_VERSION = 'flower-library-v1';

export const FLOWER_FILTERS = Object.freeze({
  BLOOMING:            'BLOOMING',
  PERENNIAL:           'PERENNIAL',
  ANNUAL:              'ANNUAL',
  FULL_SUN:            'FULL_SUN',
  PARTIAL_SHADE:       'PARTIAL_SHADE',
  POLLINATOR_FRIENDLY: 'POLLINATOR_FRIENDLY',
  DROUGHT_RESISTANT:   'DROUGHT_RESISTANT',
  INDOOR_FRIENDLY:     'INDOOR_FRIENDLY',
});

const POLLINATOR_THRESHOLD = 7;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/* Normalize the field-name drift between legacy + new schemas
   so callers always see one shape. The starter DB carries BOTH
   field forms so this never returns null. */
function _projection(flower: any) {
  if (!_isObj(flower)) return null;
  const id    = _str(flower.id);
  const name  = _str(flower.commonName) || _str(flower.name);
  const sci   = _str(flower.scientificName);
  const family = _str(flower.family);
  const lifecycle = _str(flower.lifecycle);    // annual / perennial / biennial
  const water = _str(flower.waterNeeds) || _str(flower.water);   // low/medium/high
  const sun   = _str(flower.sunlight)  || _str(flower.sun);      // full/partial/indirect
  const bloom = _arr(flower.bloomSeason).map(_str).filter(Boolean);
  const pollinatorValue = _num(flower.pollinatorValue);
  const attracts = _arr(flower.attracts).map(_str);
  const companions = _arr(flower.companionPlants).map(_str);
  const avoid    = _arr(flower.avoidPlants).map(_str);
  const repels   = _arr(flower.repels).map(_str);
  const diseases = _arr(flower.diseases).length > 0
    ? _arr(flower.diseases).map(_str)
    : _arr(flower.diseaseRisks).map(_str);
  return Object.freeze({
    id, name, scientificName: sci, family,
    type: 'flower', lifecycle,
    water, waterNeeds: water,
    sun,   sunlight:   sun,
    bloomSeason: bloom,
    pollinatorValue: pollinatorValue == null ? 0 : pollinatorValue,
    attracts:        Object.freeze(attracts),
    companionPlants: Object.freeze(companions),
    avoidPlants:     Object.freeze(avoid),
    repels:          Object.freeze(repels),
    diseases:        Object.freeze(diseases),
    diseaseRisks:    Object.freeze(diseases),
    growthDays:      _num(flower.growthDays),
    indoor:           !!flower.indoor || !!flower.indoorFriendly,
    indoorFriendly:   !!flower.indoor || !!flower.indoorFriendly,
    droughtResistant: !!flower.droughtResistant,
    image: _str(flower.image),
  });
}

function _matchesFilter(flower: any, filter: string, season: string): boolean {
  if (!_isObj(flower)) return false;
  const f = filter;
  if (f === FLOWER_FILTERS.BLOOMING) {
    if (!season) return false;
    return _arr(flower.bloomSeason).indexOf(season) !== -1;
  }
  if (f === FLOWER_FILTERS.PERENNIAL) {
    return _str(flower.lifecycle) === 'perennial';
  }
  if (f === FLOWER_FILTERS.ANNUAL) {
    return _str(flower.lifecycle) === 'annual';
  }
  if (f === FLOWER_FILTERS.FULL_SUN) {
    return _str(flower.sunlight) === 'full';
  }
  if (f === FLOWER_FILTERS.PARTIAL_SHADE) {
    return _str(flower.sunlight) === 'partial';
  }
  if (f === FLOWER_FILTERS.POLLINATOR_FRIENDLY) {
    const pv = _num(flower.pollinatorValue);
    return pv != null && pv >= POLLINATOR_THRESHOLD;
  }
  if (f === FLOWER_FILTERS.DROUGHT_RESISTANT) {
    return !!flower.droughtResistant;
  }
  if (f === FLOWER_FILTERS.INDOOR_FRIENDLY) {
    return !!flower.indoorFriendly;
  }
  return false; // unknown filter — fail closed
}

interface FilterCtx {
  filters?: string[];
  season?:  string;
  query?:   string;
}

export function filterFlowers(ctx: FilterCtx) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {} as FilterCtx;
    const active  = _arr(c.filters).map(_str).filter((s) => !!s);
    const season  = _str(c.season).toLowerCase();
    const query   = _str(c.query).trim().toLowerCase();

    // Source list — search results when a query is present;
    // otherwise the full flower pool.
    const source = query.length >= 2
      ? searchPlants(query, { type: 'flower', limit: 5000 })
      : plantsByType('flower');

    const projected = source.map(_projection).filter(Boolean) as any[];

    if (active.length === 0) {
      return Object.freeze({
        items:        Object.freeze(projected),
        appliedFilters: Object.freeze([]),
        season,
        query,
      });
    }

    const filtered = projected.filter((flower) =>
      active.every((f) => _matchesFilter(flower, f, season))
    );

    return Object.freeze({
      items:           Object.freeze(filtered),
      appliedFilters:  Object.freeze(active),
      season,
      query,
    });
  }, Object.freeze({
    items: Object.freeze([] as any[]),
    appliedFilters: Object.freeze([] as string[]),
    season: '', query: '',
  }));
}

interface SearchCtx {
  query?: string;
  limit?: number;
}

export function searchFlowers(ctx: SearchCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as SearchCtx;
    const query = _str(c.query);
    const limit = _num(c.limit) || 20;
    const hits  = searchPlants(query, { type: 'flower', limit })
      .map(_projection).filter(Boolean);
    return Object.freeze({
      runtimeVersion: FLOWER_LIBRARY_VERSION,
      query, count: hits.length,
      items: Object.freeze(hits),
    });
  }, Object.freeze({
    runtimeVersion: FLOWER_LIBRARY_VERSION,
    query: '', count: 0, items: Object.freeze([] as any[]),
  }));
}

interface LibraryCtx {
  filters?: string[];
  query?:   string;
  season?:  string;
  limit?:   number;
  offset?:  number;
}

const SPEC_TARGET = 500;

export function flowerLibrary(ctx: LibraryCtx) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {} as LibraryCtx;
    const limit   = _num(c.limit)  || 20;
    const offset  = _num(c.offset) || 0;
    const filt    = filterFlowers({
      filters: c.filters, query: c.query, season: c.season,
    });
    const all     = _arr((filt as any).items);
    const slice   = all.slice(offset, offset + limit);
    const allFlowers = plantsByType('flower');
    return Object.freeze({
      runtimeVersion:  FLOWER_LIBRARY_VERSION,
      query:           _str(c.query),
      season:          _str(c.season).toLowerCase(),
      appliedFilters:  (filt as any).appliedFilters,
      total:           all.length,
      offset, limit,
      items:           Object.freeze(slice),
      librarySize:     allFlowers.length,
      specTarget:      SPEC_TARGET,
      // 8 filter buckets — UI can read this to render the
      // filter chips without hardcoding the list.
      availableFilters: Object.freeze(Object.values(FLOWER_FILTERS)),
      deferred: Object.freeze({
        libraryTarget:
          'spec target is 500+ flowers; starter ships ' + allFlowers.length
          + ' carefully-curated entries (content-team backlog)',
        imageAssets:
          'image paths reference /realism/flowers/{id}.jpg; '
          + 'physical assets ship when the content team uploads them',
      }),
    });
  }, Object.freeze({
    runtimeVersion: FLOWER_LIBRARY_VERSION,
    query: '', season: '',
    appliedFilters: Object.freeze([] as string[]),
    total: 0, offset: 0, limit: 0,
    items: Object.freeze([] as any[]),
    librarySize: 0, specTarget: SPEC_TARGET,
    availableFilters: Object.freeze(Object.values(FLOWER_FILTERS)),
    deferred: Object.freeze({}),
  }));
}
