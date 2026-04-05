import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
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

// ═══════════════════════════════════════════════════════
//  CRUD
// ═══════════════════════════════════════════════════════

// Create application
router.post('/', authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const { farmerId, cropType, farmSizeAcres, requestedAmount } = req.body;
  if (!farmerId || !cropType || !farmSizeAcres || !requestedAmount) {
    return res.status(400).json({ error: 'farmerId, cropType, farmSizeAcres, and requestedAmount are required' });
  }
  const app = await appService.createApplication(req.body, req.user.sub);
  await writeAuditLog({
    applicationId: app.id, userId: req.user.sub, action: 'application_created',
    newStatus: 'draft', ipAddress: req.ip,
  });
  res.status(201).json(app);
}));

// List applications
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, status, farmerId, search } = req.query;
  let assignedReviewerId;
  if (req.user.role === 'reviewer') assignedReviewerId = req.user.sub;

  const result = await appService.listApplications({
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 20,
    status, farmerId, search, assignedReviewerId,
  });
  res.json(result);
}));

// Get stats
router.get('/stats', authorize('super_admin', 'institutional_admin', 'investor_viewer'), asyncHandler(async (req, res) => {
  const stats = await appService.getApplicationStats();
  res.json(stats);
}));

// Get application by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const app = await appService.getApplicationById(req.params.id);
  res.json(app);
}));

// Update application
router.put('/:id', authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const app = await appService.updateApplication(req.params.id, req.body);
  await writeAuditLog({
    applicationId: app.id, userId: req.user.sub, action: 'application_updated', ipAddress: req.ip,
  });
  res.json(app);
}));

// ═══════════════════════════════════════════════════════
//  WORKFLOW ACTIONS
// ═══════════════════════════════════════════════════════

// Submit (draft → submitted)
router.post('/:id/submit', authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const app = await appService.submitApplication(req.params.id);
  await writeAuditLog({
    applicationId: app.id, userId: req.user.sub, action: 'application_submitted',
    previousStatus: 'draft', newStatus: 'submitted', ipAddress: req.ip,
  });
  res.json(app);
}));

// Approve
router.post('/:id/approve', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const { reason, recommendedAmount } = req.body;
  const { application, previousStatus } = await appService.approveApplication(req.params.id, req.user.sub, { reason, recommendedAmount });
  await writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'application_approved',
    previousStatus, newStatus: 'approved', details: { reason, recommendedAmount }, ipAddress: req.ip,
  });
  res.json(application);
}));

// Reject
router.post('/:id/reject', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required for rejection' });
  const { application, previousStatus } = await appService.rejectApplication(req.params.id, req.user.sub, reason);
  await writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'application_rejected',
    previousStatus, newStatus: 'rejected', details: { reason }, ipAddress: req.ip,
  });
  res.json(application);
}));

// Escalate
router.post('/:id/escalate', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required for escalation' });
  const { application, previousStatus } = await appService.escalateApplication(req.params.id, req.user.sub, reason);
  await writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'application_escalated',
    previousStatus, newStatus: 'escalated', details: { reason }, ipAddress: req.ip,
  });
  res.json(application);
}));

// Reopen
router.post('/:id/reopen', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const { application, previousStatus } = await appService.reopenApplication(req.params.id, req.user.sub, reason);
  await writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'application_reopened',
    previousStatus, newStatus: 'under_review', details: { reason }, ipAddress: req.ip,
  });
  res.json(application);
}));

// Request Evidence
router.post('/:id/request-evidence', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const { reason, requiredTypes } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required' });
  const { application, previousStatus } = await appService.requestEvidence(req.params.id, req.user.sub, { reason, requiredTypes });
  await writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'evidence_requested',
    previousStatus, newStatus: 'needs_more_evidence', details: { reason, requiredTypes }, ipAddress: req.ip,
  });
  res.json(application);
}));

// Generic status update (legacy — prefer specific actions above)
router.patch('/:id/status', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const { application, previousStatus } = await appService.updateStatus(req.params.id, status, req.user.sub);
  await writeAuditLog({
    applicationId: application.id, userId: req.user.sub, action: 'status_changed',
    previousStatus, newStatus: status, ipAddress: req.ip,
  });
  res.json(application);
}));

// Assign reviewer
router.post('/:id/assign-reviewer', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const { reviewerId } = req.body;
  if (!reviewerId) return res.status(400).json({ error: 'reviewerId is required' });
  const app = await appService.assignReviewer(req.params.id, reviewerId);
  await writeAuditLog({
    applicationId: app.id, userId: req.user.sub, action: 'reviewer_assigned',
    details: { reviewerId }, ipAddress: req.ip,
  });
  res.json(app);
}));

// Assign field officer
router.post('/:id/assign-field-officer', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const { officerId } = req.body;
  if (!officerId) return res.status(400).json({ error: 'officerId is required' });
  const app = await appService.assignFieldOfficer(req.params.id, officerId);
  await writeAuditLog({
    applicationId: app.id, userId: req.user.sub, action: 'field_officer_assigned',
    details: { officerId }, ipAddress: req.ip,
  });
  res.json(app);
}));

// ═══════════════════════════════════════════════════════
//  ENGINE SCORING (nested under applications)
// ═══════════════════════════════════════════════════════

// Run verification engine
router.post('/:id/score-verification', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const result = await verificationService.runVerification(req.params.id);
  await writeAuditLog({
    applicationId: req.params.id, userId: req.user.sub,
    action: 'verification_run', details: { score: result.verificationScore, confidence: result.confidence },
    ipAddress: req.ip,
  });
  res.json(result);
}));

// Run fraud analysis
router.post('/:id/score-fraud', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const result = await fraudService.runFraudAnalysis(req.params.id);
  await writeAuditLog({
    applicationId: req.params.id, userId: req.user.sub,
    action: 'fraud_analysis_run', details: { riskScore: result.fraudRiskScore, riskLevel: result.fraudRiskLevel },
    ipAddress: req.ip,
  });
  res.json(result);
}));

// Run decision engine
router.post('/:id/score-decision', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const result = await decisionService.runDecisionEngine(req.params.id);
  await writeAuditLog({
    applicationId: req.params.id, userId: req.user.sub,
    action: 'decision_engine_run',
    details: { decision: result.decision, riskLevel: result.riskLevel },
    newStatus: result.decision === 'approve' ? 'approved' : result.decision === 'reject' ? 'rejected' : null,
    ipAddress: req.ip,
  });
  res.json(result);
}));

// Run benchmark
router.post('/:id/score-benchmark', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const result = await benchmarkService.runBenchmark(req.params.id);
  await writeAuditLog({
    applicationId: req.params.id, userId: req.user.sub,
    action: 'benchmark_run', details: { peerGroupSize: result.peerGroupSize }, ipAddress: req.ip,
  });
  res.json(result);
}));

// Run intelligence (admin only — secondary/shadow)
router.post('/:id/score-intelligence', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const result = await intelligenceService.runIntelligence(req.params.id);
  await writeAuditLog({
    applicationId: req.params.id, userId: req.user.sub,
    action: 'intelligence_run', details: { mlShadowScore: result.mlShadowScore }, ipAddress: req.ip,
  });
  res.json(result);
}));

// ═══════════════════════════════════════════════════════
//  ENGINE RESULTS (GET — nested under applications)
// ═══════════════════════════════════════════════════════

router.get('/:id/verification', asyncHandler(async (req, res) => {
  const result = await verificationService.getVerificationResult(req.params.id);
  if (!result) return res.status(404).json({ error: 'No verification result found' });
  res.json(result);
}));

router.get('/:id/fraud', asyncHandler(async (req, res) => {
  const result = await fraudService.getFraudResult(req.params.id);
  if (!result) return res.status(404).json({ error: 'No fraud result found' });
  res.json(result);
}));

router.get('/:id/decision', asyncHandler(async (req, res) => {
  const result = await decisionService.getDecisionResult(req.params.id);
  if (!result) return res.status(404).json({ error: 'No decision result found' });
  res.json(result);
}));

router.get('/:id/benchmark', asyncHandler(async (req, res) => {
  const result = await benchmarkService.getBenchmarkResult(req.params.id);
  if (!result) return res.status(404).json({ error: 'No benchmark result found' });
  res.json(result);
}));

router.get('/:id/intelligence', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const result = await intelligenceService.getIntelligenceResult(req.params.id);
  if (!result) return res.status(404).json({ error: 'No intelligence result found' });
  res.json(result);
}));

export default router;
