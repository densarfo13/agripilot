/**
 * emailServiceSendgrid.test.js — covers the SendGrid migration spec
 * §12: sendEmail success path, missing key, missing FROM,
 * sender_not_verified handling, and proof that no raw provider
 * errors leak to the caller.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @sendgrid/mail at the dynamic-import boundary.
const { mockSgSend, mockSetApiKey } = vi.hoisted(() => ({
  mockSgSend: vi.fn(),
  mockSetApiKey: vi.fn(),
}));
vi.mock('@sendgrid/mail', () => ({
  default: { setApiKey: mockSetApiKey, send: mockSgSend },
}));

import {
  sendEmail, isEmailConfigured, validateEmailConfig, _internal,
} from '../../services/emailService.js';

function setEnv(vars) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
const CLEAR = {
  SENDGRID_API_KEY: undefined,
  EMAIL_FROM:       undefined,
  EMAIL_FROM_NAME:  undefined,
  APP_BASE_URL:     undefined,
};

beforeEach(() => { vi.clearAllMocks(); setEnv(CLEAR); });
afterEach(()  => { setEnv(CLEAR); });

describe('sendEmail — success path', () => {
  it('returns { ok: true, statusCode, messageId } when SendGrid accepts', async () => {
    setEnv({ SENDGRID_API_KEY: 'SG.test', EMAIL_FROM: 'admin@farroway.app' });
    mockSgSend.mockResolvedValueOnce([{
      statusCode: 202,
      headers: { 'x-message-id': 'msg_123' },
    }]);
    const r = await sendEmail({
      to: 'farmer@test.com', subject: 'Hello', text: 'hi', html: '<p>hi</p>',
    });
    expect(r.ok).toBe(true);
    expect(r.code).toBe('ok');
    expect(r.statusCode).toBe(202);
    expect(r.messageId).toBe('msg_123');
    expect(mockSgSend).toHaveBeenCalledOnce();
    const msg = mockSgSend.mock.calls[0][0];
    expect(msg.to).toBe('farmer@test.com');
    expect(msg.from.email).toBe('admin@farroway.app');
  });
});

describe('sendEmail — missing config fails clearly', () => {
  it('returns not_configured when SENDGRID_API_KEY is missing', async () => {
    setEnv({ EMAIL_FROM: 'admin@farroway.app' });
    const r = await sendEmail({ to: 'a@b.com', subject: 'x' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('not_configured');
    expect(mockSgSend).not.toHaveBeenCalled();
  });

  it('still works when EMAIL_FROM is missing — falls back to admin@farroway.app', async () => {
    setEnv({ SENDGRID_API_KEY: 'SG.test' });
    mockSgSend.mockResolvedValueOnce([{ statusCode: 202, headers: {} }]);
    const r = await sendEmail({ to: 'a@b.com', subject: 'x' });
    expect(r.ok).toBe(true);
    const msg = mockSgSend.mock.calls[0][0];
    expect(msg.from.email).toBe('admin@farroway.app');
  });

  it('returns missing_to_or_subject with no side-effects when arguments are incomplete', async () => {
    setEnv({ SENDGRID_API_KEY: 'SG.test' });
    const r1 = await sendEmail({ to: '', subject: 'x' });
    const r2 = await sendEmail({ to: 'a@b.com', subject: '' });
    expect(r1.ok).toBe(false);
    expect(r1.code).toBe('missing_to_or_subject');
    expect(r2.ok).toBe(false);
    expect(r2.code).toBe('missing_to_or_subject');
    expect(mockSgSend).not.toHaveBeenCalled();
  });
});

describe('sendEmail — sender_not_verified', () => {
  it('surfaces a dedicated code when SendGrid rejects the From identity', async () => {
    setEnv({ SENDGRID_API_KEY: 'SG.test', EMAIL_FROM: 'admin@farroway.app' });
    mockSgSend.mockRejectedValueOnce({
      code: 403,
      response: {
        statusCode: 403,
        body: {
          errors: [{
            message: 'The from address does not match a verified Sender Identity. Mail cannot be sent until this error is resolved.',
            field: 'from',
          }],
        },
      },
      message: 'Forbidden',
    });
    const r = await sendEmail({ to: 'a@b.com', subject: 'x' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('sender_not_verified');
    // `details` is sanitised but useful for ops logs.
    expect(r.details).toMatch(/verified Sender/i);
  });
});

describe('sendEmail — other failure classes', () => {
  beforeEach(() => {
    setEnv({ SENDGRID_API_KEY: 'SG.test', EMAIL_FROM: 'admin@farroway.app' });
  });

  it('returns recipient_invalid on invalid recipient', async () => {
    mockSgSend.mockRejectedValueOnce({
      response: {
        statusCode: 400,
        body: { errors: [{ message: 'does not contain a valid address' }] },
      },
      message: 'Bad Request',
    });
    const r = await sendEmail({ to: 'bad', subject: 'x' });
    expect(r.code).toBe('recipient_invalid');
  });

  it('returns auth_failed on 401 / 403 key rejection', async () => {
    mockSgSend.mockRejectedValueOnce({
      response: { statusCode: 401, body: { errors: [{ message: 'Unauthorized' }] } },
      message: 'Unauthorized',
    });
    const r = await sendEmail({ to: 'a@b.com', subject: 'x' });
    expect(r.code).toBe('auth_failed');
  });

  it('returns network_error on transport failure', async () => {
    mockSgSend.mockRejectedValueOnce({
      code: 'ECONNRESET',
      message: 'connect ECONNRESET 167.89.123.45:443',
    });
    const r = await sendEmail({ to: 'a@b.com', subject: 'x' });
    expect(r.code).toBe('network_error');
  });
});

describe('no raw provider body reaches the caller', () => {
  it('drops stack traces from details', async () => {
    setEnv({ SENDGRID_API_KEY: 'SG.test', EMAIL_FROM: 'admin@farroway.app' });
    const noisy = new Error('BOOM');
    noisy.stack = 'Error: BOOM\n  at …\n  at …';
    noisy.response = {
      statusCode: 500,
      body: { errors: [{ message: 'Temporary failure.', help: 'https://docs.sendgrid.com/' }] },
    };
    mockSgSend.mockRejectedValueOnce(noisy);
    const r = await sendEmail({ to: 'a@b.com', subject: 'x' });
    expect(r.ok).toBe(false);
    expect(r.details).not.toMatch(/\n {2}at /);     // no stack line
    expect(r.details).not.toContain('sendgrid.com'); // no provider URL leak
  });
});

describe('validateEmailConfig', () => {
  it('lists missing variables without throwing', () => {
    setEnv({ ...CLEAR });
    const log = { info: vi.fn(), warn: vi.fn() };
    const r = validateEmailConfig({ log });
    expect(r.provider).toBe('none');
    expect(r.problems.length).toBeGreaterThan(0);
    expect(log.warn).toHaveBeenCalled();
  });

  it('reports sendgrid when the API key is set', () => {
    setEnv({ SENDGRID_API_KEY: 'SG.x', EMAIL_FROM: 'admin@farroway.app', APP_BASE_URL: 'https://farroway.app' });
    const r = validateEmailConfig({ log: { info: vi.fn(), warn: vi.fn() } });
    expect(r.provider).toBe('sendgrid');
    expect(r.problems).toEqual([]);
  });
});

describe('classifyError direct coverage', () => {
  const { classifyError } = _internal;
  it('classifies an empty error as provider_error', () => {
    const r = classifyError({});
    expect(r.code).toBe('provider_error');
  });
});
