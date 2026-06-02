/**
 * MultiPassIdentificationRuntime.ts — §PHASE 3.
 *
 * Composes results from up to 3 EXISTING identifier sources:
 *
 *   • __plantIdHealth        — Plant ID engine candidate list
 *   • __leafAnalysisHealth   — Leaf-shape / morphology engine
 *   • __cropMatcherHealth    — Local crop-matcher against known crops
 *
 * Merges by canonical key, averages confidence across sources that
 * voted for the same crop, returns the top 5 candidates. NEVER
 * fabricates candidates: if no engine returns data, returns
 * status: 'NEEDS_CONFIGURATION' and an empty list (caller must use
 * UnknownHandlingRuntime to show "Needs Identification").
 *
 * Hard rule (spec §3): "Never immediately return Unknown if candidates
 * exist." This runtime never invents — only normalizes what the
 * underlying engines actually surface.
 */

import type {
  MultiPassResult, IdentificationCandidate, Confidence,
} from './ScanAccuracyContracts';
import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _readCandidates(probe: any, source: string): IdentificationCandidate[] {
  return _safe(() => {
    if (!probe) return [];
    const v: any = probe.value || probe;
    const raw: any[] = Array.isArray(v.candidates) ? v.candidates
      : Array.isArray(v.topCandidates) ? v.topCandidates
      : Array.isArray(v.predictions) ? v.predictions : [];
    const out: IdentificationCandidate[] = [];
    for (const c of raw) {
      if (!c || typeof c !== 'object') continue;
      const key = typeof c.key === 'string' ? c.key
        : typeof c.cropKey === 'string' ? c.cropKey
        : typeof c.id === 'string' ? c.id : null;
      const label = typeof c.label === 'string' ? c.label
        : typeof c.name === 'string' ? c.name
        : (key ? key.charAt(0).toUpperCase() + key.slice(1) : '');
      const conf = typeof c.confidencePct === 'number' ? c.confidencePct
        : typeof c.confidence === 'number' ? (c.confidence <= 1 ? c.confidence * 100 : c.confidence)
        : typeof c.score === 'number' ? (c.score <= 1 ? c.score * 100 : c.score) : null;
      if (!key || conf === null || !isFinite(conf) || conf < 0) continue;
      out.push({
        key: key.toLowerCase(),
        label,
        confidencePct: Math.max(0, Math.min(100, conf)),
        source,
      });
    }
    return out.slice(0, 10);
  }, []);
}

export function runMultiPassIdentification(): Readonly<MultiPassResult> {
  return _safe(() => {
    const plantId = _probe('__plantIdHealth');
    const leafAnalysis = _probe('__leafAnalysisHealth');
    const cropMatcher = _probe('__cropMatcherHealth')
      || _probe('__cropPredictionHealth')
      || _probe('__cropRecommendationHealth');

    const enginesConfigured =
      (plantId ? 1 : 0) + (leafAnalysis ? 1 : 0) + (cropMatcher ? 1 : 0);

    const merged: Record<string, {
      label: string; confSum: number; voteCount: number; sources: string[];
    }> = {};

    const add = (list: IdentificationCandidate[]) => {
      for (const c of list) {
        if (!merged[c.key]) {
          merged[c.key] = { label: c.label, confSum: 0, voteCount: 0, sources: [] };
        }
        merged[c.key].confSum += c.confidencePct;
        merged[c.key].voteCount += 1;
        if (merged[c.key].sources.indexOf(c.source) < 0)
          merged[c.key].sources.push(c.source);
      }
    };
    add(_readCandidates(plantId, '__plantIdHealth'));
    add(_readCandidates(leafAnalysis, '__leafAnalysisHealth'));
    add(_readCandidates(cropMatcher, '__cropMatcherHealth'));

    const all: IdentificationCandidate[] = Object.keys(merged).map((key) => {
      const m = merged[key];
      const avg = m.confSum / Math.max(1, m.voteCount);
      // Multi-vote boost — cap at 100. Capped boost prevents fabrication:
      // a single 30% vote stays 30%, two 30% votes go to ~36%, three
      // 30% votes go to ~42%. Never invents a candidate, only sharpens
      // confidence when multiple engines agree.
      const boost = 1 + 0.1 * Math.max(0, m.voteCount - 1);
      const confidencePct = Math.min(100, Math.round(avg * boost));
      return {
        key,
        label: m.label,
        confidencePct,
        source: m.sources.join('+'),
      };
    });
    all.sort((a, b) => b.confidencePct - a.confidencePct);
    const top5 = Object.freeze(all.slice(0, 5)) as ReadonlyArray<IdentificationCandidate>;

    const bestKey = top5.length > 0 ? top5[0].key : null;
    const bestConfidencePct = top5.length > 0 ? top5[0].confidencePct : 0;

    const status: 'OK' | 'NEEDS_CONFIGURATION' | 'FAILED' =
      enginesConfigured === 0 ? 'NEEDS_CONFIGURATION'
      : top5.length === 0 ? 'NEEDS_CONFIGURATION'
      : 'OK';

    return Object.freeze<MultiPassResult>({
      candidates: top5,
      bestKey,
      bestConfidencePct,
      enginesConfigured,
      totalEngines: 3 as const,
      status,
      confidence: (bestConfidencePct >= 75 ? 'high'
        : bestConfidencePct >= 50 ? 'medium' : 'low') as Confidence,
      explanation:
        'Multi-pass identification merges Plant ID + Leaf Analysis + Crop Matcher engines. ' +
        'Candidates are normalized by canonical key; agreement across engines lightly boosts ' +
        'confidence (capped) but never fabricates a candidate. NEEDS_CONFIGURATION when no ' +
        'engine returns data.',
      limitations:
        'Confidence reflects engine outputs only — not field-verified accuracy. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<MultiPassResult>({
    candidates: Object.freeze([]) as ReadonlyArray<IdentificationCandidate>,
    bestKey: null,
    bestConfidencePct: 0,
    enginesConfigured: 0,
    totalEngines: 3 as const,
    status: 'FAILED' as const,
    confidence: 'low' as Confidence,
    explanation: 'Multi-pass runtime threw.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function multiPassReady(): boolean {
  return _safe(() => {
    const r = runMultiPassIdentification();
    return r.enginesConfigured > 0;
  }, false);
}
