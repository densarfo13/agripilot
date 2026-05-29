/**
 * src/knowledge/pests/PestKnowledgeService.ts — Farroway
 * Knowledge Layer · canonical pest lookup.
 *
 *   import {
 *     lookupPest, listPests, searchPestKnowledge,
 *     pestsForPlant, pestsBySymptom,
 *     PEST_KNOWLEDGE_SERVICE_VERSION,
 *   } from 'src/knowledge/pests/PestKnowledgeService';
 *
 * What this is
 * ────────────
 *   Single read API for the pest database. Reads from
 *   src/data/pests/index.js (PEST_DB) and joins through
 *   PlantKnowledgeService when callers ask for pests-for-plant.
 *
 *   Engines that want pest info MUST use this service —
 *   the CI gate enforces no direct imports of
 *   `src/data/pests/*` outside the knowledge layer.
 *
 * Strict-rule audit
 *   • Pure read-only.
 *   • Never throws. SSR-safe.
 *   • All returned arrays/objects frozen.
 *   • No PII handled.
 */

import {
  PEST_DB, findPest, searchPests,
} from '../../data/pests/index.js';
import { lookupPlantKnowledge } from '../plants/PlantKnowledgeService';

export const PEST_KNOWLEDGE_SERVICE_VERSION =
  'pest-knowledge-service-v1';

const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface PestEntry {
  id:                string;
  name:              string;
  symptoms:          ReadonlyArray<string>;
  lifecycle:         ReadonlyArray<string>;
  treatmentOrganic:  ReadonlyArray<string>;
  treatmentChemical: ReadonlyArray<string>;
  prevention:        ReadonlyArray<string>;
  images:            ReadonlyArray<string>;
}

export function lookupPest(id: string): PestEntry | null {
  return _safe(() => findPest(id) as any, null);
}

export function listPests(): ReadonlyArray<PestEntry> {
  return _safe(() => PEST_DB as any, Object.freeze([] as PestEntry[]));
}

export function searchPestKnowledge(query: string,
                                      options?: { limit?: number }) {
  return _safe(() => searchPests(query, options) as any,
    Object.freeze([] as PestEntry[]));
}

export function pestsForPlant(plantId: string):
    ReadonlyArray<PestEntry> {
  return _safe(() => {
    const p = lookupPlantKnowledge(plantId);
    if (!p) return Object.freeze([] as PestEntry[]);
    const out: PestEntry[] = [];
    for (const pid of _arr(p.commonPests).map(_str)) {
      const x = lookupPest(pid);
      if (x) out.push(x);
    }
    return Object.freeze(out);
  }, Object.freeze([] as PestEntry[]));
}

export function pestsBySymptom(keyword: string):
    ReadonlyArray<PestEntry> {
  return _safe(() => {
    const q = _str(keyword).trim().toLowerCase();
    if (q.length < 3) return Object.freeze([] as PestEntry[]);
    const out: PestEntry[] = [];
    for (const p of listPests()) {
      if (_arr(p.symptoms).some((s) =>
            _str(s).toLowerCase().includes(q))) {
        out.push(p);
      }
    }
    return Object.freeze(out);
  }, Object.freeze([] as PestEntry[]));
}

export function pestKnowledgeSummary() {
  return Object.freeze({
    runtimeVersion: PEST_KNOWLEDGE_SERVICE_VERSION,
    total:          listPests().length,
  });
}
