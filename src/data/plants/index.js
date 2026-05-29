/**
 * src/data/plants/index.js — Phase 3 + 12 plant database loader.
 *
 *   import { PLANT_DB, findPlant, searchPlants, plantsByType }
 *     from 'src/data/plants/index.js';
 *
 * What this is
 * ────────────
 *   Single import surface for the starter plant database. The
 *   user spec calls for 9,500+ plants across categories (Phase
 *   12); this ships a carefully-curated STARTER set of 50 plants
 *   covering all 5 categories. The shape is frozen so the
 *   content team can append rows without coordination.
 *
 *   Each plant carries:
 *     id, name, scientificName, type, water, sun, bloomSeason,
 *     companionPlants, avoidPlants, repels, attracts, diseases,
 *     growthDays, indoor.
 *   Houseplants also carry:
 *     humidity, wateringIntervalDays, repottingIntervalDays.
 */

import flowers     from './flowers.json';
import herbs       from './herbs.json';
import vegetables  from './vegetables.json';
import fruits      from './fruits.json';
import houseplants from './houseplants.json';
import trees       from './trees.json';
import shrubs      from './shrubs.json';

export const PLANT_DB_VERSION = 'plant-db-starter-v3';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _freezeAll(list) {
  return Object.freeze(_arr(list).map((p) => Object.freeze(p)));
}

export const PLANTS_BY_TYPE = Object.freeze({
  flower:     _freezeAll(flowers),
  herb:       _freezeAll(herbs),
  vegetable:  _freezeAll(vegetables),
  fruit:      _freezeAll(fruits),
  houseplant: _freezeAll(houseplants),
  tree:       _freezeAll(trees),
  shrub:      _freezeAll(shrubs),
});

export const PLANT_DB = Object.freeze(
  []
    .concat(PLANTS_BY_TYPE.flower)
    .concat(PLANTS_BY_TYPE.herb)
    .concat(PLANTS_BY_TYPE.vegetable)
    .concat(PLANTS_BY_TYPE.fruit)
    .concat(PLANTS_BY_TYPE.houseplant)
    .concat(PLANTS_BY_TYPE.tree)
    .concat(PLANTS_BY_TYPE.shrub)
);

const _byId = (() => {
  const m = {};
  for (const p of PLANT_DB) {
    if (_isObj(p) && _str(p.id)) m[p.id] = p;
  }
  return Object.freeze(m);
})();

export function findPlant(id) {
  return _safe(() => _byId[_str(id).toLowerCase()] || null, null);
}

export function plantsByType(type) {
  return _safe(() => PLANTS_BY_TYPE[_str(type)] || Object.freeze([]),
    Object.freeze([]));
}

/**
 * Search by name / scientificName / id. Case-insensitive. Returns
 * up to `limit` (default 20) frozen matches sorted by quality.
 */
export function searchPlants(query, options) {
  return _safe(() => {
    const q = _str(query).trim().toLowerCase();
    if (q.length < 2) return Object.freeze([]);
    const limit = (_isObj(options) && typeof options.limit === 'number')
      ? options.limit : 20;
    const type  = _isObj(options) ? _str(options.type) : '';
    const pool  = type ? plantsByType(type) : PLANT_DB;

    const ranked = [];
    for (const p of pool) {
      if (!_isObj(p)) continue;
      const id   = _str(p.id).toLowerCase();
      const name = _str(p.name).toLowerCase();
      const sci  = _str(p.scientificName).toLowerCase();
      let rank = -1;
      if (id   === q)         rank = 0;
      else if (name === q)    rank = 0;
      else if (name.startsWith(q)) rank = 1;
      else if (sci.startsWith(q))  rank = 2;
      else if (name.includes(q))   rank = 3;
      else if (sci.includes(q))    rank = 4;
      if (rank === -1) continue;
      ranked.push({ rank, plant: p });
    }
    ranked.sort((a, b) => a.rank - b.rank);
    return Object.freeze(ranked.slice(0, limit).map((r) => r.plant));
  }, Object.freeze([]));
}

export const PLANT_DB_STATS = Object.freeze({
  total:       PLANT_DB.length,
  flower:      PLANTS_BY_TYPE.flower.length,
  herb:        PLANTS_BY_TYPE.herb.length,
  vegetable:   PLANTS_BY_TYPE.vegetable.length,
  fruit:       PLANTS_BY_TYPE.fruit.length,
  houseplant:  PLANTS_BY_TYPE.houseplant.length,
  tree:        PLANTS_BY_TYPE.tree.length,
  shrub:       PLANTS_BY_TYPE.shrub.length,
  // Global Plant Intelligence Library minimum launch dataset.
  // Tracked here as a deferred metric so QA can see the runway
  // visually. Content-team backlog — engines never gate on it.
  specTarget: Object.freeze({
    flower:     500,
    vegetable:  300,
    fruit:      200,
    herb:       150,
    houseplant: 200,
    crop:       150,
    tree:       100,
    shrub:      100,
    grandTotal: 1700,
  }),
});
