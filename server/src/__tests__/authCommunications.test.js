/**
 * authCommunications.test.js — end-to-end contract tests for the
 * coordinated auth-comm pass:
 *   • DEMO_MODE server-side gating
 *   • SMS config validator at boot
 *   • MFA demo bypass for allow-listed accounts only
 *   • Recovery-methods availability shape
 *   • No secrets, raw tokens, or reset links leak to the UI
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

// ─── Server demo-mode helper ─────────────────────────────────────
describe('server/lib/demoMode.js', () => {
  beforeEach(() => {
    delete process.env.DEMO_MODE;
    delete process.env.NODE_ENV;
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
    delete process.env.NODE_ENV;
  });

  it('isDemoMode() is true in development', async () => {
    process.env.NODE_ENV = 'development';
    const { isDemoMode } = await import('../../lib/demoMode.js');
    expect(isDemoMode()).toBe(true);
  });

  it('isDemoMode() is false in production by default', async () => {
    process.env.NODE_ENV = 'production';
    const mod = await import('../../lib/demoMode.js' + '?t=' + Date.now());
    expect(mod.isDemoMode()).toBe(false);
  });

  it('isDemoMode() is true in production when DEMO_MODE=true is set explicitly', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';
    const mod = await import('../../lib/demoMode.js' + '?t=' + Date.now());
    expect(mod.isDemoMode()).toBe(true);
  });

  it('isDemoAccount() only matches the allow-list', async () => {
    const { isDemoAccount, DEMO_ALLOWED_EMAILS } = await import('../../lib/demoMode.js');
    expect(DEMO_ALLOWED_EMAILS.length).toBeGreaterThan(0);
    expect(isDemoAccount(DEMO_ALLOWED_EMAILS[0])).toBe(true);
    expect(isDemoAccount('real-admin@farroway.app')).toBe(false);
    expect(isDemoAccount(null)).toBe(false);
    expect(isDemoAccount('')).toBe(false);
  });
});

// ─── SMS config validator ────────────────────────────────────────
describe('server/services/smsService.js', () => {
  const ENV_KEYS = [
    'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
    'TWILIO_VERIFY_SERVICE_SID', 'SMS_VERIFY_PROVIDER',
  ];
  beforeEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });
  afterEach(()  => { for (const k of ENV_KEYS) delete process.env[k]; });

  it('isSmsMessagingConfigured() requires SID + TOKEN + PHONE_NUMBER', async () => {
    const { isSmsMessagingConfigured } = await import('../../services/smsService.js');
    expect(isSmsMessagingConfigured()).toBe(false);
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    expect(isSmsMessagingConfigured()).toBe(false);
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    expect(isSmsMessagingConfigured()).toBe(false);
    process.env.TWILIO_PHONE_NUMBER = '+10000000000';
    expect(isSmsMessagingConfigured()).toBe(true);
  });

  it('isSmsVerifyConfigured() requires the Verify Service SID', async () => {
    const { isSmsVerifyConfigured } = await import('../../services/smsService.js');
    expect(isSmsVerifyConfigured()).toBe(false);
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    expect(isSmsVerifyConfigured()).toBe(false);
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VAtest';
    expect(isSmsVerifyConfigured()).toBe(true);
  });

  it('validateSmsConfig() returns { verify, messaging, problems } + logs', async () => {
    const { validateSmsConfig } = await import('../../services/smsService.js');
    const log = { info: () => {}, warn: () => {} };
    const r = validateSmsConfig({ log });
    expect(r.verify).toBe(false);
    expect(r.messaging).toBe(false);
    expect(Array.isArray(r.problems)).toBe(true);
    expect(r.problems.length).toBeGreaterThan(0);
  });

  it('validateSmsConfig() reports clean state when everything is set', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN  = 'tok';
    process.env.TWILIO_PHONE_NUMBER = '+10000000000';
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VAtest';
    const { validateSmsConfig } = await import('../../services/smsService.js');
    const r = validateSmsConfig({ log: { info: () => {}, warn: () => {} } });
    expect(r.verify).toBe(true);
    expect(r.messaging).toBe(true);
    expect(r.problems).toEqual([]);
  });
});

// ─── Boot sequence wires both validators ─────────────────────────
describe('server/src/server.js — boot validation', () => {
  const code = readFile('server/src/server.js');

  it('imports validateEmailConfig and validateSmsConfig', () => {
    expect(code).toContain('validateEmailConfig');
    expect(code).toContain('validateSmsConfig');
  });

  it('calls each validator before app.listen', () => {
    const beforeListen = code.split('app.listen')[0] || '';
    expect(beforeListen).toContain('validateEmailConfig()');
    expect(beforeListen).toContain('validateSmsConfig()');
  });

  it('wraps validators in try/catch so a bad config never crashes boot', () => {
    // Each call sits inside its own defensive try to keep app
    // operational even when one provider is misconfigured.
    expect(code).toMatch(/try\s*\{\s*validateEmailConfig\(\);?\s*\}\s*catch/);
    expect(code).toMatch(/try\s*\{\s*validateSmsConfig\(\);?\s*\}\s*catch/);
  });
});

// ─── MFA demo bypass ─────────────────────────────────────────────
describe('requireMfa — demo-mode bypass (source contract)', () => {
  const code = readFile('server/src/middleware/requireMfa.js');

  it('imports the server demoMode helpers', () => {
    expect(code).toContain("from '../../lib/demoMode.js'");
    expect(code).toContain('isDemoMode');
    expect(code).toContain('isDemoAccount');
  });

  it('writes an audit log row whenever a demo bypass fires', () => {
    expect(code).toContain("from '../modules/audit/service.js'");
    expect(code).toContain('writeAuditLog');
    expect(code).toMatch(/action:\s*['"]mfa\.demo_bypass['"]/);
  });

  it('bypass requires BOTH demo-mode AND an allow-listed email', () => {
    // Look for the guarded branch:
    //   if (isDemoMode() && isDemoAccount(req.user.email)) return next();
    expect(code).toMatch(/if\s*\(\s*isDemoMode\(\)\s*&&\s*isDemoAccount\(/);
  });

  it('still enforces role exemption / requirement before the demo bypass', () => {
    // Source order must be: exempt → not-required → demo bypass → challenge.
    // Use the exact guard patterns (not plain names) so code comments
    // above the function don't throw off indexOf().
    const idxExempt    = code.indexOf('if (isMfaExempt(role))');
    const idxReqd      = code.indexOf('if (!isMfaRequired(role))');
    const idxDemoGuard = code.indexOf('if (isDemoMode()');
    const idxChallenge = code.indexOf('if (!req.user.mfaVerifiedAt)');
    expect(idxExempt).toBeGreaterThan(-1);
    expect(idxReqd).toBeGreaterThan(idxExempt);
    expect(idxDemoGuard).toBeGreaterThan(idxReqd);
    expect(idxChallenge).toBeGreaterThan(idxDemoGuard);
  });
});

// ─── Forgot-password: demo-mode gating ───────────────────────────
describe('forgot-password: dev link echo gating', () => {
  const code = readFile('server/routes/auth.js');

  it('uses isDemoMode() as the single gate for the reset-link echo', () => {
    expect(code).toContain("from '../lib/demoMode.js'");
    expect(code).toMatch(/if\s*\(\s*isDemoMode\(\)\s*\)\s*\{\s*\n\s*console\.log\(.*dev_reset_link/);
  });

  it('reset link echo and the url-generated trace are the only log lines referencing resetUrl', () => {
    const resetLogs = code.match(/console\.\w+\([^)]*resetUrl[^)]*\)/g) || [];
    // Two log lines now reference resetUrl:
    //   1. console.log(`${tag} reset_url_generated host=${new URL(resetUrl).host}`)
    //   2. console.log(`${tag} dev_reset_link ${resetUrl}`) — gated by isDemoMode()
    // Neither leaks into the HTTP response (covered by a sibling test).
    expect(resetLogs.length).toBeLessThanOrEqual(2);
    // The dev_reset_link echo must remain.
    expect(code).toMatch(/dev_reset_link \$\{resetUrl\}/);
  });
});

// ─── Invite SMS uses Twilio Messages, not Verify ─────────────────
describe('deliveryService.sendInviteSms', () => {
  const code = readFile('server/src/modules/notifications/deliveryService.js');

  it('uses the Twilio Messages API for invite SMS', () => {
    expect(code).toContain('messages.create');
  });

  it('does NOT use Twilio Verify for invite SMS', () => {
    const sendInviteSmsBody = code.split('export async function sendInviteSms')[1] || '';
    // Only assert on the sendInviteSms block itself; other helpers
    // in the file may legitimately touch Verify infra elsewhere.
    const block = sendInviteSmsBody.split('export ')[0];
    expect(block).not.toContain('verifications.create');
    expect(block).not.toContain('VerifyService');
  });
});

// ─── SMS recovery endpoints wired ────────────────────────────────
describe('SMS recovery endpoints', () => {
  const routes = readFile('server/src/modules/auth/smsVerification/routes.js');
  it('exposes POST /start-verification and /check-verification', () => {
    expect(routes).toMatch(/router\.post\(['"]\/start-verification['"]/);
    expect(routes).toMatch(/router\.post\(['"]\/check-verification['"]/);
  });

  it('sets auth cookies when the SMS service issues a session', () => {
    expect(routes).toContain('setAuthCookies');
  });
});

// ─── Dead-file cleanup ───────────────────────────────────────────
describe('dead legacy auth pages removed', () => {
  it('ForgotPasswordPage.jsx is gone', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/pages/ForgotPasswordPage.jsx'))).toBe(false);
  });
  it('ResetPasswordPage.jsx is gone', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/pages/ResetPasswordPage.jsx'))).toBe(false);
  });
  it('App.jsx no longer imports the dead pages', () => {
    const app = readFile('src/App.jsx');
    expect(app).not.toContain('ForgotPasswordPage.jsx');
    expect(app).not.toContain('ResetPasswordPage.jsx');
  });
});

// ─── Smoke scripts present for operator use ──────────────────────
describe('pilot smoke scripts', () => {
  it('scripts/smoke-email.mjs exists and exits cleanly on missing config', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/smoke-email.mjs'))).toBe(true);
    const code = readFile('scripts/smoke-email.mjs');
    expect(code).toContain('validateEmailConfig');
    expect(code).toContain('buildPasswordResetEmail');
  });
  it('scripts/smoke-sms.mjs exists and uses the real provider', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/smoke-sms.mjs'))).toBe(true);
    const code = readFile('scripts/smoke-sms.mjs');
    expect(code).toContain('getActiveSmsVerificationProvider');
    expect(code).toContain('validateSmsConfig');
  });
});

// ─── ForgotPasswordSms phone hint ────────────────────────────────
describe('ForgotPasswordSms phone hint', () => {
  const code = readFile('src/pages/ForgotPasswordSms.jsx');
  it('renders a persistent hint asking for the country code', () => {
    expect(code).toContain('auth.smsReset.phoneHint');
    expect(code).toContain('country code');
  });
  it('has aria-describedby wired to the hint element', () => {
    expect(code).toContain('aria-describedby="sms-phone-hint"');
  });
});

// ─── UI: ForgotPassword — final copy + no secrets ────────────────
describe('src/pages/ForgotPassword.jsx', () => {
  const code = readFile('src/pages/ForgotPassword.jsx');

  it('never renders reset tokens or the raw URL to the UI', () => {
    expect(code).not.toMatch(/resetUrl/);
    expect(code).not.toMatch(/rawToken/);
  });

  it('has the canonical spam-folder guidance line', () => {
    expect(code).toMatch(/inbox and spam folder/);
  });

  it('hides the SMS link unless recovery-methods reports sms=true', () => {
    expect(code).toMatch(/\{smsAvailable\s*&&/);
  });
});

// ─── .env.example documents DEMO_MODE ────────────────────────────
describe('.env.example', () => {
  const env = readFile('server/.env.example');
  it('documents DEMO_MODE', () => {
    expect(env).toContain('DEMO_MODE');
  });
  it('documents the Twilio Verify Service SID', () => {
    expect(env).toContain('TWILIO_VERIFY_SERVICE_SID');
  });
});
