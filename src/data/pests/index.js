/**
 * src/data/pests/index.js — Plant Knowledge Database · Pests
 * reference catalog.
 *
 *   import { PEST_DB, findPest, searchPests,
 *            PEST_DB_VERSION } from 'src/data/pests';
 *
 *   findPest('aphids')
 *     → { id, name, symptoms[], lifecycle[],
 *         treatmentOrganic[], treatmentChemical[],
 *         prevention[], images[] }
 *
 * What this is
 * ────────────
 *   Launch dataset of 8 cross-crop pests. Each entry carries
 *   symptoms, lifecycle, organic + chemical treatments,
 *   prevention, and image references (paths into the Verified
 *   Plant Media System — plants/pests/<slug>).
 *
 *   `id` is the canonical slug used by every other engine — it
 *   matches PlantMediaRegistry's pest entries 1:1 and is
 *   referenced from PLANT_KNOWLEDGE.commonPests.
 *
 * Strict-rule audit
 *   • Pure data + helpers. SSR-safe. Never throws.
 *   • All entries frozen. No mutation surface.
 *   • Composition-only — engines read this file, never write.
 *   • No PII handled.
 */

import pests from './pests.json';

export const PEST_DB_VERSION = 'pest-db-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _freezeEntry(p) {
  if (!_isObj(p)) return null;
  return Object.freeze({
    id:                _str(p.id),
    name:              _str(p.name),
    symptoms:          Object.freeze(_arr(p.symptoms).map(_str)),
    lifecycle:         Object.freeze(_arr(p.lifecycle).map(_str)),
    treatmentOrganic:  Object.freeze(_arr(p.treatmentOrganic).map(_str)),
    treatmentChemical: Object.freeze(_arr(p.treatmentChemical).map(_str)),
    prevention:        Object.freeze(_arr(p.prevention).map(_str)),
    images:            Object.freeze(_arr(p.images).map(_str)),
  });
}

export const PEST_DB = Object.freeze(
  _arr(pests).map(_freezeEntry).filter(Boolean)
);

const _byId = (() => {
  const m = {};
  for (const p of PEST_DB) if (p && p.id) m[p.id] = p;
  return Object.freeze(m);
})();

export function findPest(id) {
  return _safe(() => _byId[_str(id).toLowerCase()] || null, null);
}

/**
 * Case-insensitive search by id, name, or any symptom/lifecycle
 * keyword. Returns up to `limit` (default 10) ranked matches.
 */
export function searchPests(query, options) {
  return _safe(() => {
    const q = _str(query).trim().toLowerCase();
    if (q.length < 2) return Object.freeze([]);
    const limit = (_isObj(options) && typeof options.limit === 'number')
      ? options.limit : 10;
    const ranked = [];
    for (const p of PEST_DB) {
      const id   = _str(p.id).toLowerCase();
      const name = _str(p.name).toLowerCase();
      let rank = -1;
      if (id === q || name === q)         rank = 0;
      else if (id.startsWith(q))          rank = 1;
      else if (name.startsWith(q))        rank = 2;
      else if (id.includes(q) || name.includes(q)) rank = 3;
      else if (_arr(p.symptoms).some((s) =>
                 _str(s).toLowerCase().includes(q))) rank = 4;
      else if (_arr(p.lifecycle).some((s) =>
                 _str(s).toLowerCase().includes(q))) rank = 5;
      if (rank === -1) continue;
      ranked.push({ rank, pest: p });
    }
    ranked.sort((a, b) => a.rank - b.rank);
    return Object.freeze(ranked.slice(0, limit).map((r) => r.pest));
  }, Object.freeze([]));
}

export const PEST_DB_STATS = Object.freeze({
  total: PEST_DB.length,
});
