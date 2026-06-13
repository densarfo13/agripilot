/**
 * ScanMythosContracts.ts — types + enums for the Mythos scan
 * composition layer (sprint #200).
 *
 * Sibling namespace `scanMythos/` — wave-36 locks `src/runtime/scan/`.
 *
 * IMPORTANT — this is a COMPOSITION layer, not a new ML engine.
 * It re-shapes the already-shipped scanRecovery envelope (Plant.id /
 * PlantNet consensus, #176-#179) + read-only farm context into the
 * spec's trusted-agronomist card. It NEVER calls a provider, NEVER
 * invents a diagnosis, NEVER fabricates satellite/NDVI (satellite is
 * out of scope this sprint per the founder's partial-override call).
 *
 * Pure data. SSR-safe. Frozen at module scope.
 */

export const SCAN_MYTHOS_CONTRACTS_VERSION = 'scan-mythos-contracts-v1';

// Confidence labels (farmer-facing — no jargon, never "100%").
export type MythosConfidenceLabel =
  | 'Likely match'        // >= 80
  | 'Needs confirmation'  // 60-79
  | 'Review recommended'; // < 60

export type MythosSeverity = 'low' | 'medium' | 'high' | null;

// The five photo types the multi-photo flow can use. None required.
export const PHOTO_TYPES = Object.freeze([
  'leaf', 'whole_plant', 'fruit', 'stem', 'field',
] as const);
export type PhotoType = (typeof PHOTO_TYPES)[number];

export interface FarmScanContext {
  contextCrop:     string | null;
  contextStage:    string | null;
  contextLocation: string | null;
  previousIssues:  ReadonlyArray<string>;
  confidenceBoost: number;   // 0..15 points, additive, explainable
  rationale:       ReadonlyArray<string>; // why the boost was applied
}

export interface MultiPhotoStatus {
  photosUsed:                   ReadonlyArray<PhotoType>;
  missingHelpfulPhotos:         ReadonlyArray<PhotoType>;
  confidenceImprovementPotential: 'high' | 'medium' | 'low' | 'none';
  guidance:                     string | null; // "Take a closer leaf photo."
}

export interface ScanMythosDecision {
  runtimeVersion:        string;
  plant:                 string;   // never empty (ladder-resolved)
  scientificName:        string;
  confidence:            number;   // 0..100
  confidenceLabel:       MythosConfidenceLabel;
  topCandidates:         ReadonlyArray<Readonly<{
    commonName: string; scientificName: string; score: number;
  }>>;
  issue:                 string;
  issueType:             string;
  severity:              MythosSeverity;
  farmContextBoost:      number;   // points contributed by context
  satelliteContextBoost: number;   // ALWAYS 0 this sprint (no satellite)
  why:                   ReadonlyArray<string>; // explainable reasons
  limitations:           ReadonlyArray<string>; // honest caveats
  nextAction:            string;   // never empty, never unsafe dosage
  estimatedTime:         string;
  followUpDate:          string;   // ISO yyyy-mm-dd, never empty
  outcomePrompt:         string;   // "Did the plant improve?"
  riskPrediction:        string | null;
  // Honesty constants — gate-asserted.
  neverFabricatesSatellite: true;
  neverShowsProviderNames:  true;
}

// The literal strings the gate forbids in any composed output.
export const FORBIDDEN_PROVIDER_NAMES = Object.freeze([
  'Plant.id', 'PlantNet', 'Insect.id', 'SoilGrids', 'Cloudinary', 'Sentinel',
]);

// Unsafe-dosage tokens forbidden in nextAction copy.
export const FORBIDDEN_DOSAGE_TOKENS = Object.freeze([
  'mg/L', 'kg/ha', 'g/L', 'ml/L', '/litre', '/liter',
  'glyphosate', 'malathion', 'imidacloprid', 'cypermethrin', 'paraquat',
]);
