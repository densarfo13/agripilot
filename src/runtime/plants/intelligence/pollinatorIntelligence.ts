/**
 * src/runtime/plants/intelligence/pollinatorIntelligence.ts —
 * pollinator intelligence facade.
 *
 *   import {
 *     pollinatorIntelligence, POLLINATOR_HIGH_VALUE_PLANTS,
 *     POLLINATOR_INTELLIGENCE_VERSION,
 *   } from 'src/runtime/plants/intelligence/pollinatorIntelligence';
 *
 * What this is
 * ────────────
 *   Plant-runtime tier façade over the existing pollinatorEngine.
 *   Returns the spec'd envelope:
 *     { pollinatorScore: 0..100, attracts: ['bees', 'butterflies',
 *       'hummingbirds'], highValue: boolean }
 *
 *   The underlying engine returns a 0–10 score; this facade
 *   scales to 0–100 per spec.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only.
 *   • No fetch, no LLM.
 */

import { pollinatorScore } from '../../../runtime/grow/pollinatorEngine';

export const POLLINATOR_INTELLIGENCE_VERSION = 'pollinator-intelligence-v1';

export const POLLINATOR_HIGH_VALUE_PLANTS = Object.freeze([
  'lavender', 'sunflower', 'bee_balm', 'salvia',
  'zinnia', 'coneflower', 'marigold', 'hibiscus',
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

interface PollinatorCtx {
  plantId?:    string;
  plantIds?:   string[];   // for multi-plant garden score
}

export function pollinatorIntelligence(ctx: PollinatorCtx) {
  return _safe(() => {
    const c   = _isObj(ctx) ? ctx : {} as PollinatorCtx;
    const ids = _arr(c.plantIds).length > 0
      ? _arr(c.plantIds).map(_str)
      : (_str(c.plantId) ? [_str(c.plantId)] : []);
    if (ids.length === 0) {
      return Object.freeze({
        runtimeVersion: POLLINATOR_INTELLIGENCE_VERSION,
        ok: false, reason: 'no_plant_ids',
        highValuePlants: POLLINATOR_HIGH_VALUE_PLANTS,
      });
    }
    const env = pollinatorScore({ plantIds: ids });
    // Engine returns 0–10; spec wants 0–100.
    const score10 = _num((env as any).score) || 0;
    const score100 = Math.max(0, Math.min(100, Math.round(score10 * 10)));
    const attracts = _arr((env as any).attracts).map(_str);
    const highValue = ids.some((id) =>
      POLLINATOR_HIGH_VALUE_PLANTS.indexOf(id) !== -1);
    return Object.freeze({
      runtimeVersion:  POLLINATOR_INTELLIGENCE_VERSION,
      ok:              true,
      reason:          '',
      plantIds:        Object.freeze(ids),
      pollinatorScore: score100,
      friendly:        !!(env as any).friendly,
      attracts:        Object.freeze(attracts),
      highValue,
      highValuePlants: POLLINATOR_HIGH_VALUE_PLANTS,
    });
  }, Object.freeze({
    runtimeVersion: POLLINATOR_INTELLIGENCE_VERSION,
    ok: false, reason: 'error',
    pollinatorScore: 0,
    attracts: Object.freeze([]),
    highValuePlants: POLLINATOR_HIGH_VALUE_PLANTS,
  }));
}
