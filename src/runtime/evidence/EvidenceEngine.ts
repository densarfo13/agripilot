/**
 * EvidenceEngine.ts — TRUST ENGINE + EVIDENCE PLATFORM, Phase 1.
 *
 * Assembles the explicit, farmer-readable evidence behind a recommendation so
 * EVERY recommendation is explainable in one place:
 *   ✓ Plant identified · ✓ Crop stage estimated · ✓ Recent scan ·
 *   ✓ Weather forecast · ✓ Farm history
 * plus Confidence, Source Type, Freshness, and Data Quality (composed from the
 * DataQualityEngine). A ✓ line appears ONLY when its signal is real — missing
 * evidence is simply absent, never fabricated. Provider/API names never appear.
 *
 * Pure, total, never throws. Pins window.__evidenceEngineHealth().
 */
import { scoreDataQuality, DataQualityInput } from '../quality/DataQualityEngine';

export const EVIDENCE_ENGINE_VERSION = 'evidence-engine-v1';
export type SourceType = 'scan' | 'weather' | 'soil' | 'history' | 'crop_profile' | 'mixed' | 'none';

export interface EvidenceItem { label: string; sourceType: SourceType; fresh: boolean; }
export interface EvidenceEnvelope {
  evidence: ReadonlyArray<EvidenceItem>;
  evidenceLines: ReadonlyArray<string>;   // farmer-facing ✓ lines
  confidence: number;                      // 0..100
  sourceTypes: ReadonlyArray<SourceType>;
  freshness: number;                       // 0..100 (from data quality)
  dataQuality: 'high' | 'medium' | 'low' | 'unknown';
  hasEvidence: boolean;
}

export interface EvidenceInput extends DataQualityInput {
  plantIdentified?: boolean;
  cropStageKnown?: boolean;
  recentScan?: boolean;
  weatherAvailable?: boolean;
  farmHistory?: boolean;
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _num = (v: any): number | null => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null; };

export function buildEvidence(input: EvidenceInput = {}): EvidenceEnvelope {
  return _safe(() => {
    const fb = input.farmBrainState || {};
    const items: EvidenceItem[] = [];
    const add = (cond: boolean, label: string, sourceType: SourceType, fresh = true) => {
      if (cond) items.push({ label, sourceType, fresh });
    };

    add(input.plantIdentified === true || !!input.crop || !!fb.crop, '✓ Plant identified', 'scan');
    add(input.cropStageKnown === true || !!(fb.growthStage && fb.growthStage.value) || !!input.plantingDate,
      '✓ Crop stage estimated', 'crop_profile');
    add(input.recentScan === true || input.hasScan === true || fb.hasFirstScan === true, '✓ Recent scan', 'scan');
    add(input.weatherAvailable === true || !!input.farmBrainState?.weather || !!(input as any).weather,
      '✓ Weather forecast', 'weather');
    add(input.farmHistory === true || (_num(input.taskCount) || 0) > 0, '✓ Farm history', 'history');

    const dq = scoreDataQuality(input);
    const sourceTypes = Array.from(new Set(items.map((i) => i.sourceType)));
    // Confidence: FarmBrain confidence, tempered by how much evidence exists.
    const fbConf = _num(fb.confidence);
    const coverage = items.length / 5;
    const confidence = Math.max(0, Math.min(100, Math.round((fbConf ?? (items.length ? 50 : 0)) * (0.5 + 0.5 * coverage))));

    return Object.freeze({
      evidence: Object.freeze(items),
      evidenceLines: Object.freeze(items.map((i) => i.label)),
      confidence,
      sourceTypes: Object.freeze(sourceTypes.length ? sourceTypes : (['none'] as SourceType[])),
      freshness: dq.freshness,
      dataQuality: dq.band,
      hasEvidence: items.length > 0,
    });
  }, Object.freeze({
    evidence: Object.freeze([]), evidenceLines: Object.freeze([]), confidence: 0,
    sourceTypes: Object.freeze(['none'] as SourceType[]), freshness: 0,
    dataQuality: 'unknown' as const, hasEvidence: false,
  }));
}

export function evidenceEngineHealth() {
  const rich = buildEvidence({ plantIdentified: true, cropStageKnown: true, recentScan: true,
    weatherAvailable: true, farmHistory: true, taskCount: 2, hasScan: true,
    farmBrainState: { hasFirstScan: true, confidence: 85 } });
  const empty = buildEvidence({});
  return Object.freeze({
    ok: true, version: EVIDENCE_ENGINE_VERSION,
    dimensions: Object.freeze(['evidence', 'confidence', 'sourceType', 'freshness', 'dataQuality']),
    richHasFiveLines: rich.evidenceLines.length === 5,
    emptyHasNoFabricatedEvidence: empty.hasEvidence === false,
  });
}

export function installEvidenceEngineHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__evidenceEngineHealth) return;
    Object.defineProperty(window, '__evidenceEngineHealth', {
      configurable: true, enumerable: false, writable: false, value: () => evidenceEngineHealth(),
    });
  }, undefined);
}
