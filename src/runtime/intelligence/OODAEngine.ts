/**
 * src/runtime/intelligence/OODAEngine.ts — Observe / Orient /
 * Decide / Act decision loop. Pure, composable, role-safe.
 *
 *   import { observe, orient, decide, act, runOODA,
 *            OODA_ENGINE_VERSION } from
 *     'src/runtime/intelligence/OODAEngine';
 *
 *   const out = runOODA({
 *     scanResult, plant, weather, region, history, timeline,
 *   });
 *
 * What this file owns
 * ───────────────────
 *   The 4 OODA phases as pure functions. Each phase consumes
 *   only data the caller supplies — engines never reach into
 *   global state. The composite `runOODA()` wires them.
 *
 *   The decision phase uses the Knowledge Layer for ground
 *   truth (plant care guide / disease catalog / pest catalog)
 *   so the output stays grounded in real horticultural data.
 *   No LLM, no random sampling — same input → same output.
 *
 *   Output is INTERNAL by default. The grower-facing UI strips
 *   raw OODA text and only surfaces simple action recommendations
 *   through the existing PlantRecommendationEngine.
 *
 * Strict-rule audit
 *   • Pure functions. SSR-safe. Never throws.
 *   • No React imports. No localStorage writes.
 *   • Reads only via the canonical Knowledge Layer.
 *   • Safe wording — recommendations use "likely / monitor /
 *     recommended / expected" only. No "guaranteed / will cure /
 *     confirmed".
 */

import {
  lookupPlantKnowledge, lookupDisease, lookupPest,
  diseasesForPlant, pestsForPlant,
} from '../../knowledge/index';

export const OODA_ENGINE_VERSION = 'ooda-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num  = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export type Confidence = 'high' | 'medium' | 'low' | 'unknown';
export type RiskLevel  = 'high' | 'medium' | 'low' | 'unknown';

interface OODAInput {
  scanResult?: any;
  plant?:      any;
  weather?:    any;
  region?:     string;
  history?:    ReadonlyArray<any>;
  timeline?:   ReadonlyArray<any>;
  /** Anonymous user signals; never PII. */
  userPrefs?:  Record<string, any>;
}

/* ── Phase 1: Observe ─────────────────────────────────────── */
export function observe(ctx: OODAInput) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as OODAInput;
    const scan = c.scanResult || null;
    const plant = c.plant || null;
    const plantId = _str(
      (plant && (plant.id || plant.plantId)) ||
      (scan  && (scan.plantId  || scan.cropId)));
    return Object.freeze({
      runtimeVersion: OODA_ENGINE_VERSION,
      phase: 'observe',
      plantId,
      scanId:           _str(scan && (scan.scanId || scan.id)),
      scanConfidence:   _num(scan && scan.confidence),
      diseaseHints:     Object.freeze(
        _arr(scan && (scan.diseaseIds || scan.diseases)).map(_str)
          .filter(Boolean)),
      pestHints:        Object.freeze(
        _arr(scan && (scan.pestIds || scan.pests)).map(_str)
          .filter(Boolean)),
      lifecycleStage:   _str(plant && (plant.lifecycleStage || plant.growthStage)),
      healthScore:      _num(plant && plant.healthScore),
      riskScore:        _num(plant && plant.riskScore),
      region:           _str(c.region),
      weatherSummary:   _isObj(c.weather)
                          ? Object.freeze({
                              tempC:        _num((c.weather as any).tempC),
                              humidity:     _num((c.weather as any).humidity),
                              precipProb:   _num((c.weather as any).precipProb),
                            })
                          : null,
      timelineCount:    _arr(c.timeline).length,
      historyCount:     _arr(c.history).length,
    });
  }, _emptyObservation());
}

function _emptyObservation() {
  return Object.freeze({
    runtimeVersion: OODA_ENGINE_VERSION,
    phase: 'observe',
    plantId: '', scanId: '',
    scanConfidence: null, diseaseHints: Object.freeze([]),
    pestHints: Object.freeze([]),
    lifecycleStage: '', healthScore: null, riskScore: null,
    region: '', weatherSummary: null,
    timelineCount: 0, historyCount: 0,
  });
}

/* ── Phase 2: Orient ──────────────────────────────────────── */
export function orient(observation: any) {
  return _safe(() => {
    if (!_isObj(observation)) return _emptyOrientation();
    const plantId = _str((observation as any).plantId);
    const knowledge = plantId ? lookupPlantKnowledge(plantId) : null;
    const commonDiseases = knowledge
      ? _arr(knowledge.commonDiseases).map(_str) : [];
    const commonPests = knowledge
      ? _arr(knowledge.commonPests).map(_str) : [];
    const knownDiseases = diseasesForPlant(plantId);
    const knownPests    = pestsForPlant(plantId);

    // Weather risk: high humidity + warm temps elevate fungal
    // disease risk; cool wet conditions elevate late-blight risk.
    const ws = (observation as any).weatherSummary;
    let weatherRisk: RiskLevel = 'unknown';
    if (_isObj(ws)) {
      const hum = _num((ws as any).humidity);
      const tmp = _num((ws as any).tempC);
      if (hum != null && tmp != null) {
        if (hum >= 75 && tmp >= 18 && tmp <= 30) weatherRisk = 'high';
        else if (hum >= 60) weatherRisk = 'medium';
        else weatherRisk = 'low';
      }
    }

    return Object.freeze({
      runtimeVersion: OODA_ENGINE_VERSION,
      phase: 'orient',
      plantId,
      knowledgeFound: !!knowledge,
      lifecycleStage: _str(observation.lifecycleStage),
      commonDiseases: Object.freeze(commonDiseases),
      commonPests:    Object.freeze(commonPests),
      knownDiseaseCount: knownDiseases.length,
      knownPestCount:    knownPests.length,
      weatherRisk,
      regionScoped:   !!_str((observation as any).region),
    });
  }, _emptyOrientation());
}

function _emptyOrientation() {
  return Object.freeze({
    runtimeVersion: OODA_ENGINE_VERSION,
    phase: 'orient',
    plantId: '', knowledgeFound: false,
    lifecycleStage: '',
    commonDiseases: Object.freeze([]), commonPests: Object.freeze([]),
    knownDiseaseCount: 0, knownPestCount: 0,
    weatherRisk: 'unknown' as RiskLevel,
    regionScoped: false,
  });
}

/* ── Phase 3: Decide ──────────────────────────────────────── */
export function decide(observation: any, orientation: any) {
  return _safe(() => {
    if (!_isObj(observation) || !_isObj(orientation)) return _emptyDecision();
    const o = observation as any;
    const r = orientation as any;
    const diseaseHints = _arr(o.diseaseHints).map(_str);
    const pestHints    = _arr(o.pestHints).map(_str);

    // Likely issue — match scan hints against the plant's
    // common-disease / common-pest registry. We DO NOT invent
    // claims; if nothing matches, likelyIssue stays null.
    let likelyIssue: any = null;
    for (const did of diseaseHints) {
      const d = lookupDisease(did);
      if (d && _arr(r.commonDiseases).indexOf(did) >= 0) {
        likelyIssue = Object.freeze({
          kind: 'disease', id: did, name: _str((d as any).name),
        });
        break;
      }
    }
    if (!likelyIssue) {
      for (const pid of pestHints) {
        const p = lookupPest(pid);
        if (p && _arr(r.commonPests).indexOf(pid) >= 0) {
          likelyIssue = Object.freeze({
            kind: 'pest', id: pid, name: _str((p as any).name),
          });
          break;
        }
      }
    }

    // Confidence — scan confidence + knowledge presence.
    const sc = _num(o.scanConfidence);
    let confidence: Confidence = 'unknown';
    if (sc != null) {
      if      (sc >= 0.85 && r.knowledgeFound) confidence = 'high';
      else if (sc >= 0.65 || r.knowledgeFound) confidence = 'medium';
      else                                     confidence = 'low';
    } else if (r.knowledgeFound) {
      confidence = 'medium';
    }

    // Risk = max(weatherRisk, scoreRisk).
    const sr = _num(o.riskScore);
    let scoreRisk: RiskLevel = 'unknown';
    if (sr != null) {
      if      (sr >= 70) scoreRisk = 'high';
      else if (sr >= 40) scoreRisk = 'medium';
      else                scoreRisk = 'low';
    }
    const weatherRisk = (r.weatherRisk || 'unknown') as RiskLevel;
    const riskLevel: RiskLevel = (() => {
      const order: RiskLevel[] = ['low', 'medium', 'high'];
      const sIdx = order.indexOf(scoreRisk);
      const wIdx = order.indexOf(weatherRisk);
      const max = Math.max(sIdx, wIdx);
      return max >= 0 ? order[max] : 'unknown';
    })();

    return Object.freeze({
      runtimeVersion: OODA_ENGINE_VERSION,
      phase: 'decide',
      plantId: _str(o.plantId),
      likelyIssue:      likelyIssue,
      confidence,
      riskLevel,
      nextBestAction:   _nextBestAction(o, r, likelyIssue),
    });
  }, _emptyDecision());
}

function _nextBestAction(o: any, r: any, likely: any): any {
  // Safe wording per spec — "likely / monitor / recommended".
  if (likely && likely.kind === 'disease') {
    return Object.freeze({
      kind: 'inspect',
      labelKey: 'ooda.action.inspectDisease',
      labelDefault: 'Inspect plant for ' + _str(likely.name)
        + ' — likely match; monitor closely.',
      priority: 'high',
    });
  }
  if (likely && likely.kind === 'pest') {
    return Object.freeze({
      kind: 'inspect',
      labelKey: 'ooda.action.inspectPest',
      labelDefault: 'Inspect plant for ' + _str(likely.name)
        + ' — likely match; monitor for spread.',
      priority: 'high',
    });
  }
  if (r.weatherRisk === 'high') {
    return Object.freeze({
      kind: 'monitor',
      labelKey: 'ooda.action.monitorWeather',
      labelDefault: 'High humidity + warm temperature today — '
        + 'monitor plant for early disease signs.',
      priority: 'medium',
    });
  }
  return Object.freeze({
    kind: 'observe',
    labelKey: 'ooda.action.routineCheck',
    labelDefault: 'Routine check recommended.',
    priority: 'low',
  });
}

function _emptyDecision() {
  return Object.freeze({
    runtimeVersion: OODA_ENGINE_VERSION,
    phase: 'decide',
    plantId: '',
    likelyIssue: null, confidence: 'unknown' as Confidence,
    riskLevel: 'unknown' as RiskLevel,
    nextBestAction: null as any,
  });
}

/* ── Phase 4: Act ─────────────────────────────────────────── */
export function act(decision: any) {
  return _safe(() => {
    if (!_isObj(decision)) return _emptyAction();
    const action = (decision as any).nextBestAction || null;
    const tasks = action ? [Object.freeze({
      labelKey:     action.labelKey,
      labelDefault: action.labelDefault,
      priority:     action.priority,
      source:       'ooda',
    })] : [];
    // Timeline event descriptor — the caller (PlantRuntime)
    // owns actual persistence via appendPlantHistory.
    const timelineEvents = (decision as any).likelyIssue
      ? [Object.freeze({
          kind: (decision as any).likelyIssue.kind === 'disease'
                  ? 'DiseaseDetected' : 'PestDetected',
          summary: 'OODA decided likely ' + _str(
            (decision as any).likelyIssue.name),
          source: 'ooda',
        })]
      : [];
    return Object.freeze({
      runtimeVersion: OODA_ENGINE_VERSION,
      phase: 'act',
      plantId: _str((decision as any).plantId),
      recommendedTasks: Object.freeze(tasks),
      timelineEvents:   Object.freeze(timelineEvents),
      artifacts:        Object.freeze([]), // caller emits via ArtifactRuntime
    });
  }, _emptyAction());
}

function _emptyAction() {
  return Object.freeze({
    runtimeVersion: OODA_ENGINE_VERSION,
    phase: 'act',
    plantId: '',
    recommendedTasks: Object.freeze([]),
    timelineEvents:   Object.freeze([]),
    artifacts:        Object.freeze([]),
  });
}

/**
 * Composite — runs the full Observe → Orient → Decide → Act
 * loop and returns one frozen envelope.
 */
export function runOODA(ctx: OODAInput) {
  return _safe(() => {
    const observation = observe(ctx);
    const orientation = orient(observation);
    const decision    = decide(observation, orientation);
    const action      = act(decision);
    return Object.freeze({
      runtimeVersion: OODA_ENGINE_VERSION,
      observation,
      orientation,
      decision,
      action,
      confidence:       (decision as any).confidence,
      riskLevel:        (decision as any).riskLevel,
      recommendedTasks: (action as any).recommendedTasks,
      timelineEvents:   (action as any).timelineEvents,
      artifacts:        (action as any).artifacts,
    });
  }, Object.freeze({
    runtimeVersion: OODA_ENGINE_VERSION,
    observation: _emptyObservation(),
    orientation: _emptyOrientation(),
    decision:    _emptyDecision(),
    action:      _emptyAction(),
    confidence:  'unknown' as Confidence,
    riskLevel:   'unknown' as RiskLevel,
    recommendedTasks: Object.freeze([]),
    timelineEvents:   Object.freeze([]),
    artifacts:        Object.freeze([]),
  }));
}
