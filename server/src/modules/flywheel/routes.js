/**
 * server/src/modules/flywheel/routes.js — Phase 14 Intelligence API.
 *
 *   mounted at /api/flywheel/*
 *
 *   GET /api/flywheel/farm            — farm memory graph
 *   GET /api/flywheel/crop            — crop memory graph (?cropId=)
 *   GET /api/flywheel/recommendations — recommendation funnel
 *   GET /api/flywheel/trust           — farmer + buyer + program trust
 *   GET /api/flywheel/outcomes        — outcome verdicts + helpRate
 *
 * Spec note
 * ─────────
 *   The Phase 14 spec lists these as `/api/intelligence/farm`, etc.
 *   The existing wave-9 intelligence module owns `/api/intelligence`
 *   with a `:applicationId` wildcard that would shadow these flat
 *   paths. To respect the strict-rule "do not modify existing
 *   modules", the canonical Phase 14 Intelligence API is mounted
 *   at `/api/flywheel/*`.
 *
 *   These routes return composite envelopes derived from the
 *   client-shipped event log + server-side companion signals.
 *   For now the event log is caller-supplied (POST body) since
 *   the cross-farm event sync is still named-deferred. The shape
 *   stays stable so the UI can call through `apiRuntime` exactly
 *   like every other server route.
 *
 * Strict-rule audit
 *   • Authenticated. Same `authenticate` middleware as every
 *     other route on this server.
 *   • Never throws — every handler is wrapped in asyncHandler.
 *   • Never returns 500s for client-shape errors — uses 400.
 *   • Never returns PII the client didn't already have.
 *   • Composition-only — does NOT modify any existing route.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';

// The Phase 14 runtime engines live in src/runtime/flywheel —
// shared between client + server. We mirror the public interface
// here so the server can compose envelopes from request bodies.
// (Engines are pure, framework-free ES modules — they Just Work
// in Node.)
import {
  dataFlywheel,
  DATA_FLYWHEEL_VERSION,
  buildFarmMemory,
  buildCropMemory,
  computeRecommendationFunnel,
  computeOutcomes,
  composeFarmerTrust,
  computeBuyerTrust,
  computeProgramTrust,
} from '../../../../src/runtime/flywheel/index.js';

const router = Router();
router.use(authenticate);

function _badRequest(res, reason) {
  return res.status(400).json({
    error: 'bad_request', reason, runtimeVersion: DATA_FLYWHEEL_VERSION,
  });
}

// GET /api/flywheel/farm
//   body or query: events (array), farmId
router.get('/farm', asyncHandler(async (req, res) => {
  const events = Array.isArray(req.body && req.body.events) ? req.body.events
               : Array.isArray(req.query && req.query.events) ? req.query.events
               : [];
  const farmId = (req.body && req.body.farmId) || req.query.farmId || '';
  const out = buildFarmMemory({ events, farmId });
  res.json({ runtimeVersion: DATA_FLYWHEEL_VERSION, farm: out });
}));

// GET /api/flywheel/crop?cropId=...
router.get('/crop', asyncHandler(async (req, res) => {
  const cropId = (req.body && req.body.cropId) || req.query.cropId || '';
  if (!cropId) return _badRequest(res, 'missing_cropId');
  const events = Array.isArray(req.body && req.body.events) ? req.body.events : [];
  const out = buildCropMemory({ events, cropId });
  res.json({ runtimeVersion: DATA_FLYWHEEL_VERSION, crop: out });
}));

// GET /api/flywheel/recommendations
router.get('/recommendations', asyncHandler(async (req, res) => {
  const events = Array.isArray(req.body && req.body.events) ? req.body.events : [];
  const outcomeRecords = Array.isArray(req.body && req.body.outcomeRecords)
    ? req.body.outcomeRecords : [];
  const out = computeRecommendationFunnel({ events, outcomeRecords });
  res.json({ runtimeVersion: DATA_FLYWHEEL_VERSION, recommendations: out });
}));

// GET /api/flywheel/trust
router.get('/trust', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const farmer = composeFarmerTrust({
    events:      Array.isArray(body.events) ? body.events : [],
    taskState:   body.taskState,
    scanHistory: Array.isArray(body.scanHistory) ? body.scanHistory : [],
    baseTrust:   body.baseTrust,
  });
  // Buyer + program are gated by default — caller MUST pass
  // ungatedFlag=true to receive scored output. RC1 production
  // never sets that flag.
  const buyer  = computeBuyerTrust(body.buyerInputs || {});
  const program = computeProgramTrust(body.programInputs || {});
  res.json({
    runtimeVersion: DATA_FLYWHEEL_VERSION,
    trust: { farmer, buyer, program },
  });
}));

// GET /api/flywheel/outcomes
router.get('/outcomes', asyncHandler(async (req, res) => {
  const events = Array.isArray(req.body && req.body.events) ? req.body.events : [];
  const out = computeOutcomes({ events });
  res.json({ runtimeVersion: DATA_FLYWHEEL_VERSION, outcomes: out });
}));

// GET /api/flywheel — composite (matches client useDataFlywheel)
router.get('/', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const out = dataFlywheel(body);
  res.json(out);
}));

export default router;
