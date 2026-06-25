/**
 * ScanTypeRouter.ts — SCAN TYPE ROUTER.
 *
 *   detectScanType(input) → { scanType, confidence, route, reason, providers }
 *
 * Decides what the farmer actually scanned (leaf / whole_plant / stem /
 * fruit / vegetable / insect / soil / unknown) and which route handles it,
 * so a tomato isn't forced through the plant-disease path and a beetle
 * isn't called "Unknown plant". Signals, in priority order:
 *   1. user-selected scan mode (explicit intent wins)
 *   2. provider candidates (object type + name)
 *   3. image hints (objectType / category on the envelope)
 *   4. crop context (the farmer's known crop)
 *
 * Plus applyScanTypeSafetyGate() (confidence < 70 → block creation, coach)
 * and installScanTypeRouterHealth() → window.__scanTypeRouterHealth().
 *
 * Pure, frozen, never throws.
 */
import {
  SCAN_ROUTE_BY_TYPE, ROUTE_PROVIDERS, SCAN_CONFIDENCE_MIN, SCAN_MODE_TO_TYPE,
} from './ScanTypeContracts';
import type { ScanType, ScanTypeDecision, ScanTypeSafety, ScanMode } from './ScanTypeContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);

const INSECT_RE = /\b(insect|pest|aphid|aphids|caterpillar|beetle|weevil|worm|armyworm|bollworm|moth|mite|mites|whitefly|whiteflies|thrips|mealybug|locust|grasshopper|bug|larva|larvae|maggot)\b/i;
const SOIL_RE   = /\b(soil|dirt|ground|earth|loam|clay|sand)\b/i;
const FRUIT_RE  = /\b(tomato|pepper|chilli|chili|mango|orange|lemon|lime|banana|plantain|avocado|guava|pawpaw|papaya|pineapple|melon|watermelon|berry|berries|apple|grape|fruit)\b/i;
const VEG_RE    = /\b(onion|cabbage|lettuce|carrot|garlic|spinach|kale|okra|eggplant|aubergine|cucumber|pumpkin|squash|beans?|peas?|potato|yam|cassava|vegetable)\b/i;
const LEAF_RE   = /\b(leaf|leaves|foliage)\b/i;

function _topCandidateName(r: any): string {
  return _safe(() => {
    const c = Array.isArray(r.topCandidates) ? r.topCandidates[0] : null;
    return _str(c && (c.commonName || c.name)) || _str(r.plantName) || _str(r.cropName);
  }, '');
}

function _decisionFor(scanType: ScanType, confidence: number, reason: string): ScanTypeDecision {
  const route = SCAN_ROUTE_BY_TYPE[scanType] || 'review';
  return Object.freeze({
    scanType, confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    route, reason, providers: ROUTE_PROVIDERS[route] || [],
  });
}

/** Decide the scan type + route. */
export function detectScanType(input: any = {}): ScanTypeDecision {
  return _safe<ScanTypeDecision>(() => {
    const r = (input && input.scanResult && typeof input.scanResult === 'object') ? input.scanResult : (input || {});
    const mode: ScanMode = (input && input.scanMode) || 'auto';

    // 1. Explicit user mode wins.
    if (mode && mode !== 'auto' && (SCAN_MODE_TO_TYPE as any)[mode]) {
      return _decisionFor((SCAN_MODE_TO_TYPE as any)[mode], 90, 'user_selected_mode:' + mode);
    }

    // Confidence we carry from the scan envelope.
    const confPct = _num(r.confidencePct);
    const band = _str(r.confidence);
    const conf = confPct != null ? confPct : (band === 'high' ? 85 : band === 'medium' ? 55 : band === 'low' ? 25 : 30);

    const objectType = _str(r.objectType).toLowerCase();
    const name = _topCandidateName(r);
    const hint = (objectType + ' ' + name + ' ' + _str(r.possibleIssue)).toLowerCase();

    // 2/3. Object type + candidate name.
    if (objectType === 'insect' || INSECT_RE.test(hint)) return _decisionFor('insect', conf, 'insect_signal');
    if (objectType === 'soil' || SOIL_RE.test(hint))     return _decisionFor('soil', Math.max(conf, 50), 'soil_signal');
    // Culinary "vegetable" (onion/cabbage/...) vs "fruit" (tomato/pepper/...).
    if (VEG_RE.test(name))   return _decisionFor('vegetable', conf, 'vegetable_candidate');
    if (FRUIT_RE.test(name)) return _decisionFor('fruit', conf, 'fruit_candidate');
    // 4. Leaf vs whole plant.
    if (objectType === 'leaf' || LEAF_RE.test(hint)) return _decisionFor('leaf', conf, 'leaf_signal');

    // A real plant identification with no fruit/veg/insect/soil signal → plant.
    const hasPlant = !!(name || (Array.isArray(r.topCandidates) && r.topCandidates.length > 0));
    if (hasPlant) return _decisionFor('whole_plant', conf, 'plant_candidate');

    // Nothing identifiable → review (coaching).
    return _decisionFor('unknown', conf, 'no_signal');
  }, _decisionFor('unknown', 0, 'router_error'));
}

/**
 * Safety gate (spec §5): below 70% confidence, do not create a plant/task/
 * FarmBrain ingest — only allow a "retake / save-for-review" task and show
 * coaching. 'unknown'/'review' is always coaching-only.
 */
export function applyScanTypeSafetyGate(decision: ScanTypeDecision): Readonly<ScanTypeSafety> {
  return _safe<Readonly<ScanTypeSafety>>(() => {
    const conf = _num(decision && decision.confidence) ?? 0;
    const isReview = !decision || decision.route === 'review' || decision.scanType === 'unknown';
    const lowConf = conf < SCAN_CONFIDENCE_MIN;
    if (isReview || lowConf) {
      return Object.freeze({
        allowPlantCreation: false,
        allowTaskCreation: false,   // only retake / save-for-review tasks are allowed by the UI
        ingestFarmBrain: false,
        showCoaching: true,
        reason: isReview ? 'review_or_unknown' : 'confidence_below_' + SCAN_CONFIDENCE_MIN,
      });
    }
    return Object.freeze({
      allowPlantCreation: true,
      allowTaskCreation: true,
      ingestFarmBrain: true,
      showCoaching: false,
      reason: 'confidence_ok',
    });
  }, Object.freeze({
    allowPlantCreation: false, allowTaskCreation: false,
    ingestFarmBrain: false, showCoaching: true, reason: 'gate_error',
  }));
}

let _installed = false;
export function installScanTypeRouterHealth(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__scanTypeRouterHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => Object.freeze({
        routerReady: true,
        fruitRouteReady: SCAN_ROUTE_BY_TYPE.fruit === 'fruit_quality',
        vegetableRouteReady: SCAN_ROUTE_BY_TYPE.vegetable === 'fruit_quality',
        insectRouteReady: (ROUTE_PROVIDERS.insect_pest || []).includes('insect.id'),
        soilRouteReady: SCAN_ROUTE_BY_TYPE.soil === 'soil_visual',
        lowConfidenceBlocked: applyScanTypeSafetyGate(
          _decisionFor('fruit', 50, 'probe')).allowPlantCreation === false,
      }),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({ detectScanType, applyScanTypeSafetyGate, _decisionFor });
export default detectScanType;
