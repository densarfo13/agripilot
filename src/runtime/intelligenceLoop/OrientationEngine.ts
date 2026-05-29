/**
 * src/runtime/intelligenceLoop/OrientationEngine.ts — Phase 2.
 *
 * Pulls the canonical Knowledge Layer + Plant Health + weather
 * risk into one frozen orientation envelope.
 */

import {
  lookupPlantKnowledge, diseasesForPlant, pestsForPlant,
  lookupDisease, lookupPest,
} from '../../knowledge/index';

export const ORIENTATION_ENGINE_VERSION = 'loop-orientation-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num  = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export type Severity = 'high' | 'medium' | 'low' | 'unknown';
export type RiskLevel = Severity;
export type Confidence = 'high' | 'medium' | 'low' | 'unknown';

export function orientLoopObservation(observation: any) {
  return _safe(() => {
    if (!_isObj(observation)) return _emptyOrientation();
    const plantId = _str((observation as any).plantId);
    const knowledge = plantId ? lookupPlantKnowledge(plantId) : null;
    const knownDiseases = plantId ? diseasesForPlant(plantId) : [];
    const knownPests    = plantId ? pestsForPlant(plantId)    : [];

    // ─── Likely plant ───────────────────────────────────────
    const likelyPlant = knowledge
      ? Object.freeze({
          id:             knowledge.id,
          commonName:     (knowledge as any).commonName,
          scientificName: (knowledge as any).scientificName,
          category:       (knowledge as any).category,
        })
      : null;

    // ─── Likely issue — match scan hints to commonDiseases /
    // commonPests using the safe-wording filter.            ──
    const dHints = _arr((observation as any).scanDiseaseHints)
      .map(_str);
    const pHints = _arr((observation as any).scanPestHints).map(_str);
    let likelyIssue: any = null;
    for (const did of dHints) {
      const d = lookupDisease(did);
      if (d) {
        likelyIssue = Object.freeze({
          kind: 'disease', id: did, name: _str((d as any).name),
        });
        break;
      }
    }
    if (!likelyIssue) {
      for (const pid of pHints) {
        const p = lookupPest(pid);
        if (p) {
          likelyIssue = Object.freeze({
            kind: 'pest', id: pid, name: _str((p as any).name),
          });
          break;
        }
      }
    }

    // ─── Confidence ─────────────────────────────────────────
    const sc = _num((observation as any).scanConfidence);
    let confidence: Confidence = 'unknown';
    if (sc != null) {
      if      (sc >= 0.85 && !!likelyPlant) confidence = 'high';
      else if (sc >= 0.65 || !!likelyPlant) confidence = 'medium';
      else                                   confidence = 'low';
    } else if (likelyPlant) {
      confidence = 'medium';
    }

    // ─── Weather risk ──────────────────────────────────────
    const ws = (observation as any).weatherSummary;
    let weatherRisk: RiskLevel = 'unknown';
    if (_isObj(ws)) {
      const hum = _num((ws as any).humidity);
      const tmp = _num((ws as any).tempC);
      if (hum != null && tmp != null) {
        if      (hum >= 75 && tmp >= 18 && tmp <= 30) weatherRisk = 'high';
        else if (hum >= 60)                            weatherRisk = 'medium';
        else                                            weatherRisk = 'low';
      }
    }

    // ─── Plant health risk ─────────────────────────────────
    const rs = _num((observation as any).riskScore);
    let healthRisk: RiskLevel = 'unknown';
    if (rs != null) {
      if      (rs >= 70) healthRisk = 'high';
      else if (rs >= 40) healthRisk = 'medium';
      else                healthRisk = 'low';
    }

    // ─── Severity / risk roll-up ───────────────────────────
    const order: RiskLevel[] = ['low', 'medium', 'high'];
    const sIdx = order.indexOf(healthRisk);
    const wIdx = order.indexOf(weatherRisk);
    const max = Math.max(sIdx, wIdx);
    const riskLevel: RiskLevel = max >= 0 ? order[max] : 'unknown';
    const severity: Severity   = riskLevel;

    // ─── Context + constraints ─────────────────────────────
    const context = Object.freeze({
      lifecycleStage: _str((observation as any).lifecycleStage),
      knowledgeFound: !!knowledge,
      knownDiseaseCount: knownDiseases.length,
      knownPestCount:    knownPests.length,
      regionScoped:   !!_str((observation as any).region),
      weatherRisk, healthRisk,
    });
    const constraints = Object.freeze({
      offline:        (observation as any).offline === true,
      lowConfidence:  confidence === 'low',
      noKnowledge:    !knowledge,
    });

    return Object.freeze({
      runtimeVersion: ORIENTATION_ENGINE_VERSION,
      phase: 'orient',
      plantId,
      likelyPlant,
      likelyIssue,
      confidence,
      severity,
      riskLevel,
      context,
      constraints,
    });
  }, _emptyOrientation());
}

function _emptyOrientation() {
  return Object.freeze({
    runtimeVersion: ORIENTATION_ENGINE_VERSION,
    phase: 'orient',
    plantId: '',
    likelyPlant: null, likelyIssue: null,
    confidence: 'unknown' as Confidence,
    severity:   'unknown' as Severity,
    riskLevel:  'unknown' as RiskLevel,
    context:     Object.freeze({}),
    constraints: Object.freeze({}),
  });
}
