/**
 * src/runtime/yield/YieldRiskEngine.ts — pure deterministic
 * yield-risk classifier (Low / Medium / High / Unknown).
 *
 * Pure. Never throws. SSR-safe (no DOM access).
 */

import {
  YIELD_RISK,
  type YieldRiskValue,
  type YieldRiskDriver,
} from './yieldContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().trim() : '';
}

function _num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return 0;
}

export interface YieldRiskInput {
  plantId:           string;
  growthStage?:      string;
  scanHealthScore?:  number;     // 0-100; lower means worse
  severityLevel?:    string;     // 'low' | 'medium' | 'high' | 'critical'
  pestPressure?:     string;     // 'low' | 'medium' | 'high'
  weatherRiskLevel?: string;     // 'low' | 'medium' | 'high'
  taskCompletionRate?: number;   // 0-1
  vegetationHealth?: string;     // 'good' | 'watch' | 'poor' (satellite)
  moistureRisk?:     string;     // 'low' | 'medium' | 'high' (satellite)
  heatStress?:       string;     // 'low' | 'medium' | 'high' (satellite)
  ndviTrend?:        string;     // 'improving' | 'stable' | 'declining'
  hasSufficientData: boolean;
}

export interface YieldRiskOutput {
  yieldRisk:    YieldRiskValue;
  score:        number;          // 0-100; higher means more risk
  drivers:      ReadonlyArray<YieldRiskDriver>;
}

export function evaluateYieldRisk(input: YieldRiskInput): YieldRiskOutput {
  return _safe(() => {
    if (!input.hasSufficientData) {
      return Object.freeze({
        yieldRisk: YIELD_RISK.UNKNOWN,
        score:     0,
        drivers:   Object.freeze([]),
      });
    }

    let score = 0;
    const drivers: YieldRiskDriver[] = [];

    // Disease severity contribution.
    const sev = _lower(input.severityLevel);
    if (sev === 'critical')      { score += 40; drivers.push({ signal: 'disease', weight: 0.4, detail: 'Critical disease signal detected.' }); }
    else if (sev === 'high')     { score += 28; drivers.push({ signal: 'disease', weight: 0.28, detail: 'High disease signal detected.' }); }
    else if (sev === 'medium')   { score += 15; drivers.push({ signal: 'disease', weight: 0.15, detail: 'Moderate disease signal.' }); }

    // Pest pressure contribution.
    const pp = _lower(input.pestPressure);
    if (pp === 'high')           { score += 20; drivers.push({ signal: 'pest', weight: 0.2, detail: 'High pest pressure.' }); }
    else if (pp === 'medium')    { score += 10; drivers.push({ signal: 'pest', weight: 0.1, detail: 'Moderate pest pressure.' }); }

    // Weather risk contribution.
    const wr = _lower(input.weatherRiskLevel);
    if (wr === 'high')           { score += 18; drivers.push({ signal: 'weather', weight: 0.18, detail: 'Weather may increase disease risk.' }); }
    else if (wr === 'medium')    { score += 9;  drivers.push({ signal: 'weather', weight: 0.09, detail: 'Weather conditions worth monitoring.' }); }

    // Satellite signals (when available).
    const veg = _lower(input.vegetationHealth);
    if (veg === 'poor')          { score += 20; drivers.push({ signal: 'satellite', weight: 0.2, detail: 'Vegetation health signal looks poor.' }); }
    else if (veg === 'watch')    { score += 10; drivers.push({ signal: 'satellite', weight: 0.1, detail: 'Vegetation signal worth watching.' }); }

    const moisture = _lower(input.moistureRisk);
    if (moisture === 'high')     { score += 12; drivers.push({ signal: 'moisture', weight: 0.12, detail: 'Moisture stress may be increasing.' }); }
    else if (moisture === 'medium') { score += 6; drivers.push({ signal: 'moisture', weight: 0.06, detail: 'Some moisture stress likely.' }); }

    const heat = _lower(input.heatStress);
    if (heat === 'high')         { score += 10; drivers.push({ signal: 'heat', weight: 0.1, detail: 'Heat stress likely.' }); }

    const ndvi = _lower(input.ndviTrend);
    if (ndvi === 'declining')    { score += 10; drivers.push({ signal: 'trend', weight: 0.1, detail: 'Vegetation trend appears to be declining.' }); }

    // Scan health score (inverse — low health = high risk).
    const health = _num(input.scanHealthScore);
    if (health > 0 && health < 40) { score += 12; drivers.push({ signal: 'health', weight: 0.12, detail: 'Recent scan health is low.' }); }

    // Task completion (helpful — high completion reduces risk).
    const completion = _num(input.taskCompletionRate);
    if (completion >= 0.7)       { score -= 8; }

    // Growth-stage-specific dampener — early stages have time to recover.
    const stage = _lower(input.growthStage);
    if (stage === 'emergence' || stage === 'seedling' || stage === 'young') {
      score = Math.max(0, score - 6);
    }

    score = Math.max(0, Math.min(100, score));

    let risk: YieldRiskValue;
    if (score >= 60)      risk = YIELD_RISK.HIGH;
    else if (score >= 30) risk = YIELD_RISK.MEDIUM;
    else                  risk = YIELD_RISK.LOW;

    return Object.freeze({
      yieldRisk: risk,
      score,
      drivers: Object.freeze([...drivers]),
    });
  }, Object.freeze({
    yieldRisk: YIELD_RISK.UNKNOWN,
    score:     0,
    drivers:   Object.freeze([]),
  }));
}

export const YIELD_RISK_ENGINE_VERSION = 'yield-risk-engine-v1';
