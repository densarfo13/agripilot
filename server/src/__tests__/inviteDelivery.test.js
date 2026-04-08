import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock @sendgrid/mail ───────────────────────────────────
const mockSgSend = vi.fn();
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: mockSgSend,
  },
}));

// ─── Mock twilio ───────────────────────────────────────────
const mockTwilioCreate = vi.fn();
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
  SENDGRID_API_KEY: 'SG.test-key',
  EMAIL_FROM_ADDRESS: 'noreply@farroway.test',
};
const SMS_ENV = {
  TWILIO_ACCOUNT_SID: 'ACtest',
  TWILIO_AUTH_TOKEN: 'authtest',
  TWILIO_PHONE_NUMBER: '+10000000000',
};
const CLEAR_EMAIL = { SENDGRID_API_KEY: undefined, EMAIL_FROM_ADDRESS: undefined };
const CLEAR_SMS = { TWILIO_ACCOUNT_SID: undefined, TWILIO_AUTH_TOKEN: undefined, TWILIO_PHONE_NUMBER: undefined };

beforeEach(() => {
  vi.clearAllMocks();
  setEnv({ ...CLEAR_EMAIL, ...CLEAR_SMS });
});

afterEach(() => {
  setEnv({ ...CLEAR_EMAIL, ...CLEAR_SMS });
});

// ─── isEmailConfigured ─────────────────────────────────────

describe('isEmailConfigured', () => {
  it('returns false when no vars set', () => {
    expect(isEmailConfigured()).toBe(false);
  });

  it('returns false when only SENDGRID_API_KEY set (missing FROM)', () => {
    setEnv({ SENDGRID_API_KEY: 'SG.test', EMAIL_FROM_ADDRESS: undefined });
    expect(isEmailConfigured()).toBe(false);
  });

  it('returns true when both SENDGRID_API_KEY and EMAIL_FROM_ADDRESS set', () => {
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
  it('returns manual_share_ready when email not configured', async () => {
    const result = await sendInviteEmail({ toEmail: 'farmer@test.com', farmerName: 'Alice', inviteUrl: 'http://x/accept?token=t' });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
    expect(mockSgSend).not.toHaveBeenCalled();
  });

  it('returns manual_share_ready when toEmail is missing', async () => {
    setEnv(EMAIL_ENV);
    const result = await sendInviteEmail({ toEmail: '', farmerName: 'Alice', inviteUrl: 'http://x' });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
    expect(mockSgSend).not.toHaveBeenCalled();
  });
});

describe('sendInviteEmail — configured, delivery succeeds', () => {
  beforeEach(() => {
    setEnv(EMAIL_ENV);
    mockSgSend.mockResolvedValue([{ statusCode: 202 }]);
  });

  it('calls sgMail.send and returns email_sent on success', async () => {
    const result = await sendInviteEmail({
      toEmail: 'farmer@test.com',
      farmerName: 'Alice Kamau',
      inviteUrl: 'http://app.test/accept?token=abc',
      inviterName: 'Field Officer Bob',
      expiresAt: new Date('2026-05-01'),
    });
    expect(mockSgSend).toHaveBeenCalledOnce();
    expect(result.delivered).toBe(true);
    expect(result.deliveryStatus).toBe('email_sent');
    expect(result.channel).toBe('email');
  });

  it('sends to the correct recipient', async () => {
    await sendInviteEmail({ toEmail: 'farmer@test.com', farmerName: 'Alice', inviteUrl: 'http://x' });
    const call = mockSgSend.mock.calls[0][0];
    expect(call.to).toBe('farmer@test.com');
  });

  it('sends from the configured from address', async () => {
    await sendInviteEmail({ toEmail: 'farmer@test.com', farmerName: 'Alice', inviteUrl: 'http://x' });
    const call = mockSgSend.mock.calls[0][0];
    expect(call.from.email).toBe('noreply@farroway.test');
  });

  it('includes inviteUrl in the email body', async () => {
    const inviteUrl = 'http://app.test/accept?token=abc123';
    await sendInviteEmail({ toEmail: 'farmer@test.com', farmerName: 'Alice', inviteUrl });
    const call = mockSgSend.mock.calls[0][0];
    expect(call.text).toContain(inviteUrl);
    expect(call.html).toContain(inviteUrl);
  });
});

describe('sendInviteEmail — configured, delivery fails', () => {
  beforeEach(() => {
    setEnv(EMAIL_ENV);
    mockSgSend.mockRejectedValue(Object.assign(new Error('Bad request'), {
      response: { body: { errors: [{ message: 'Invalid email address' }] } },
    }));
  });

  it('returns manual_share_ready on SendGrid error', async () => {
    const result = await sendInviteEmail({ toEmail: 'bad@test.com', farmerName: 'Alice', inviteUrl: 'http://x' });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
    expect(result.reason).toMatch(/Invalid email address/);
  });

  it('never throws — always returns a result', async () => {
    await expect(sendInviteEmail({ toEmail: 'x@t.com', farmerName: 'A', inviteUrl: 'u' })).resolves.toBeDefined();
  });
});

// ─── sendInviteSms ────────────────────────────────────────

describe('sendInviteSms — not configured', () => {
  it('returns manual_share_ready when Twilio not configured', async () => {
    const result = await sendInviteSms({ toPhone: '+254700000000', farmerName: 'Alice', inviteUrl: 'http://x' });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
    expect(mockTwilioCreate).not.toHaveBeenCalled();
  });

  it('returns manual_share_ready when toPhone is missing', async () => {
    setEnv(SMS_ENV);
    const result = await sendInviteSms({ toPhone: '', farmerName: 'Alice', inviteUrl: 'http://x' });
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
      toPhone: '+254700000000',
      farmerName: 'Alice Kamau',
      inviteUrl: 'http://app.test/accept?token=abc',
    });
    expect(mockTwilioCreate).toHaveBeenCalledOnce();
    expect(result.delivered).toBe(true);
    expect(result.deliveryStatus).toBe('phone_sent');
    expect(result.channel).toBe('phone');
  });

  it('sends to the correct phone number', async () => {
    await sendInviteSms({ toPhone: '+254700000001', farmerName: 'Alice', inviteUrl: 'http://x' });
    const call = mockTwilioCreate.mock.calls[0][0];
    expect(call.to).toBe('+254700000001');
  });

  it('sends from the configured Twilio number', async () => {
    await sendInviteSms({ toPhone: '+254700000000', farmerName: 'Alice', inviteUrl: 'http://x' });
    const call = mockTwilioCreate.mock.calls[0][0];
    expect(call.from).toBe('+10000000000');
  });

  it('includes inviteUrl in the SMS body', async () => {
    const inviteUrl = 'http://app.test/accept?token=def456';
    await sendInviteSms({ toPhone: '+254700000000', farmerName: 'Alice', inviteUrl });
    const call = mockTwilioCreate.mock.calls[0][0];
    expect(call.body).toContain(inviteUrl);
  });
});

describe('sendInviteSms — configured, delivery fails', () => {
  beforeEach(() => {
    setEnv(SMS_ENV);
    mockTwilioCreate.mockRejectedValue(new Error('Invalid phone number'));
  });

  it('returns manual_share_ready on Twilio error', async () => {
    const result = await sendInviteSms({ toPhone: '+1invalid', farmerName: 'Alice', inviteUrl: 'http://x' });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
    expect(result.reason).toMatch(/Invalid phone number/);
  });

  it('never throws — always returns a result', async () => {
    await expect(sendInviteSms({ toPhone: '+1x', farmerName: 'A', inviteUrl: 'u' })).resolves.toBeDefined();
  });
});

// ─── dispatchInvite ───────────────────────────────────────

describe('dispatchInvite', () => {
  it('routes email channel to sendInviteEmail (configured)', async () => {
    setEnv(EMAIL_ENV);
    mockSgSend.mockResolvedValue([{ statusCode: 202 }]);
    const result = await dispatchInvite({
      channel: 'email',
      toEmail: 'f@test.com',
      toPhone: '+254700000000',
      farmerName: 'Alice',
      inviteUrl: 'http://x',
    });
    expect(result.channel).toBe('email');
    expect(result.deliveryStatus).toBe('email_sent');
  });

  it('routes phone channel to sendInviteSms (configured)', async () => {
    setEnv(SMS_ENV);
    mockTwilioCreate.mockResolvedValue({ sid: 'SM1' });
    const result = await dispatchInvite({
      channel: 'phone',
      toEmail: null,
      toPhone: '+254700000000',
      farmerName: 'Alice',
      inviteUrl: 'http://x',
    });
    expect(result.channel).toBe('phone');
    expect(result.deliveryStatus).toBe('phone_sent');
  });

  it('returns manual_share_ready for link channel without attempting delivery', async () => {
    const result = await dispatchInvite({ channel: 'link', toEmail: null, toPhone: null, farmerName: 'A', inviteUrl: 'u' });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
    expect(mockSgSend).not.toHaveBeenCalled();
    expect(mockTwilioCreate).not.toHaveBeenCalled();
  });

  it('falls back to manual_share_ready when email not configured', async () => {
    // no EMAIL env set
    const result = await dispatchInvite({ channel: 'email', toEmail: 'f@test.com', toPhone: null, farmerName: 'A', inviteUrl: 'u' });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
  });

  it('falls back to manual_share_ready when SMS not configured', async () => {
    const result = await dispatchInvite({ channel: 'phone', toEmail: null, toPhone: '+254700000000', farmerName: 'A', inviteUrl: 'u' });
    expect(result.delivered).toBe(false);
    expect(result.deliveryStatus).toBe('manual_share_ready');
  });
});

// ─── getDeliveryStatusLabel ───────────────────────────────

describe('getDeliveryStatusLabel', () => {
  it('shows Account Active for farmer with user account', () => {
    const label = getDeliveryStatusLabel('manual_share_ready', true);
    expect(label.label).toBe('Account Active');
    expect(label.cls).toBe('badge-approved');
  });

  it('maps manual_share_ready correctly', () => {
    const label = getDeliveryStatusLabel('manual_share_ready', false);
    expect(label.label).toMatch(/share manually/i);
  });

  it('maps email_sent correctly', () => {
    const label = getDeliveryStatusLabel('email_sent', false);
    expect(label.label).toMatch(/email sent/i);
    expect(label.cls).toBe('badge-submitted');
  });

  it('maps phone_sent correctly', () => {
    const label = getDeliveryStatusLabel('phone_sent', false);
    expect(label.label).toMatch(/sms sent/i);
    expect(label.cls).toBe('badge-submitted');
  });

  it('maps accepted correctly', () => {
    const label = getDeliveryStatusLabel('accepted', false);
    expect(label.label).toMatch(/accepted/i);
    expect(label.cls).toBe('badge-approved');
  });

  it('maps expired correctly', () => {
    const label = getDeliveryStatusLabel('expired', false);
    expect(label.label).toMatch(/expired/i);
    expect(label.cls).toBe('badge-rejected');
  });

  it('returns empty cls for unknown status', () => {
    const label = getDeliveryStatusLabel('something_weird', false);
    expect(label.cls).toBe('');
  });
});

// ─── Honesty contract ─────────────────────────────────────

describe('honesty contract', () => {
  it('sendInviteEmail never returns email_sent when not configured', async () => {
    const result = await sendInviteEmail({ toEmail: 'f@t.com', farmerName: 'A', inviteUrl: 'u' });
    expect(result.deliveryStatus).not.toBe('email_sent');
  });

  it('sendInviteSms never returns phone_sent when not configured', async () => {
    const result = await sendInviteSms({ toPhone: '+1', farmerName: 'A', inviteUrl: 'u' });
    expect(result.deliveryStatus).not.toBe('phone_sent');
  });

  it('sendInviteEmail never returns email_sent when send throws', async () => {
    setEnv(EMAIL_ENV);
    mockSgSend.mockRejectedValue(new Error('Network error'));
    const result = await sendInviteEmail({ toEmail: 'f@t.com', farmerName: 'A', inviteUrl: 'u' });
    expect(result.deliveryStatus).not.toBe('email_sent');
    expect(result.delivered).toBe(false);
  });

  it('sendInviteSms never returns phone_sent when create throws', async () => {
    setEnv(SMS_ENV);
    mockTwilioCreate.mockRejectedValue(new Error('Network error'));
    const result = await sendInviteSms({ toPhone: '+254700000000', farmerName: 'A', inviteUrl: 'u' });
    expect(result.deliveryStatus).not.toBe('phone_sent');
    expect(result.delivered).toBe(false);
  });
});
