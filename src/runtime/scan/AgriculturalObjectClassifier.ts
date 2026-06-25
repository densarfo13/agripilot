/**
 * AgriculturalObjectClassifier.ts — UNIVERSAL SCANNER, Phase 1 + 2.
 *
 * One Scan button. The farmer never picks Plant/Leaf/Fruit/Flower/Insect — this
 * classifier decides WHAT is in the photo and WHICH providers to route to. It
 * COMPOSES the shipped detectScanType() (leaf/whole_plant/fruit/vegetable/
 * insect/soil) and extends it with the three classes that router did not cover:
 * flower, tree, seedling.
 *
 * Honest: every class carries a confidence; below the 70% floor the routing
 * decision is flagged low-confidence so the result card coaches a retake
 * instead of asserting a guess. It never fabricates an object type to look
 * decisive — an ambiguous photo stays `unknown`.
 *
 * Pure, total, never throws. Pins window.__agriClassifierHealth().
 */
import { detectScanType } from './router/ScanTypeRouter';

export const AGRI_CLASSIFIER_VERSION = 'agri-object-classifier-v1';
export const AGRI_CONFIDENCE_MIN = 70;

export type AgriObjectType =
  | 'leaf' | 'wholePlant' | 'fruit' | 'vegetable' | 'flower'
  | 'tree' | 'seedling' | 'insect' | 'soil'
  // v10 — extended object coverage (no redesign; same classify→route contract).
  | 'herb' | 'seed' | 'grass' | 'shrub' | 'houseplant'
  | 'hydroponic' | 'greenhouse' | 'weed'
  | 'unknown';

export const AGRI_OBJECT_TYPES: ReadonlyArray<AgriObjectType> = Object.freeze([
  'leaf', 'wholePlant', 'fruit', 'vegetable', 'flower',
  'tree', 'seedling', 'insect', 'soil',
  'herb', 'seed', 'grass', 'shrub', 'houseplant', 'hydroponic', 'greenhouse', 'weed',
  'unknown',
]);

/** Ordered provider/engine steps per object type (Phase 2). */
export const AGRI_ROUTING: Readonly<Record<AgriObjectType, ReadonlyArray<string>>> = Object.freeze({
  leaf:       Object.freeze(['plant.id', 'crop.health']),
  wholePlant: Object.freeze(['plant.id', 'crop.health']),
  fruit:      Object.freeze(['plant.id', 'ripeness_engine', 'damage_assessment']),
  vegetable:  Object.freeze(['plant.id', 'ripeness_engine', 'quality_assessment']),
  flower:     Object.freeze(['plant.id', 'flower_engine']),
  tree:       Object.freeze(['plant.id']),
  seedling:   Object.freeze(['plant.id', 'crop.health']),
  insect:     Object.freeze(['insect.id', 'insect_engine']),
  soil:       Object.freeze(['soil_visual']),
  // v10 routes — identify via plant.id where applicable; weed → identify + advise.
  herb:       Object.freeze(['plant.id', 'crop.health']),
  seed:       Object.freeze(['plant.id']),
  grass:      Object.freeze(['plant.id']),
  shrub:      Object.freeze(['plant.id', 'crop.health']),
  houseplant: Object.freeze(['plant.id', 'crop.health']),
  hydroponic: Object.freeze(['plant.id', 'crop.health']),
  greenhouse: Object.freeze(['plant.id', 'crop.health']),
  weed:       Object.freeze(['plant.id', 'weed_engine']),
  unknown:    Object.freeze(['review']),
});

export interface RoutingDecision {
  providers: ReadonlyArray<string>;
  lowConfidence: boolean;
  /** Farmer-facing safety line when low confidence (Phase 7). */
  safetyMessage: string | null;
  reason: string;
}

export interface AgriClassification {
  version: string;
  objectType: AgriObjectType;
  confidence: number;            // 0..100
  routingDecision: RoutingDecision;
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');

// The three classes the shipped router doesn't separate. Checked BEFORE we fall
// back to detectScanType, since "tree"/"flower"/"seedling" hints are specific.
const FLOWER_RE = /\b(flower|bloom|blossom|petal|rose|hibiscus|marigold|sunflower|orchid|lily|inflorescence)\b/i;
const TREE_RE = /\b(tree|trunk|sapling|mango tree|orchard|canopy|bark|cocoa tree|citrus tree)\b/i;
const SEEDLING_RE = /\b(seedling|sprout|germinat|nursery|transplant|cotyledon|young plant)\b/i;
// v10 extended-object detectors. Ordered most-specific first in the classify flow.
const SEED_RE = /\b(seed|seeds|grain|kernel|pip|bean seed)\b/i;
const HYDRO_RE = /\b(hydroponic|hydroponics|nft|deep water culture|nutrient film|aeroponic)\b/i;
const GREENHOUSE_RE = /\b(greenhouse|polytunnel|poly tunnel|glasshouse|hoop house|tunnel crop)\b/i;
const HOUSEPLANT_RE = /\b(houseplant|house plant|indoor plant|potted plant|pot plant|monstera|pothos|succulent)\b/i;
const HERB_RE = /\b(herb|basil|mint|coriander|cilantro|parsley|thyme|rosemary|oregano|sage|chive)\b/i;
const WEED_RE = /\b(weed|weeds|invasive|nutgrass|amaranth weed|striga|witchweed|pigweed|crabgrass)\b/i;
const GRASS_RE = /\b(grass|lawn|turf|pasture|fodder grass|napier|brachiaria)\b/i;
const SHRUB_RE = /\b(shrub|bush|hedge|woody bush)\b/i;

function _hintFrom(input: any): string {
  const r = (input && typeof input === 'object') ? input : {};
  return (_str(r.objectType) + ' ' + _str(r.scanMode) + ' ' + _str(r.plantName)
    + ' ' + _str(r.name) + ' ' + _str(r.possibleIssue) + ' ' + _str(r.category)).toLowerCase();
}

function _routing(objectType: AgriObjectType, confidence: number, reason: string): RoutingDecision {
  const lowConfidence = confidence < AGRI_CONFIDENCE_MIN;
  return Object.freeze({
    providers: AGRI_ROUTING[objectType] || AGRI_ROUTING.unknown,
    lowConfidence,
    safetyMessage: lowConfidence ? "We're not confident enough." : null,
    reason,
  });
}

/**
 * Classify the scanned object + decide routing. `input` is the scan envelope
 * (objectType/scanMode/plantName/confidence hints) — same shape detectScanType
 * consumes.
 */
export function classifyAgriculturalObject(input: any = {}): AgriClassification {
  return _safe(() => {
    const hint = _hintFrom(input);
    const r = (input && typeof input === 'object') ? input : {};
    const confHint = typeof r.confidencePct === 'number' ? r.confidencePct
      : (typeof r.confidence === 'number' ? (r.confidence <= 1 ? r.confidence * 100 : r.confidence) : null);

    // 0. An explicit objectType hint is authoritative — it is the photo context
    //    the capture flow carries. "Onion leaf" is a LEAF scan even though onion
    //    is a vegetable crop, so this must win over the router's name inference.
    const ot = _str(r.objectType).toLowerCase().replace(/\s|_/g, '');
    const DIRECT: Record<string, AgriObjectType> = {
      leaf: 'leaf', wholeplant: 'wholePlant', plant: 'wholePlant',
      fruit: 'fruit', vegetable: 'vegetable', flower: 'flower',
      tree: 'tree', seedling: 'seedling', insect: 'insect', soil: 'soil',
      herb: 'herb', seed: 'seed', grass: 'grass', shrub: 'shrub',
      houseplant: 'houseplant', hydroponic: 'hydroponic', greenhouse: 'greenhouse', weed: 'weed',
    };
    if (DIRECT[ot]) return _build(DIRECT[ot], confHint ?? 70, 'objectType:' + ot);

    // v10 — extended-object hints (specific → general). These win over the generic
    // router only on an explicit keyword; otherwise the router still decides.
    const V10: Array<[RegExp, AgriObjectType]> = [
      [SEED_RE, 'seed'], [HYDRO_RE, 'hydroponic'], [GREENHOUSE_RE, 'greenhouse'],
      [HOUSEPLANT_RE, 'houseplant'], [HERB_RE, 'herb'], [WEED_RE, 'weed'],
      [GRASS_RE, 'grass'], [SHRUB_RE, 'shrub'],
    ];
    for (const [re, t] of V10) if (re.test(hint)) return _build(t, confHint ?? 62, t + '_signal');

    // 1. The three router-uncovered classes take priority on a specific hint.
    //    Seedling before tree (a "young mango tree" is a seedling), flower next.
    if (SEEDLING_RE.test(hint)) {
      const c = confHint ?? 60;
      return _build('seedling', c, 'seedling_signal');
    }
    if (FLOWER_RE.test(hint)) {
      const c = confHint ?? 60;
      return _build('flower', c, 'flower_signal');
    }
    if (TREE_RE.test(hint)) {
      const c = confHint ?? 60;
      return _build('tree', c, 'tree_signal');
    }

    // 2. Otherwise defer to the shipped scan-type router and map its result.
    const d = detectScanType(input);
    const mapped = _mapScanType(_str(d.scanType));
    return _build(mapped, typeof d.confidence === 'number' ? d.confidence : 0,
      'router:' + (d.reason || d.scanType));
  }, _build('unknown', 0, 'classify_error'));
}

function _mapScanType(scanType: string): AgriObjectType {
  switch (scanType) {
    case 'leaf': return 'leaf';
    case 'whole_plant': return 'wholePlant';
    case 'stem': return 'wholePlant';
    case 'fruit': return 'fruit';
    case 'vegetable': return 'vegetable';
    case 'insect': return 'insect';
    case 'soil': return 'soil';
    default: return 'unknown';
  }
}

function _build(objectType: AgriObjectType, confidence: number, reason: string): AgriClassification {
  const c = Math.max(0, Math.min(100, Math.round(confidence || 0)));
  return Object.freeze({
    version: AGRI_CLASSIFIER_VERSION,
    objectType, confidence: c,
    routingDecision: _routing(objectType, c, reason),
  });
}

// ── Health global ──
let _lastStats = { classified: 0, lowConfidence: 0, byType: {} as Record<string, number> };

export function recordClassification(c: AgriClassification): void {
  _safe(() => {
    _lastStats.classified += 1;
    if (c.routingDecision.lowConfidence) _lastStats.lowConfidence += 1;
    _lastStats.byType[c.objectType] = (_lastStats.byType[c.objectType] || 0) + 1;
  }, undefined);
}

export function agriClassifierHealth() {
  return Object.freeze({
    ok: true,
    version: AGRI_CLASSIFIER_VERSION,
    supportedTypes: AGRI_OBJECT_TYPES,
    confidenceMin: AGRI_CONFIDENCE_MIN,
    classified: _lastStats.classified,
    lowConfidence: _lastStats.lowConfidence,
    byType: Object.freeze({ ..._lastStats.byType }),
    oneButtonScan: true,   // the farmer never pre-selects a scan type
  });
}

export function installAgriClassifierHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__agriClassifierHealth) return;
    Object.defineProperty(window, '__agriClassifierHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => agriClassifierHealth(),
    });
  }, undefined);
}
