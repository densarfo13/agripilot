/**
 * NutrientKnowledgeService.ts — knowledge-layer access to the curated nutrient-
 * deficiency database (src/data/nutrients). Mirror of DiseaseKnowledgeService so
 * runtime/components never import src/data directly.
 *
 * Strict-rule audit
 *   • Pure read-only.  • Never throws. SSR-safe.
 *   • All returned arrays/objects frozen.  • No PII handled.
 */
import {
  NUTRIENT_DB, findNutrient, searchNutrients,
} from '../../data/nutrients/index.js';

export const NUTRIENT_KNOWLEDGE_SERVICE_VERSION = 'nutrient-knowledge-service-v1';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export interface NutrientEntry {
  id:                  string;
  name:                string;
  aliases:             ReadonlyArray<string>;
  symptoms:            ReadonlyArray<string>;
  commonCauses:        ReadonlyArray<string>;
  treatment:           ReadonlyArray<string>;
  prevention:          ReadonlyArray<string>;
  severityGuidance:    string;
  followUpScanDays:    number | null;
  farmerFriendlySummary: string;
}

export function lookupNutrient(id: string): NutrientEntry | null {
  return _safe(() => findNutrient(id) as any, null);
}

export function listNutrients(): ReadonlyArray<NutrientEntry> {
  return _safe(() => NUTRIENT_DB as any, Object.freeze([] as NutrientEntry[]));
}

export function searchNutrientKnowledge(query: string) {
  return _safe(() => searchNutrients(query) as any, Object.freeze([] as NutrientEntry[]));
}
