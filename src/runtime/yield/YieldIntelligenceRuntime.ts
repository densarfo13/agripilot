/**
 * src/runtime/yield/YieldIntelligenceRuntime.ts — top-level
 * facade. Composes YieldRiskEngine + YieldForecastEngine +
 * YieldSignalEngine into a single frozen YieldIntelligenceResult
 * envelope.
 *
 *   evaluate(input) → frozen YieldIntelligenceResult
 *
 * Strict-rule audit
 *   • Composition over architecture. NEVER imports React or DOM.
 *   • Pure runtime. Never throws.
 *   • Frozen envelopes only.
 *   • Single window global: __yieldIntelligenceHealth.
 *   • Safe wording — CI gate enforces ban on guaranteed/exact.
 */

import {
  YIELD_RUNTIME_VERSION,
  YIELD_RISK,
  YIELD_STORAGE_KEY,
  YIELD_HISTORY_CAP,
  type YieldIntelligenceResult,
  type YieldIntelligenceHealth,
  type YieldRecommendedAction,
} from './yieldContracts';
import { evaluateYieldRisk } from './YieldRiskEngine';
import { evaluateYieldForecast } from './YieldForecastEngine';
import {
  hasSufficientData, composeSafeMessage,
} from './YieldSignalEngine';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ─── Persistence ──────────────────────────────────────────────────

function _hasLocal(): boolean {
  return _safe(() => typeof localStorage !== 'undefined'
                     && !!localStorage, false);
}

function _readHistory(): YieldIntelligenceResult[] {
  return _safe(() => {
    if (!_hasLocal()) return [];
    const raw = localStorage.getItem(YIELD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _writeHistory(list: YieldIntelligenceResult[]): boolean {
  return _safe(() => {
    if (!_hasLocal()) return false;
    const trimmed = list.length > YIELD_HISTORY_CAP
      ? list.slice(list.length - YIELD_HISTORY_CAP) : list;
    localStorage.setItem(YIELD_STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  }, false);
}

function _appendHistory(rec: YieldIntelligenceResult): void {
  _safe(() => {
    const list = _readHistory();
    const key = `${rec.plantId}:${rec.scanId || rec.timestamp}`;
    const dedup = list.filter((r) =>
      `${r.plantId}:${r.scanId || r.timestamp}` !== key);
    dedup.push(rec);
    _writeHistory(dedup);
  }, undefined as any);
}

// ─── Public entry ─────────────────────────────────────────────────

export interface YieldEvaluateInput {
  plantId:           string;
  scanId?:           string;
  farmSizeHa?:       number;
  plantCount?:       number;
  growthStage?:      string;
  region?:           string;       // wave-37 — region multiplier key
  scanHealthScore?:  number;
  severityLevel?:    string;
  pestPressure?:     string;
  weatherRiskLevel?: string;
  taskCompletionRate?: number;
  vegetationHealth?: string;
  moistureRisk?:     string;
  heatStress?:       string;
  ndviTrend?:        string;
  timestamp?:        string;
}

export function evaluate(input: YieldEvaluateInput): YieldIntelligenceResult {
  const fallback = (plantId: string): YieldIntelligenceResult =>
    Object.freeze({
      plantId,
      scanId: input.scanId,
      yieldRisk: YIELD_RISK.UNKNOWN,
      forecastBand: Object.freeze({}),
      confidence: 0,
      riskDrivers: Object.freeze([]),
      recommendedActions: Object.freeze([]),
      safeMessage: 'Not enough data yet — scan again in a few days to see a yield estimate.',
      hasEnoughData: false,
      timestamp: _str(input?.timestamp),
    });

  return _safe(() => {
    const plantId = _str(input.plantId).toLowerCase();
    if (!plantId) return fallback('');

    const enough = hasSufficientData({
      plantId,
      scanHealthScore:  input.scanHealthScore,
      severityLevel:    input.severityLevel,
      growthStage:      input.growthStage,
      weatherRiskLevel: input.weatherRiskLevel,
      pestPressure:     input.pestPressure,
      taskCompletionRate: input.taskCompletionRate,
    });

    const riskOut = evaluateYieldRisk({
      plantId,
      growthStage:        input.growthStage,
      scanHealthScore:    input.scanHealthScore,
      severityLevel:      input.severityLevel,
      pestPressure:       input.pestPressure,
      weatherRiskLevel:   input.weatherRiskLevel,
      taskCompletionRate: input.taskCompletionRate,
      vegetationHealth:   input.vegetationHealth,
      moistureRisk:       input.moistureRisk,
      heatStress:         input.heatStress,
      ndviTrend:          input.ndviTrend,
      hasSufficientData:  enough,
    });

    const forecastBand = evaluateYieldForecast({
      plantId,
      farmSizeHa:        input.farmSizeHa,
      plantCount:        input.plantCount,
      growthStage:       input.growthStage,
      region:            input.region,     // wave-37 region multiplier
      riskScore:         riskOut.score,
      hasSufficientData: enough,
    });

    const safeMessage = composeSafeMessage(riskOut.yieldRisk, riskOut.drivers);

    // Compose recommended actions (envelopes only — Task Runtime
    // is the canonical writer; this runtime never calls addScanTasks).
    const recommendedActions: YieldRecommendedAction[] = [];
    if (riskOut.yieldRisk === YIELD_RISK.HIGH) {
      recommendedActions.push(Object.freeze({
        id:         `yield:inspect:${plantId}`,
        title:      'Inspect crop health',
        reason:     'Several signals point to higher yield risk.',
        urgency:    'high',
        actionType: 'inspect',
      }));
      recommendedActions.push(Object.freeze({
        id:         `yield:follow-up:${plantId}`,
        title:      'Follow-up scan in 2-3 days',
        reason:     'Track whether risk signals are improving.',
        urgency:    'medium',
        actionType: 'follow_up_scan',
      }));
      // If moisture or heat is a driver, add an irrigate-check task.
      if (riskOut.drivers.some((d) => d.signal === 'moisture'
                                   || d.signal === 'heat')) {
        recommendedActions.push(Object.freeze({
          id:         `yield:moisture:${plantId}`,
          title:      'Check soil moisture',
          reason:     'Recent moisture or heat signals.',
          urgency:    'medium',
          actionType: 'irrigate',
        }));
      }
      // If pest is a driver.
      if (riskOut.drivers.some((d) => d.signal === 'pest')) {
        recommendedActions.push(Object.freeze({
          id:         `yield:pest:${plantId}`,
          title:      'Review for pest signs',
          reason:     'Recent pest pressure signal.',
          urgency:    'high',
          actionType: 'inspect',
        }));
      }
    } else if (riskOut.yieldRisk === YIELD_RISK.MEDIUM) {
      recommendedActions.push(Object.freeze({
        id:         `yield:monitor:${plantId}`,
        title:      'Monitor and scan again in 3-5 days',
        reason:     'Moderate risk signals — track for change.',
        urgency:    'medium',
        actionType: 'monitor',
      }));
    }

    // Confidence — derives from enough-data flag + driver count.
    let confidence = 0;
    if (enough) {
      confidence = Math.min(75, 40 + riskOut.drivers.length * 8);
    }

    const result: YieldIntelligenceResult = Object.freeze({
      plantId,
      scanId: input.scanId,
      yieldRisk: riskOut.yieldRisk,
      forecastBand,
      confidence,
      riskDrivers: riskOut.drivers,
      recommendedActions: Object.freeze([...recommendedActions]),
      safeMessage,
      hasEnoughData: enough,
      timestamp: _str(input.timestamp),
    });

    _appendHistory(result);
    return result;
  }, fallback(_str(input?.plantId)));
}

export function getLatestYieldForPlant(plantId: string): YieldIntelligenceResult | null {
  return _safe(() => {
    const pid = _str(plantId).toLowerCase();
    if (!pid) return null;
    const rows = _readHistory()
      .filter((r) => _str(r.plantId).toLowerCase() === pid)
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

export function yieldIntelligenceHealth(): YieldIntelligenceHealth {
  return _safe(() => Object.freeze({
    runtimeVersion:          YIELD_RUNTIME_VERSION,
    initialized:             true,
    yieldRiskReady:          true,
    forecastBandReady:       true,
    safeWordingReady:        true,
    noGuaranteedYieldClaims: true,
  }), Object.freeze({
    runtimeVersion:          YIELD_RUNTIME_VERSION,
    initialized:             false,
    yieldRiskReady:          false,
    forecastBandReady:       false,
    safeWordingReady:        false,
    noGuaranteedYieldClaims: true,
  }));
}

export function installYieldIntelligenceGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__yieldIntelligenceHealth !== 'function') {
      w.__yieldIntelligenceHealth = function () {
        const out = yieldIntelligenceHealth();
        try { console.log('[Farroway · Yield Intelligence]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
