/**
 * src/runtime/plants/PlantRuntime.ts — Universal Plant Runtime
 * keystone.
 *
 *   import {
 *     createManagedPlant, updateManagedPlant, freezePlant,
 *     PLANT_RUNTIME_VERSION, ManagedPlant,
 *   } from 'src/runtime/plants/PlantRuntime';
 *
 *   const plant = createManagedPlant({
 *     scanResult, ownerId, location, growType,
 *   });
 *
 * What this is
 * ────────────
 *   The orchestrator that converts a scan/import/manual entry
 *   into a Farroway-managed Plant record. The shape is:
 *
 *     interface Plant {
 *       id, commonName, scientificName,
 *       category, subtype, growType, growthStage,
 *       healthScore, riskScore,
 *       location, scans[], tasks[], history[],
 *       createdAt, updatedAt,
 *     }
 *
 *   This file owns the SHAPE + transition functions; the
 *   PlantRegistry composes it. Records are immutable — every
 *   write returns a new frozen copy. The wave-5 single-writer
 *   invariant is preserved: this runtime emits records, the
 *   caller persists them.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over the modules/plants catalog.
 *   • No fetch. No persistence writes. No PII (location carries
 *     regionLabel only).
 */

import { findPlant }            from '../../data/plants/index.js';
import { registerPlantFromScan } from '../../modules/plants/PlantRegistry';
import { PLANT_CATEGORIES }     from '../../modules/plants/plantCategories';

export const PLANT_RUNTIME_VERSION = 'plant-runtime-v1';

export interface ManagedPlant {
  id:             string;
  commonName:     string;
  scientificName: string;
  category:       string;       // one of PLANT_CATEGORIES
  subtype:        string;       // family (Rosaceae, Solanaceae, ...)
  growType:       string;       // user-facing grow type
  growthStage:    string;       // seed/sprout/.../harvest/unknown
  // Sprint A — spec uses `lifecycleStage`; carried as a stable
  // alias of growthStage so callers can read either name. The two
  // fields are kept in sync by freezePlant + advancePlantStage.
  lifecycleStage: string;
  healthScore:    number;       // 0..100
  riskScore:      number;       // 0..100 (inverse of health-derived)
  location:       { regionLabel: string };
  scans:          ReadonlyArray<any>;
  tasks:          ReadonlyArray<any>;
  history:        ReadonlyArray<any>;
  createdAt:      string;
  updatedAt:      string;
  schemaVersion:  string;
}

/* ── Sprint A governance manifest ───────────────────────────────
 * Documents the ownership boundaries the spec calls out. Engines
 * read it; the CI gate verifies it stays in sync with reality.
 * Any future runtime that wants to do plant work MUST go through
 * this runtime (no direct findPlant + setState from UI).
 */
export const PLANT_RUNTIME_OWNERSHIP = Object.freeze({
  plantRuntime: Object.freeze([
    'plant_state',
    'plant_health',
    'plant_lifecycle',
    'plant_memory',
  ]),
  scanRuntime: Object.freeze([
    'camera',
    'upload',
    'plant_id_classifier',
  ]),
  farmRuntime: Object.freeze([
    'farm_selection',
    'garden_selection',
  ]),
  // Explicit non-ownership notes for clarity.
  notes: Object.freeze({
    persistence:
      'Persistence belongs to the wave-5 single-writer (journal '
      + 'store + scanPersistenceBridge). Engines never write to '
      + 'storage.',
    rendering:
      'UI components own rendering; engines never touch the DOM '
      + 'or React state.',
  }),
});

const SCHEMA_VERSION = 'plant-managed-v1';
const _validCategories = new Set<string>(PLANT_CATEGORIES as readonly string[]);

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface CreateCtx {
  plantId?:   string;
  scanResult?: any;
  ownerId?:   string;
  growType?:  string;
  location?:  { regionLabel?: string };
  now?:       number;
  // when caller already has computed signals — optional overrides
  healthScore?: number;
  riskScore?:   number;
  growthStage?: string;
  initialTasks?: any[];
}

export function freezePlant(p: any): ManagedPlant | null {
  if (!_isObj(p)) return null;
  // Sprint A — lifecycleStage is a stable alias of growthStage.
  // Caller may write either; we copy from whichever is set and
  // keep them in sync on the way out.
  const stage = _str(p.lifecycleStage) || _str(p.growthStage) || 'unknown';
  return Object.freeze({
    id:             _str(p.id),
    commonName:     _str(p.commonName),
    scientificName: _str(p.scientificName),
    category:       _str(p.category),
    subtype:        _str(p.subtype),
    growType:       _str(p.growType),
    growthStage:    stage,
    lifecycleStage: stage,
    healthScore:    _num(p.healthScore)  ?? 0,
    riskScore:      _num(p.riskScore)    ?? 0,
    location:       Object.freeze({
      regionLabel: _str(p.location && p.location.regionLabel),
    }),
    scans:          Object.freeze(_arr(p.scans).slice()),
    tasks:          Object.freeze(_arr(p.tasks).slice()),
    history:        Object.freeze(_arr(p.history).slice()),
    createdAt:      _str(p.createdAt),
    updatedAt:      _str(p.updatedAt),
    schemaVersion:  SCHEMA_VERSION,
  }) as ManagedPlant;
}

/**
 * Create a managed plant from a scan envelope OR an explicit
 * plantId. Returns the frozen record + an `ok` flag.
 */
export function createManagedPlant(ctx: CreateCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as CreateCtx;
    const pid = _str(c.plantId)
      || (_isObj(c.scanResult) ? _str(c.scanResult.plantId) : '');
    const catalog = pid ? findPlant(pid) : null;
    if (!catalog) {
      return Object.freeze({
        runtimeVersion: PLANT_RUNTIME_VERSION,
        ok: false, reason: 'plant_not_in_catalog',
        plantId: pid,
      });
    }
    const category = _validCategories.has(_str((catalog as any).type))
      ? _str((catalog as any).type)
      : 'unknown';
    const now = _str(_safe(() => new Date(_num(c.now) || Date.now()).toISOString(), ''));
    // Stable record id derived from plantId + ownerId + createdAt
    const recordId = 'plant_' + _hash(
      _str(c.ownerId) + '|' + _str(pid) + '|' + now
    );
    const regResult = c.scanResult
      ? registerPlantFromScan({
          scanResult: c.scanResult,
          ownerId: c.ownerId,
          location: c.location,
        } as any)
      : null;
    const initialHistory = regResult && (regResult as any).ok
      ? [Object.freeze({
          kind: 'registered_from_scan',
          at:   now,
          scanId: _str((c.scanResult && c.scanResult.scanId) || ''),
        })]
      : [Object.freeze({ kind: 'created_manually', at: now })];

    const seedStage = _str(c.growthStage) || 'vegetative';
    const managed: ManagedPlant = Object.freeze({
      id:             recordId,
      commonName:     _str((catalog as any).commonName)
                       || _str((catalog as any).name),
      scientificName: _str((catalog as any).scientificName),
      category,
      subtype:        _str((catalog as any).family),
      growType:       _str(c.growType) || category,
      growthStage:    seedStage,
      lifecycleStage: seedStage,
      healthScore:    _num(c.healthScore) ?? 0,
      riskScore:      _num(c.riskScore)   ?? 0,
      location:       Object.freeze({
        regionLabel: _str(c.location && c.location.regionLabel),
      }),
      scans:          Object.freeze(c.scanResult
                                    ? [Object.freeze(c.scanResult)]
                                    : []),
      tasks:          Object.freeze(_arr(c.initialTasks).slice()),
      history:        Object.freeze(initialHistory),
      createdAt:      now,
      updatedAt:      now,
      schemaVersion:  SCHEMA_VERSION,
    });
    return Object.freeze({
      runtimeVersion: PLANT_RUNTIME_VERSION,
      ok: true, reason: '',
      plant: managed,
      registration: regResult,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_RUNTIME_VERSION,
    ok: false, reason: 'error',
  }));
}

/**
 * Immutable update — returns a new frozen Plant with patch
 * applied; original record is never mutated. Caller persists.
 */
export function updateManagedPlant(plant: ManagedPlant,
                                    patch: Partial<ManagedPlant>) {
  return _safe(() => {
    if (!_isObj(plant)) return null;
    const merged: any = { ...plant, ...(patch || {}) };
    merged.updatedAt = _now();
    return freezePlant(merged);
  }, plant);
}

/**
 * Append-only — adds an entry to the plant's history list and
 * stamps updatedAt. Used by every other engine in the runtime.
 */
export function appendPlantHistory(plant: ManagedPlant,
                                    entry: { kind: string; at?: string }) {
  return _safe(() => {
    if (!_isObj(plant)) return plant;
    const at = _str((entry && entry.at)) || _now();
    const hist = (plant.history || []).concat([Object.freeze({
      ...(entry || { kind: 'unknown' }),
      at,
    })]);
    return freezePlant({ ...plant, history: hist, updatedAt: _now() });
  }, plant);
}

export { PLANT_CATEGORIES };
export const PLANT_SCHEMA_VERSION = SCHEMA_VERSION;
