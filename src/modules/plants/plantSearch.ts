/**
 * src/modules/plants/plantSearch.ts — unified plant search.
 *
 *   import { plantSearch, PLANT_SEARCH_VERSION }
 *     from 'src/modules/plants/plantSearch';
 *
 *   plantSearch({
 *     query: 'tomato',
 *     categories: ['vegetable', 'fruit'],   // optional filter
 *     limit: 20,
 *   });
 *
 * What this is
 * ────────────
 *   Multi-field, ranked search across the whole plant DB. Looks
 *   at id / commonName / scientificName / localNames / family
 *   and returns hits ranked by match quality:
 *
 *     0  exact id / commonName match
 *     1  prefix match on commonName
 *     2  prefix match on scientificName
 *     3  substring match on commonName
 *     4  substring match on scientificName / family
 *     5  substring match on localNames[]
 *
 *   Local names are pulled from `plant.localNames` (a `{lang:
 *   string}` map) when present — the content team adds them
 *   incrementally; the engine returns empty rather than throwing
 *   when the field is missing.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No fetch, no persistence.
 *   • Defensive — fields may be missing from any DB row.
 */

import { PLANT_DB, plantsByType } from '../../data/plants/index.js';
import { PLANT_CATEGORIES, isPlantCategory, PlantCategory }
  from './plantCategories';

export const PLANT_SEARCH_VERSION = 'plant-search-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface PlantSearchCtx {
  query?:      string;
  categories?: string[];   // optional category filter
  limit?:      number;
  locale?:     string;
}

function _localNamesArray(plant: any, locale: string): string[] {
  const out: string[] = [];
  const ln = plant && plant.localNames;
  if (_isObj(ln)) {
    if (locale && typeof ln[locale] === 'string') out.push(ln[locale]);
    // Surface every locale as a search-target so a user typing in
    // their native language still hits the right plant when the
    // active app locale doesn't match.
    for (const k of Object.keys(ln)) {
      const v = ln[k];
      if (typeof v === 'string' && v) out.push(v);
    }
  }
  // Also accept a flat `localName` string for old data shapes.
  if (typeof plant?.localName === 'string') out.push(plant.localName);
  return out;
}

function _rankPlant(plant: any, q: string, locale: string): number {
  if (!_isObj(plant) || q.length < 2) return -1;
  const id   = _str(plant.id).toLowerCase();
  const name = (_str(plant.commonName) || _str(plant.name)).toLowerCase();
  const sci  = _str(plant.scientificName).toLowerCase();
  const fam  = _str(plant.family).toLowerCase();
  const locals = _localNamesArray(plant, locale).map((s) => s.toLowerCase());

  if (id   === q || name === q) return 0;
  if (name.startsWith(q))       return 1;
  if (sci.startsWith(q))        return 2;
  if (name.includes(q))         return 3;
  if (sci.includes(q) || fam.includes(q)) return 4;
  for (const l of locals) {
    if (l === q) return 0;
    if (l.startsWith(q)) return 1;
    if (l.includes(q))   return 5;
  }
  return -1;
}

export function plantSearch(ctx: PlantSearchCtx) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {} as PlantSearchCtx;
    const query   = _str(c.query).trim().toLowerCase();
    const locale  = _str(c.locale);
    const limit   = _num(c.limit) || 20;
    if (query.length < 2) {
      return Object.freeze({
        runtimeVersion: PLANT_SEARCH_VERSION,
        query, count: 0, items: Object.freeze([] as any[]),
        appliedCategories: Object.freeze([] as string[]),
      });
    }

    const cats = _arr(c.categories).map(_str).filter(isPlantCategory);
    const pool: any[] = cats.length > 0
      ? cats.flatMap((cat) => plantsByType(cat as PlantCategory))
      : (PLANT_DB as any[]);

    const ranked: { rank: number; plant: any }[] = [];
    for (const p of pool) {
      const rank = _rankPlant(p, query, locale);
      if (rank === -1) continue;
      ranked.push({ rank, plant: p });
    }
    ranked.sort((a, b) => a.rank - b.rank);

    const items = ranked.slice(0, limit).map((r) => Object.freeze({
      id:             _str(r.plant.id),
      commonName:     _str(r.plant.commonName) || _str(r.plant.name),
      scientificName: _str(r.plant.scientificName),
      category:       _str(r.plant.type),
      family:         _str(r.plant.family),
      rank:           r.rank,
    }));

    return Object.freeze({
      runtimeVersion: PLANT_SEARCH_VERSION,
      query,
      count: items.length,
      items: Object.freeze(items),
      appliedCategories: Object.freeze(cats),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_SEARCH_VERSION,
    query: '', count: 0, items: Object.freeze([] as any[]),
    appliedCategories: Object.freeze([] as string[]),
  }));
}

export { PLANT_CATEGORIES };
