/**
 * runtime/grow/gardenMode.js — Phase 8 Farm-vs-Garden label
 * switcher.
 *
 *   import {
 *     resolveGardenMode, GARDEN_LABEL_MAP, GARDEN_MODE_VERSION,
 *   } from 'src/runtime/grow/gardenMode.js';
 *
 *   resolveGardenMode({ growType: 'flower' })
 *   → { mode: 'garden', labels: { home: 'Garden Home', ... } }
 *
 * What this is
 * ────────────
 *   The Farm-mode UX is unchanged. Garden mode swaps a small set
 *   of user-facing labels:
 *     Farm Progress  → Garden Progress
 *     Yield          → Bloom Success
 *     Field Tasks    → Garden Care
 *
 *   This engine does NOT switch routes or rewire pages — it
 *   returns a label envelope the UI may opt-into. Existing Farm
 *   labels remain canonical when growType is 'crop' or unset.
 *
 *   "No breaking changes" rule: the resolver defaults to Farm
 *   mode whenever the input is ambiguous. Garden mode is opt-in
 *   only.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — does NOT modify existing pages.
 *   • Falls back to Farm labels on any uncertainty.
 */

export const GARDEN_MODE_VERSION = 'garden-mode-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const GARDEN_GROW_TYPES = new Set([
  'flower', 'herb', 'houseplant', 'garden', 'greenhouse',
]);
const FARM_GROW_TYPES = new Set([
  'crop', 'vegetable', 'fruit',
]);

export const GARDEN_LABEL_MAP = Object.freeze({
  farm: Object.freeze({
    home:          { key: 'grow.label.farm.home',     def: 'Farm Home' },
    progress:      { key: 'grow.label.farm.progress', def: 'Farm Progress' },
    yieldOrBloom:  { key: 'grow.label.farm.yield',    def: 'Yield' },
    tasks:         { key: 'grow.label.farm.tasks',    def: 'Field Tasks' },
    healthScore:   { key: 'grow.label.farm.health',   def: 'Farm Health Score' },
  }),
  garden: Object.freeze({
    home:          { key: 'grow.label.garden.home',     def: 'Garden Home' },
    progress:      { key: 'grow.label.garden.progress', def: 'Garden Progress' },
    yieldOrBloom:  { key: 'grow.label.garden.bloom',    def: 'Bloom Success' },
    tasks:         { key: 'grow.label.garden.tasks',    def: 'Garden Care' },
    healthScore:   { key: 'grow.label.garden.health',   def: 'Garden Health Score' },
  }),
});

export function resolveGardenMode(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    const growType = _str(c.growType).toLowerCase();
    let mode = 'farm';
    if (GARDEN_GROW_TYPES.has(growType)) mode = 'garden';
    else if (FARM_GROW_TYPES.has(growType)) mode = 'farm';
    else if (c.modeOverride === 'garden') mode = 'garden';
    else if (c.modeOverride === 'farm')   mode = 'farm';
    return Object.freeze({
      runtimeVersion: GARDEN_MODE_VERSION,
      mode,
      labels: GARDEN_LABEL_MAP[mode],
      growType,
    });
  }, Object.freeze({
    runtimeVersion: GARDEN_MODE_VERSION,
    mode: 'farm',
    labels: GARDEN_LABEL_MAP.farm,
    growType: 'unknown',
  }));
}
