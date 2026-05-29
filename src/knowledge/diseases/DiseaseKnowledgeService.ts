/**
 * src/knowledge/diseases/DiseaseKnowledgeService.ts — Farroway
 * Knowledge Layer · canonical disease lookup.
 *
 *   import {
 *     lookupDisease, listDiseases, searchDiseaseKnowledge,
 *     diseasesForPlant, diseasesBySymptom,
 *     DISEASE_KNOWLEDGE_SERVICE_VERSION,
 *   } from 'src/knowledge/diseases/DiseaseKnowledgeService';
 *
 * What this is
 * ────────────
 *   Single read API for the disease database. Reads from
 *   src/data/diseases/index.js (DISEASE_DB) and joins through
 *   PlantKnowledgeService when callers ask for diseases-for-plant.
 *
 *   Engines that want disease info MUST use this service —
 *   the CI gate enforces no direct imports of
 *   `src/data/diseases/*` outside the knowledge layer.
 *
 * Strict-rule audit
 *   • Pure read-only.
 *   • Never throws. SSR-safe.
 *   • All returned arrays/objects frozen.
 *   • No PII handled.
 */

import {
  DISEASE_DB, findDisease, searchDiseases,
} from '../../data/diseases/index.js';
import { lookupPlantKnowledge } from '../plants/PlantKnowledgeService';

export const DISEASE_KNOWLEDGE_SERVICE_VERSION =
  'disease-knowledge-service-v1';

const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface DiseaseEntry {
  id:                string;
  name:              string;
  symptoms:          ReadonlyArray<string>;
  causes:            ReadonlyArray<string>;
  treatmentOrganic:  ReadonlyArray<string>;
  treatmentChemical: ReadonlyArray<string>;
  prevention:        ReadonlyArray<string>;
  images:            ReadonlyArray<string>;
}

export function lookupDisease(id: string): DiseaseEntry | null {
  return _safe(() => findDisease(id) as any, null);
}

export function listDiseases(): ReadonlyArray<DiseaseEntry> {
  return _safe(() => DISEASE_DB as any, Object.freeze([] as DiseaseEntry[]));
}

export function searchDiseaseKnowledge(query: string,
                                         options?: { limit?: number }) {
  return _safe(() => searchDiseases(query, options) as any,
    Object.freeze([] as DiseaseEntry[]));
}

/**
 * Return the disease entries linked to a plant via its
 * PLANT_KNOWLEDGE.commonDiseases array. Pure composition over
 * the plant service.
 */
export function diseasesForPlant(plantId: string):
    ReadonlyArray<DiseaseEntry> {
  return _safe(() => {
    const p = lookupPlantKnowledge(plantId);
    if (!p) return Object.freeze([] as DiseaseEntry[]);
    const out: DiseaseEntry[] = [];
    for (const did of _arr(p.commonDiseases).map(_str)) {
      const d = lookupDisease(did);
      if (d) out.push(d);
    }
    return Object.freeze(out);
  }, Object.freeze([] as DiseaseEntry[]));
}

/**
 * Symptom-driven lookup — useful for the scan diagnosis flow
 * where a user describes what they see and we surface matching
 * disease candidates.
 */
export function diseasesBySymptom(keyword: string):
    ReadonlyArray<DiseaseEntry> {
  return _safe(() => {
    const q = _str(keyword).trim().toLowerCase();
    if (q.length < 3) return Object.freeze([] as DiseaseEntry[]);
    const out: DiseaseEntry[] = [];
    for (const d of listDiseases()) {
      if (_arr(d.symptoms).some((s) =>
            _str(s).toLowerCase().includes(q))) {
        out.push(d);
      }
    }
    return Object.freeze(out);
  }, Object.freeze([] as DiseaseEntry[]));
}

export function diseaseKnowledgeSummary() {
  return Object.freeze({
    runtimeVersion: DISEASE_KNOWLEDGE_SERVICE_VERSION,
    total:          listDiseases().length,
  });
}
