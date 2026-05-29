/**
 * runtime/grow/pollinatorEngine.ts — Phase 6 pollinator
 * intelligence.
 *
 *   import { pollinatorScore }
 *     from 'src/runtime/grow/pollinatorEngine';
 *
 *   pollinatorScore({ plantIds: ['rose', 'lavender'] })
 *   → { score: 9.2, attracts: ['bees', 'butterflies', ...] }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Reads plant DB only.
 */

import { findPlant } from '../../data/plants/index.js';

export const POLLINATOR_ENGINE_VERSION = 'pollinator-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const POLLINATOR_WEIGHTS: Record<string, number> = {
  bees: 3,
  butterflies: 2.5,
  swallowtail_butterflies: 2.5,
  hummingbirds: 2.5,
  birds: 1,
  ladybugs: 1,
  beneficial_wasps: 1,
};

export const POLLINATOR_CATEGORIES = Object.freeze([
  'bees', 'butterflies', 'hummingbirds', 'birds',
  'ladybugs', 'beneficial_wasps',
]);

interface PollinatorCtx {
  plantIds?: string[];
  plants?: any[];
}

function _scoreOne(plant: any): { score: number; attracts: string[] } {
  if (!_isObj(plant)) return { score: 0, attracts: [] };
  const attractsList = _arr(plant.attracts).map(_str);
  let score = 0;
  for (const a of attractsList) {
    score += POLLINATOR_WEIGHTS[a] != null
      ? POLLINATOR_WEIGHTS[a] : 0.5;
  }
  return { score, attracts: attractsList };
}

export function pollinatorScore(ctx: PollinatorCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as PollinatorCtx;
    const list = _arr(c.plants).length > 0
      ? _arr(c.plants)
      : _arr(c.plantIds).map((id) => findPlant(_str(id))).filter(Boolean);

    if (list.length === 0) {
      return Object.freeze({
        runtimeVersion: POLLINATOR_ENGINE_VERSION,
        score: 0, friendly: false,
        attracts: Object.freeze([]),
        contributors: Object.freeze([]),
      });
    }

    const seen = new Set<string>();
    const contributors: any[] = [];
    let totalScore = 0;
    for (const p of list) {
      const { score, attracts } = _scoreOne(p);
      totalScore += score;
      for (const a of attracts) seen.add(a);
      if (score > 0) {
        contributors.push(Object.freeze({
          plantId: _str(p.id), score: Math.round(score * 10) / 10,
        }));
      }
    }
    contributors.sort((a, b) => b.score - a.score);

    // Average score per plant, scaled to /10
    const avg = totalScore / list.length;
    const finalScore = Math.min(10, Math.round(avg * 10) / 10);
    const friendly = finalScore >= 5;

    return Object.freeze({
      runtimeVersion: POLLINATOR_ENGINE_VERSION,
      score:    finalScore,
      friendly,
      attracts: Object.freeze(Array.from(seen).sort()),
      contributors: Object.freeze(contributors.slice(0, 10)),
    });
  }, Object.freeze({
    runtimeVersion: POLLINATOR_ENGINE_VERSION,
    score: 0, friendly: false,
    attracts: Object.freeze([]),
    contributors: Object.freeze([]),
  }));
}
