import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as reviewService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Add review note
router.post('/:applicationId/notes', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const { content, internal } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  const note = await reviewService.addReviewNote(req.params.applicationId, req.user.sub, content, internal !== false);
  await writeAuditLog({
    applicationId: req.params.applicationId, userId: req.user.sub,
    action: 'review_note_added', ipAddress: req.ip,
  });
  res.status(201).json(note);
}));

// List review notes
router.get('/:applicationId/notes', asyncHandler(async (req, res) => {
  const notes = await reviewService.listReviewNotes(req.params.applicationId);
  res.json(notes);
}));

// Get review assignments for an application
router.get('/:applicationId/assignments', asyncHandler(async (req, res) => {
  const assignments = await reviewService.getReviewAssignments(req.params.applicationId);
  res.json(assignments);
}));

// Complete a review assignment
router.patch('/assignments/:assignmentId/complete', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const assignment = await reviewService.completeReviewAssignment(req.params.assignmentId, req.user.sub);
  await writeAuditLog({
    userId: req.user.sub, action: 'review_assignment_completed',
    details: { assignmentId: req.params.assignmentId }, ipAddress: req.ip,
  });
  res.json(assignment);
}));

// Get my review assignments
router.get('/my-assignments', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const { status } = req.query;
  const assignments = await reviewService.getMyAssignments(req.user.sub, status);
  res.json(assignments);
}));

export default router;
