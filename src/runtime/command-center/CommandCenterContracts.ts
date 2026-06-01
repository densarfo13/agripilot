/**
 * CommandCenterContracts.ts — types and shape definitions for the
 * Farroway Command Center. Pure type module: no logic, no probes,
 * no globals. Imported by Aggregator/Selectors/Runtime.
 */

export type Confidence = 'low' | 'medium' | 'high';
export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type MarketDemand = 'low' | 'medium' | 'high' | 'unknown';
export type HealthBand = 'low' | 'medium' | 'high' | 'unknown';

export interface TodayAction {
  id: string | null;
  title: string;
  why: string;
  estimatedTime: string;
  scanRelevant: boolean;
  source: string;
}

export interface NextAction {
  id: string | null;
  title: string;
  why: string;
  estimatedTime: string;
  source: string;
}

export interface RiskOut {
  level: RiskLevel;
  explanation: string;
  source: string;
}

export interface HealthOut {
  score: number | null;
  band: HealthBand;
  label: string;
}

export interface MarketOut {
  level: MarketDemand;
  recommendedSellingWindow: string;
  source: string;
}

export interface FundingMatch {
  matched: boolean;
  label: string;
  reason: string;
  source: string;
}

export interface SellReadinessOut {
  unlocked: boolean;
  reason: string;
}

export interface LatestOutcome {
  kind: string | null;
  recordedAt: string | null;
  summary: string;
}

export interface LatestScan {
  scanId: string | null;
  recordedAt: string | null;
  summary: string;
  riskDelta: string;
}

export interface ProgressOut {
  completed: number;
  total: number;
  percent: number;
  stepLabel: string;
}

/** §SPEC OUTPUT — the canonical Command Center state shape. */
export interface CommandCenterState {
  crop: string;
  cropStage: string;
  farmHealth: HealthOut;
  riskLevel: RiskOut;
  daysToHarvest: number | null;
  todayAction: TodayAction;
  why: string;
  estimatedTime: string;
  nextAction: NextAction;
  marketDemand: MarketOut;
  fundingMatches: ReadonlyArray<FundingMatch>;
  sellReadiness: SellReadinessOut;
  latestOutcome: LatestOutcome;
  latestScan: LatestScan;
  progress: ProgressOut;
  confidence: Confidence;
  limitations: string;
}

/** §SPEC DIAGNOSTICS — window.__commandCenterHealth() envelope. */
export interface CommandCenterDiagnostics {
  initialized: true;
  // Readiness flags (data-availability).
  cropReady: boolean;
  stageReady: boolean;
  healthReady: boolean;
  riskReady: boolean;
  actionReady: boolean;
  harvestReady: boolean;
  fundingReady: boolean;
  marketReady: boolean;
  sellReady: boolean;
  notificationReady: boolean;
  // Page-integration flags (DOM-attestation).
  homeIntegrated: boolean;
  tasksIntegrated: boolean;
  myFarmIntegrated: boolean;
  scanIntegrated: boolean;
  activityIntegrated: boolean;
  // Honesty contract.
  composedFrom: ReadonlyArray<string>;
  integratedSurfaceCount: number;
  totalSurfaces: 5;
  readinessCount: number;
  totalFields: 10;
  noFakeData: true;
  noFabricatedScores: true;
  noPageLocalCalculations: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
  // Embedded state snapshot (read-only).
  state: Readonly<CommandCenterState>;
}

export const GUIDANCE_TAIL = 'Decision support, not a guarantee.';
export const COMMAND_CENTER_VERSION = 'command-center-runtime-v2' as const;

/** Surfaces tracked for integration attestation. */
export const COMMAND_CENTER_SURFACES: ReadonlyArray<
  'home' | 'tasks' | 'my-farm' | 'scan' | 'activity'
> = Object.freeze(['home', 'tasks', 'my-farm', 'scan', 'activity']);
