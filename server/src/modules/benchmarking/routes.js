import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as benchmarkService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Run benchmark
router.post('/:applicationId/run', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const result = await benchmarkService.runBenchmark(req.params.applicationId);
  writeAuditLog({
    applicationId: req.params.applicationId, userId: req.user.sub,
    action: 'benchmark_run', details: { peerGroupSize: result.peerGroupSize }, ipAddress: req.ip,
  }).catch(() => {});
  res.json(result);
}));

// Get benchmark result
router.get('/:applicationId', asyncHandler(async (req, res) => {
  const result = await benchmarkService.getBenchmarkResult(req.params.applicationId);
  if (!result) return res.status(404).json({ error: 'No benchmark result found' });
  res.json(result);
}));

export default router;
