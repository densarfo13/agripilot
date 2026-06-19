/**
 * CropStageEngine.ts — sprint #208, spec §2.
 *
 * Infers crop growth stage + days-after-planting from the planting
 * date, using published approximate stage durations for the 10 pilot
 * crops. This is REAL horticultural data (well-known DAP ranges), not
 * fabricated intelligence: with no planting date we return confidence
 * null and stage 'unknown' rather than guessing.
 *
 * Pure. SSR-safe. Never throws. Frozen returns. No provider, no
 * satellite, no Date.now() in the engine itself — the caller passes
 * `asOf` (the page already has a current date in scope).
 */

export const CROP_STAGE_ENGINE_VERSION = 'crop-stage-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export type CropStage =
  | 'germination' | 'seedling' | 'vegetative'
  | 'flowering' | 'fruiting' | 'maturity' | 'unknown';

// Per-crop stage boundaries in days-after-planting. Upper bound of
// each stage; the last (maturity) is open-ended. Approximate field
// ranges — honest agronomy, not a guarantee. Non-fruiting crops
// (maize, rice, cassava, beans, cabbage) map 'fruiting' to grain/
// head/tuber fill, which is the agronomically equivalent phase.
const STAGE_TABLE: Readonly<Record<string, ReadonlyArray<readonly [CropStage, number]>>> = Object.freeze({
  onion:    [['germination', 10], ['seedling', 30], ['vegetative', 70], ['flowering', 95], ['fruiting', 120], ['maturity', 150]],
  tomato:   [['germination', 8],  ['seedling', 25], ['vegetative', 45], ['flowering', 65], ['fruiting', 90],  ['maturity', 120]],
  pepper:   [['germination', 10], ['seedling', 30], ['vegetative', 55], ['flowering', 75], ['fruiting', 100], ['maturity', 130]],
  okra:     [['germination', 7],  ['seedling', 20], ['vegetative', 40], ['flowering', 55], ['fruiting', 75],  ['maturity', 100]],
  maize:    [['germination', 9],  ['seedling', 25], ['vegetative', 55], ['flowering', 70], ['fruiting', 95],  ['maturity', 120]],
  cassava:  [['germination', 20], ['seedling', 60], ['vegetative', 150],['flowering', 210],['fruiting', 270], ['maturity', 330]],
  rice:     [['germination', 10], ['seedling', 30], ['vegetative', 60], ['flowering', 85], ['fruiting', 110], ['maturity', 135]],
  beans:    [['germination', 8],  ['seedling', 20], ['vegetative', 35], ['flowering', 50], ['fruiting', 70],  ['maturity', 90]],
  cabbage:  [['germination', 10], ['seedling', 30], ['vegetative', 60], ['flowering', 80], ['fruiting', 95],  ['maturity', 110]],
  cucumber: [['germination', 7],  ['seedling', 18], ['vegetative', 35], ['flowering', 48], ['fruiting', 65],  ['maturity', 85]],
});

export const SUPPORTED_CROPS: ReadonlyArray<string> = Object.freeze(Object.keys(STAGE_TABLE));

function _normCrop(crop: string): string {
  const c = _str(crop).toLowerCase();
  // common aliases → canonical key
  if (c === 'corn') return 'maize';
  if (c === 'chili' || c === 'chilli' || c === 'capsicum') return 'pepper';
  if (c === 'manioc' || c === 'yuca') return 'cassava';
  return c;
}

function _daysBetween(plantingISO: string, asOfISO: string): number | null {
  return _safe(() => {
    const p = new Date(plantingISO);
    const a = asOfISO ? new Date(asOfISO) : new Date(plantingISO);
    if (isNaN(p.getTime()) || isNaN(a.getTime())) return null;
    const ms = a.getTime() - p.getTime();
    return Math.max(0, Math.round(ms / 86400000));
  }, null);
}

export interface CropStageResult {
  runtimeVersion:    string;
  crop:              string | null;
  supported:         boolean;
  daysAfterPlanting: number | null;
  stage:             CropStage;
  confidence:        number | null;   // null when not computable — never faked
  stages:            ReadonlyArray<CropStage>;
}

/**
 * Infer the stage. `asOf` is the reference date (ISO yyyy-mm-dd); the
 * caller supplies it so the engine stays pure/deterministic.
 */
export function inferCropStage(input: {
  crop?: string;
  plantingDate?: string;
  asOf?: string;
  weatherNote?: string;
} = {}): Readonly<CropStageResult> {
  return _safe(() => {
    const crop = _normCrop(_str(input.crop));
    const table = crop ? STAGE_TABLE[crop] : undefined;
    const supported = !!table;
    const stages: CropStage[] = table
      ? table.map((t) => t[0])
      : ['germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'maturity'];

    const planting = _str(input.plantingDate);
    const dap = planting ? _daysBetween(planting, _str(input.asOf)) : null;

    let stage: CropStage = 'unknown';
    let confidence: number | null = null;

    if (table && dap != null) {
      stage = 'maturity';
      for (const [st, upper] of table) {
        if (dap <= upper) { stage = st; break; }
      }
      // Confidence: high mid-cycle where stage boundaries are clear,
      // a little lower very early (germination overlap) and past the
      // last boundary (over-mature uncertainty). Honest, bounded.
      const last = table[table.length - 1][1];
      if (dap > last) confidence = 55;          // beyond table — uncertain
      else if (dap <= table[0][1]) confidence = 65; // germination window
      else confidence = 80;
    } else if (table && dap == null) {
      // Crop known, no date → we can name the stages but not the stage.
      confidence = null;
    }

    return Object.freeze({
      runtimeVersion: CROP_STAGE_ENGINE_VERSION,
      crop: crop || null,
      supported,
      daysAfterPlanting: dap,
      stage,
      confidence,
      stages: Object.freeze(stages),
    });
  }, Object.freeze({
    runtimeVersion: CROP_STAGE_ENGINE_VERSION,
    crop: null, supported: false, daysAfterPlanting: null,
    stage: 'unknown' as const, confidence: null,
    stages: Object.freeze(['germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'maturity'] as CropStage[]),
  }));
}

export const _internal = Object.freeze({ inferCropStage, SUPPORTED_CROPS, STAGE_TABLE });
export default inferCropStage;
