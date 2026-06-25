/**
 * ScanSpecializedEngines.ts — UNIVERSAL SCANNER, Phase 6.
 *
 * Per-object advisors: Fruit, Flower, Leaf, Insect. The honesty rule is strict:
 * Farroway has NO trained ripeness/damage/bloom computer-vision model, so these
 * engines do NOT emit a fabricated "80% ripe" / "bloom stage 3" number. They
 * give honest, crop-aware guidance and compose the REAL signals that exist (the
 * FarmBrainV2 disease likelihood + the identified plant). Anything we cannot
 * measure is returned as `assessed:false` with a "check by hand" prompt — never
 * an invented score.
 *
 * Pure, total, never throws. Farmer-facing wording only (no AI/model/provider).
 */
const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _num = (v: any): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface EngineFinding {
  /** Was this measured from the photo, or is it guidance to check by hand? */
  assessed: boolean;
  label: string;
  value: string | null;     // null when not measurable — NEVER fabricated
  guidance: string;
}
export interface SpecializedResult {
  engine: 'fruit' | 'flower' | 'leaf' | 'insect';
  findings: ReadonlyArray<EngineFinding>;
  note: string;
}

function _f(assessed: boolean, label: string, value: string | null, guidance: string): EngineFinding {
  return Object.freeze({ assessed, label, value, guidance });
}

/** Fruit: ripeness / damage / harvest readiness — guidance, not invented scores. */
export function fruitEngine(result: any = {}): SpecializedResult {
  return _safe(() => {
    const crop = String(result.cropName || result.plantName || 'this fruit');
    return Object.freeze({
      engine: 'fruit' as const,
      findings: Object.freeze([
        _f(false, 'Ripeness', null,
          `Check ${crop} by hand: colour, firmness and smell tell you more than a photo.`),
        _f(false, 'Damage', null,
          'Look for soft spots, cracks or insect holes; set damaged fruit aside.'),
        _f(false, 'Harvest readiness', null,
          'Harvest when colour is even and the fruit parts easily from the stem.'),
      ]),
      note: 'Visual ripeness scoring is not available yet — this is general harvest guidance.',
    });
  }, Object.freeze({ engine: 'fruit', findings: Object.freeze([]), note: '' }));
}

/** Flower: bloom stage / pollinator advice. */
export function flowerEngine(result: any = {}): SpecializedResult {
  return _safe(() => {
    const crop = String(result.cropName || result.plantName || 'this flower');
    return Object.freeze({
      engine: 'flower' as const,
      findings: Object.freeze([
        _f(false, 'Bloom stage', null,
          `Compare ${crop} to bud / opening / full-bloom / fading by eye.`),
        _f(true, 'Pollinator advice', 'Encourage bees',
          'Avoid spraying during open bloom; pollinators are most active mid-morning.'),
      ]),
      note: 'Bloom stage is judged by eye — no photo score is given.',
    });
  }, Object.freeze({ engine: 'flower', findings: Object.freeze([]), note: '' }));
}

/** Leaf: disease / nutrient stress / water stress — composes the REAL FarmBrainV2 signal. */
export function leafEngine(result: any = {}): SpecializedResult {
  return _safe(() => {
    const fb = result.farmBrain || {};
    const disease = _num(fb.diseaseLikelihood);
    const diseaseFinding = disease != null
      ? _f(true, 'Disease', disease >= 60 ? 'Signs detected' : 'Low signs',
          disease >= 60 ? 'Follow the recommended treatment and re-check in 3 days.'
            : 'Keep watching; no strong disease signs.')
      : _f(false, 'Disease', null, 'Scan a clear leaf in good light to check for disease.');
    return Object.freeze({
      engine: 'leaf' as const,
      findings: Object.freeze([
        diseaseFinding,
        _f(false, 'Nutrient stress', null,
          'Yellowing between veins can mean a nutrient gap — compare old vs new leaves.'),
        _f(false, 'Water stress', null,
          'Wilting in cool morning hours suggests too little water; check soil moisture.'),
      ]),
      note: 'Disease uses the scan signal; nutrient and water are guidance to confirm by hand.',
    });
  }, Object.freeze({ engine: 'leaf', findings: Object.freeze([]), note: '' }));
}

/** Insect: pest identification / threat / control guidance. */
export function insectEngine(result: any = {}): SpecializedResult {
  return _safe(() => {
    const named = String(result.detectedInsect || result.cropName || '').trim();
    const idFinding = named
      ? _f(true, 'Pest', named, 'Confirm against the photo before treating.')
      : _f(false, 'Pest', null, 'Insect identification is not connected yet — describe it to a field officer.');
    return Object.freeze({
      engine: 'insect' as const,
      findings: Object.freeze([
        idFinding,
        _f(false, 'Threat', null,
          'Check how many plants are affected; a few insects rarely need spraying.'),
        _f(false, 'Control', null,
          'Start with the least-harmful step: handpick, trap or a soap spray before chemicals.'),
      ]),
      note: 'Pest control guidance favours the safest effective step first.',
    });
  }, Object.freeze({ engine: 'insect', findings: Object.freeze([]), note: '' }));
}

/** Pick the engine for an object type (from the classifier). */
export function specializedEngineFor(objectType: string, result: any = {}): SpecializedResult | null {
  switch (objectType) {
    case 'fruit':
    case 'vegetable': return fruitEngine(result);
    case 'flower': return flowerEngine(result);
    case 'leaf':
    case 'wholePlant':
    case 'seedling':
    case 'tree': return leafEngine(result);
    case 'insect': return insectEngine(result);
    default: return null;
  }
}

export const SPECIALIZED_ENGINES = Object.freeze(['fruit', 'flower', 'leaf', 'insect']);
