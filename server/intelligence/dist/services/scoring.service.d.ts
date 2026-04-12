/**
 * Farroway Intelligence — Scoring Service
 *
 * Pure computation module implementing all 4 scoring formulas.
 * NO database access — callers fetch data, this module computes.
 * All weights are read from config/thresholds (hot-reloadable from DB).
 *
 * Formula component names match the product specification EXACTLY.
 */
import type { FarmPestRiskComponents, HotspotScoreComponents, RegionalOutbreakComponents, AlertConfidenceComponents, ScoringResult, RiskLevel, HotspotSeverity, AlertLevel } from '../types/index.js';
export declare function clamp(value: number, min?: number, max?: number): number;
export declare function weightedSum(components: Record<string, number>, weights: Record<string, number>): number;
export declare function riskLevelFromScore(score: number): RiskLevel;
export declare function severityFromHotspotScore(score: number): HotspotSeverity;
export declare function alertLevelFromOutbreakScore(score: number): AlertLevel;
export declare function computeCropStageVulnerability(cropType: string, growthStage: string): number;
export declare function computeVerificationSignal(answers: Record<string, string>): number;
export declare function computeFarmPestRisk(components: FarmPestRiskComponents): ScoringResult;
export declare function computeHotspotScore(components: HotspotScoreComponents): ScoringResult;
export declare function computeRegionalOutbreakScore(components: RegionalOutbreakComponents): ScoringResult;
export declare function computeAlertConfidence(components: AlertConfidenceComponents): ScoringResult;
//# sourceMappingURL=scoring.service.d.ts.map