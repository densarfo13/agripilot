/**
 * src/data/diseases/index.js — Plant Knowledge Database ·
 * Diseases reference catalog.
 *
 *   import { DISEASE_DB, findDisease, searchDiseases,
 *            DISEASE_DB_VERSION } from 'src/data/diseases';
 *
 *   findDisease('leaf-spot')
 *     → { id, name, symptoms[], causes[], treatmentOrganic[],
 *         treatmentChemical[], prevention[], images[] }
 *
 * What this is
 * ────────────
 *   Launch dataset of 8 cross-crop diseases. Each entry carries
 *   symptoms, causes, organic + chemical treatments, prevention,
 *   and image references (paths into the Verified Plant Media
 *   System — plants/diseases/<slug>).
 *
 *   `id` is the canonical slug used by every other engine — it
 *   matches PlantMediaRegistry's disease entries 1:1 and is
 *   referenced from PLANT_KNOWLEDGE.commonDiseases.
 *
 * Strict-rule audit
 *   • Pure data + helpers. SSR-safe. Never throws.
 *   • All entries frozen. No mutation surface.
 *   • Composition-only — engines read this file, never write.
 *   • No PII handled.
 */

import diseases from './diseases.json';

export const DISEASE_DB_VERSION = 'disease-db-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _freezeEntry(d) {
  if (!_isObj(d)) return null;
  return Object.freeze({
    id:                _str(d.id),
    name:              _str(d.name),
    symptoms:          Object.freeze(_arr(d.symptoms).map(_str)),
    causes:            Object.freeze(_arr(d.causes).map(_str)),
    treatmentOrganic:  Object.freeze(_arr(d.treatmentOrganic).map(_str)),
    treatmentChemical: Object.freeze(_arr(d.treatmentChemical).map(_str)),
    prevention:        Object.freeze(_arr(d.prevention).map(_str)),
    images:            Object.freeze(_arr(d.images).map(_str)),
  });
}

export const DISEASE_DB = Object.freeze(
  _arr(diseases).map(_freezeEntry).filter(Boolean)
);

const _byId = (() => {
  const m = {};
  for (const d of DISEASE_DB) if (d && d.id) m[d.id] = d;
  return Object.freeze(m);
})();

export function findDisease(id) {
  return _safe(() => _byId[_str(id).toLowerCase()] || null, null);
}

/**
 * Case-insensitive search by id, name, or any symptom keyword.
 * Returns up to `limit` (default 10) frozen matches ranked by
 * field quality (id > name > symptom).
 */
export function searchDiseases(query, options) {
  return _safe(() => {
    const q = _str(query).trim().toLowerCase();
    if (q.length < 2) return Object.freeze([]);
    const limit = (_isObj(options) && typeof options.limit === 'number')
      ? options.limit : 10;
    const ranked = [];
    for (const d of DISEASE_DB) {
      const id   = _str(d.id).toLowerCase();
      const name = _str(d.name).toLowerCase();
      let rank = -1;
      if (id === q || name === q)          rank = 0;
      else if (id.startsWith(q))           rank = 1;
      else if (name.startsWith(q))         rank = 2;
      else if (id.includes(q) || name.includes(q)) rank = 3;
      else if (_arr(d.symptoms).some((s) =>
                 _str(s).toLowerCase().includes(q))) rank = 4;
      if (rank === -1) continue;
      ranked.push({ rank, disease: d });
    }
    ranked.sort((a, b) => a.rank - b.rank);
    return Object.freeze(ranked.slice(0, limit).map((r) => r.disease));
  }, Object.freeze([]));
}

export const DISEASE_DB_STATS = Object.freeze({
  total: DISEASE_DB.length,
});
