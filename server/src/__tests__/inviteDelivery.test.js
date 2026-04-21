import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock the shared SMTP transport ─────────────────────────
// Replaces the previous @sendgrid/mail mock. `lib/mailer.js` is the
// single source of truth for outbound email after the Zoho switch.
// vi.mock is hoisted to the top of the module, so the shared mock
// functions must be declared inside vi.hoisted to be accessible.
const { mockSmtpSend, mockTwilioCreate } = vi.hoisted(() => ({
  mockSmtpSend:     vi.fn(),
  mockTwilioCreate: vi.fn(),
}));
vi.mock('../../lib/mailer.js', () => ({
  sendEmail: mockSmtpSend,
  isEmailConfigured: () => (
    !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  ),
  validateEmailConfig: () => ({ provider: 'smtp', from: 'admin@farroway.app', problems: [] }),
}));
vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: { create: mockTwilioCreate },
  })),
}));

import {
  isEmailConfigured,
  isSmsConfigured,
  sendInviteEmail,
  sendInviteSms,
  dispatchInvite,
  getDeliveryStatusLabel,
} from '../modules/notifications/deliveryService.js';

// ─── Helpers ───────────────────────────────────────────────
function setEnv(vars) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

const EMAIL_ENV = {
  SMTP_HOST:  'smtp.zoho.com',
  SMTP_PORT:  '465',
  SMTP_USER:  'admin@farroway.app',
  SMTP_PASS:  'app-password',
  EMAIL_FROM: 'admin@farroway.app',
};
const SMS_ENV = {
  TWILIO_ACCOUNT_SID:  'ACtest',
  TWILIO_AUTH_TOKEN:   'authtest',
  TWILIO_PHONE_NUMBER: '+10000000000',
};
const CLEAR_EMAIL = {
  SMTP_HOST: undefined, SMTP_PORT: undefined,
  SMTP_USER: undefined, SMTP_PASS: undefined,
  EMAIL_FROM: undefined,
};
const CLEAR_SMS = {
  TWILIO_ACCOUNT_SID: undefined, TWILIO_AUTH_TOKEN: undefined, TWILIO_PHONE_NUMBER: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  setEnv({ ...CLEAR_EMAIL, ...CLEAR_SMS });
});

afterEach(() => {
  setEnv({ ...CLEAR_EMAIL, ...CLEAR_SMS });
});

// ─── isEmailConfigured ─────────────────────────────────────
describe('isEmailConfigured', () => {
  it('returns false when no SMTP vars are set', () => {
    expect(isEmailConfigured()).toBe(false);
  });

  it('returns false when SMTP_HOST is set but SMTP_USER/SMTP_PASS are missing', () => {
    setEnv({ SMTP_HOST: 'smtp.zoho.com' });
    expect(isEmailConfigured()).toBe(false);
  });

  it('returns true when SMTP_HOST + SMTP_USER + SMTP_PASS are all set', () => {
    setEnv(EMAIL_ENV);
    expect(isEmailConfigured()).toBe(true);
  });
});

// ─── isSmsConfigured ───────────────────────────────────────
describe('isSmsConfigured', () => {
  it('returns false when no vars set', () => {
    expect(isSmsConfigured()).toBe(false);
  });

  it('returns false when only partial Twilio config', () => {
    setEnv({ TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: undefined, TWILIO_PHONE_NUMBER: undefined });
    expect(isSmsConfigured()).toBe(false);
  });

  it('returns true when all three Twilio vars set', () => {
    setEnv(SMS_ENV);
    expect(isSmsConfigured()).toBe(true);
  });
});

// ─── sendInviteEmail ───────────────────────────────────────
describe('sendInviteEmail — not configured', () => {
  it('returns manual_share_ready when SMTP is not configured', async () => {
    const result = await sendInviteEmail({
      toEmail: 'farmer@test.com', farmerName: 'Alice',
      inviteUrl: 'http://x/accept?token=t',
    });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
    expect(mockSmtpSend).not.toHaveBeenCalled();
  });

  it('returns manual_share_ready when toEmail is missing', async () => {
    setEnv(EMAIL_ENV);
    const result = await sendInviteEmail({
      toEmail: '', farmerName: 'Alice', inviteUrl: 'http://x',
    });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
    expect(mockSmtpSend).not.toHaveBeenCalled();
  });
});

describe('sendInviteEmail — configured, delivery succeeds', () => {
  beforeEach(() => {
    setEnv(EMAIL_ENV);
    mockSmtpSend.mockResolvedValue({ success: true, provider: 'smtp', messageId: '<id@zoho>' });
  });

  it('calls the SMTP mailer and returns email_sent on success', async () => {
    const result = await sendInviteEmail({
      toEmail: 'farmer@test.com',
      farmerName: 'Alice Kamau',
      inviteUrl: 'http://app.test/accept?token=abc',
      inviterName: 'Field Officer Bob',
      expiresAt: new Date('2026-05-01'),
    });
    expect(mockSmtpSend).toHaveBeenCalledOnce();
    expect(result.delivered).toBe(true);
    expect(result.deliveryStatus).toBe('email_sent');
    expect(result.channel).toBe('email');
  });

  it('sends to the correct recipient', async () => {
    await sendInviteEmail({
      toEmail: 'farmer@test.com', farmerName: 'Alice', inviteUrl: 'http://x',
    });
    const call = mockSmtpSend.mock.calls[0][0];
    expect(call.to).toBe('farmer@test.com');
  });

  it('includes inviteUrl in the email body', async () => {
    const inviteUrl = 'http://app.test/accept?token=abc123';
    await sendInviteEmail({
      toEmail: 'farmer@test.com', farmerName: 'Alice', inviteUrl,
    });
    const call = mockSmtpSend.mock.calls[0][0];
    expect(call.text).toContain(inviteUrl);
    expect(call.html).toContain(inviteUrl);
  });
});

describe('sendInviteEmail — configured, delivery fails', () => {
  beforeEach(() => {
    setEnv(EMAIL_ENV);
    mockSmtpSend.mockResolvedValue({
      success: false, provider: 'smtp',
      error: 'smtp_error: Invalid email address',
    });
  });

  it('returns manual_share_ready on SMTP failure', async () => {
    const result = await sendInviteEmail({
      toEmail: 'bad@test.com', farmerName: 'Alice', inviteUrl: 'http://x',
    });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
    expect(result.reason).toMatch(/Invalid email address/);
  });

  it('never throws — always returns a result', async () => {
    await expect(sendInviteEmail({
      toEmail: 'x@t.com', farmerName: 'A', inviteUrl: 'u',
    })).resolves.toBeDefined();
  });
});

// ─── sendInviteSms ────────────────────────────────────────
describe('sendInviteSms — not configured', () => {
  it('returns manual_share_ready when Twilio not configured', async () => {
    const result = await sendInviteSms({
      toPhone: '+254700000000', farmerName: 'Alice', inviteUrl: 'http://x',
    });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
    expect(mockTwilioCreate).not.toHaveBeenCalled();
  });

  it('returns manual_share_ready when toPhone is missing', async () => {
    setEnv(SMS_ENV);
    const result = await sendInviteSms({
      toPhone: '', farmerName: 'Alice', inviteUrl: 'http://x',
    });
    expect(result.delivered).toBe(false);
    expect(mockTwilioCreate).not.toHaveBeenCalled();
  });
});

describe('sendInviteSms — configured, delivery succeeds', () => {
  beforeEach(() => {
    setEnv(SMS_ENV);
    mockTwilioCreate.mockResolvedValue({ sid: 'SMtest123', status: 'sent' });
  });

  it('calls messages.create and returns phone_sent on success', async () => {
    const result = await sendInviteSms({
      toPhone: '+254700000000', farmerName: 'Alice',
      inviteUrl: 'http://app.test/accept?token=abc',
    });
    expect(mockTwilioCreate).toHaveBeenCalledOnce();
    expect(result.delivered).toBe(true);
    expect(result.deliveryStatus).toBe('phone_sent');
    expect(result.channel).toBe('phone');
  });

  it('sends the invite URL in the SMS body', async () => {
    const inviteUrl = 'http://app.test/accept?token=xyz';
    await sendInviteSms({ toPhone: '+254700000000', farmerName: 'Alice', inviteUrl });
    const call = mockTwilioCreate.mock.calls[0][0];
    expect(call.body).toContain(inviteUrl);
  });
});

describe('dispatchInvite — channel selection', () => {
  it('falls back to manual link when neither email nor SMS are configured', async () => {
    const result = await dispatchInvite({
      toEmail: 'a@b.com', toPhone: '+254700000000',
      farmerName: 'A', inviteUrl: 'http://x',
    });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
  });
});

describe('getDeliveryStatusLabel', () => {
  it('returns a { label, cls } badge for every known status', () => {
    const shape = (v) => v && typeof v === 'object' && typeof v.label === 'string';
    expect(shape(getDeliveryStatusLabel('email_sent'))).toBe(true);
    expect(shape(getDeliveryStatusLabel('phone_sent'))).toBe(true);
    expect(shape(getDeliveryStatusLabel('manual_share_ready'))).toBe(true);
    // Unknown codes still return a safe badge instead of undefined.
    expect(shape(getDeliveryStatusLabel('unknown_code'))).toBe(true);
    // With hasUserAccount=true the function short-circuits.
    expect(shape(getDeliveryStatusLabel('email_sent', true))).toBe(true);
  });
});
