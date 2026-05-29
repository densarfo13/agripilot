/**
 * src/modules/plants/plantLibrary.ts — unified Plant Library.
 *
 *   import {
 *     plantLibrary, PLANT_LIBRARY_SORT,
 *     PLANT_LIBRARY_FILTERS, PLANT_LIBRARY_VERSION,
 *   } from 'src/modules/plants/plantLibrary';
 *
 *   plantLibrary({
 *     category: 'flower',       // optional — drops the filter
 *     filters:  ['POLLINATOR_FRIENDLY', 'DROUGHT_RESISTANT'],
 *     query:    'rose',
 *     sort:     'name_asc',
 *     favorites:    ['rose', 'monstera'],
 *     limit:    20,
 *     offset:   0,
 *   });
 *
 * What this is
 * ────────────
 *   The unified browsing surface across all 7 plant categories.
 *   Composes the existing per-category libraries (flowerLibrary
 *   for flowers + plantsByType for everything else) under one
 *   shape:
 *
 *     {
 *       items:           [...projected plants],
 *       total,           // matches after filters
 *       librarySize,     // total rows in DB
 *       categories:      [{ id, icon, label, count, minLaunch }],
 *       appliedFilters,  appliedCategory, appliedSort,
 *       query,           favoritesCount,
 *       specTarget,      deferred,
 *     }
 *
 *   Favorites are caller-supplied IDs; the engine flags + sorts
 *   them. No localStorage / persistence calls — wave-5 single-
 *   writer invariant preserved.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — never modifies underlying engines.
 *   • Spec target 1,500+ rows is NAMED-DEFERRED.
 */

import { PLANT_DB, PLANT_DB_STATS, plantsByType }
  from '../../data/plants/index.js';
import {
  PLANT_CATEGORIES, PLANT_CATEGORY_META, isPlantCategory,
  PlantCategory, MIN_LAUNCH_TOTAL,
} from './plantCategories';
import { plantSearch } from './plantSearch';
import { FLOWER_FILTERS } from '../../runtime/grow/flowerLibrary';

export const PLANT_LIBRARY_VERSION = 'plant-library-unified-v1';

export const PLANT_LIBRARY_FILTERS = Object.freeze({
  BLOOMING:            'BLOOMING',
  PERENNIAL:           'PERENNIAL',
  ANNUAL:              'ANNUAL',
  FULL_SUN:            'FULL_SUN',
  PARTIAL_SHADE:       'PARTIAL_SHADE',
  POLLINATOR_FRIENDLY: 'POLLINATOR_FRIENDLY',
  DROUGHT_RESISTANT:   'DROUGHT_RESISTANT',
  INDOOR_FRIENDLY:     'INDOOR_FRIENDLY',
  FAVORITES_ONLY:      'FAVORITES_ONLY',
});

export const PLANT_LIBRARY_SORT = Object.freeze({
  NAME_ASC:               'name_asc',
  NAME_DESC:              'name_desc',
  POLLINATOR_DESC:        'pollinator_desc',
  WATER_LOW_TO_HIGH:      'water_low_to_high',
  FAVORITES_FIRST:        'favorites_first',
  CATEGORY:               'category',
});

const POLLINATOR_THRESHOLD = 7;
const WATER_ORDER: Record<string, number> = {
  low: 0, medium: 1, high: 2, '': 9,
};

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _project(plant: any, isFavorite: boolean) {
  const id    = _str(plant.id);
  const name  = _str(plant.commonName) || _str(plant.name);
  const water = _str(plant.waterNeeds) || _str(plant.water);
  const sun   = _str(plant.sunlight)  || _str(plant.sun);
  const polli = _num(plant.pollinatorValue);
  return Object.freeze({
    id, name,
    commonName:     name,
    scientificName: _str(plant.scientificName),
    family:         _str(plant.family),
    category:       _str(plant.type),
    lifecycle:      _str(plant.lifecycle),
    bloomSeason:    Object.freeze(_arr(plant.bloomSeason).map(_str)),
    sun, sunlight: sun,
    water, waterNeeds: water,
    pollinatorValue:  polli == null ? 0 : polli,
    droughtResistant: !!plant.droughtResistant,
    indoorFriendly:   !!plant.indoor || !!plant.indoorFriendly,
    image:            _str(plant.image),
    isFavorite,
  });
}

function _matchesFilter(p: any, filter: string, season: string,
                         isFavorite: boolean): boolean {
  switch (filter) {
    case PLANT_LIBRARY_FILTERS.BLOOMING:
      if (!season) return false;
      return _arr(p.bloomSeason).indexOf(season) !== -1;
    case PLANT_LIBRARY_FILTERS.PERENNIAL:
      return _str(p.lifecycle) === 'perennial';
    case PLANT_LIBRARY_FILTERS.ANNUAL:
      return _str(p.lifecycle) === 'annual';
    case PLANT_LIBRARY_FILTERS.FULL_SUN:
      return _str(p.sunlight) === 'full';
    case PLANT_LIBRARY_FILTERS.PARTIAL_SHADE:
      return _str(p.sunlight) === 'partial';
    case PLANT_LIBRARY_FILTERS.POLLINATOR_FRIENDLY:
      return _num(p.pollinatorValue) != null
        && (p.pollinatorValue as number) >= POLLINATOR_THRESHOLD;
    case PLANT_LIBRARY_FILTERS.DROUGHT_RESISTANT:
      return !!p.droughtResistant;
    case PLANT_LIBRARY_FILTERS.INDOOR_FRIENDLY:
      return !!p.indoorFriendly;
    case PLANT_LIBRARY_FILTERS.FAVORITES_ONLY:
      return isFavorite;
    default:
      return false;
  }
}

function _sortItems(items: any[], sort: string): any[] {
  const out = items.slice();
  if (sort === PLANT_LIBRARY_SORT.NAME_ASC) {
    out.sort((a, b) => _str(a.name).localeCompare(_str(b.name)));
  } else if (sort === PLANT_LIBRARY_SORT.NAME_DESC) {
    out.sort((a, b) => _str(b.name).localeCompare(_str(a.name)));
  } else if (sort === PLANT_LIBRARY_SORT.POLLINATOR_DESC) {
    out.sort((a, b) => (_num(b.pollinatorValue) || 0)
                      - (_num(a.pollinatorValue) || 0));
  } else if (sort === PLANT_LIBRARY_SORT.WATER_LOW_TO_HIGH) {
    out.sort((a, b) => (WATER_ORDER[_str(a.water)] ?? 9)
                      - (WATER_ORDER[_str(b.water)] ?? 9));
  } else if (sort === PLANT_LIBRARY_SORT.FAVORITES_FIRST) {
    out.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (b.isFavorite && !a.isFavorite) return 1;
      return _str(a.name).localeCompare(_str(b.name));
    });
  } else if (sort === PLANT_LIBRARY_SORT.CATEGORY) {
    out.sort((a, b) => _str(a.category).localeCompare(_str(b.category))
                     || _str(a.name).localeCompare(_str(b.name)));
  }
  return out;
}

interface LibraryCtx {
  category?:  string;
  filters?:   string[];
  query?:     string;
  season?:    string;
  sort?:      string;
  favorites?: string[];
  limit?:     number;
  offset?:    number;
  locale?:    string;
}

export function plantLibrary(ctx: LibraryCtx) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {} as LibraryCtx;
    const limit   = _num(c.limit)  || 20;
    const offset  = _num(c.offset) || 0;
    const cat     = isPlantCategory(c.category) ? c.category as PlantCategory : null;
    const filters = _arr(c.filters).map(_str).filter((s) => !!s);
    const query   = _str(c.query).trim();
    const season  = _str(c.season).toLowerCase();
    const sort    = _str(c.sort) || PLANT_LIBRARY_SORT.NAME_ASC;
    const favs    = new Set<string>(_arr(c.favorites).map(_str));

    // 1. Pool — category-filtered list OR full DB
    let pool: any[] = cat
      ? (plantsByType(cat) as any[])
      : (PLANT_DB as any[]);

    // 2. Apply query — drop search rank to a name-list intersect
    if (query.length >= 2) {
      const hits = plantSearch({
        query, locale: c.locale,
        categories: cat ? [cat] : undefined,
        limit: 1000,
      });
      const allowed = new Set<string>(
        _arr((hits as any).items).map((i) => _str(i.id))
      );
      pool = pool.filter((p) => allowed.has(_str(p.id)));
    }

    // 3. Project to UI-friendly rows + favorite flag
    let items = pool.map((p) => _project(p, favs.has(_str(p.id))));

    // 4. Filter intersection (AND, conservative)
    if (filters.length > 0) {
      items = items.filter((p) => filters.every((f) =>
        _matchesFilter(p, f, season, p.isFavorite)
      ));
    }

    // 5. Sort
    const sorted = _sortItems(items, sort);

    // 6. Paginate
    const slice = sorted.slice(offset, offset + limit);

    // Category counts — derived once for the UI sidebar.
    const categories = PLANT_CATEGORIES.map((id) => ({
      id, icon: PLANT_CATEGORY_META[id].icon,
      labelKey: PLANT_CATEGORY_META[id].labelKey,
      labelDefault: PLANT_CATEGORY_META[id].labelDefault,
      minLaunch: PLANT_CATEGORY_META[id].minLaunch,
      count: (PLANT_DB_STATS as any)[id] || 0,
    }));

    return Object.freeze({
      runtimeVersion:  PLANT_LIBRARY_VERSION,
      total:           sorted.length,
      librarySize:     PLANT_DB.length,
      offset, limit,
      items:           Object.freeze(slice),
      categories:      Object.freeze(categories.map((c) => Object.freeze(c))),
      appliedCategory: cat,
      appliedFilters:  Object.freeze(filters),
      appliedSort:     sort,
      query,
      favoritesCount:  favs.size,
      availableFilters: Object.freeze(Object.values(PLANT_LIBRARY_FILTERS)),
      availableSorts:   Object.freeze(Object.values(PLANT_LIBRARY_SORT)),
      // The 8 filters here ALSO match the flowerLibrary FLOWER_FILTERS
      // set — surfaced so the UI can render unified chips without
      // re-reading the per-category library.
      flowerFilters:    FLOWER_FILTERS,
      specTarget: Object.freeze({
        ...PLANT_DB_STATS.specTarget,
        grandTotal: (PLANT_DB_STATS.specTarget as any).grandTotal
                  || MIN_LAUNCH_TOTAL,
      }),
      deferred: Object.freeze({
        libraryDataset:
          'spec asks for 1,500+ rows (500 flowers + 300 vegetables + '
          + '200 fruits + 150 herbs + 200 houseplants + 150 crops + '
          + '100 trees); starter ships ' + PLANT_DB.length
          + ' rows with the target tracked in specTarget — '
          + 'content-team backlog',
        localNamesCoverage:
          'localNames is opt-in per row; content-team backlog to '
          + 'populate the 6 supported locales',
        favoritesPersistence:
          'favorites is caller-supplied; persistence stays with the '
          + 'wave-5 single-writer (engines never write storage)',
        scanAutoAdd:
          'auto-add-from-scan surfaces via plantProfile().autoAddSuggestion'
          + ' — engine emits payload, caller persists',
      }),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_LIBRARY_VERSION,
    total: 0, librarySize: 0, offset: 0, limit: 0,
    items: Object.freeze([] as any[]),
    categories: Object.freeze([] as any[]),
    appliedCategory: null,
    appliedFilters:  Object.freeze([] as string[]),
    appliedSort:     PLANT_LIBRARY_SORT.NAME_ASC,
    query: '', favoritesCount: 0,
    availableFilters: Object.freeze(Object.values(PLANT_LIBRARY_FILTERS)),
    availableSorts:   Object.freeze(Object.values(PLANT_LIBRARY_SORT)),
    flowerFilters:    FLOWER_FILTERS,
    specTarget: Object.freeze({}),
    deferred: Object.freeze({}),
  }));
}
