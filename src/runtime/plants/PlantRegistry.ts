/**
 * src/runtime/plants/PlantRegistry.ts — managed-plant registry
 * (runtime layer).
 *
 *   import {
 *     registryAddPlant, registryUpdatePlant, registryRemovePlant,
 *     registryListByCategory, registrySummary,
 *     PLANT_REGISTRY_RUNTIME_VERSION,
 *   } from 'src/runtime/plants/PlantRegistry';
 *
 *   const next = registryAddPlant(prevList, newPlant);
 *
 * What this is
 * ────────────
 *   The runtime-tier registry. Pure functional helpers over a
 *   caller-owned list of ManagedPlant records — no module state.
 *
 *   The catalog-tier registry (src/modules/plants/PlantRegistry.ts)
 *   handles DB lookup + scan-registration payloads. This runtime
 *   handles MANAGED PLANT records the user has actually added.
 *
 *   Every mutating helper returns a NEW frozen list. The original
 *   list is never modified. The wave-5 single-writer invariant
 *   means persistence stays with the caller — these helpers feed
 *   their output back to the journal store.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence writes.
 *   • Composition-only.
 */

import {
  ManagedPlant, freezePlant,
} from './PlantRuntime';
import {
  PLANT_CATEGORIES, PLANT_CATEGORY_META,
} from '../../modules/plants/plantCategories';

export const PLANT_REGISTRY_RUNTIME_VERSION = 'plant-registry-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _normalizeList(list: unknown): ManagedPlant[] {
  return _arr(list).map(freezePlant).filter(
    (p): p is ManagedPlant => p != null
  );
}

export function registryAddPlant(list: ManagedPlant[],
                                  plant: ManagedPlant) {
  return _safe(() => {
    if (!_isObj(plant)) return Object.freeze(_normalizeList(list));
    const normalized = _normalizeList(list);
    // Dedupe by id — adding a plant with the same id replaces.
    const filtered = normalized.filter((p) => p.id !== plant.id);
    return Object.freeze(filtered.concat([plant]));
  }, Object.freeze(_normalizeList(list)));
}

export function registryUpdatePlant(list: ManagedPlant[],
                                     id: string,
                                     patch: Partial<ManagedPlant>) {
  return _safe(() => {
    const normalized = _normalizeList(list);
    let touched = false;
    const next = normalized.map((p) => {
      if (p.id !== id) return p;
      touched = true;
      return freezePlant({ ...p, ...(patch || {}) }) as ManagedPlant;
    });
    return Object.freeze(touched ? next : normalized);
  }, Object.freeze(_normalizeList(list)));
}

export function registryRemovePlant(list: ManagedPlant[],
                                     id: string) {
  return _safe(() => {
    return Object.freeze(_normalizeList(list).filter((p) => p.id !== id));
  }, Object.freeze(_normalizeList(list)));
}

export function registryFindPlant(list: ManagedPlant[], id: string) {
  return _safe(() => {
    return _normalizeList(list).find((p) => p.id === id) || null;
  }, null);
}

export function registryListByCategory(list: ManagedPlant[]) {
  return _safe(() => {
    const normalized = _normalizeList(list);
    const buckets: Record<string, ManagedPlant[]> = {};
    for (const c of PLANT_CATEGORIES) buckets[c] = [];
    for (const p of normalized) {
      if (buckets[p.category] != null) buckets[p.category].push(p);
    }
    const out: any = {};
    for (const c of PLANT_CATEGORIES) {
      out[c] = Object.freeze(buckets[c]);
    }
    return Object.freeze(out);
  }, Object.freeze({}));
}

/**
 * Summary — counts + average health per category, plus an
 * `alerts` count (plants with riskScore >= 60 OR healthScore < 50).
 * Used by the MyPlants UI to render the section headers.
 */
export function registrySummary(list: ManagedPlant[]) {
  return _safe(() => {
    const normalized = _normalizeList(list);
    const byCat = registryListByCategory(normalized);
    const sections: any[] = [];
    let totalAlerts = 0;
    let totalCount = 0;
    let totalHealthSum = 0;
    let totalHealthN = 0;
    for (const c of PLANT_CATEGORIES) {
      const arr = (byCat as any)[c] as ManagedPlant[];
      let healthSum = 0; let healthN = 0; let alerts = 0;
      for (const p of arr) {
        healthSum += p.healthScore;
        healthN++;
        if (p.riskScore >= 60 || p.healthScore < 50) alerts++;
      }
      totalCount += arr.length;
      totalHealthSum += healthSum;
      totalHealthN += healthN;
      totalAlerts += alerts;
      sections.push(Object.freeze({
        category: c,
        icon: PLANT_CATEGORY_META[c].icon,
        labelKey: PLANT_CATEGORY_META[c].labelKey,
        labelDefault: PLANT_CATEGORY_META[c].labelDefault,
        count:    arr.length,
        avgHealth: healthN === 0 ? null
                  : Math.round(healthSum / healthN),
        alerts,
      }));
    }
    return Object.freeze({
      runtimeVersion: PLANT_REGISTRY_RUNTIME_VERSION,
      sections: Object.freeze(sections),
      totalCount,
      totalAlerts,
      avgHealthOverall: totalHealthN === 0 ? null
                       : Math.round(totalHealthSum / totalHealthN),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_REGISTRY_RUNTIME_VERSION,
    sections: Object.freeze([]),
    totalCount: 0, totalAlerts: 0, avgHealthOverall: null,
  }));
}
