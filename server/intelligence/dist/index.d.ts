/**
 * Farroway Intelligence Module — Barrel Export
 *
 * Mounts all intelligence routers under a single Express router
 * that can be imported and used from the main app.js.
 *
 * Usage in app.js:
 *   import { intelligenceRouter } from './intelligence/index.js';
 *   app.use('/api/v2', intelligenceRouter);
 */
declare const intelligenceRouter: import("express-serve-static-core").Router;
export { intelligenceRouter };
export * from './types/index.js';
export { computeFarmPestRisk, computeHotspotScore, computeRegionalOutbreakScore, computeAlertConfidence, riskLevelFromScore, computeCropStageVulnerability, computeVerificationSignal, } from './services/scoring.service.js';
export { evaluateAndCreateAlert, getActiveAlerts, getAlertsByFarmer } from './services/alert.service.js';
export { ingestSatelliteScan } from './services/satellite.service.js';
export { ingestDroneScan } from './services/drone.service.js';
export { detectOutbreakClusters, computeDistrictRisk, getRegionalIntelligence, getActiveOutbreakClusters } from './services/outbreak.service.js';
//# sourceMappingURL=index.d.ts.map