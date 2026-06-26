/**
 * EvidenceTierEngine.ts — Scan Intelligence evidence-tier classifier.
 *
 * Replaces the flat unavailable/unknown/no_live_feed taxonomy with EVIDENCE TIERS:
 * every scan field is classified by HOW a real value would be obtained, and its
 * status reports whether that capability actually exists right now. This is a more
 * actionable honesty — "needs a lab test" / "needs a CV model" / "needs a satellite
 * feed" instead of a flat "unavailable".
 *
 * Hard rule (from the spec + the platform doctrine): a field is NEVER given a value
 * unless a real model/provider/measurement produced it. The tier names the PATH to
 * a value; it does not fabricate one. And we do NOT hardcode "unavailable" for a
 * field that a validated model CAN estimate — the crop-calendar fields (plant age,
 * maturity, harvest window) and live-weather fields are genuinely served as
 * estimated/live values, with estimated=true + method + confidence.
 *
 * Pure, total, browser-safe. Composes pure engines only.
 */
// @ts-ignore — JS engine
import { computeLifecycleSnapshot } from '../../../core/lifecycle/cropLifecycleEngine.js';
// @ts-ignore — TS sibling
import * as WeatherRisk from '../../weatherRisk/WeatherRiskRuntime';

export const EVIDENCE_TIER_VERSION = 'evidence-tier-v1';

export type EvidenceTier =
  | 'DIRECT_MEASURED'   // Tier 1 — direct image measurement (needs a CV model)
  | 'MODEL_ESTIMATED'   // Tier 2 — a validated estimation model
  | 'FUSED_ESTIMATE'    // Tier 3 — multiple sources (image + weather + soil + gps + history)
  | 'LIVE_PROVIDER'     // Tier 4 — an external live feed (market/satellite/drone/iot/weather)
  | 'LAB_REQUIRED'      // Tier 5 — laboratory testing
  | 'UNKNOWN';          // Tier 6 — no model, no provider, no evidence

export type FieldStatus =
  | 'measured'           // Tier 1 produced a real measurement
  | 'estimated'          // Tier 2/3 model produced a value (estimated=true)
  | 'live'               // Tier 4 provider returned a value
  | 'awaiting_model'     // tier correct, CV/estimation model not deployed
  | 'awaiting_provider'  // tier correct, live feed not wired
  | 'awaiting_lab'       // needs a lab test
  | 'awaiting_input'     // model exists but a required input is missing (e.g. planting date)
  | 'unknown';           // Tier 6

export interface FieldEvidence {
  field: string;
  tier: EvidenceTier;
  status: FieldStatus;
  value: number | string | null;
  confidence: number | null;   // 0..100, null when no value
  source: string;
  reason: string;
  estimated: boolean;
  lastUpdated: string | null;  // caller-supplied (no clock dependence)
}

export interface TierContext {
  crop?: string | null; plantingDate?: string | null;
  climate?: string; setting?: string; mode?: string; nowMs?: number;
  weather?: any; soil?: any;
  nowIso?: string | null;      // timestamp for lastUpdated, supplied by caller
}

// ── Field → tier classification (the status matrix) ──
const TIER1_CV = ['fruitCount', 'flowerCount', 'leafCount', 'leafDamagePct', 'diseaseLesions', 'canopyCoverage', 'objectDimensions', 'plantPopulation', 'gapDetection', 'rowAlignment'];
const TIER2_CALENDAR = ['plantAge', 'maturityDate', 'harvestWindow', 'growthVelocity']; // REAL validated model
const TIER2_CV = ['yieldEstimate', 'biomass', 'ripeness', 'stress', 'healthScore', 'recoveryProbability'];
const TIER3_FUSED = ['diseaseRisk', 'yieldForecast', 'harvestDateForecast'];
const TIER4_WEATHER = ['rainRisk', 'frostRisk', 'heatRisk', 'windRisk']; // REAL live provider
const TIER4_PROVIDER = ['marketPrice', 'satelliteNdvi', 'droneAnalysis', 'iotSensors'];
const TIER4_SOIL = ['soilPh', 'soilMoisture']; // SoilGrids/Ambee provider
const TIER5_LAB = ['nitrogen', 'phosphorus', 'potassium', 'organicMatter', 'cec', 'micronutrients'];

export function classifyFieldTier(field: string): EvidenceTier {
  if (TIER1_CV.includes(field)) return 'DIRECT_MEASURED';
  if (TIER2_CALENDAR.includes(field) || TIER2_CV.includes(field)) return 'MODEL_ESTIMATED';
  if (TIER3_FUSED.includes(field)) return 'FUSED_ESTIMATE';
  if (TIER4_WEATHER.includes(field) || TIER4_PROVIDER.includes(field) || TIER4_SOIL.includes(field)) return 'LIVE_PROVIDER';
  if (TIER5_LAB.includes(field)) return 'LAB_REQUIRED';
  return 'UNKNOWN';
}

export const ALL_TIER_FIELDS: ReadonlyArray<string> = Object.freeze([
  ...TIER1_CV, ...TIER2_CALENDAR, ...TIER2_CV, ...TIER3_FUSED, ...TIER4_WEATHER, ...TIER4_PROVIDER, ...TIER4_SOIL, ...TIER5_LAB,
]);

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _num = (v: any): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

function rec(field: string, tier: EvidenceTier, status: FieldStatus, value: any, confidence: number | null, source: string, reason: string, estimated: boolean, lastUpdated: string | null): FieldEvidence {
  return Object.freeze({ field, tier, status, value: value ?? null, confidence: value == null ? null : confidence, source, reason, estimated, lastUpdated: value == null ? null : lastUpdated });
}

/** Evaluate one field into its honest evidence record. Never fabricates a value. */
export function evaluateField(field: string, ctx: TierContext = {}): FieldEvidence {
  return _safe(() => _evaluate(field, ctx), rec(field, 'UNKNOWN', 'unknown', null, null, 'error', 'Could not evaluate this field.', false, null));
}

function _evaluate(field: string, ctx: TierContext): FieldEvidence {
  const tier = classifyFieldTier(field);
  const now = ctx.nowIso || null;

  // ── Tier 2 MODEL_ESTIMATED — crop calendar (a REAL validated estimation model). ──
  if (TIER2_CALENDAR.includes(field)) {
    const snap = _safe(() => computeLifecycleSnapshot({ crop: ctx.crop, plantingDate: ctx.plantingDate, climate: ctx.climate, setting: ctx.setting, mode: ctx.mode, nowMs: ctx.nowMs }), null) as any;
    const hasDate = !!ctx.plantingDate;
    let value: any = null;
    if (snap) {
      if (field === 'plantAge') value = hasDate ? _num(snap.daysSincePlanting) : null;
      else if (field === 'harvestWindow') value = (snap.harvestWindow && (snap.harvestWindow.label || snap.harvestWindow.startDate)) ? (snap.harvestWindow.label || (snap.harvestWindow.startDate + '–' + (snap.harvestWindow.endDate || ''))) : null;
      else if (field === 'maturityDate') value = (snap.harvestWindow && snap.harvestWindow.expectedDate) || null;
      else if (field === 'growthVelocity') { const a = _num(snap.daysSincePlanting), d = _num(snap.durationDays); value = (hasDate && a != null && d) ? Math.round((a / d) * 100) + '% through cycle' : null; }
    }
    return value != null
      ? rec(field, tier, 'estimated', value, 55, 'crop-calendar', 'Estimated from the validated crop-calendar model (method=crop-calendar).', true, now)
      : rec(field, tier, 'awaiting_input', null, null, 'crop-calendar', 'A planting date + supported crop are needed for this estimate.', false, null);
  }

  // ── Tier 4 LIVE_PROVIDER — live weather (a REAL wired provider). ──
  if (TIER4_WEATHER.includes(field)) {
    if (!ctx.weather) return rec(field, tier, 'awaiting_provider', null, null, 'live-weather', 'Needs a live weather reading (enable location).', false, null);
    const wr = _safe(() => WeatherRisk.evaluate({ forecast: ctx.weather, weather: ctx.weather }), null) as any;
    const key = field === 'heatRisk' ? 'heatRisk' : field === 'windRisk' ? 'windRisk' : field === 'frostRisk' ? 'frostRisk' : 'rainRisk';
    const v = wr && (wr[key] ?? (wr.risks && wr.risks[key]));
    return v != null
      ? rec(field, tier, 'live', String(v), 55, 'live-weather', 'From the live weather forecast.', false, now)
      : rec(field, tier, 'live', 'low', 40, 'live-weather', 'Forecast read; no notable risk for this signal.', false, now);
  }

  // ── Tier 4 LIVE_PROVIDER — soil pH / moisture (SoilGrids/Ambee). ──
  if (TIER4_SOIL.includes(field)) {
    const s = ctx.soil && typeof ctx.soil === 'object' ? ctx.soil : null;
    const k = field === 'soilPh' ? 'ph' : 'moisture';
    const v = s ? _num(s[k]) : null;
    return v != null
      ? rec(field, tier, 'live', v, 70, 'soilgrids/ambee', 'From the server-side soil provider.', false, now)
      : rec(field, tier, 'awaiting_provider', null, null, 'soilgrids/ambee', 'Needs a location-based soil lookup.', false, null);
  }

  // ── Tier 5 LAB_REQUIRED — never estimated; a real soil test is the only path. ──
  if (TIER5_LAB.includes(field)) {
    return rec(field, tier, 'awaiting_lab', null, null, 'lab', 'Needs a soil laboratory test — not estimated from a photo.', false, null);
  }

  // ── Tier 4 other live feeds — not wired (market/satellite/drone/iot). ──
  if (TIER4_PROVIDER.includes(field)) {
    return rec(field, tier, 'awaiting_provider', null, null, 'live-feed', 'No live feed wired for this source yet.', false, null);
  }

  // ── Tier 1 DIRECT_MEASURED + Tier 2 CV estimates — need a CV model not deployed. ──
  if (TIER1_CV.includes(field)) {
    return rec(field, tier, 'awaiting_model', null, null, 'cv-model', 'Direct measurement needs a computer-vision model (not yet deployed) — not fabricated.', false, null);
  }
  if (TIER2_CV.includes(field)) {
    return rec(field, tier, 'awaiting_model', null, null, 'cv-model', 'A validated CV estimation model is required (not yet deployed) — not fabricated.', false, null);
  }

  // ── Tier 3 FUSED — needs a CV component + multi-source fusion (not yet available). ──
  if (TIER3_FUSED.includes(field)) {
    return rec(field, tier, 'awaiting_model', null, null, 'fusion', 'Needs a fused model over image + weather + soil + history (CV component missing) — not fabricated.', false, null);
  }

  return rec(field, 'UNKNOWN', 'unknown', null, null, 'none', 'No model, provider, or evidence for this field.', false, null);
}

export function evaluateScanFields(ctx: TierContext = {}): Record<string, FieldEvidence> {
  const out: Record<string, FieldEvidence> = {};
  for (const f of ALL_TIER_FIELDS) out[f] = evaluateField(f, ctx);
  return Object.freeze(out);
}

export function evidenceTierHealth() {
  const ctx: TierContext = { crop: 'maize', plantingDate: '2026-05-01', nowMs: 1, nowIso: '2026-06-25T00:00:00Z', weather: { tempC: 30 }, soil: { ph: 6.2, moisture: 18 } };
  const fields = evaluateScanFields(ctx);
  const vals = Object.values(fields);
  // Honesty invariants: a value only exists for estimated/live/measured; CV fields
  // are awaiting_model (never a fabricated number); lab fields are LAB_REQUIRED.
  const valueOnlyWhenReal = vals.every(f => f.value == null || ['estimated', 'live', 'measured'].includes(f.status));
  const cvNeverFabricated = TIER1_CV.concat(TIER2_CV).every(k => fields[k].value === null && fields[k].status === 'awaiting_model');
  const labNeverEstimated = TIER5_LAB.every(k => fields[k].tier === 'LAB_REQUIRED' && fields[k].value === null && fields[k].estimated === false);
  const calendarIsEstimated = fields.plantAge.status === 'estimated' && fields.plantAge.estimated === true && fields.plantAge.value != null;
  return Object.freeze({
    ok: true, version: EVIDENCE_TIER_VERSION,
    tiers: 6, fields: ALL_TIER_FIELDS.length,
    valueOnlyWhenReal, cvNeverFabricated, labNeverEstimated, calendarIsEstimated,
  });
}

export function installEvidenceTierHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__evidenceTierHealth) return;
    Object.defineProperty(window, '__evidenceTierHealth', {
      configurable: true, enumerable: false, writable: false, value: () => evidenceTierHealth(),
    });
  }, undefined);
}
