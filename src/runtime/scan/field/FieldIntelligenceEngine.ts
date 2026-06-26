/**
 * FieldIntelligenceEngine.ts — Scan Intelligence v11 field estimates.
 *
 * Produces field intelligence after an object is identified, split HONESTLY into
 * what can be estimated and what cannot:
 *
 *   CALENDAR-BASED (real estimate from planting date + crop calendar):
 *     plant age · maturity date · growth velocity · harvest window.
 *     Composes computeLifecycleSnapshot; unknown when no planting date.
 *
 *   CV-DEPENDENT (a vision model we do NOT have — therefore 'unavailable', never
 *   a fabricated number):
 *     fruit count · flower count · canopy coverage · plant density · row spacing ·
 *     estimated yield · estimated biomass · field coverage.
 *
 * Every field carries value + status + confidence + reason. "Unknown is always
 * acceptable" — we never invent a count or a yield from a single photo.
 * Pure, total, never throws.
 */
// @ts-ignore — JS module, no types
import { computeLifecycleSnapshot } from '../../../core/lifecycle/cropLifecycleEngine.js';

export const FIELD_INTELLIGENCE_VERSION = 'field-intelligence-v11';

export type FieldStatus = 'ok' | 'estimated' | 'unknown' | 'unavailable';
export interface FieldEstimate<T = number | string | null> {
  value: T;
  status: FieldStatus;
  confidence: number;          // 0..100
  reason: string;              // farmer-facing, honest
}

export interface FieldIntelligence {
  version: string;
  // Calendar-based (estimable).
  plantAge: FieldEstimate<number | null>;          // days since planting
  maturityDate: FieldEstimate<string | null>;
  growthVelocity: FieldEstimate<string | null>;
  harvestWindow: FieldEstimate<string | null>;
  // CV-dependent (honest 'unavailable' — never fabricated).
  fruitCount: FieldEstimate<number | null>;
  flowerCount: FieldEstimate<number | null>;
  canopyCoverage: FieldEstimate<number | null>;
  plantDensity: FieldEstimate<number | null>;
  rowSpacing: FieldEstimate<number | null>;
  estimatedYield: FieldEstimate<number | null>;
  estimatedBiomass: FieldEstimate<number | null>;
  fieldCoverage: FieldEstimate<number | null>;
}

export interface FieldInput {
  crop?: string | null;
  cropId?: string | null;
  plantingDate?: string | null;
  mode?: string;
  climate?: string;
  setting?: string;
  nowMs?: number;
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _num = (v: any): number | null => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null; };

function est(value: any, status: FieldStatus, confidence: number, reason: string): FieldEstimate<any> {
  return Object.freeze({ value: value ?? null, status, confidence: Math.max(0, Math.min(100, Math.round(confidence || 0))), reason });
}

/**
 * The honest "we can't measure this from a photo" estimate. The ONLY way a
 * CV-dependent field is produced — it is never given a fabricated number.
 */
function unavailable(what: string): FieldEstimate<null> {
  return est(null, 'unavailable', 0,
    'Counting ' + what + ' from one photo needs a measurement tool we don’t run yet — sample a row by hand for now.');
}

export function estimateFieldIntelligence(input: FieldInput = {}): FieldIntelligence {
  return _safe(() => {
    const snap = _safe(() => computeLifecycleSnapshot({
      crop: input.crop, cropId: input.cropId, plantingDate: input.plantingDate,
      mode: input.mode, climate: input.climate, setting: input.setting, nowMs: input.nowMs,
    }), null) as any;

    const hasPlantingDate = !!input.plantingDate;
    // Plant age is only honest WITH a planting date — never inferred without one.
    const age = (hasPlantingDate && snap) ? _num(snap.daysSincePlanting) : null;
    const hw = snap && snap.harvestWindow;
    const duration = snap && _num(snap.durationDays);

    // ── Calendar-based (real estimates; unknown without a planting date). ──
    const plantAge = age != null
      ? est(age, 'ok', 75, 'About ' + age + ' days since planting.')
      : est(null, 'unknown', 0, 'Add your planting date to estimate plant age.');

    const maturityDate = (hw && hw.expectedDate)
      ? est(hw.expectedDate, 'estimated', 55, 'Estimated from your crop calendar — refine with scans.')
      : est(null, 'unknown', 0, hasPlantingDate ? 'Crop calendar not available for this crop.' : 'Add planting date for a maturity estimate.');

    const harvestWindow = (hw && (hw.label || hw.startDate))
      ? est(hw.label || (hw.startDate + '–' + (hw.endDate || '')), 'estimated', 55, 'Estimated harvest window from the crop calendar.')
      : (duration != null
        ? est('~' + duration + ' days from planting', 'estimated', 40, 'Typical duration for this crop (no planting date yet).')
        : est(null, 'unknown', 0, 'Add planting date + crop for a harvest window.'));

    const growthVelocity = (age != null && duration != null && duration > 0)
      ? est(Math.round((age / duration) * 100) + '% through its cycle', 'estimated', 50, 'Position in the crop cycle from planting date.')
      : est(null, 'unknown', 0, 'Needs planting date + crop calendar.');

    // ── CV-dependent (honest unavailable; NEVER fabricated). ──
    return Object.freeze({
      version: FIELD_INTELLIGENCE_VERSION,
      plantAge, maturityDate, growthVelocity, harvestWindow,
      fruitCount: unavailable('fruit'),
      flowerCount: unavailable('flowers'),
      canopyCoverage: unavailable('canopy cover'),
      plantDensity: unavailable('plant density'),
      rowSpacing: unavailable('row spacing'),
      estimatedYield: est(null, 'unavailable', 0,
        'Yield needs measured plant counts + a harvest history — log harvests to build it (never guessed from a photo).'),
      estimatedBiomass: unavailable('biomass'),
      fieldCoverage: unavailable('field coverage'),
    });
  }, _empty());
}

function _empty(): FieldIntelligence {
  const u = unavailable('this');
  const unk = est(null, 'unknown', 0, 'Add planting date + crop.');
  return Object.freeze({
    version: FIELD_INTELLIGENCE_VERSION,
    plantAge: unk, maturityDate: unk, growthVelocity: unk, harvestWindow: unk,
    fruitCount: u, flowerCount: u, canopyCoverage: u, plantDensity: u, rowSpacing: u,
    estimatedYield: u, estimatedBiomass: u, fieldCoverage: u,
  });
}

export function fieldIntelligenceHealth() {
  const withDate = estimateFieldIntelligence({ crop: 'maize', plantingDate: '2026-05-01', nowMs: Date.now() });
  return Object.freeze({
    ok: true, version: FIELD_INTELLIGENCE_VERSION,
    calendarEstimable: ['plantAge', 'maturityDate', 'growthVelocity', 'harvestWindow'],
    cvUnavailable: ['fruitCount', 'flowerCount', 'canopyCoverage', 'plantDensity', 'rowSpacing',
      'estimatedYield', 'estimatedBiomass', 'fieldCoverage'],
    // Honesty attestation: CV fields are ALWAYS 'unavailable' (never fabricated).
    cvNeverFabricated: withDate.fruitCount.status === 'unavailable' && withDate.fruitCount.value === null,
    plantAgeEstimatedWithDate: withDate.plantAge.value != null,
  });
}

export function installFieldIntelligenceHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__fieldIntelligenceHealth) return;
    Object.defineProperty(window, '__fieldIntelligenceHealth', {
      configurable: true, enumerable: false, writable: false, value: () => fieldIntelligenceHealth(),
    });
  }, undefined);
}
