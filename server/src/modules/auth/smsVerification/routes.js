/**
 * SMS verification routes — mounted at /api/auth/sms.
 *
 *   POST /start-verification  { phone, purpose?, channel?, locale? }
 *   POST /check-verification  { phone, purpose?, code, newPassword? }
 *
 * Both routes are thin — every decision lives in ./service.js.
 * Both routes are rate-limited using the existing password-reset
 * limiter (5/15min/IP) so SMS OTP abuse pays the same cost as
 * email-reset abuse. Audit logs + ops events are emitted inside
 * the service.
 */

import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler.js';
import { passwordResetLimiter } from '../../../middleware/rateLimiters.js';
import {
  startSmsVerification,
  checkSmsVerification,
  SMS_PURPOSES,
} from './service.js';

const router = Router();

function sendResult(res, result) {
  const status = result.status || (result.ok ? 200 : 400);
  // Don't echo internal flags to the client — just the user-facing shape.
  const payload = result.ok
    ? {
        ok: true,
        code: result.code || 'sent',
        channel: result.channel,
        purpose: result.purpose,
        cooldownSec: result.cooldownSec,
        verified: result.verified,
        passwordReset: result.passwordReset,
      }
    : {
        ok: false,
        code: result.code || 'error',
        message: result.message || 'Verification failed.',
        retryAfterSec: result.retryAfterSec,
      };
  return res.status(status).json(payload);
}

// POST /api/auth/sms/start-verification
router.post('/start-verification', passwordResetLimiter, asyncHandler(async (req, res) => {
  const {
    phone,
    purpose = SMS_PURPOSES.PASSWORD_RESET,
    channel = 'sms',
    locale,
  } = req.body || {};

  // Pass req.ip through so the service can enforce the per-IP
  // sliding-window throttle. express trusts the proxy chain we
  // already set up upstream (trust proxy is enabled on the app).
  const r = await startSmsVerification({
    phone, purpose, channel, locale,
    ip: req.ip || req.headers['x-forwarded-for'] || null,
  });
  return sendResult(res, r);
}));

// POST /api/auth/sms/check-verification
router.post('/check-verification', passwordResetLimiter, asyncHandler(async (req, res) => {
  const {
    phone,
    code,
    purpose = SMS_PURPOSES.PASSWORD_RESET,
    newPassword,
  } = req.body || {};

  const r = await checkSmsVerification({ phone, code, purpose, newPassword });
  return sendResult(res, r);
}));

export default router;
