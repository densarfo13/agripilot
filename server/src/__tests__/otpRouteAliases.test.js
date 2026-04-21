/**
 * otpRouteAliases.test.js — contract tests for the Twilio Verify OTP
 * path aliases. The SMS verification service is mounted at
 * /api/auth/sms/{start,check}-verification; these aliases expose the
 * same service at the paths the frontend already calls and the paths
 * the spec calls for. A regression that removes an alias trips a red
 * test here.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('v2 OTP aliases (server/routes/auth.js)', () => {
  const code = readFile('server/routes/auth.js');

  it('imports the SMS verification service', () => {
    expect(code).toContain("from '../src/modules/auth/smsVerification/service.js'");
    expect(code).toContain('startSmsVerification');
    expect(code).toContain('checkSmsVerification');
  });

  it('mounts POST /otp/request (frontend canonical path)', () => {
    expect(code).toMatch(/router\.post\(\s*['"]\/otp\/request['"]/);
  });

  it('mounts POST /otp/verify (frontend canonical path)', () => {
    expect(code).toMatch(/router\.post\(\s*['"]\/otp\/verify['"]/);
  });

  it('mounts POST /send-otp (spec §3 canonical path)', () => {
    expect(code).toMatch(/router\.post\(\s*['"]\/send-otp['"]/);
  });

  it('mounts POST /verify-otp (spec §4 canonical path)', () => {
    expect(code).toMatch(/router\.post\(\s*['"]\/verify-otp['"]/);
  });

  it('rate-limits every OTP path with passwordResetLimiter', () => {
    // All four handlers must sit behind the limiter.
    const line = (p) => new RegExp(`router\\.post\\(\\s*['"]${p.replace(/[-\\/]/g, '\\$&')}['"],\\s*passwordResetLimiter`);
    expect(code).toMatch(line('/otp/request'));
    expect(code).toMatch(line('/otp/verify'));
    expect(code).toMatch(line('/send-otp'));
    expect(code).toMatch(line('/verify-otp'));
  });

  it('never leaks a raw Twilio body to the client', () => {
    // The shared `sendOtpResult` builds a whitelist payload.
    expect(code).toContain('function sendOtpResult(');
    // Failing branch must ONLY forward { ok, code, message, retryAfterSec }.
    const sendOtp = code.split('function sendOtpResult')[1] || '';
    const failBranch = sendOtp.split('return res.status(status).json(payload);')[0];
    expect(failBranch).not.toMatch(/\.twilio|provider:\s*result\.rawError|raw_body/i);
  });

  it('catches unexpected provider failures and returns provider_error', () => {
    expect(code).toMatch(/code:\s*'provider_error'/);
    expect(code).toMatch(/handleSendOtp[\s\S]*?catch \(err\)/);
    expect(code).toMatch(/handleVerifyOtp[\s\S]*?catch \(err\)/);
  });

  it('mounts POST /send-recovery-email as an alias for /forgot-password', () => {
    expect(code).toMatch(/router\.post\(\s*['"]\/send-recovery-email['"]/);
    expect(code).toContain("req.url = '/forgot-password'");
  });
});

describe('v1 OTP aliases (server/src/modules/auth/routes.js)', () => {
  const code = readFile('server/src/modules/auth/routes.js');

  it('mounts /send-otp and /verify-otp under /api/auth', () => {
    expect(code).toMatch(/router\.post\(\s*['"]\/send-otp['"]/);
    expect(code).toMatch(/router\.post\(\s*['"]\/verify-otp['"]/);
  });

  it('forwards to the existing SMS verification routes', () => {
    expect(code).toContain("req.url = '/sms/start-verification'");
    expect(code).toContain("req.url = '/sms/check-verification'");
  });
});

describe('src/lib/api.js — frontend OTP helpers', () => {
  const code = readFile('src/lib/api.js');

  it('requestPhoneOtp hits /api/v2/auth/otp/request (now live)', () => {
    expect(code).toContain("'/api/v2/auth/otp/request'");
  });

  it('verifyPhoneOtp hits /api/v2/auth/otp/verify (now live)', () => {
    expect(code).toContain("'/api/v2/auth/otp/verify'");
  });
});

describe('VerifyOtp.jsx — server-echoed cooldown + safe error mapping', () => {
  const code = readFile('src/pages/VerifyOtp.jsx');

  it('maps max_attempts, rate_limited, cooldown, invalid_code codes', () => {
    expect(code).toContain("'max_attempts'");
    expect(code).toContain("'rate_limited'");
    expect(code).toContain("'cooldown'");
    expect(code).toContain("'invalid_code'");
    expect(code).toContain("'expired_or_invalid'");
    expect(code).toContain("'provider_error'");
  });

  it('reads cooldownSec from the server resend response', () => {
    expect(code).toMatch(/cooldownSec/);
    expect(code).toMatch(/retryAfterSec/);
  });

  it('never renders a raw provider stack / "Error:" string', () => {
    expect(code).toMatch(/stack\|error:/i);  // the filter that drops them
  });
});
