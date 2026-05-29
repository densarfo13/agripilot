/**
 * runtime/grow/companionEngine.ts — Phase 5 companion planting.
 *
 *   import { companionAdvice }
 *     from 'src/runtime/grow/companionEngine';
 *
 *   companionAdvice({ plantId: 'tomato' })
 *   → { good: ['basil', 'marigold', ...], avoid: ['potato', ...] }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Reads plant DB only.
 */

import { findPlant, PLANT_DB } from '../../data/plants/index.js';

export const COMPANION_ENGINE_VERSION = 'companion-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _expandPlant(id: string) {
  const p = findPlant(id);
  return p ? Object.freeze({
    id: _str(p.id), name: _str(p.name), type: _str(p.type),
  }) : Object.freeze({ id: _str(id), name: '', type: '' });
}

interface CompanionCtx {
  plantId?: string;
  plant?: any;
  haveInGarden?: string[]; // optional — flags conflicts vs your current set
}

export function companionAdvice(ctx: CompanionCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as CompanionCtx;
    const plant = c.plant || (_str(c.plantId) ? findPlant(c.plantId) : null);
    if (!plant) {
      return Object.freeze({
        runtimeVersion: COMPANION_ENGINE_VERSION,
        plantId: _str(c.plantId), found: false,
        good:    Object.freeze([]),
        avoid:   Object.freeze([]),
        conflictsInGarden: Object.freeze([]),
        synergyInGarden:   Object.freeze([]),
      });
    }
    const good  = _arr(plant.companionPlants).map((id) => _expandPlant(id));
    const avoid = _arr(plant.avoidPlants).map((id) => _expandPlant(id));

    const have = new Set(_arr(c.haveInGarden).map(_str));
    const conflictsInGarden = avoid.filter((p) => have.has(p.id));
    const synergyInGarden   = good.filter((p) => have.has(p.id));

    return Object.freeze({
      runtimeVersion: COMPANION_ENGINE_VERSION,
      plantId: _str(plant.id), found: true,
      good:    Object.freeze(good),
      avoid:   Object.freeze(avoid),
      conflictsInGarden: Object.freeze(conflictsInGarden),
      synergyInGarden:   Object.freeze(synergyInGarden),
    });
  }, Object.freeze({
    runtimeVersion: COMPANION_ENGINE_VERSION,
    plantId: '', found: false,
    good: Object.freeze([]), avoid: Object.freeze([]),
    conflictsInGarden: Object.freeze([]),
    synergyInGarden:   Object.freeze([]),
  }));
}

/**
 * Suggest plants that would synergize with the given set (max 5).
 * Each suggestion is a plant from the DB that appears in the
 * `companionPlants` list of at least one member of the set, and
 * is not already a member.
 */
export function suggestCompanionsForGarden(plantIds: string[]) {
  return _safe(() => {
    const have = new Set(_arr(plantIds).map(_str));
    const score: Record<string, number> = {};
    for (const id of have) {
      const p = findPlant(id);
      if (!p) continue;
      for (const c of _arr(p.companionPlants)) {
        const cid = _str(c);
        if (!cid || have.has(cid)) continue;
        score[cid] = (score[cid] || 0) + 1;
      }
    }
    const ranked = Object.keys(score)
      .sort((a, b) => score[b] - score[a])
      .slice(0, 5)
      .map((id) => Object.freeze({
        ..._expandPlant(id), synergyCount: score[id],
      }));
    return Object.freeze({
      runtimeVersion: COMPANION_ENGINE_VERSION,
      suggestions: Object.freeze(ranked),
    });
  }, Object.freeze({
    runtimeVersion: COMPANION_ENGINE_VERSION,
    suggestions: Object.freeze([]),
  }));
}

// Silence unused-import lint when consumed only via re-export
export const _internals = Object.freeze({ PLANT_DB_REF: PLANT_DB });
