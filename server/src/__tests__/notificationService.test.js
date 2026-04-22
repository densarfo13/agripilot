/**
 * notificationService.test.js — locks the email-first / SMS-fallback
 * policy for sendPasswordReset. Both channels are mocked at the
 * service boundary so the orchestrator is exercised in isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const { mockSendEmail, mockSendSms } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockSendSms:   vi.fn(),
}));

vi.mock('../../services/emailService.js', () => ({
  sendEmail:          mockSendEmail,
  isEmailConfigured:  () => !!process.env.SENDGRID_API_KEY,
  fromAddress:        () => process.env.EMAIL_FROM || 'admin@farroway.app',
  validateEmailConfig:() => ({ provider: 'sendgrid', from: 'admin@farroway.app', problems: [] }),
}));
vi.mock('../../services/smsService.js', () => ({
  sendSms:                    mockSendSms,
  isSmsMessagingConfigured:   () => !!(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_PHONE_NUMBER
  ),
}));
// buildPasswordResetEmail is a pure helper — real import is fine.

import { sendPasswordReset } from '../../services/notificationService.js';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const RESET = 'https://farroway.app/reset-password?token=' + 'a'.repeat(64);

function setEnv(vars) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
const CLEAR = {
  SENDGRID_API_KEY: undefined, EMAIL_FROM: undefined,
  TWILIO_ACCOUNT_SID: undefined, TWILIO_AUTH_TOKEN: undefined,
  TWILIO_PHONE_NUMBER: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  setEnv(CLEAR);
});
afterEach(() => { setEnv(CLEAR); });

// ─── Happy path — email accepted, no SMS ────────────────────────
describe('email accepted', () => {
  it('returns delivered:true and does NOT call sendSms', async () => {
    setEnv({ SENDGRID_API_KEY: 'SG.test', EMAIL_FROM: 'admin@farroway.app' });
    mockSendEmail.mockResolvedValueOnce({ ok: true, code: 'ok', statusCode: 202, messageId: '<id>' });
    const r = await sendPasswordReset({
      user: { email: 'a@b.com', phone: '+14155551212' },
      resetLink: RESET,
    });
    expect(r.delivered).toBe(true);
    expect(r.email.ok).toBe(true);
    expect(r.sms.attempted).toBe(false);
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('passes the absolute reset URL into the email body', async () => {
    setEnv({ SENDGRID_API_KEY: 'SG.test', EMAIL_FROM: 'admin@farroway.app' });
    mockSendEmail.mockResolvedValueOnce({ ok: true, code: 'ok' });
    await sendPasswordReset({
      user: { email: 'a@b.com' },
      resetLink: RESET,
    });
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe('a@b.com');
    expect(call.subject).toBe('Reset your Farroway password');
    expect(call.html).toContain(RESET);
    expect(call.text).toContain(RESET);
  });
});

// ─── Fallback — email fails, SMS succeeds ──────────────────────
describe('email fails → SMS fallback', () => {
  beforeEach(() => {
    setEnv({
      SENDGRID_API_KEY: 'SG.test', EMAIL_FROM: 'admin@farroway.app',
      TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'tok',
      TWILIO_PHONE_NUMBER: '+10000000000',
    });
  });

  it('fires SMS when email returns ok:false + user.phone exists', async () => {
    mockSendEmail.mockResolvedValueOnce({ ok: false, code: 'sender_not_verified' });
    mockSendSms.mockResolvedValueOnce({ ok: true, code: 'ok', messageSid: 'SMtest' });
    const r = await sendPasswordReset({
      user: { email: 'a@b.com', phone: '+14155551212' },
      resetLink: RESET,
    });
    expect(r.email.ok).toBe(false);
    expect(r.sms.attempted).toBe(true);
    expect(r.sms.ok).toBe(true);
    expect(r.delivered).toBe(true);
    const smsCall = mockSendSms.mock.calls[0][0];
    expect(smsCall.to).toBe('+14155551212');
    expect(smsCall.body).toContain(RESET);
    expect(smsCall.body).toMatch(/Reset your Farroway password/);
  });

  it('does NOT call SMS when phone is missing', async () => {
    mockSendEmail.mockResolvedValueOnce({ ok: false, code: 'sender_not_verified' });
    const r = await sendPasswordReset({
      user: { email: 'a@b.com' },    // no phone
      resetLink: RESET,
    });
    expect(r.sms.attempted).toBe(false);
    expect(r.delivered).toBe(false);
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('does NOT call SMS when the phone string is clearly invalid', async () => {
    mockSendEmail.mockResolvedValueOnce({ ok: false, code: 'sender_not_verified' });
    const r = await sendPasswordReset({
      user: { email: 'a@b.com', phone: 'not-a-phone' },
      resetLink: RESET,
    });
    expect(r.sms.attempted).toBe(false);
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('marks SMS as attempted but not_configured when Twilio is unset', async () => {
    // Explicit clear — beforeEach leaves Twilio set; this test needs
    // them gone so isSmsMessagingConfigured() returns false.
    setEnv({
      ...CLEAR,
      SENDGRID_API_KEY: 'SG.test', EMAIL_FROM: 'admin@farroway.app',
      TWILIO_ACCOUNT_SID: undefined, TWILIO_AUTH_TOKEN: undefined,
      TWILIO_PHONE_NUMBER: undefined,
    });
    mockSendEmail.mockResolvedValueOnce({ ok: false, code: 'provider_error' });
    const r = await sendPasswordReset({
      user: { email: 'a@b.com', phone: '+14155551212' },
      resetLink: RESET,
    });
    expect(r.email.ok).toBe(false);
    expect(r.sms.attempted).toBe(true);
    expect(r.sms.ok).toBe(false);
    expect(r.sms.code).toBe('not_configured');
    expect(r.delivered).toBe(false);
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('surfaces classified codes (never raw Twilio errors)', async () => {
    mockSendEmail.mockResolvedValueOnce({ ok: false, code: 'sender_not_verified' });
    mockSendSms.mockResolvedValueOnce({
      ok: false, code: 'trial_unverified',
      details: 'Twilio trial — recipient number is not verified.',
    });
    const r = await sendPasswordReset({
      user: { email: 'a@b.com', phone: '+14155551212' },
      resetLink: RESET,
    });
    expect(r.sms.ok).toBe(false);
    expect(r.sms.code).toBe('trial_unverified');
    expect(r.delivered).toBe(false);
  });
});

// ─── Guard rails ───────────────────────────────────────────────
describe('input validation', () => {
  it('returns missing_inputs with neither channel attempted', async () => {
    const r = await sendPasswordReset({ user: {}, resetLink: RESET });
    expect(r.email.ok).toBe(false);
    expect(r.email.code).toBe('missing_inputs');
    expect(r.sms.attempted).toBe(false);
    expect(r.delivered).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('refuses to send when resetLink is empty', async () => {
    const r = await sendPasswordReset({
      user: { email: 'a@b.com' },
      resetLink: '',
    });
    expect(r.delivered).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('email is never attempted when SENDGRID_API_KEY is missing', async () => {
    // Deliberately no SENDGRID_API_KEY in env.
    const r = await sendPasswordReset({
      user: { email: 'a@b.com' },
      resetLink: RESET,
    });
    expect(r.email.code).toBe('not_configured');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

// ─── Route wiring + contract ───────────────────────────────────
describe('routes/auth.js — wires notificationService', () => {
  const code = readFile('server/routes/auth.js');

  it('imports sendPasswordReset from notificationService', () => {
    expect(code).toContain("from '../services/notificationService.js'");
    expect(code).toContain('notifySendPasswordReset');
  });

  it('forgot-password reads farmerProfile.phone for the fallback', () => {
    expect(code).toMatch(/farmerProfile:\s*\{\s*select:\s*\{\s*phone:\s*true\s*\}/);
  });

  it('passes the resetLink through to the orchestrator', () => {
    expect(code).toContain('resetLink: resetUrl');
  });

  it('preserves anti-enumeration — always returns { success: true }', () => {
    expect(code).toMatch(/return res\.json\(\{\s*success:\s*true\s*\}\)/);
  });
});

// ─── Frontend copy ─────────────────────────────────────────────
describe('ForgotPassword.jsx success copy', () => {
  const code = readFile('src/pages/ForgotPassword.jsx');

  it('uses the spec-mandated success message', () => {
    expect(code).toContain('If an account exists, we');
    expect(code).toContain('sent password reset instructions');
    expect(code).toContain('inbox and spam folder');
  });

  it('resend cooldown is still wired', () => {
    expect(code).toContain('RESEND_COOLDOWN_SECONDS');
  });

  it('has no placeholder copy leftovers', () => {
    expect(code).not.toMatch(/\bTODO\b/);
    expect(code).not.toMatch(/\bplaceholder[ _-]?text\b/i);
    expect(code).not.toMatch(/lorem/i);
  });
});

describe('ResetPassword.jsx success copy', () => {
  const code = readFile('src/pages/ResetPassword.jsx');

  it('uses the spec-mandated success message', () => {
    expect(code).toContain('Your password has been reset');
    expect(code).toContain('You can now sign in');
  });

  it('has a Back to sign in CTA', () => {
    expect(code).toContain('Back to sign in');
  });
});
