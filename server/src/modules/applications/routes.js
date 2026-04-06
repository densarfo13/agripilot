import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, requireApprovedFarmer, requireApplicationAccess } from '../../middleware/auth.js';
import { validateParamUUID, isValidUUID, parsePositiveInt } from '../../middleware/validate.js';
import { dedupGuard } from '../../middleware/dedup.js';
import { workflowLimiter } from '../../middleware/rateLimiters.js';
import { idempotencyCheck } from '../../middleware/idempotency.js';
import * as appService from './service.js';
import { writeAuditLog } from '../audit/service.js';

// Engine service imports
import * as verificationService from '../verification/service.js';
import * as fraudService from '../fraud/service.js';
import * as decisionService from '../decision/service.js';
import * as benchmarkService from '../benchmarking/service.js';
import * as intelligenceService from '../intelligence/service.js';

const router = Router();
router.use(authenticate);
router.use(requireApprovedFarmer);

// ═══════════════════════════════════════════════════════
//  CRUD
// ═══════════════════════════════════════════════════════

// Create application
router.post('/', authorize('super_admin', 'institutional_admin', 'field_officer'), idempotencyCheck, asyncHandler(async (req, res) => {
  const { farmerId, cropType, farmSizeAcres, requestedAmount } = req.body;
  if (!farmerId || !cropType || !farmSizeAcres || !requestedAmount) {
    return res.status(400).json({ error: 'farmerId, cropType, farmSizeAcres, and requestedAmount are required' });
  }
  if (!isValidUUID(farmerId)) {
    return res.status(400).json({ error: 'Invalid farmerId format' });
  }
  if (isNaN(parseFloat(farmSizeAcres)) || parseFloat(farmSizeAcres) <= 0) {
    return res.status(400).json({ error: 'farmSizeAcres must be a positive number' });
  }
  if (isNaN(parseFloat(requestedAmount)) || parseFloat(requestedAmount) <= 0) {
    return res.status(400).json({ error: 'requestedAmount must be a positive number' });
  }
  const app = await appService.createApplication(req.body, req.user.sub);
  writeAuditLog({
    applicationId: app.id, userId: req.user.sub, action: 'application_created',
    newStatus: 'draft', ipAddress: req.ip,
  }).catch(() => {});
  res.status(201).json(app);
}));

// List applications (scoped: reviewers see only assigned, field officers see only assigned)
router.get('/', authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'), asyncHandler(async (req, res) => {
  const { status, farmerId, search } = req.query;
  let assignedReviewerId;
  let assignedFieldOfficerId;
  if (req.user.role === 'reviewer') assignedReviewerId = req.user.sub;
  if (req.user.role === 'field_officer') assignedFieldOfficerId = req.user.sub;

  const result = await appService.listApplications({
    page: parsePositiveInt(req.query.page, 1, 1000),
    limit: parsePositiveInt(req.query.limit, 20, 100),
    status, farmerId, search, assignedReviewerId, assignedFieldOfficerId,
  });
  res.json(result);
}));

// Get stats
router.get('/stats', authorize('super_admin', 'institutional_admin', 'investor_viewer'), asyncHandler(async (req, res) => {
  const stats = await appService.getApplicationStats();
  res.json(stats);
}));

// Get application by ID (scoped: field officers / reviewers see only assigned)
router.get('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'), requireApplicationAccess, asyncHandler(async (req, res) => {
  const app = await appService.getApplicationById(req.params.id);
  res.json(app);
}));

// Update application (scoped)
router.put('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'field_officer'), requireApplicationAccess, asyncHandler(async (req, res) => {
  const app = await appService.updateApplication(req.params.id, req.body);
  writeAuditLog({
    applicationId: app.id, userId: req.user.sub, action: 'application_updated', ipAddress: req.ip,
  }).catch(() => {});
  res.json(app);
}));

// ═══════════════════════════════════════════════════════
//  WORKFLOW ACTIONS
// ═══════════════════════════════════════════════════════

// Submit (draft → submitted)
router.post('/:id/submit', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'field_officer'), requireApplicationAccess, workflowLimiter, dedupGuard('submit'), asyncHandler(async (req, res) => {
  const app = await appService.submitApplication(req.params.id);
  writeAuditLog({
    applicationId: app.id, userId: req.user.sub, action: 'application_submitted',
    previousStatus: 'draft', newStatus: 'submitted', ipAddress: req.ip,
  }).catch(() => {});
  res.json(app);
}));

// Approve (scoped — reviewer must be assigned)
router.post('/:id/approve', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer'), requireApplicationAccess, workflowLimiter, dedupGuard('approve'), asyncHandler(async (req, res) => {
  const { reason, recommendedAmount } = req.body;
  const { application, previousStatus } = await appService.approveApplication(req.params.id, req.user.sub, { reason, recommendedAmount });
  writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'application_approved',
    previousStatus, newStatus: 'approved', details: { reason, recommendedAmount }, ipAddress: req.ip,
  }).catch(() => {});
  res.json(application);
}));

// Reject (scoped)
router.post('/:id/reject', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer'), requireApplicationAccess, workflowLimiter, dedupGuard('reject'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required for rejection' });
  const { application, previousStatus } = await appService.rejectApplication(req.params.id, req.user.sub, reason);
  writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'application_rejected',
    previousStatus, newStatus: 'rejected', details: { reason }, ipAddress: req.ip,
  }).catch(() => {});
  res.json(application);
}));

// Escalate (scoped)
router.post('/:id/escalate', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer'), requireApplicationAccess, workflowLimiter, dedupGuard('escalate'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required for escalation' });
  const { application, previousStatus } = await appService.escalateApplication(req.params.id, req.user.sub, reason);
  writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'application_escalated',
    previousStatus, newStatus: 'escalated', details: { reason }, ipAddress: req.ip,
  }).catch(() => {});
  res.json(application);
}));

// Reopen
router.post('/:id/reopen', validateParamUUID('id'), authorize('super_admin', 'institutional_admin'), workflowLimiter, dedupGuard('reopen'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const { application, previousStatus } = await appService.reopenApplication(req.params.id, req.user.sub, reason);
  writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'application_reopened',
    previousStatus, newStatus: 'under_review', details: { reason }, ipAddress: req.ip,
  }).catch(() => {});
  res.json(application);
}));

// Disburse (approved/conditional → disbursed)
router.post('/:id/disburse', validateParamUUID('id'), authorize('super_admin', 'institutional_admin'), workflowLimiter, dedupGuard('disburse'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const { application, previousStatus } = await appService.disburseApplication(req.params.id, req.user.sub, { reason });
  writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'application_disbursed',
    previousStatus, newStatus: 'disbursed', details: { reason }, ipAddress: req.ip,
  }).catch(() => {});
  res.json(application);
}));

// Request Evidence (scoped)
router.post('/:id/request-evidence', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer'), requireApplicationAccess, workflowLimiter, dedupGuard('request-evidence'), asyncHandler(async (req, res) => {
  const { reason, requiredTypes } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required' });
  const { application, previousStatus } = await appService.requestEvidence(req.params.id, req.user.sub, { reason, requiredTypes });
  writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'evidence_requested',
    previousStatus, newStatus: 'needs_more_evidence', details: { reason, requiredTypes }, ipAddress: req.ip,
  }).catch(() => {});
  res.json(application);
}));

// Generic status update (admin-only — prefer specific workflow actions above)
router.patch('/:id/status', validateParamUUID('id'), authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const { application, previousStatus } = await appService.updateStatus(req.params.id, status, req.user.sub);
  writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'status_changed',
    previousStatus, newStatus: status, ipAddress: req.ip,
  }).catch(() => {});
  res.json(application);
}));

// Assign reviewer
router.post('/:id/assign-reviewer', validateParamUUID('id'), authorize('super_admin', 'institutional_admin'), dedupGuard('assign-reviewer'), asyncHandler(async (req, res) => {
  const { reviewerId } = req.body;
  if (!reviewerId) return res.status(400).json({ error: 'reviewerId is required' });
  const app = await appService.assignReviewer(req.params.id, reviewerId);
  writeAuditLog({
    applicationId: app.id, userId: req.user.sub, action: 'reviewer_assigned',
    details: { reviewerId }, ipAddress: req.ip,
  }).catch(() => {});
  res.json(app);
}));

// Assign field officer
router.post('/:id/assign-field-officer', validateParamUUID('id'), authorize('super_admin', 'institutional_admin'), dedupGuard('assign-officer'), asyncHandler(async (req, res) => {
  const { officerId } = req.body;
  if (!officerId) return res.status(400).json({ error: 'officerId is required' });
  const app = await appService.assignFieldOfficer(req.params.id, officerId);
  writeAuditLog({
    applicationId: app.id, userId: req.user.sub, action: 'field_officer_assigned',
    details: { officerId }, ipAddress: req.ip,
  }).catch(() => {});
  res.json(app);
}));

// ═══════════════════════════════════════════════════════
//  ENGINE SCORING (nested under applications)
// ═══════════════════════════════════════════════════════

// Run verification engine (scoped)
router.post('/:id/score-verification', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer'), requireApplicationAccess, workflowLimiter, dedupGuard('score-verification'), asyncHandler(async (req, res) => {
  const result = await verificationService.runVerification(req.params.id);
  writeAuditLog({
    applicationId: req.params.id, userId: req.user.sub,
    action: 'verification_run', details: { score: result.verificationScore, confidence: result.confidence },
    ipAddress: req.ip,
  }).catch(() => {});
  res.json(result);
}));

// Run fraud analysis (scoped)
router.post('/:id/score-fraud', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer'), requireApplicationAccess, workflowLimiter, dedupGuard('score-fraud'), asyncHandler(async (req, res) => {
  const result = await fraudService.runFraudAnalysis(req.params.id);
  writeAuditLog({
    applicationId: req.params.id, userId: req.user.sub,
    action: 'fraud_analysis_run', details: { riskScore: result.fraudRiskScore, riskLevel: result.fraudRiskLevel },
    ipAddress: req.ip,
  }).catch(() => {});
  res.json(result);
}));

// Run decision engine (scoped)
router.post('/:id/score-decision', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer'), requireApplicationAccess, workflowLimiter, dedupGuard('score-decision'), asyncHandler(async (req, res) => {
  const result = await decisionService.runDecisionEngine(req.params.id);
  writeAuditLog({
    applicationId: req.params.id, userId: req.user.sub,
    action: 'decision_engine_run',
    details: { recommendedDecision: result.decision, riskLevel: result.riskLevel, recommendedAmount: result.recommendedAmount },
    // Only log newStatus for auto-transitioned decisions (reject, escalate, needs_more_evidence)
    // Positive recommendations (approve, conditional_approve) do NOT auto-transition — no newStatus
    newStatus: ({ reject: 'rejected', escalate: 'escalated', needs_more_evidence: 'needs_more_evidence' })[result.decision] || null,
    ipAddress: req.ip,
  }).catch(() => {});
  res.json(result);
}));

// Run benchmark (scoped)
router.post('/:id/score-benchmark', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer'), requireApplicationAccess, workflowLimiter, dedupGuard('score-benchmark'), asyncHandler(async (req, res) => {
  const result = await benchmarkService.runBenchmark(req.params.id);
  writeAuditLog({
    applicationId: req.params.id, userId: req.user.sub,
    action: 'benchmark_run', details: { peerGroupSize: result.peerGroupSize }, ipAddress: req.ip,
  }).catch(() => {});
  res.json(result);
}));

// Run intelligence (admin only — secondary/shadow)
router.post('/:id/score-intelligence', validateParamUUID('id'), authorize('super_admin', 'institutional_admin'), workflowLimiter, dedupGuard('score-intelligence'), asyncHandler(async (req, res) => {
  const result = await intelligenceService.runIntelligence(req.params.id);
  writeAuditLog({
    applicationId: req.params.id, userId: req.user.sub,
    action: 'intelligence_run', details: { mlShadowScore: result.mlShadowScore }, ipAddress: req.ip,
  }).catch(() => {});
  res.json(result);
}));

// ═══════════════════════════════════════════════════════
//  ENGINE RESULTS (GET — nested under applications)
// ═══════════════════════════════════════════════════════

router.get('/:id/verification', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'), requireApplicationAccess, asyncHandler(async (req, res) => {
  const result = await verificationService.getVerificationResult(req.params.id);
  if (!result) return res.status(404).json({ error: 'No verification result found' });
  res.json(result);
}));

router.get('/:id/fraud', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'), requireApplicationAccess, asyncHandler(async (req, res) => {
  const result = await fraudService.getFraudResult(req.params.id);
  if (!result) return res.status(404).json({ error: 'No fraud result found' });
  res.json(result);
}));

router.get('/:id/decision', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'), requireApplicationAccess, asyncHandler(async (req, res) => {
  const result = await decisionService.getDecisionResult(req.params.id);
  if (!result) return res.status(404).json({ error: 'No decision result found' });
  res.json(result);
}));

router.get('/:id/benchmark', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'), requireApplicationAccess, asyncHandler(async (req, res) => {
  const result = await benchmarkService.getBenchmarkResult(req.params.id);
  if (!result) return res.status(404).json({ error: 'No benchmark result found' });
  res.json(result);
}));

router.get('/:id/intelligence', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer'), requireApplicationAccess, asyncHandler(async (req, res) => {
  const result = await intelligenceService.getIntelligenceResult(req.params.id);
  if (!result) return res.status(404).json({ error: 'No intelligence result found' });
  res.json(result);
}));

export default router;
