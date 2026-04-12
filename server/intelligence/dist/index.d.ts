/**
 * Farroway Intelligence Module — Barrel Export
 *
 * Mounts all intelligence routers under a single Express router.
 * Re-exports types, services, config, and infra for external consumers.
 *
 * Usage in app.js:
 *   import { intelligenceRouter, loadThresholdsFromDb } from './intelligence/dist/index.js';
 *   await loadThresholdsFromDb(); // load configurable thresholds
 *   app.use('/api/v2', intelligenceRouter);
 */
declare const intelligenceRouter: import("express-serve-static-core").Router;
export { intelligenceRouter };
export { loadThresholdsFromDb, getRiskThresholds, getFarmRiskWeights, getHotspotWeights, getOutbreakWeights, getAlertConfidenceWeights, getAlertConfig } from './config/thresholds.js';
export * from './types/index.js';
export { computeFarmPestRisk, computeHotspotScore, computeRegionalOutbreakScore, computeAlertConfidence, riskLevelFromScore, severityFromHotspotScore, alertLevelFromOutbreakScore, computeCropStageVulnerability, computeVerificationSignal, clamp, weightedSum, } from './services/scoring.service.js';
export { computeComponentScores, findNearbyFarmRisks } from './services/components.service.js';
export { evaluateAndCreateAlert, getActiveAlerts, getAlertsByFarmer, suppressAlert, expireStaleAlerts } from './services/alert.service.js';
export { ingestSatelliteScan, getLatestFieldStress, getFieldStressHistory } from './services/satellite.service.js';
export { ingestDroneScan, getDroneScans } from './services/drone.service.js';
export { detectOutbreakClusters, computeDistrictRisk, getRegionalIntelligence, getActiveOutbreakClusters } from './services/outbreak.service.js';
export { assessImageQuality, checkImageCompleteness, REQUIRED_IMAGE_TYPES, getRejectionMessage } from './services/image-quality.service.js';
export { computeDiagnosisConfidence } from './services/confidence.service.js';
export { generateActionGuidance, generateAlertActionSummary } from './services/action-engine.service.js';
export { validateBoundary, farmHasValidBoundary } from './services/boundary-validation.service.js';
export { getStorage, storageKey } from './infra/storage.js';
export type { StorageProvider } from './infra/storage.js';
export { enqueue, startWorker, stopWorker, stopAllWorkers, pruneJobs } from './infra/jobs.js';
//# sourceMappingURL=index.d.ts.map