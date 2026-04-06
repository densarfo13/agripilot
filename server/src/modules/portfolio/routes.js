import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { parsePositiveInt } from '../../middleware/validate.js';
import * as portfolioService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Get live portfolio summary
router.get('/summary', authorize('super_admin', 'institutional_admin', 'investor_viewer'), asyncHandler(async (req, res) => {
  const summary = await portfolioService.getPortfolioSummary();
  res.json(summary);
}));

// Take a portfolio snapshot
router.post('/snapshot', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const snapshot = await portfolioService.takeSnapshot();
  writeAuditLog({
    userId: req.user.sub, action: 'portfolio_snapshot_taken',
    details: { snapshotId: snapshot.id }, ipAddress: req.ip,
  }).catch(() => {});
  res.status(201).json(snapshot);
}));

// Get snapshot history
router.get('/snapshots', authorize('super_admin', 'institutional_admin', 'investor_viewer'), asyncHandler(async (req, res) => {
  const limit = parsePositiveInt(req.query.limit, 30, 365);
  const snapshots = await portfolioService.getSnapshotHistory(limit);
  res.json(snapshots);
}));

export default router;
