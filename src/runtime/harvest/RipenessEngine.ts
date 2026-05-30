/**
 * src/runtime/harvest/RipenessEngine.ts — pure deterministic
 * ripeness classifier. Maps (plantId, visual signals, scan
 * category, lifecycle stage) → ripeness status + confidence +
 * recommendation copy.
 *
 *   import { evaluateRipeness } from './RipenessEngine';
 *
 *   evaluateRipeness({
 *     plantId: 'tomato',
 *     scanCategory: 'healthy',
 *     color: 'red',
 *     defects: [],
 *   });
 *
 * Strict-rule audit
 *   • Pure function. Same input → same output.
 *   • Never throws — wraps every read in _safe.
 *   • Frozen output envelope.
 *   • No PII handled.
 *   • Copy is SAFE-WORDING only (no "guaranteed", "definitely",
 *     "confirmed harvest date"). The CI gate enforces this.
 */

import {
  RIPENESS_STATUS, BLOOM_STAGE,
  PLANT_CATEGORY, HARVEST_CATEGORY,
  type RipenessStatusValue, type BloomStageValue,
  type HarvestCategoryValue,
} from './harvestContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().trim() : '';
}

export interface RipenessInput {
  plantId:           string;
  color?:            string;
  size?:             string;
  texture?:          string;
  defects?:          ReadonlyArray<string>;
  diseaseSigns?:     ReadonlyArray<string>;
  pestSigns?:        ReadonlyArray<string>;
  scanCategory?:     string; // healthy / yellowing / pest / disease / unknown
  lifecycleStage?:   string;
}

export interface RipenessOutput {
  ripenessStatus:        RipenessStatusValue;
  bloomStage?:           BloomStageValue;
  category:              HarvestCategoryValue;
  confidence:            number;          // 0-100
  harvestReadinessScore: number;          // 0-100
  recommendationTitle:   string;
  recommendationBody:    string;
  needsReview:           boolean;
  estimatedHarvestWindow?: string;
}

/**
 * The classifier table. Each plant maps to a function that takes
 * the input signals and returns a partial output. Defaults fill in
 * missing fields. Functions are pure.
 */
type Rule = (sig: RipenessInput) => Partial<RipenessOutput>;

function _hasAny(arr: ReadonlyArray<string> | undefined, needles: string[]): boolean {
  if (!Array.isArray(arr)) return false;
  for (const a of arr) {
    const al = _lower(a);
    for (const n of needles) if (al.includes(n)) return true;
  }
  return false;
}

// ─── Fruit + Vegetable rules ──────────────────────────────────────

const ruleTomato: Rule = (sig) => {
  const c = _lower(sig.color);
  if (_hasAny(sig.defects, ['spot', 'rot', 'soft', 'mold'])
      || _hasAny(sig.diseaseSigns, ['blight', 'rot', 'spot'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 50 };
  }
  if (c.includes('green')) {
    return { ripenessStatus: RIPENESS_STATUS.NOT_READY, confidence: 70 };
  }
  if (c.includes('red') || c.includes('orange')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 75,
             estimatedHarvestWindow: 'today or within 1-2 days' };
  }
  if (c.includes('yellow') || c.includes('blush')) {
    return { ripenessStatus: RIPENESS_STATUS.ALMOST_READY, confidence: 65,
             estimatedHarvestWindow: '3-5 days' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleBanana: Rule = (sig) => {
  const c = _lower(sig.color);
  if (_hasAny(sig.defects, ['black', 'mush', 'brown bruis'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 55 };
  }
  if (c.includes('green')) {
    return { ripenessStatus: RIPENESS_STATUS.NOT_READY, confidence: 75,
             estimatedHarvestWindow: '5-10 days' };
  }
  if (c.includes('yellow')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 75,
             estimatedHarvestWindow: 'within 2-3 days' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleMango: Rule = (sig) => {
  const c = _lower(sig.color);
  if (_hasAny(sig.defects, ['black spot', 'rot', 'soft'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 50 };
  }
  if (c.includes('green') && _lower(sig.texture).includes('hard')) {
    return { ripenessStatus: RIPENESS_STATUS.NOT_READY, confidence: 75,
             estimatedHarvestWindow: '1-2 weeks' };
  }
  if (c.includes('yellow') || c.includes('orange') || c.includes('blush') || c.includes('red')) {
    return { ripenessStatus: RIPENESS_STATUS.ALMOST_READY, confidence: 70,
             estimatedHarvestWindow: 'within 3-5 days' };
  }
  if (c.includes('green')) {
    return { ripenessStatus: RIPENESS_STATUS.NOT_READY, confidence: 60 };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleAvocado: Rule = (sig) => {
  const c = _lower(sig.color);
  const t = _lower(sig.texture);
  if (_hasAny(sig.defects, ['black', 'mush', 'rot'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 50 };
  }
  if (t.includes('very soft') || t.includes('mushy')) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 60 };
  }
  if (t.includes('slightly soft') || c.includes('dark')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 70,
             estimatedHarvestWindow: 'today or within 1-2 days' };
  }
  if (t.includes('firm') || c.includes('green')) {
    return { ripenessStatus: RIPENESS_STATUS.ALMOST_READY, confidence: 60,
             estimatedHarvestWindow: '3-7 days' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleOrange: Rule = (sig) => {
  const c = _lower(sig.color);
  if (_hasAny(sig.defects, ['mold', 'soft', 'rot'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 50 };
  }
  if (c.includes('orange') || c.includes('yellow')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 70,
             estimatedHarvestWindow: 'within 1-2 weeks' };
  }
  if (c.includes('green')) {
    return { ripenessStatus: RIPENESS_STATUS.NOT_READY, confidence: 70 };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleLemon: Rule = (sig) => {
  const c = _lower(sig.color);
  if (_hasAny(sig.defects, ['mold', 'soft', 'rot'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 50 };
  }
  if (c.includes('yellow')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 70,
             estimatedHarvestWindow: 'within 1-2 weeks' };
  }
  if (c.includes('green')) {
    return { ripenessStatus: RIPENESS_STATUS.ALMOST_READY, confidence: 60,
             estimatedHarvestWindow: '1-3 weeks' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleLime: Rule = (sig) => {
  const c = _lower(sig.color);
  if (_hasAny(sig.defects, ['mold', 'soft', 'rot'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 50 };
  }
  if (c.includes('green') || c.includes('yellow-green')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 70,
             estimatedHarvestWindow: 'within 1-2 weeks' };
  }
  if (c.includes('yellow')) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 55 };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const rulePineapple: Rule = (sig) => {
  const c = _lower(sig.color);
  if (_hasAny(sig.defects, ['mold', 'soft', 'rot', 'brown leaves'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 55 };
  }
  if (c.includes('yellow') || c.includes('gold')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 70,
             estimatedHarvestWindow: 'within 3-5 days' };
  }
  if (c.includes('green')) {
    return { ripenessStatus: RIPENESS_STATUS.NOT_READY, confidence: 70 };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleApple: Rule = (sig) => {
  const c = _lower(sig.color);
  if (_hasAny(sig.defects, ['soft', 'mold', 'rot', 'wrinkled'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 55 };
  }
  if (c.includes('red') || c.includes('green-yellow') || c.includes('yellow')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 65,
             estimatedHarvestWindow: 'within 1-2 weeks' };
  }
  if (c.includes('green')) {
    return { ripenessStatus: RIPENESS_STATUS.ALMOST_READY, confidence: 55,
             estimatedHarvestWindow: '1-3 weeks' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleStrawberry: Rule = (sig) => {
  const c = _lower(sig.color);
  if (_hasAny(sig.defects, ['mold', 'soft', 'rot', 'dark red'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 60 };
  }
  if (c.includes('red')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 75,
             estimatedHarvestWindow: 'today or within 1-2 days' };
  }
  if (c.includes('white') || c.includes('green') || c.includes('pink')) {
    return { ripenessStatus: RIPENESS_STATUS.NOT_READY, confidence: 70,
             estimatedHarvestWindow: '3-7 days' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleWatermelon: Rule = (sig) => {
  const c = _lower(sig.color);
  const t = _lower(sig.texture);
  if (_hasAny(sig.defects, ['crack', 'soft', 'rot'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 55 };
  }
  if (c.includes('brown tendril') || t.includes('hollow sound')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 65,
             estimatedHarvestWindow: 'within 3-5 days' };
  }
  if (c.includes('green stem') || c.includes('green tendril')) {
    return { ripenessStatus: RIPENESS_STATUS.NOT_READY, confidence: 60 };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const rulePepper: Rule = (sig) => {
  const c = _lower(sig.color);
  if (_hasAny(sig.defects, ['black', 'soft', 'mold', 'rot'])) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 55 };
  }
  if (c.includes('red') || c.includes('yellow') || c.includes('orange')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 70,
             estimatedHarvestWindow: 'within 1-3 days' };
  }
  if (c.includes('green')) {
    // Green pepper is often usable — almost_ready by default.
    return { ripenessStatus: RIPENESS_STATUS.ALMOST_READY, confidence: 60,
             estimatedHarvestWindow: '5-10 days' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleCucumber: Rule = (sig) => {
  const c = _lower(sig.color);
  const t = _lower(sig.texture);
  if (_hasAny(sig.defects, ['yellow', 'soft', 'mold', 'bloat'])
      || c.includes('yellow')) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 60 };
  }
  if (c.includes('green') && (t.includes('firm') || !t)) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 65,
             estimatedHarvestWindow: 'within 1-2 days' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleEggplant: Rule = (sig) => {
  const c = _lower(sig.color);
  const t = _lower(sig.texture);
  if (_hasAny(sig.defects, ['wrinkle', 'dull', 'soft', 'mold'])
      || t.includes('wrinkled') || t.includes('dull')) {
    return { ripenessStatus: RIPENESS_STATUS.OVERRIPE,
             needsReview: true, confidence: 55 };
  }
  if ((c.includes('purple') || c.includes('dark'))
      && (t.includes('glossy') || !t)) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 65,
             estimatedHarvestWindow: 'within 1-3 days' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

// ─── Crop rules ───────────────────────────────────────────────────

const ruleMaize: Rule = (sig) => {
  const c = _lower(sig.color);
  const stage = _lower(sig.lifecycleStage);
  if (c.includes('brown silk') || stage.includes('mature')
      || stage.includes('hard dough')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 70,
             estimatedHarvestWindow: 'within 5-10 days' };
  }
  if (c.includes('green silk') || stage.includes('milk')) {
    return { ripenessStatus: RIPENESS_STATUS.ALMOST_READY, confidence: 60,
             estimatedHarvestWindow: '2-3 weeks' };
  }
  if (stage.includes('flower') || stage.includes('tassel')) {
    return { ripenessStatus: RIPENESS_STATUS.NOT_READY, confidence: 60 };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleRice: Rule = (sig) => {
  const c = _lower(sig.color);
  const stage = _lower(sig.lifecycleStage);
  if (c.includes('gold') || c.includes('yellow') || stage.includes('ripen')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 65,
             estimatedHarvestWindow: 'within 7-14 days' };
  }
  if (c.includes('green')) {
    return { ripenessStatus: RIPENESS_STATUS.NOT_READY, confidence: 60 };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleCassava: Rule = (sig) => {
  const stage = _lower(sig.lifecycleStage);
  if (stage.includes('mature') || stage.includes('8 month')
      || stage.includes('12 month')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 55,
             estimatedHarvestWindow: 'within 2-4 weeks' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleYam: Rule = (sig) => {
  const c = _lower(sig.color);
  const stage = _lower(sig.lifecycleStage);
  if (c.includes('vine yellow') || stage.includes('vine die')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 60,
             estimatedHarvestWindow: 'within 1-3 weeks' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleSoybean: Rule = (sig) => {
  const c = _lower(sig.color);
  const stage = _lower(sig.lifecycleStage);
  if (c.includes('leaf yellow') || stage.includes('mature pod')
      || stage.includes('r8')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 65,
             estimatedHarvestWindow: 'within 5-10 days' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

const ruleGroundnut: Rule = (sig) => {
  const c = _lower(sig.color);
  const stage = _lower(sig.lifecycleStage);
  if (c.includes('leaf yellow') || stage.includes('mature')) {
    return { ripenessStatus: RIPENESS_STATUS.READY, confidence: 60,
             estimatedHarvestWindow: 'within 1-2 weeks' };
  }
  return { ripenessStatus: RIPENESS_STATUS.UNKNOWN, needsReview: true,
           confidence: 35 };
};

// ─── Flower rules → bloom stage ───────────────────────────────────

const ruleFlower = (defaultPlantName: string): Rule => (sig) => {
  const stage = _lower(sig.lifecycleStage);
  const c = _lower(sig.color);
  let bloom: BloomStageValue = BLOOM_STAGE.UNKNOWN;
  let conf = 35;
  let window: string | undefined;
  if (stage.includes('bud') || c.includes('green bud')) {
    bloom = BLOOM_STAGE.BUDDING; conf = 65; window = 'opens in 3-7 days';
  } else if (stage.includes('peak') || stage.includes('full bloom')) {
    bloom = BLOOM_STAGE.PEAK_BLOOM; conf = 70; window = 'best cut window: today';
  } else if (stage.includes('open') || stage.includes('blooming')) {
    bloom = BLOOM_STAGE.BLOOMING; conf = 65; window = 'peak in 1-3 days';
  } else if (stage.includes('wilt') || stage.includes('past')
             || _hasAny(sig.defects, ['petal drop', 'wilt'])) {
    bloom = BLOOM_STAGE.PAST_BLOOM; conf = 55;
  }
  // Map bloom stage → ripeness analogue so the result envelope stays
  // shape-stable for the UI gate.
  let ripeness: RipenessStatusValue = RIPENESS_STATUS.UNKNOWN;
  switch (bloom) {
    case BLOOM_STAGE.BUDDING:    ripeness = RIPENESS_STATUS.NOT_READY; break;
    case BLOOM_STAGE.BLOOMING:   ripeness = RIPENESS_STATUS.ALMOST_READY; break;
    case BLOOM_STAGE.PEAK_BLOOM: ripeness = RIPENESS_STATUS.READY; break;
    case BLOOM_STAGE.PAST_BLOOM: ripeness = RIPENESS_STATUS.OVERRIPE; break;
    default: ripeness = RIPENESS_STATUS.UNKNOWN;
  }
  return {
    ripenessStatus: ripeness,
    bloomStage: bloom,
    confidence: conf,
    needsReview: bloom === BLOOM_STAGE.UNKNOWN,
    estimatedHarvestWindow: window,
  };
  void defaultPlantName; // reserved for plant-specific overrides
};

// ─── Rule table ───────────────────────────────────────────────────

const RULES: Readonly<Record<string, Rule>> = Object.freeze({
  tomato: ruleTomato, pepper: rulePepper,
  cucumber: ruleCucumber, eggplant: ruleEggplant,
  mango: ruleMango, banana: ruleBanana, avocado: ruleAvocado,
  orange: ruleOrange, lemon: ruleLemon, lime: ruleLime,
  pineapple: rulePineapple, apple: ruleApple,
  strawberry: ruleStrawberry, watermelon: ruleWatermelon,
  maize: ruleMaize, rice: ruleRice, cassava: ruleCassava,
  yam: ruleYam, soybean: ruleSoybean, groundnut: ruleGroundnut,
  rose: ruleFlower('rose'), hibiscus: ruleFlower('hibiscus'),
  sunflower: ruleFlower('sunflower'), marigold: ruleFlower('marigold'),
  // Wave-28 risk-fix #5 — generic-bloom flowers; the ruleFlower
  // factory handles all four with the same bud→peak→past pattern.
  orchid: ruleFlower('orchid'), lily: ruleFlower('lily'),
  dahlia: ruleFlower('dahlia'), daisy: ruleFlower('daisy'),
});

// ─── Recommendation copy — SAFE-WORDING ONLY ─────────────────────

function _copyFor(status: RipenessStatusValue, plantName: string,
                  window: string | undefined): { title: string; body: string } {
  const win = window ? ` Estimated window: ${window}.` : '';
  switch (status) {
    case RIPENESS_STATUS.READY:
      return {
        title: `${plantName} appears likely ready to harvest`,
        body:  `Visual signals suggest the ${plantName} is at a typical harvest point.${win} Inspect closely before cutting.`,
      };
    case RIPENESS_STATUS.ALMOST_READY:
      return {
        title: `${plantName} appears almost ready`,
        body:  `Color and stage signals suggest the ${plantName} is approaching harvest.${win} Monitor again in a few days.`,
      };
    case RIPENESS_STATUS.NOT_READY:
      return {
        title: `${plantName} is not yet ready`,
        body:  `Continue normal care and scan again later.${win}`,
      };
    case RIPENESS_STATUS.OVERRIPE:
      return {
        title: `${plantName} needs another look`,
        body:  `Visual signals suggest the ${plantName} may be past its peak or showing damage. Inspect for rot, pests, or removal.`,
      };
    default:
      return {
        title: `${plantName} — readiness unclear`,
        body:  `The current photo doesn't give us enough signal. Try another angle in better light, or scan again in a few days.`,
      };
  }
}

// ─── Public entry ─────────────────────────────────────────────────

/**
 * evaluateRipeness — pure, never throws. Returns a frozen
 * RipenessOutput envelope. If the plant isn't supported, the
 * envelope reports UNKNOWN + needsReview: true; the harvest
 * runtime then suppresses the UI card.
 */
export function evaluateRipeness(input: RipenessInput): Readonly<RipenessOutput> {
  return _safe(() => {
    const pid = _lower(input.plantId);
    const category = PLANT_CATEGORY[pid] || HARVEST_CATEGORY.UNKNOWN;
    const rule = RULES[pid];
    if (!rule || category === HARVEST_CATEGORY.UNKNOWN) {
      return Object.freeze({
        ripenessStatus:        RIPENESS_STATUS.UNKNOWN,
        category:              HARVEST_CATEGORY.UNKNOWN,
        confidence:            0,
        harvestReadinessScore: 0,
        recommendationTitle:   '',
        recommendationBody:    '',
        needsReview:           true,
      });
    }
    const out = rule(input);
    const status = out.ripenessStatus || RIPENESS_STATUS.UNKNOWN;
    const conf   = typeof out.confidence === 'number' ? out.confidence : 35;
    // harvestReadinessScore: derived from status (deterministic).
    const score =
      status === RIPENESS_STATUS.READY        ? 90 :
      status === RIPENESS_STATUS.ALMOST_READY ? 65 :
      status === RIPENESS_STATUS.NOT_READY    ? 25 :
      status === RIPENESS_STATUS.OVERRIPE     ? 30 : 0;
    const plantName = pid.charAt(0).toUpperCase() + pid.slice(1);
    const copy = _copyFor(status, plantName, out.estimatedHarvestWindow);
    return Object.freeze({
      ripenessStatus:        status,
      bloomStage:            out.bloomStage,
      category,
      confidence:            Math.max(0, Math.min(100, conf)),
      harvestReadinessScore: score,
      recommendationTitle:   copy.title,
      recommendationBody:    copy.body,
      needsReview:           !!out.needsReview
                              || status === RIPENESS_STATUS.UNKNOWN,
      estimatedHarvestWindow: out.estimatedHarvestWindow,
    });
  }, Object.freeze({
    ripenessStatus:        RIPENESS_STATUS.UNKNOWN,
    category:              HARVEST_CATEGORY.UNKNOWN,
    confidence:            0,
    harvestReadinessScore: 0,
    recommendationTitle:   '',
    recommendationBody:    '',
    needsReview:           true,
  }));
}

export const RIPENESS_ENGINE_VERSION = 'ripeness-engine-v1';
