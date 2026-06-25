/**
 * ScanTypeContracts.ts — SCAN TYPE ROUTER contracts.
 *
 * Farroway must scan the right thing the right way: a leaf is a disease
 * question, a tomato is a ripeness/quality question, a beetle is a pest
 * question, soil is a condition question. These contracts define the scan
 * types, the route each maps to, the providers behind each route, and the
 * fruit/veg + insect result shapes — so no scan is forced through the
 * plant-only result path.
 */
export const SCAN_TYPE_CONTRACTS_VERSION = 'scan-type-contracts-v1';

export type ScanType =
  | 'leaf' | 'whole_plant' | 'stem'      // → plant disease
  | 'fruit' | 'vegetable'                // → quality / ripeness / damage
  | 'insect'                             // → pest
  | 'soil'                               // → soil visual
  | 'unknown';                           // → review

export const SCAN_TYPES: ReadonlyArray<ScanType> = Object.freeze([
  'leaf', 'whole_plant', 'stem', 'fruit', 'vegetable', 'insect', 'soil', 'unknown',
]);

export type ScanRoute =
  | 'plant_disease'   // Plant.id + Crop.health + Mythos/FarmBrain action
  | 'fruit_quality'   // Plant.id + quality/ripeness/damage + harvest/sell guidance
  | 'insect_pest'     // Insect.id + pest risk + action
  | 'soil_visual'     // soil visual check + moisture/texture/condition
  | 'review';         // photo-quality coaching + save for review

export const SCAN_ROUTE_BY_TYPE: Readonly<Record<ScanType, ScanRoute>> = Object.freeze({
  leaf: 'plant_disease', whole_plant: 'plant_disease', stem: 'plant_disease',
  fruit: 'fruit_quality', vegetable: 'fruit_quality',
  insect: 'insect_pest', soil: 'soil_visual', unknown: 'review',
});

// Providers each route uses. The insect route MUST go through Insect.id;
// the build gate enforces it. (Crop.health + Insect.id are wired here but
// only execute when their keys are configured — honest degrade otherwise.)
export const ROUTE_PROVIDERS: Readonly<Record<ScanRoute, ReadonlyArray<string>>> = Object.freeze({
  plant_disease: Object.freeze(['plant.id', 'crop.health']),
  fruit_quality: Object.freeze(['plant.id', 'quality_analysis']),
  insect_pest: Object.freeze(['insect.id']),
  soil_visual: Object.freeze(['soil_visual']),
  review: Object.freeze([]),
});

/** Below this the safety gate blocks plant/task/FarmBrain creation. */
export const SCAN_CONFIDENCE_MIN = 70;

// Pre-scan quick modes the farmer can pick. 'auto' = auto-detect (default).
export type ScanMode = 'auto' | 'plant' | 'leaf' | 'fruit' | 'vegetable' | 'insect' | 'soil';
export const SCAN_MODES: ReadonlyArray<ScanMode> = Object.freeze([
  'auto', 'plant', 'leaf', 'fruit', 'vegetable', 'insect', 'soil',
]);
export const SCAN_MODE_TO_TYPE: Readonly<Record<Exclude<ScanMode, 'auto'>, ScanType>> = Object.freeze({
  plant: 'whole_plant', leaf: 'leaf', fruit: 'fruit',
  vegetable: 'vegetable', insect: 'insect', soil: 'soil',
});

// Fruit / vegetable result vocabulary.
export const FRUIT_STATUS = Object.freeze(['ripening', 'ripe', 'overripe', 'damaged', 'unknown'] as const);
export type FruitStatus = typeof FRUIT_STATUS[number];
export const QUALITY_BANDS = Object.freeze(['good', 'watch', 'at_risk', 'unknown'] as const);
export type QualityBand = typeof QUALITY_BANDS[number];

// Insect result vocabulary.
export const THREAT_LEVELS = Object.freeze(['low', 'moderate', 'high', 'unknown'] as const);
export type ThreatLevel = typeof THREAT_LEVELS[number];

export interface ScanTypeDecision {
  scanType: ScanType;
  confidence: number;   // 0..100
  route: ScanRoute;
  reason: string;
  providers: ReadonlyArray<string>;
}

export interface ScanTypeSafety {
  allowPlantCreation: boolean;
  allowTaskCreation: boolean;   // unless action is retake / save-for-review
  ingestFarmBrain: boolean;
  showCoaching: boolean;
  reason: string;
}
