/**
 * src/runtime/growth/GrowthStageRuntime.ts — top-level facade.
 * Routes a scanResult+plantContext into the right sub-engine based
 * on the plant category (resolved via the existing harvest
 * runtime's PLANT_CATEGORY lookup — composition, not duplication).
 *
 *   evaluate(scanResult, plantContext, timestamp)
 *     → frozen GrowthStageResult
 *
 * Strict-rule audit
 *   • Composition over architecture. Never owns the camera.
 *     Never calls Plant.id directly. Never bypasses ScanRuntime.
 *   • Pure runtime. Never throws.
 *   • Single window global: __growthStageHealth.
 *   • Frozen envelopes.
 *   • Idempotency: deterministic key `growth:{scanId}`.
 */

import {
  GROWTH_RUNTIME_VERSION,
  PLANT_STAGE, CROP_STAGE, FLOWER_STAGE,
  STAGE_MODEL,
  GROWTH_STORAGE_KEY, GROWTH_HISTORY_CAP,
  type GrowthStageResult, type GrowthStageHealth,
  type StageValue,
} from './growthContracts';
import { evaluatePlantStage }  from './GrowthStageEngine';
import { evaluateCropStage }   from './CropStageEngine';
import { evaluateFlowerStage } from './FlowerStageEngine';
// Composition — reuse the harvest runtime's plant-category lookup
// so we share one source of truth for which plant is fruit / crop /
// flower / unknown.
import { PLANT_CATEGORY } from '../harvest';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().trim() : '';
}

function _str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ─── Persistence ──────────────────────────────────────────────────

function _hasLocal(): boolean {
  return _safe(() => typeof localStorage !== 'undefined'
                     && !!localStorage, false);
}

function _readHistory(): GrowthStageResult[] {
  return _safe(() => {
    if (!_hasLocal()) return [];
    const raw = localStorage.getItem(GROWTH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _writeHistory(list: GrowthStageResult[]): boolean {
  return _safe(() => {
    if (!_hasLocal()) return false;
    const trimmed = list.length > GROWTH_HISTORY_CAP
      ? list.slice(list.length - GROWTH_HISTORY_CAP) : list;
    localStorage.setItem(GROWTH_STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  }, false);
}

function _appendHistory(rec: GrowthStageResult): void {
  _safe(() => {
    const list = _readHistory();
    const key = `growth:${rec.scanId}`;
    const dedup = list.filter((r) => `growth:${r.scanId}` !== key);
    dedup.push(rec);
    _writeHistory(dedup);
  }, undefined as any);
}

// ─── Public entry ─────────────────────────────────────────────────

export interface GrowthEvaluateInput {
  scanResult:    any;
  plantContext?: {
    plantId?:           string;
    lifecycleStage?:    string;
    weeksSincePlanting?: number;
    ageWeeks?:          number;
    size?:              string;
  };
  timestamp?: string;
}

export function evaluate(input: GrowthEvaluateInput): GrowthStageResult {
  const fallback = (scanId: string, plantId: string): GrowthStageResult =>
    Object.freeze({
      scanId,
      plantId,
      model: STAGE_MODEL.PLANT,
      stage: PLANT_STAGE.UNKNOWN as StageValue,
      confidence: 0,
      needsReview: true,
      timestamp: _str(input?.timestamp),
    });

  return _safe(() => {
    const scan = input.scanResult || {};
    const scanId = _str(scan.scanId) || _str(scan.id) || '';
    if (!scanId) return fallback('', '');

    const ctx = input.plantContext || {};
    const plantId = _lower(ctx.plantId)
                  || _lower(scan.plantId)
                  || _lower(scan.crop)
                  || _lower(scan.cropId)
                  || _lower(scan.plantName)
                  || _lower(scan.cropName);

    const category = PLANT_CATEGORY[plantId];

    let stageResult: any;
    if (category === 'flower') {
      stageResult = evaluateFlowerStage({
        plantId,
        lifecycleStage: ctx.lifecycleStage || _str(scan.lifecycleStage),
        color:          _str(scan.color)   || _str(scan.dominantColor),
        defects:        Array.isArray(scan.defects) ? scan.defects : undefined,
      });
    } else if (category === 'crop'
            || category === 'vegetable'
            || category === 'fruit') {
      stageResult = evaluateCropStage({
        plantId,
        lifecycleStage:     ctx.lifecycleStage || _str(scan.lifecycleStage),
        weeksSincePlanting: ctx.weeksSincePlanting,
        scanCategory:       _str(scan.category),
        color:              _str(scan.color),
      });
    } else {
      stageResult = evaluatePlantStage({
        plantId,
        lifecycleStage: ctx.lifecycleStage,
        size:           ctx.size,
        ageWeeks:       ctx.ageWeeks,
      });
    }

    const result: GrowthStageResult = Object.freeze({
      plantId,
      scanId,
      model: stageResult.model,
      stage: stageResult.stage,
      confidence: stageResult.confidence,
      nextExpectedStage: stageResult.nextExpectedStage,
      estimatedDaysToNextStage: stageResult.estimatedDaysToNextStage,
      needsReview: !!stageResult.needsReview,
      timestamp: _str(input.timestamp),
    });

    _appendHistory(result);
    return result;
  }, fallback(_str(input?.scanResult?.scanId), _str(input?.plantContext?.plantId)));
}

// ─── Read helpers ─────────────────────────────────────────────────

export function getLatestStageForPlant(plantId: string): GrowthStageResult | null {
  return _safe(() => {
    const pid = _lower(plantId);
    if (!pid) return null;
    const rows = _readHistory()
      .filter((r) => _lower(r.plantId) === pid)
      .sort((a, b) => {
        const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
        const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
        return (Number.isFinite(tb) ? tb : 0)
             - (Number.isFinite(ta) ? ta : 0);
      });
    return rows[0] || null;
  }, null);
}

// ─── Diagnostic envelope ──────────────────────────────────────────

export function growthStageHealth(): GrowthStageHealth {
  return _safe(() => Object.freeze({
    runtimeVersion:    GROWTH_RUNTIME_VERSION,
    initialized:       true,
    growthStageReady:  true,
    plantStagesReady:  true,
    cropStagesReady:   true,
    flowerStagesReady: true,
  }), Object.freeze({
    runtimeVersion:    GROWTH_RUNTIME_VERSION,
    initialized:       false,
    growthStageReady:  false,
    plantStagesReady:  false,
    cropStagesReady:   false,
    flowerStagesReady: false,
  }));
}

export function installGrowthStageGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__growthStageHealth !== 'function') {
      w.__growthStageHealth = function () {
        const out = growthStageHealth();
        try { console.log('[Farroway · Growth Stage]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export const STAGES = Object.freeze({
  PLANT_STAGE, CROP_STAGE, FLOWER_STAGE,
});
