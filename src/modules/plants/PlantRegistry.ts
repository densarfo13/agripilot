/**
 * src/modules/plants/PlantRegistry.ts — central plant registry.
 *
 *   import {
 *     plantRegistry, registerPlantFromScan, lookupPlant,
 *     PLANT_REGISTRY_VERSION,
 *   } from 'src/modules/plants/PlantRegistry';
 *
 *   plantRegistry()
 *     → { totalKnown, byCategory, specTarget, deferred, ... }
 *
 *   registerPlantFromScan({ scanResult, ownerId, location })
 *     → caller-ready payload for journal save
 *
 * What this is
 * ────────────
 *   The catalog / registration surface for the Global Plant
 *   Intelligence Platform. The platform's success criterion is
 *   "any plant identified by Scan can instantly become a managed
 *   plant with tasks, health tracking, recommendations, history."
 *   This file owns the IDENTIFY → REGISTER half of that
 *   contract — the actual persistence stays with the wave-5
 *   single-writer (caller saves the returned payload via the
 *   journal store).
 *
 *   Lookup is delegated to findPlant; registration produces a
 *   stable shape the caller can pass straight to the existing
 *   journal + today-task pipeline.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — no engine modified.
 *   • No fetch, no persistence writes.
 *   • No PII — owner ids stay opaque IDs; we never carry
 *     name/email/phone through this layer.
 */

import {
  PLANT_DB, PLANT_DB_STATS, findPlant,
} from '../../data/plants/index.js';
import {
  PLANT_CATEGORIES, PLANT_CATEGORY_META, MIN_LAUNCH_TOTAL,
} from './plantCategories';

export const PLANT_REGISTRY_VERSION = 'plant-registry-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

function _identityForPlant(plant: any) {
  return Object.freeze({
    id:             _str(plant.id),
    commonName:     _str(plant.commonName) || _str(plant.name),
    scientificName: _str(plant.scientificName),
    family:         _str(plant.family),
    category:       _str(plant.type),
    lifecycle:      _str(plant.lifecycle),
    growthDays:     _num(plant.growthDays),
    indoor:         !!plant.indoor || !!plant.indoorFriendly,
    image:          _str(plant.image),
  });
}

export function lookupPlant(idOrCtx: any) {
  return _safe(() => {
    const id = _isObj(idOrCtx) ? _str(idOrCtx.plantId) : _str(idOrCtx);
    const p  = id ? findPlant(id) : null;
    if (!p) {
      return Object.freeze({
        runtimeVersion: PLANT_REGISTRY_VERSION,
        ok: false, reason: 'not_found',
        plantId: id,
      });
    }
    return Object.freeze({
      runtimeVersion: PLANT_REGISTRY_VERSION,
      ok: true, reason: '',
      identity: _identityForPlant(p),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_REGISTRY_VERSION,
    ok: false, reason: 'error', plantId: '',
  }));
}

interface RegisterFromScanCtx {
  scanResult?: any;
  ownerId?:    string;
  location?:   { regionLabel?: string };
  gardenId?:   string;
  farmId?:     string;
  experience?: string;
  now?:        number;
}

/**
 * Produce a registration payload the caller can save through the
 * existing scanPersistenceBridge / addScanTasks pipeline.
 *
 * The payload shape is stable: caller doesn't need to know which
 * engine produced it. PII fields (owner name, address, GPS lat/
 * lng) are never carried — only opaque ids + region label.
 */
export function registerPlantFromScan(ctx: RegisterFromScanCtx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as RegisterFromScanCtx;
    const scan  = _isObj(c.scanResult) ? c.scanResult : null;
    if (!scan) {
      return Object.freeze({
        runtimeVersion: PLANT_REGISTRY_VERSION,
        ok: false, reason: 'no_scan_result',
      });
    }
    const plantId = _str(scan.plantId) || _str((scan as any).id);
    const plant   = plantId ? findPlant(plantId) : null;
    if (!plant) {
      return Object.freeze({
        runtimeVersion: PLANT_REGISTRY_VERSION,
        ok: false, reason: 'plant_not_in_db',
        scanId: _str(scan.scanId),
      });
    }
    const now = _str(scan.capturedAt) || _str(scan.timestamp)
              || _safe(() => new Date(_num(c.now) || Date.now()).toISOString(), '');
    return Object.freeze({
      runtimeVersion: PLANT_REGISTRY_VERSION,
      ok: true, reason: '',
      payload: Object.freeze({
        plantId:        _str(plant.id),
        commonName:     _str(plant.commonName) || _str(plant.name),
        scientificName: _str(plant.scientificName),
        category:       _str(plant.type),
        scanId:         _str(scan.scanId),
        registeredAt:   now,
        ownerId:        _str(c.ownerId),
        gardenId:       _str(c.gardenId),
        farmId:         _str(c.farmId),
        experience:     _str(c.experience),
        regionLabel:    _str((c.location && c.location.regionLabel) || ''),
        // Caller-actionable next steps — the spec calls for
        // "tasks + health tracking + recommendations + history"
        // to spin up the moment a scan resolves to a plant.
        recommendedFollowUps: Object.freeze([
          'add_to_today_plan',
          'open_plant_profile',
          'enable_care_reminders',
          'check_companion_planting',
        ]),
      }),
      deferred: Object.freeze({
        persistence:
          'engine emits payload only; the journal save + today-task '
          + 'add stay with the wave-5 single-writer',
      }),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_REGISTRY_VERSION,
    ok: false, reason: 'error',
  }));
}

/**
 * Catalog snapshot — used by the dashboard / library shell to
 * render category cards with live counts.
 */
export function plantRegistry() {
  return _safe(() => {
    const byCategory = PLANT_CATEGORIES.map((id) => Object.freeze({
      id, icon: PLANT_CATEGORY_META[id].icon,
      labelKey: PLANT_CATEGORY_META[id].labelKey,
      labelDefault: PLANT_CATEGORY_META[id].labelDefault,
      count: (PLANT_DB_STATS as any)[id] || 0,
      minLaunch: PLANT_CATEGORY_META[id].minLaunch,
    }));
    return Object.freeze({
      runtimeVersion: PLANT_REGISTRY_VERSION,
      generatedAt:    _now(),
      totalKnown:     PLANT_DB.length,
      minLaunchTotal: MIN_LAUNCH_TOTAL,
      byCategory:     Object.freeze(byCategory),
      specTarget:     PLANT_DB_STATS.specTarget,
      deferred: Object.freeze({
        datasetVolume:
          'spec target ' + MIN_LAUNCH_TOTAL + '+; ships '
          + PLANT_DB.length + ' rows — content-team backlog',
      }),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_REGISTRY_VERSION,
    generatedAt: '', totalKnown: 0, minLaunchTotal: 0,
    byCategory: Object.freeze([]),
    specTarget: Object.freeze({}),
    deferred: Object.freeze({}),
  }));
}
