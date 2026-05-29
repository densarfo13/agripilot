/**
 * src/runtime/plants/intelligence/companionPlanting.ts —
 * companion planting facade.
 *
 *   import {
 *     companionPlanting, COMPANION_PLANTING_VERSION,
 *   } from 'src/runtime/plants/intelligence/companionPlanting';
 *
 *   companionPlanting({ plantId: 'tomato', haveInGarden })
 *
 * What this is
 * ────────────
 *   Plant-runtime tier façade over the existing companionEngine
 *   from src/runtime/grow. Returns the spec'd envelope:
 *     { goodCompanions, avoidCompanions, reason }
 *
 *   Carries a per-pair "reason" string the spec asks for, derived
 *   from the plant DB tags (e.g. "marigold repels nematodes").
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over companionEngine.
 *   • No fetch, no LLM.
 */

import { companionAdvice }
  from '../../../runtime/grow/companionEngine';
import { findPlant } from '../../../data/plants/index.js';

export const COMPANION_PLANTING_VERSION = 'companion-planting-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _reasonForPair(targetPlant: any, companion: any): string {
  if (!_isObj(targetPlant) || !_isObj(companion)) return '';
  const repels = _arr(companion.repels).map(_str);
  const diseases = _arr(targetPlant.diseases).map(_str);
  // The most useful reason — companion repels something the
  // target plant is susceptible to.
  for (const r of repels) {
    if (diseases.indexOf(r) !== -1) {
      return companion.commonName + ' or ' + companion.name
        + ' repels ' + r + ', which affects ' + targetPlant.commonName;
    }
    if (r) return companion.name + ' repels ' + r;
  }
  // Attracts pollinators
  const attracts = _arr(companion.attracts).map(_str);
  if (attracts.length > 0) {
    return companion.name + ' attracts '
      + attracts.slice(0, 2).join(', ');
  }
  return 'Documented as a good companion in the plant DB';
}

function _reasonForAvoid(targetPlant: any, avoidPlant: any): string {
  if (!_isObj(targetPlant) || !_isObj(avoidPlant)) return '';
  return _str(avoidPlant.commonName) + ' competes with '
    + _str(targetPlant.commonName) + ' for nutrients or '
    + 'attracts shared pests';
}

interface CompanionCtx {
  plantId?:      string;
  haveInGarden?: string[];
}

export function companionPlanting(ctx: CompanionCtx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as CompanionCtx;
    const id    = _str(c.plantId);
    const plant = id ? findPlant(id) : null;
    if (!plant) {
      return Object.freeze({
        runtimeVersion: COMPANION_PLANTING_VERSION,
        ok: false, reason: 'plant_not_in_db',
        plantId: id,
      });
    }
    const env = companionAdvice({
      plantId: id, haveInGarden: _arr(c.haveInGarden).map(_str),
    } as any);
    const good  = _arr((env as any).good);
    const avoid = _arr((env as any).avoid);
    const goodCompanions = good.map((g) => {
      const cp = findPlant(_str(g.id));
      return Object.freeze({
        id:         _str(g.id),
        commonName: _str(g.name) || _str((cp as any).commonName),
        reason:     _reasonForPair(plant, cp),
      });
    });
    const avoidCompanions = avoid.map((a) => {
      const cp = findPlant(_str(a.id));
      return Object.freeze({
        id:         _str(a.id),
        commonName: _str(a.name) || _str((cp as any).commonName),
        reason:     _reasonForAvoid(plant, cp),
      });
    });
    return Object.freeze({
      runtimeVersion: COMPANION_PLANTING_VERSION,
      ok:             true,
      reason:         '',
      plantId:        id,
      goodCompanions: Object.freeze(goodCompanions),
      avoidCompanions: Object.freeze(avoidCompanions),
      conflictsInGarden: (env as any).conflictsInGarden,
      synergyInGarden:   (env as any).synergyInGarden,
    });
  }, Object.freeze({
    runtimeVersion: COMPANION_PLANTING_VERSION,
    ok: false, reason: 'error',
    plantId: '',
    goodCompanions: Object.freeze([]),
    avoidCompanions: Object.freeze([]),
  }));
}
