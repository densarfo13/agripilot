/**
 * runtime/grow/scanGrowType.js — Phase 7 grow-type-aware scan
 * envelope tagger.
 *
 *   import { tagScanWithGrowType, SCAN_GROW_TYPE_VERSION }
 *     from 'src/runtime/grow/scanGrowType.js';
 *
 *   tagScanWithGrowType({ scanResult, plantHint })
 *
 * What this is
 * ────────────
 *   The existing wave-1 scan pipeline (Plant.id classifier +
 *   ScanRuntime) returns a crop-shaped envelope. Phase 7 expands
 *   the scope to flower / houseplant / vegetable / fruit / herb,
 *   but the upstream classifier doesn't tag grow type natively.
 *
 *   This engine layers grow-type tagging on top of the existing
 *   envelope:
 *     1. If the resolved plantId hits the local plant DB, copy
 *        its `type` onto the envelope.
 *     2. If not, fall back to a name-matching heuristic against
 *        the DB.
 *     3. If still no hit, emit `growType: 'unknown'` and a
 *        `deferred` marker — never invent a confidence.
 *
 *   Returns a NEW frozen envelope; the original scanResult is
 *   not mutated. Composition-only.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Does NOT modify the wave-1 ScanRuntime or any wave-9
 *     intelligent scan engines.
 *   • Honest unknown when classifier output is ambiguous.
 */

import { findPlant, searchPlants } from '../../data/plants/index.js';

export const SCAN_GROW_TYPE_VERSION = 'scan-grow-type-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const SUPPORTED_GROW_TYPES = Object.freeze([
  'crop', 'flower', 'houseplant', 'vegetable', 'fruit', 'herb',
]);

function _resolvePlant(scanResult, plantHint) {
  // 1. explicit hint wins
  if (_str(plantHint)) {
    const p = findPlant(plantHint);
    if (p) return p;
  }
  // 2. scan envelope's plantId / id
  const pid = _str(scanResult && (scanResult.plantId || scanResult.id));
  if (pid) {
    const p = findPlant(pid);
    if (p) return p;
  }
  // 3. name-based search
  const name = _str(scanResult && (scanResult.name
    || scanResult.commonName || scanResult.label));
  if (name) {
    const hits = searchPlants(name, { limit: 1 });
    if (hits.length > 0) return hits[0];
  }
  return null;
}

export function tagScanWithGrowType(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    const scan = _isObj(c.scanResult) ? c.scanResult : {};
    const plant = _resolvePlant(scan, c.plantHint);

    if (plant && SUPPORTED_GROW_TYPES.indexOf(_str(plant.type)) !== -1) {
      return Object.freeze({
        runtimeVersion: SCAN_GROW_TYPE_VERSION,
        ...scan,
        plantId:        _str(plant.id),
        plantName:      _str(plant.name),
        scientificName: _str(plant.scientificName),
        growType:       _str(plant.type),
        growTypeSource: 'plant_db_match',
        plantData: Object.freeze({
          water: _str(plant.water),
          sun:   _str(plant.sun),
          indoor: !!plant.indoor,
        }),
      });
    }

    return Object.freeze({
      runtimeVersion: SCAN_GROW_TYPE_VERSION,
      ...scan,
      growType:       'unknown',
      growTypeSource: 'no_match',
      deferred: Object.freeze({
        classifier:
          'wave-1 scan pipeline classifies crops; non-crop '
          + 'classification (flowers / houseplants / fruits / herbs) '
          + 'requires expanded Plant.id model coverage or a separate '
          + 'classifier — currently honest-unknown.',
      }),
    });
  }, Object.freeze({
    runtimeVersion: SCAN_GROW_TYPE_VERSION,
    growType: 'unknown', growTypeSource: 'error',
  }));
}

export { SUPPORTED_GROW_TYPES };
