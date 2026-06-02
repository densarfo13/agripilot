/**
 * FarmMemoryTrendRuntime.ts — §FARM MEMORY trend.
 *
 * Computes a per-plant trend label from real outcome history:
 *   • Improving      — recent verdicts skew 'better'
 *   • Stable         — verdicts split or repeat 'same'
 *   • Needs Attention — recent verdicts skew 'worse'
 *   • Not enough data yet — fewer than 2 recorded outcomes
 *
 * Pure projection over localStorage scan-outcome log; never fabricates.
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}
type Confidence = 'low' | 'medium' | 'high';

export const FARM_MEMORY_TREND_VERSION = 'farm-memory-trend-v1' as const;

export type TrendLabel = 'Improving' | 'Stable' | 'Needs Attention' | 'Not enough data yet';

export interface FarmMemoryTrend {
  label: TrendLabel;
  better: number;
  same: number;
  worse: number;
  totalOutcomes: number;
  rationale: string;
}

export interface FarmMemoryTrendHealthEnvelope {
  initialized: true;
  storageReady: boolean;
  trendsTrackedFor: number;  // distinct plantKeys
  noFakeTrends: true;
  noFabricatedVerdicts: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _readOutcomes(): any[] {
  return _safe(() => {
    const raw = _ls('farroway_scan_outcome_log');
    return Array.isArray(raw) ? raw : [];
  }, []);
}

function _readMemory(): any[] {
  return _safe(() => {
    const raw = _ls('farroway_scan_memory_log');
    return Array.isArray(raw) ? raw : [];
  }, []);
}

/** Compute a trend for a specific plant. Reads outcome log + memory
 *  log; joins on scanId. Returns 'Not enough data yet' until 2+
 *  outcomes exist. */
export function trendForPlant(plantKey: string): Readonly<FarmMemoryTrend> {
  return _safe(() => {
    if (!plantKey) {
      return Object.freeze<FarmMemoryTrend>({
        label: 'Not enough data yet',
        better: 0, same: 0, worse: 0, totalOutcomes: 0,
        rationale: 'No plant key supplied.',
      });
    }
    const memory = _readMemory();
    const outcomes = _readOutcomes();
    // ScanIds associated with this plant.
    const plantScanIds = new Set(
      memory
        .filter((m: any) => m && m.plantKey === plantKey && typeof m.scanId === 'string')
        .map((m: any) => m.scanId),
    );
    let better = 0, same = 0, worse = 0;
    for (const o of outcomes) {
      if (!o || typeof o !== 'object') continue;
      if (!plantScanIds.has(o.scanId)) continue;
      if (o.verdict === 'better') better++;
      else if (o.verdict === 'same') same++;
      else if (o.verdict === 'worse') worse++;
    }
    const total = better + same + worse;
    if (total < 2) {
      return Object.freeze<FarmMemoryTrend>({
        label: 'Not enough data yet',
        better, same, worse, totalOutcomes: total,
        rationale: 'Fewer than 2 recorded outcomes for this plant — trend will appear after the next outcome.',
      });
    }
    // Decision logic.
    if (worse > better) {
      return Object.freeze<FarmMemoryTrend>({
        label: 'Needs Attention',
        better, same, worse, totalOutcomes: total,
        rationale: 'Recent outcomes skew worse — consider re-scanning and reviewing care.',
      });
    }
    if (better > worse && better >= same) {
      return Object.freeze<FarmMemoryTrend>({
        label: 'Improving',
        better, same, worse, totalOutcomes: total,
        rationale: 'Recent outcomes skew better — keep up the current care.',
      });
    }
    return Object.freeze<FarmMemoryTrend>({
      label: 'Stable',
      better, same, worse, totalOutcomes: total,
      rationale: 'Outcomes split or repeat "same" — stable for now.',
    });
  }, Object.freeze<FarmMemoryTrend>({
    label: 'Not enough data yet',
    better: 0, same: 0, worse: 0, totalOutcomes: 0,
    rationale: 'Trend runtime threw.',
  }));
}

export function farmMemoryTrendReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

export function farmMemoryTrendHealth()
  : Readonly<FarmMemoryTrendHealthEnvelope> {
  return _safe(() => {
    const memory = _readMemory();
    const plantKeys = new Set(
      memory.filter((m: any) => m && typeof m.plantKey === 'string').map((m: any) => m.plantKey),
    );
    return Object.freeze<FarmMemoryTrendHealthEnvelope>({
      initialized: true,
      storageReady: typeof window !== 'undefined' && !!window.localStorage,
      trendsTrackedFor: plantKeys.size,
      noFakeTrends: true as const,
      noFabricatedVerdicts: true as const,
      composedFrom: Object.freeze([
        'localStorage:farroway_scan_memory_log',
        'localStorage:farroway_scan_outcome_log',
      ]) as ReadonlyArray<string>,
      confidence: (plantKeys.size >= 2 ? 'high' : plantKeys.size >= 1 ? 'medium' : 'low') as Confidence,
      explanation:
        'Per-plant trend over real outcome history. Labels: Improving / Stable / ' +
        'Needs Attention / "Not enough data yet" (when fewer than 2 outcomes recorded). ' +
        'Joins memory + outcome logs by scanId; never fabricates verdicts.',
      limitations:
        'Trend reflects only outcomes the farmer has actually recorded. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<FarmMemoryTrendHealthEnvelope>({
    initialized: true, storageReady: false,
    trendsTrackedFor: 0,
    noFakeTrends: true as const, noFabricatedVerdicts: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Farm memory trend runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installFarmMemoryTrendGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__farmMemoryTrendHealth !== 'function') {
      w.__farmMemoryTrendHealth = function () {
        const out = farmMemoryTrendHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Farm Memory Trend]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
