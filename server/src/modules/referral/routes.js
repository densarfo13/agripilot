import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import * as service from './service.js';

const router = Router();
router.use(authenticate);

// GET /api/v1/referral — get referral code + info
router.get('/', asyncHandler(async (req, res) => {
  const data = await service.getReferralInfo(req.user.sub);
  res.json(data);
}));

// POST /api/v1/referral/apply — apply a referral code
router.post('/apply', asyncHandler(async (req, res) => {
  const { code } = req.body;
  const result = await service.applyReferralCode(req.user.sub, code);
  res.json(result);
}));

export default router;
