/**
 * src/runtime/plants/scanToManagedPlant.ts — Scan → Managed
 * Plant workflow helper.
 *
 *   import {
 *     scanToManagedPlant, SCAN_TO_MANAGED_PLANT_VERSION,
 *   } from 'src/runtime/plants/scanToManagedPlant';
 *
 *   const wf = scanToManagedPlant({
 *     scanResult, ownerId, gardenId, farmId, location,
 *     existingPlants, registerOnly,
 *   });
 *
 *   // wf.eligible    — boolean
 *   // wf.payload     — ManagedPlant record ready to persist
 *   // wf.alreadyManaged — true if an active plant matches
 *
 * What this is
 * ────────────
 *   The runtime-tier workflow that turns a scan envelope into a
 *   managed Plant record. Three responsibilities:
 *
 *     1. ELIGIBILITY — does the scan resolve to a catalog plant?
 *     2. DEDUPE       — has the user already added this plant?
 *     3. PRODUCE      — emit a frozen ManagedPlant record + a
 *                       caller-ready add-to-registry payload.
 *
 *   The actual persistence + ScanPage wiring stays with the UI
 *   layer (wave-5 single-writer invariant). This helper is what
 *   ScanResultCard / ScanPage / MyPlants will call when the
 *   user taps "Add to my plants".
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over createManagedPlant + registry.
 *   • Wave-5 single-writer preserved.
 *   • No fetch, no LLM.
 */

import {
  createManagedPlant, ManagedPlant,
} from './PlantRuntime';
import {
  registryFindPlant,
} from './PlantRegistry';

export const SCAN_TO_MANAGED_PLANT_VERSION = 'scan-to-managed-plant-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface WorkflowCtx {
  scanResult?:   any;
  ownerId?:      string;
  gardenId?:     string;
  farmId?:       string;
  location?:     { regionLabel?: string };
  existingPlants?: ManagedPlant[];
  // when true, emit the payload but skip the recommendedFollowUps
  registerOnly?: boolean;
  now?:          number;
}

export function scanToManagedPlant(ctx: WorkflowCtx) {
  return _safe(() => {
    const c    = _isObj(ctx) ? ctx : {} as WorkflowCtx;
    const scan = _isObj(c.scanResult) ? c.scanResult : null;
    if (!scan) {
      return Object.freeze({
        runtimeVersion: SCAN_TO_MANAGED_PLANT_VERSION,
        eligible:       false,
        reason:         'no_scan_result',
      });
    }
    const plantId = _str(scan.plantId) || _str((scan as any).id);
    if (!plantId) {
      return Object.freeze({
        runtimeVersion: SCAN_TO_MANAGED_PLANT_VERSION,
        eligible:       false,
        reason:         'scan_has_no_plant_id',
        scanId:         _str(scan.scanId),
      });
    }

    // Dedupe — has the user already added a plant with this
    // catalog id? Match by commonName since record ids are hashed.
    const existing = _arr(c.existingPlants);
    const alreadyManagedRecord = existing.find((p) => {
      if (!_isObj(p)) return false;
      const stored = _str(p.commonName).toLowerCase();
      const candidate = _str(scan.plantName)
                       || _str(scan.commonName)
                       || _str(scan.label)
                       || plantId.toLowerCase();
      return stored !== '' && stored === candidate.toLowerCase();
    });
    if (alreadyManagedRecord) {
      return Object.freeze({
        runtimeVersion:   SCAN_TO_MANAGED_PLANT_VERSION,
        eligible:         true,
        alreadyManaged:   true,
        existingPlantId:  (alreadyManagedRecord as any).id,
        reason:           'plant_already_in_my_plants',
        scanId:           _str(scan.scanId),
      });
    }

    // Produce the managed-plant record via the runtime keystone.
    const produced = createManagedPlant({
      plantId,
      scanResult: scan,
      ownerId: c.ownerId,
      location: c.location,
      now:     c.now,
    } as any);
    if (!_isObj(produced) || !(produced as any).ok) {
      return Object.freeze({
        runtimeVersion: SCAN_TO_MANAGED_PLANT_VERSION,
        eligible:       false,
        reason:         _isObj(produced)
                          ? _str((produced as any).reason)
                          : 'create_failed',
        scanId:         _str(scan.scanId),
      });
    }
    const plant = (produced as any).plant as ManagedPlant;

    return Object.freeze({
      runtimeVersion: SCAN_TO_MANAGED_PLANT_VERSION,
      eligible:       true,
      alreadyManaged: false,
      plant,
      payload: Object.freeze({
        // What the caller saves through scanPersistenceBridge
        // (NOT through this helper — wave-5 single-writer).
        operation: 'register_managed_plant',
        plant,
        registration: (produced as any).registration,
        ownerId:   _str(c.ownerId),
        gardenId:  _str(c.gardenId),
        farmId:    _str(c.farmId),
        recommendedFollowUps: c.registerOnly
          ? Object.freeze([])
          : Object.freeze([
              'add_to_today_plan',
              'open_plant_profile',
              'enable_care_reminders',
            ]),
      }),
      deferred: Object.freeze({
        persistence:
          'helper emits payload only; the caller persists via '
          + 'scanPersistenceBridge / addScanTasks / saveScanUseful',
        scanPageWiring:
          'ScanPage already renders results; UI bridge to call '
          + 'this helper sits in the next sprint to avoid touching '
          + 'the 1556-line scan page that just had a critical bug '
          + 'fix landed',
      }),
    });
  }, Object.freeze({
    runtimeVersion: SCAN_TO_MANAGED_PLANT_VERSION,
    eligible: false, reason: 'error',
  }));
}
