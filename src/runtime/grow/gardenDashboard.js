/**
 * runtime/grow/gardenDashboard.js — Phase 14 dashboard cards
 * composer.
 *
 *   import { composeGardenDashboard, GARDEN_DASHBOARD_VERSION }
 *     from 'src/runtime/grow/gardenDashboard.js';
 *
 *   composeGardenDashboard({ plants: [...], indoorCare: [...] })
 *   → {
 *       cards: { count, flowers, vegetables, fruits, indoor },
 *       scores: { growth, health, bloom },
 *     }
 *
 * What this is
 * ────────────
 *   Aggregates per-plant signals into the spec'd dashboard cards:
 *     🌱 Plant Count, 🌹 Flowers, 🍅 Vegetables, 🍎 Fruits,
 *     🪴 Indoor Plants
 *   Plus 3 aggregate scores: growth, health, bloom.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — reads injected plant + care state.
 *   • Honest 0 / 'unknown' on missing input.
 */

import { findPlant } from '../../data/plants/index.js';

export const GARDEN_DASHBOARD_VERSION = 'garden-dashboard-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _expandPlant(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return findPlant(entry);
  if (_isObj(entry)) {
    if (entry.type) return entry;
    return findPlant(_str(entry.id) || _str(entry.plantId));
  }
  return null;
}

function _avg(arr) {
  if (arr.length === 0) return null;
  let sum = 0; let n = 0;
  for (const v of arr) {
    const x = _num(v);
    if (x == null) continue;
    sum += x; n++;
  }
  return n === 0 ? null : sum / n;
}

export function composeGardenDashboard(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    const raw = _arr(c.plants);
    const expanded = raw.map(_expandPlant).filter(Boolean);

    const cards = {
      count:      expanded.length,
      flowers:    expanded.filter((p) => p.type === 'flower').length,
      vegetables: expanded.filter((p) => p.type === 'vegetable').length,
      fruits:     expanded.filter((p) => p.type === 'fruit').length,
      herbs:      expanded.filter((p) => p.type === 'herb').length,
      indoor:     expanded.filter((p) => p.type === 'houseplant').length,
    };

    // Growth score — placeholder unless growthDays + plantedAt signals
    // are injected. We compute a "garden maturity" proxy from plant
    // count + variety.
    const variety = new Set(expanded.map((p) => _str(p.type))).size;
    const growth  = expanded.length === 0
      ? null
      : Math.min(100, Math.round(
          (expanded.length * 5) + (variety * 8)));

    // Health score — average of injected per-plant health scores
    const healthList = _arr(c.healthScores).map(_num).filter((v) => v != null);
    const health     = healthList.length === 0 ? null
                     : Math.round(_avg(healthList));

    // Bloom score — share of flowering plants currently in bloom season
    const bloomList = _arr(c.bloomScores).map(_num).filter((v) => v != null);
    const bloom     = bloomList.length === 0 ? null
                    : Math.round(_avg(bloomList));

    return Object.freeze({
      runtimeVersion: GARDEN_DASHBOARD_VERSION,
      cards: Object.freeze(cards),
      scores: Object.freeze({
        growth: growth, health: health, bloom: bloom,
      }),
      variety,
    });
  }, Object.freeze({
    runtimeVersion: GARDEN_DASHBOARD_VERSION,
    cards: Object.freeze({
      count: 0, flowers: 0, vegetables: 0, fruits: 0, herbs: 0, indoor: 0,
    }),
    scores: Object.freeze({ growth: null, health: null, bloom: null }),
    variety: 0,
  }));
}
