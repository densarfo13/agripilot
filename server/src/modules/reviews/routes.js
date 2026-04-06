import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, requireApplicationAccess } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as reviewService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Get my review assignments (must be above /:applicationId routes)
router.get('/my-assignments', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const { status } = req.query;
  const assignments = await reviewService.getMyAssignments(req.user.sub, status);
  res.json(assignments);
}));

// Add review note (scoped)
router.post('/:applicationId/notes',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  requireApplicationAccess,
  asyncHandler(async (req, res) => {
    const { content, internal } = req.body;
    if (!content) return res.status(400).json({ error: 'content is required' });
    const note = await reviewService.addReviewNote(req.params.applicationId, req.user.sub, content, internal !== false);
    writeAuditLog({
      applicationId: req.params.applicationId, userId: req.user.sub,
      action: 'review_note_added', ipAddress: req.ip,
    }).catch(() => {});
    res.status(201).json(note);
  }));

// List review notes (scoped)
router.get('/:applicationId/notes',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'),
  requireApplicationAccess,
  asyncHandler(async (req, res) => {
    const notes = await reviewService.listReviewNotes(req.params.applicationId);
    res.json(notes);
  }));

// Get review assignments for an application (scoped)
router.get('/:applicationId/assignments',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'),
  requireApplicationAccess,
  asyncHandler(async (req, res) => {
    const assignments = await reviewService.getReviewAssignments(req.params.applicationId);
    res.json(assignments);
  }));

// Complete a review assignment
router.patch('/assignments/:assignmentId/complete',
  validateParamUUID('assignmentId'),
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const assignment = await reviewService.completeReviewAssignment(req.params.assignmentId, req.user.sub);
    writeAuditLog({
      userId: req.user.sub, action: 'review_assignment_completed',
      details: { assignmentId: req.params.assignmentId }, ipAddress: req.ip,
    }).catch(() => {});
    res.json(assignment);
  }));

export default router;
