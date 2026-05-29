/**
 * src/runtime/plants/plantContracts.ts — formal Plant Runtime
 * contracts.
 *
 *   import {
 *     PLANT_CATEGORY_VALUES, PLANT_TIMELINE_EVENT_TYPES,
 *     HEALTH_LABEL_FOR_SCORE, PLANT_SOURCE,
 *     PLANT_CONTRACTS_VERSION,
 *   } from 'src/runtime/plants/plantContracts';
 *
 * What this is
 * ────────────
 *   The canonical contract surface every Plant Runtime engine,
 *   UI component, and CI gate reads from. Centralising these
 *   values means a contract change is one edit + a gate update
 *   — never a hunt-and-replace across files.
 *
 *   Carries:
 *     • PLANT_CATEGORY_VALUES — 8 supported categories
 *     • PLANT_SOURCE          — manual | scan
 *     • PLANT_TIMELINE_EVENT_TYPES — the 12 spec'd event types
 *     • HEALTH_LABEL_FOR_SCORE — spec'd 4-band labels
 *
 * Strict-rule audit
 *   • Pure constants. No side effects. SSR-safe.
 *   • Composition-only.
 */

import { PLANT_CATEGORIES } from '../../modules/plants/plantCategories';

export const PLANT_CONTRACTS_VERSION = 'plant-contracts-v1';

/* 8 supported categories — sourced from the canonical
   plantCategories registry to keep the two in lock-step. */
export const PLANT_CATEGORY_VALUES = Object.freeze(
  (PLANT_CATEGORIES as readonly string[]).slice()
);

export const PLANT_SOURCE = Object.freeze({
  MANUAL: 'manual',
  SCAN:   'scan',
});

/* 12 spec'd timeline event types. These ADD to (not replace) the
   internal TIMELINE_EVENT_KIND values that PlantTimeline.ts
   already emits — the new TaskGenerated / BloomForecastUpdated
   / RecommendationGenerated entries map onto sibling generation
   events from PlantTaskEngine + PlantRecommendationEngine. */
export const PLANT_TIMELINE_EVENT_TYPES = Object.freeze({
  PlantCreated:             'PlantCreated',
  ScanCompleted:            'ScanCompleted',
  DiseaseDetected:          'DiseaseDetected',
  PestDetected:             'PestDetected',
  TaskGenerated:            'TaskGenerated',
  TaskCompleted:            'TaskCompleted',
  TreatmentApplied:         'TreatmentApplied',
  GrowthStageChanged:       'GrowthStageChanged',
  BloomStarted:             'BloomStarted',
  BloomForecastUpdated:     'BloomForecastUpdated',
  RecommendationGenerated:  'RecommendationGenerated',
  RecommendationAccepted:   'RecommendationAccepted',
});

/* Spec'd health labels — 4-band scheme alongside the internal
   {thriving / healthy / fair / struggling} bands the
   PlantHealthEngine carries. Both schemes are valid; this
   accessor lets UI components show the spec-aligned wording. */
export const HEALTH_LABEL_BANDS = Object.freeze([
  { min: 90, label: 'Excellent',       key: 'plant.health.excellent' },
  { min: 75, label: 'Good',            key: 'plant.health.good' },
  { min: 55, label: 'Needs Attention', key: 'plant.health.needsAttention' },
  { min:  0, label: 'Critical',        key: 'plant.health.critical' },
]);

export function HEALTH_LABEL_FOR_SCORE(score: number) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return Object.freeze({ min: 0, label: 'Unknown',
                            key: 'plant.health.unknown' });
  }
  for (const b of HEALTH_LABEL_BANDS) {
    if (score >= b.min) return b;
  }
  return HEALTH_LABEL_BANDS[HEALTH_LABEL_BANDS.length - 1];
}
