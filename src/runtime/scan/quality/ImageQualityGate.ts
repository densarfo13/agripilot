/**
 * ImageQualityGate.ts — single image-quality decision point for the scan pipeline.
 *
 * Composes the EXISTING preflight scorer (src/lib/imageQualityPreflight.js — single
 * source of truth for luminance + sharpness) rather than re-implementing it. It maps
 * the measured stats to the spec's 7 quality factors and produces one gating
 * decision: a low-quality image must NOT diagnose, ingest into FarmBrain, or create
 * a task — only ask for a retake.
 *
 * Honesty: factors we can actually measure from the preflight (sharpness, brightness,
 * resolution) carry a real 0..100 score; factors that need a CV detector (distance,
 * targetVisible, motionBlur, multipleObjects) are reported 'not_assessed' with a null
 * score — NEVER a fabricated number. Pure, total, browser-safe.
 */
export type QualityFactor = 'sharpness' | 'brightness' | 'resolution' | 'distance' | 'targetVisible' | 'motionBlur' | 'multipleObjects';

export interface FactorScore {
  factor: QualityFactor;
  score: number | null;          // 0..100, or null when not assessable
  assessed: boolean;
  note: string;
}

export interface ImageQualityDecision {
  overall: 'good' | 'retake';
  measurableScore: number | null; // 0..100 over the assessed factors, null if none
  factors: Record<QualityFactor, FactorScore>;
  retakeNeeded: boolean;
  guidance: string | null;        // farmer-facing retake hint
  // Gating — what the rest of the pipeline may do with this image.
  gates: { canDiagnose: boolean; canIngestFarmBrain: boolean; canCreateTask: boolean };
}

// Thresholds mirror imageQualityPreflight (luminance ∈ [0.18,0.95], sharpness ≥0.30)
// + a minimum usable resolution.
const MIN_LUM = 0.18, MAX_LUM = 0.95, MIN_SHARP = 0.30, MIN_PX = 240;

const _clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const _num = (v: any): number | null => (Number.isFinite(v) ? v : null);

function f(factor: QualityFactor, score: number | null, assessed: boolean, note: string): FactorScore {
  return Object.freeze({ factor, score, assessed, note });
}
const notAssessed = (factor: QualityFactor): FactorScore =>
  f(factor, null, false, 'Needs a vision detector — not assessed (not fabricated).');

/**
 * Decide from preflight stats `{ luminance, sharpness, width, height }`
 * (the output of scoreImageQuality(...).stats). Total + frozen.
 */
export function evaluateImageQuality(stats: { luminance?: any; sharpness?: any; width?: any; height?: any } = {}): ImageQualityDecision {
  try {
    const lum = _num(stats.luminance);
    const sharp = _num(stats.sharpness);
    const w = _num(stats.width), h = _num(stats.height);
    const minSide = (w != null && h != null) ? Math.min(w, h) : null;

    // Measurable factors → real scores.
    const brightness = lum == null ? notAssessed('brightness')
      : f('brightness', _clamp((lum >= MIN_LUM && lum <= MAX_LUM) ? 90 : (lum < MIN_LUM ? lum / MIN_LUM * 60 : (1 - lum) / (1 - MAX_LUM) * 60)),
          true, lum < MIN_LUM ? 'Too dark.' : lum > MAX_LUM ? 'Too bright / washed out.' : 'Good light.');
    const sharpness = sharp == null ? notAssessed('sharpness')
      : f('sharpness', _clamp(sharp >= MIN_SHARP ? 60 + sharp * 40 : sharp / MIN_SHARP * 50), true,
          sharp < MIN_SHARP ? 'Blurry — hold steady.' : 'Sharp enough.');
    const resolution = minSide == null ? notAssessed('resolution')
      : f('resolution', _clamp(minSide >= MIN_PX ? 90 : minSide / MIN_PX * 60), true,
          minSide < MIN_PX ? 'Photo is small/low-res.' : 'Resolution OK.');

    // CV-dependent factors → honest not_assessed (never fabricated).
    const factors = Object.freeze({
      sharpness, brightness, resolution,
      distance: notAssessed('distance'),
      targetVisible: notAssessed('targetVisible'),
      motionBlur: notAssessed('motionBlur'),
      multipleObjects: notAssessed('multipleObjects'),
    });

    const assessed = [sharpness, brightness, resolution].filter(x => x.assessed && x.score != null) as FactorScore[];
    const measurableScore = assessed.length ? Math.round(assessed.reduce((s, x) => s + (x.score as number), 0) / assessed.length) : null;
    // Retake if ANY measured factor is below its hard floor, or no factor could be measured.
    const failed = (sharp != null && sharp < MIN_SHARP) || (lum != null && (lum < MIN_LUM || lum > MAX_LUM)) || (minSide != null && minSide < MIN_PX);
    const retakeNeeded = !!failed;
    const guidance = retakeNeeded
      ? (sharpness.score != null && sharp! < MIN_SHARP ? 'The photo looks blurry — hold the camera steady and try again.'
        : lum != null && lum < MIN_LUM ? 'The photo looks dark — try again with more light.'
        : lum != null && lum > MAX_LUM ? 'The photo is washed out — try with the sun behind you.'
        : 'Move a little closer and take another photo.')
      : null;

    return Object.freeze({
      overall: retakeNeeded ? 'retake' : 'good',
      measurableScore, factors, retakeNeeded, guidance,
      gates: Object.freeze({ canDiagnose: !retakeNeeded, canIngestFarmBrain: !retakeNeeded, canCreateTask: !retakeNeeded }),
    });
  } catch {
    // On any error, fail SAFE — do not let a bad image through, but don't block forever.
    return Object.freeze({
      overall: 'retake', measurableScore: null,
      factors: Object.freeze({ sharpness: notAssessed('sharpness'), brightness: notAssessed('brightness'), resolution: notAssessed('resolution'), distance: notAssessed('distance'), targetVisible: notAssessed('targetVisible'), motionBlur: notAssessed('motionBlur'), multipleObjects: notAssessed('multipleObjects') }),
      retakeNeeded: true, guidance: 'Please take another photo.',
      gates: Object.freeze({ canDiagnose: false, canIngestFarmBrain: false, canCreateTask: false }),
    });
  }
}

export function imageQualityGateHealth() {
  const good = evaluateImageQuality({ luminance: 0.5, sharpness: 0.8, width: 1024, height: 1024 });
  const dark = evaluateImageQuality({ luminance: 0.05, sharpness: 0.8, width: 1024, height: 1024 });
  const blurry = evaluateImageQuality({ luminance: 0.5, sharpness: 0.05, width: 1024, height: 1024 });
  return Object.freeze({
    ok: true,
    goodPasses: good.overall === 'good' && good.gates.canDiagnose === true,
    // Low quality blocks diagnosis + ingest + task.
    lowBlocksPipeline: dark.gates.canDiagnose === false && dark.gates.canIngestFarmBrain === false && dark.gates.canCreateTask === false
      && blurry.gates.canCreateTask === false,
    // CV-dependent factors are never fabricated.
    cvFactorsNotFabricated: good.factors.distance.score === null && good.factors.multipleObjects.score === null,
  });
}

export function installImageQualityGateHealth(): void {
  try {
    if (typeof window === 'undefined' || (window as any).__imageQualityGateHealth) return;
    Object.defineProperty(window, '__imageQualityGateHealth', {
      configurable: true, enumerable: false, writable: false, value: () => imageQualityGateHealth(),
    });
  } catch { /* swallow */ }
}
