/**
 * runtime/grow/multiGarden.js — Phase 15 multi-garden state.
 *
 *   import {
 *     resolveActiveGarden, GARDEN_KINDS, MULTI_GARDEN_VERSION,
 *   } from 'src/runtime/grow/multiGarden.js';
 *
 *   resolveActiveGarden({ gardens, activeGardenId })
 *   → { active, kindLabel, count, available }
 *
 * What this is
 * ────────────
 *   Pure compute of "which garden is active right now" given an
 *   array of caller-stored garden records. The actual persistence
 *   of the garden list is the caller's responsibility (wave-5
 *   single-writer invariant).
 *
 *   Supported kinds (Phase 15 spec):
 *     backyard, indoor, flower_bed, greenhouse, vegetable_patch
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence writes.
 *   • Frozen envelopes.
 */

export const MULTI_GARDEN_VERSION = 'multi-garden-v1';

export const GARDEN_KINDS = Object.freeze({
  BACKYARD:        'backyard',
  INDOOR:          'indoor',
  FLOWER_BED:      'flower_bed',
  GREENHOUSE:      'greenhouse',
  VEGETABLE_PATCH: 'vegetable_patch',
});

const KIND_LABELS = Object.freeze({
  backyard:        { key: 'grow.garden.kind.backyard',
                     def: 'Backyard Garden' },
  indoor:          { key: 'grow.garden.kind.indoor',
                     def: 'Indoor Garden' },
  flower_bed:      { key: 'grow.garden.kind.flowerBed',
                     def: 'Flower Bed' },
  greenhouse:      { key: 'grow.garden.kind.greenhouse',
                     def: 'Greenhouse' },
  vegetable_patch: { key: 'grow.garden.kind.vegPatch',
                     def: 'Vegetable Patch' },
});

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const _validKindSet = new Set(Object.values(GARDEN_KINDS));

function _normalizeGarden(raw) {
  if (!_isObj(raw)) return null;
  const kind = _str(raw.kind);
  if (!_validKindSet.has(kind)) return null;
  return Object.freeze({
    id:        _str(raw.id) || _str(raw.gardenId),
    name:      _str(raw.name),
    kind,
    kindLabel: KIND_LABELS[kind],
    plantCount: Array.isArray(raw.plantIds) ? raw.plantIds.length
              : (typeof raw.plantCount === 'number' ? raw.plantCount : 0),
    indoor:    kind === 'indoor' || kind === 'greenhouse',
  });
}

export function resolveActiveGarden(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    const gardens = _arr(c.gardens).map(_normalizeGarden).filter(Boolean);
    if (gardens.length === 0) {
      return Object.freeze({
        runtimeVersion: MULTI_GARDEN_VERSION,
        active:         null,
        count:          0,
        available:      Object.freeze([]),
      });
    }
    const activeId = _str(c.activeGardenId);
    const active   = (activeId
      ? gardens.find((g) => g.id === activeId)
      : null) || gardens[0];

    return Object.freeze({
      runtimeVersion: MULTI_GARDEN_VERSION,
      active,
      count:     gardens.length,
      available: Object.freeze(gardens),
    });
  }, Object.freeze({
    runtimeVersion: MULTI_GARDEN_VERSION,
    active: null, count: 0, available: Object.freeze([]),
  }));
}

export { KIND_LABELS as GARDEN_KIND_LABELS };
