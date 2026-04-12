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
import { Router } from 'express';
import pestRiskRoutes from './routes/pest-risk.routes.js';
import adminRoutes from './routes/admin.routes.js';
import ingestRoutes from './routes/ingest.routes.js';
const intelligenceRouter = Router();
intelligenceRouter.use('/pest-risk', pestRiskRoutes);
intelligenceRouter.use('/intelligence-admin', adminRoutes);
intelligenceRouter.use('/intelligence-ingest', ingestRoutes);
export { intelligenceRouter };
// ── Config ──
export { loadThresholdsFromDb, getRiskThresholds, getFarmRiskWeights, getHotspotWeights, getOutbreakWeights, getAlertConfidenceWeights, getAlertConfig } from './config/thresholds.js';
// ── Types ──
export * from './types/index.js';
// ── Scoring (pure computation) ──
export { computeFarmPestRisk, computeHotspotScore, computeRegionalOutbreakScore, computeAlertConfidence, riskLevelFromScore, severityFromHotspotScore, alertLevelFromOutbreakScore, computeCropStageVulnerability, computeVerificationSignal, clamp, weightedSum, } from './services/scoring.service.js';
// ── Services (DB-backed) ──
export { computeComponentScores, findNearbyFarmRisks } from './services/components.service.js';
export { evaluateAndCreateAlert, getActiveAlerts, getAlertsByFarmer, suppressAlert, expireStaleAlerts } from './services/alert.service.js';
export { ingestSatelliteScan, getLatestFieldStress, getFieldStressHistory } from './services/satellite.service.js';
export { ingestDroneScan, getDroneScans } from './services/drone.service.js';
export { detectOutbreakClusters, computeDistrictRisk, getRegionalIntelligence, getActiveOutbreakClusters } from './services/outbreak.service.js';
// ── Trust & quality layers ──
export { assessImageQuality, checkImageCompleteness, REQUIRED_IMAGE_TYPES, getRejectionMessage } from './services/image-quality.service.js';
export { computeDiagnosisConfidence } from './services/confidence.service.js';
export { generateActionGuidance, generateAlertActionSummary } from './services/action-engine.service.js';
export { validateBoundary, farmHasValidBoundary } from './services/boundary-validation.service.js';
// ── Infrastructure ──
export { getStorage, storageKey } from './infra/storage.js';
export { enqueue, startWorker, stopWorker, stopAllWorkers, pruneJobs } from './infra/jobs.js';
//# sourceMappingURL=index.js.map