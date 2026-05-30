/**
 * src/data/nutrients/index.js — Wave-33 Nutrient Deficiencies
 * catalog. Loader + canonical export surface.
 *
 *   import { NUTRIENT_DB, findNutrient, searchNutrients,
 *            NUTRIENT_DB_VERSION } from 'src/data/nutrients';
 *
 * Schema per entry (see nutrients.json):
 *   id, name, aliases[], scientificName,
 *   symptoms[], commonCauses[], treatment[], prevention[],
 *   severityGuidance, followUpScanDays,
 *   farmerFriendlySummary, regions[], images[]
 *
 * Strict-rule audit
 *   • Pure data loader. No runtime side effects.
 *   • SSR-safe. Never throws — _safe wraps all reads.
 *   • Frozen exports.
 *   • No PII.
 */

import nutrientsRaw from './nutrients.json';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

export const NUTRIENT_DB_VERSION = 'nutrient-db-v1';

export const NUTRIENT_DB = Object.freeze(
  _safe(
    () => (Array.isArray(nutrientsRaw) ? nutrientsRaw : [])
      .map((row) => Object.freeze({ ...row })),
    [],
  ),
);

const _byId = Object.freeze(_safe(() => {
  const m = Object.create(null);
  for (const n of NUTRIENT_DB) if (n && n.id) m[n.id] = n;
  return m;
}, {}));

/** Find a nutrient deficiency entry by id. */
export function findNutrient(id) {
  return _safe(() => {
    if (typeof id !== 'string') return null;
    return _byId[id] || null;
  }, null);
}

/** Substring + alias search across name, aliases, scientificName, symptoms. */
export function searchNutrients(query) {
  return _safe(() => {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return [];
    const matches = [];
    for (const n of NUTRIENT_DB) {
      if (!n) continue;
      const hay =
        (n.name || '').toLowerCase() + ' ' +
        (Array.isArray(n.aliases) ? n.aliases.join(' ') : '').toLowerCase() + ' ' +
        (n.scientificName || '').toLowerCase() + ' ' +
        (Array.isArray(n.symptoms) ? n.symptoms.join(' ') : '').toLowerCase();
      if (hay.includes(q)) matches.push(n);
    }
    return Object.freeze(matches);
  }, []);
}

/** Aggregate stats — used by KnowledgeContentRuntime if it ever consumes nutrients. */
export const NUTRIENT_DB_STATS = Object.freeze({
  total:        NUTRIENT_DB.length,
  withRegions:  NUTRIENT_DB.filter((n) =>
                  Array.isArray(n.regions) && n.regions.length > 0).length,
  withAliases:  NUTRIENT_DB.filter((n) =>
                  Array.isArray(n.aliases) && n.aliases.length > 0).length,
});
