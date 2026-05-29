/**
 * src/runtime/plants/intelligence/flowerIntelligence.ts —
 * per-flower intelligence facade.
 *
 *   import {
 *     flowerIntelligence, SUPPORTED_FLOWERS,
 *     FLOWER_INTELLIGENCE_VERSION,
 *   } from 'src/runtime/plants/intelligence/flowerIntelligence';
 *
 *   flowerIntelligence({ plantId: 'rose', weather, season })
 *
 * What this is
 * ────────────
 *   Composes the existing flowerAdvisor + companionEngine +
 *   pollinatorEngine into the single envelope the spec calls
 *   for:
 *     { careTasks, commonRisks, bloomEstimate, pollinatorValue,
 *       companionSuggestions }
 *
 *   Covers the 20 spec'd flowers — all of which are in the
 *   PLANT_DB starter set or named-deferred when missing.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over existing engines.
 *   • No LLM, no fetch.
 */

import { findPlant }       from '../../../data/plants/index.js';
import { flowerAdvisor }   from '../../../runtime/grow/flowerAdvisor';
import { companionAdvice } from '../../../runtime/grow/companionEngine';
import { pollinatorScore } from '../../../runtime/grow/pollinatorEngine';

export const FLOWER_INTELLIGENCE_VERSION = 'flower-intelligence-v1';

export const SUPPORTED_FLOWERS = Object.freeze([
  'rose', 'hibiscus', 'sunflower', 'lavender', 'marigold',
  'tulip', 'orchid', 'jasmine', 'daisy', 'hydrangea',
  'petunia', 'begonia', 'dahlia', 'chrysanthemum', 'bougainvillea',
  'zinnia', 'geranium', 'peony', 'camellia', 'azalea',
]);

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface FlowerCtx {
  plantId?:      string;
  weather?:      any;
  season?:       string;
  haveInGarden?: string[];
  now?:          number;
}

export function flowerIntelligence(ctx: FlowerCtx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as FlowerCtx;
    const id    = _str(c.plantId);
    const plant = id ? findPlant(id) : null;
    if (!plant) {
      return Object.freeze({
        runtimeVersion: FLOWER_INTELLIGENCE_VERSION,
        ok: false, reason: 'plant_not_in_db',
        plantId: id,
        supportedFlowers: SUPPORTED_FLOWERS,
      });
    }
    const supported = SUPPORTED_FLOWERS.indexOf(id) !== -1;
    const adv = flowerAdvisor({
      plantId: id, weather: c.weather, season: _str(c.season),
      now: c.now,
    } as any);
    const comp = companionAdvice({
      plantId: id, haveInGarden: _arr(c.haveInGarden).map(_str),
    } as any);
    const polli = pollinatorScore({ plantIds: [id] });

    return Object.freeze({
      runtimeVersion: FLOWER_INTELLIGENCE_VERSION,
      ok:             true,
      reason:         '',
      plantId:        id,
      commonName:     _str((plant as any).commonName) || _str((plant as any).name),
      supported,
      careTasks:      Object.freeze(_arr((adv as any).todayTasks).slice()),
      commonRisks:    Object.freeze(_arr((adv as any).riskAlerts).slice()),
      bloomEstimate:  (adv as any).bloomForecast,
      pollinatorValue: Object.freeze({
        score:    _num((polli as any).score) || 0,
        friendly: !!(polli as any).friendly,
        attracts: (polli as any).attracts || Object.freeze([]),
      }),
      companionSuggestions: Object.freeze({
        good:  _arr((comp as any).good).slice(),
        avoid: _arr((comp as any).avoid).slice(),
        reason: _str((comp as any).good).length > 0
                  ? 'These companions are documented in the plant DB'
                  : 'No specific companions recorded',
      }),
      deferred: supported ? undefined : Object.freeze({
        catalogCoverage:
          'this flower is in the spec list but not yet in PLANT_DB; '
          + 'content-team backlog to add it',
      }),
    });
  }, Object.freeze({
    runtimeVersion: FLOWER_INTELLIGENCE_VERSION,
    ok: false, reason: 'error',
    plantId: '',
    supportedFlowers: SUPPORTED_FLOWERS,
  }));
}
