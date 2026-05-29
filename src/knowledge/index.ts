/**
 * src/knowledge/index.ts — Farroway Knowledge Layer barrel.
 *
 *   import {
 *     // Plants
 *     lookupPlantKnowledge, listPlantKnowledge,
 *     listPlantKnowledgeByCategory, searchPlantKnowledge,
 *     companionsFor, pollinatorIntelligenceFor,
 *     // Diseases
 *     lookupDisease, listDiseases, searchDiseaseKnowledge,
 *     diseasesForPlant, diseasesBySymptom,
 *     // Pests
 *     lookupPest, listPests, searchPestKnowledge,
 *     pestsForPlant, pestsBySymptom,
 *     // Composite
 *     knowledgeForPlant, farrowayKnowledge,
 *     installFarrowayKnowledgeGlobal,
 *     FARROWAY_KNOWLEDGE_VERSION,
 *   } from 'src/knowledge';
 *
 * What this is
 * ────────────
 *   The Knowledge Layer is the canonical source of truth for
 *   plants / diseases / pests / growth stages / companions /
 *   pollinator value / care guides. Every runtime imports from
 *   here — NOT from `src/data/*` directly.
 *
 *   `knowledgeForPlant(plantId)` is the single one-call entry
 *   the scan flow uses post-identification:
 *
 *     knowledgeForPlant('rose')
 *       → {
 *           plant:        <PlantEntry>,
 *           diseases:     <DiseaseEntry[]>,
 *           pests:        <PestEntry[]>,
 *           companions:   <CompanionEnvelope>,
 *           pollinator:   <PollinatorEnvelope>,
 *           todaysTasks:  <BriefingTask[]>,
 *         }
 *
 * Strict-rule audit
 *   • Pure composition.
 *   • Never throws. SSR-safe.
 *   • Frozen envelopes only.
 *   • No PII handled.
 */

import {
  lookupPlantKnowledge, listPlantKnowledge,
  listPlantKnowledgeByCategory, searchPlantKnowledge,
  companionsFor, pollinatorIntelligenceFor,
  plantKnowledgeSummary, PLANT_KNOWLEDGE_SERVICE_VERSION,
} from './plants/PlantKnowledgeService';
import {
  lookupDisease, listDiseases, searchDiseaseKnowledge,
  diseasesForPlant, diseasesBySymptom,
  diseaseKnowledgeSummary, DISEASE_KNOWLEDGE_SERVICE_VERSION,
} from './diseases/DiseaseKnowledgeService';
import {
  lookupPest, listPests, searchPestKnowledge,
  pestsForPlant, pestsBySymptom,
  pestKnowledgeSummary, PEST_KNOWLEDGE_SERVICE_VERSION,
} from './pests/PestKnowledgeService';
import type { PlantEntry } from './plants/PlantKnowledgeService';
import type { DiseaseEntry } from './diseases/DiseaseKnowledgeService';
import type { PestEntry } from './pests/PestKnowledgeService';

export const FARROWAY_KNOWLEDGE_VERSION = 'farroway-knowledge-v1';

const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Daily-briefing-shaped tasks derived from the knowledge layer.
 * Pure function — no current-date dependency; the daily engine
 * filters by today's month/stage.
 */
export interface BriefingTask {
  labelKey:     string;
  labelDefault: string;
  priority:     'low' | 'medium' | 'high';
  source:       string;
}

function _briefingTasksFor(plant: PlantEntry): ReadonlyArray<BriefingTask> {
  const out: BriefingTask[] = [];
  const water = _str((plant as any).waterNeed).toLowerCase();
  if (water === 'high') {
    out.push({
      labelKey: 'knowledge.task.waterDeeply',
      labelDefault: 'Water deeply at soil level',
      priority: 'high', source: 'careGuide.water',
    });
  } else if (water === 'medium') {
    out.push({
      labelKey: 'knowledge.task.waterLightly',
      labelDefault: 'Water lightly when topsoil is dry',
      priority: 'medium', source: 'careGuide.water',
    });
  } else if (water === 'low') {
    out.push({
      labelKey: 'knowledge.task.checkSoilDryness',
      labelDefault: 'Skip watering — let soil dry between cycles',
      priority: 'low', source: 'careGuide.water',
    });
  }
  // Inspect for the top common pest.
  const topPest = _arr(plant.commonPests)[0];
  if (topPest) {
    out.push({
      labelKey: 'knowledge.task.inspectPest',
      labelDefault: 'Inspect plant for ' + topPest,
      priority: 'medium', source: 'commonPests',
    });
  }
  // Inspect for the top common disease.
  const topDisease = _arr(plant.commonDiseases)[0];
  if (topDisease) {
    out.push({
      labelKey: 'knowledge.task.scoutDisease',
      labelDefault: 'Scout for ' + topDisease + ' symptoms',
      priority: 'medium', source: 'commonDiseases',
    });
  }
  return Object.freeze(out);
}

/**
 * Composite read — returns everything a scan/profile surface
 * needs in one frozen envelope. This IS the
 * `lookupPlantKnowledge` the scan integration spec calls out.
 */
export function knowledgeForPlant(plantId: string) {
  return _safe(() => {
    const slug = _str(plantId).toLowerCase();
    const plant = lookupPlantKnowledge(slug);
    if (!plant) {
      return Object.freeze({
        runtimeVersion: FARROWAY_KNOWLEDGE_VERSION,
        ok: false, reason: 'plant_not_in_knowledge',
        plantId: slug,
      });
    }
    const diseases   = diseasesForPlant(slug);
    const pests      = pestsForPlant(slug);
    const companions = companionsFor(slug);
    const pollinator = pollinatorIntelligenceFor(slug);
    const todaysTasks = _briefingTasksFor(plant);

    return Object.freeze({
      runtimeVersion: FARROWAY_KNOWLEDGE_VERSION,
      ok: true, reason: '',
      plantId: slug,
      plant,
      diseases,
      pests,
      companions,
      pollinator,
      todaysTasks,
    });
  }, Object.freeze({
    runtimeVersion: FARROWAY_KNOWLEDGE_VERSION,
    ok: false, reason: 'error',
    plantId: '',
  }));
}

/**
 * Diagnostic snapshot — used by __farrowayKnowledge() and the
 * CI gate.
 */
export function farrowayKnowledge() {
  return Object.freeze({
    runtimeVersion: FARROWAY_KNOWLEDGE_VERSION,
    plants:    plantKnowledgeSummary(),
    diseases:  diseaseKnowledgeSummary(),
    pests:     pestKnowledgeSummary(),
    versions: Object.freeze({
      plants:    PLANT_KNOWLEDGE_SERVICE_VERSION,
      diseases:  DISEASE_KNOWLEDGE_SERVICE_VERSION,
      pests:     PEST_KNOWLEDGE_SERVICE_VERSION,
    }),
  });
}

/**
 * Pin __farrowayKnowledge() on window for QA introspection.
 */
export function installFarrowayKnowledgeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__farrowayKnowledge !== 'function') {
      w.__farrowayKnowledge = function (plantId?: string) {
        const out = plantId
          ? knowledgeForPlant(plantId)
          : farrowayKnowledge();
        try { console.log('[Farroway · Knowledge Layer]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

// ─── Re-exports ────────────────────────────────────────────────
export {
  lookupPlantKnowledge, listPlantKnowledge,
  listPlantKnowledgeByCategory, searchPlantKnowledge,
  companionsFor, pollinatorIntelligenceFor,
  plantKnowledgeSummary, PLANT_KNOWLEDGE_SERVICE_VERSION,
  lookupDisease, listDiseases, searchDiseaseKnowledge,
  diseasesForPlant, diseasesBySymptom,
  diseaseKnowledgeSummary, DISEASE_KNOWLEDGE_SERVICE_VERSION,
  lookupPest, listPests, searchPestKnowledge,
  pestsForPlant, pestsBySymptom,
  pestKnowledgeSummary, PEST_KNOWLEDGE_SERVICE_VERSION,
};
export type { PlantEntry, DiseaseEntry, PestEntry };
