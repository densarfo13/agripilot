/**
 * smsVerification.test.js — provider abstraction + business logic.
 *
 * Uses a stub provider (matching the real interface) so tests cover
 * every branch without touching Twilio. Prisma is mocked at module
 * level so the service's DB calls become assertions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Prisma mock — mirrors the subset of methods the service touches.
const prismaMock = {
  user: {
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  farmer: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  passwordResetToken: {
    deleteMany: vi.fn(),
  },
  userSession: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(async (ops) => Promise.all(ops.map((p) => (
    typeof p?.then === 'function' ? p : Promise.resolve(p)
  )))),
};

// Path relative to THIS test file — resolves to server/src/config/database.js,
// the same module the service imports.
vi.mock('../config/database.js', () => ({ default: prismaMock }));
vi.mock('../modules/audit/service.js', () => ({
  writeAuditLog: vi.fn(async () => ({})),
}));
vi.mock('../utils/opsLogger.js', () => ({
  opsEvent: vi.fn(),
  logAuthEvent: vi.fn(),
  logDeliveryEvent: vi.fn(),
}));

// Imports go after the mocks so the module under test picks up the
// mocked deps.
const {
  startSmsVerification,
  checkSmsVerification,
  toE164,
  SMS_PURPOSES,
  _internal,
} = await import('../modules/auth/smsVerification/service.js');

// Stub provider — matches the real shape in provider.js.
function makeStubProvider({
  configured = true,
  startResult = { ok: true, status: 'pending', sid: 'VE_stub' },
  checkResult = { ok: true, status: 'approved', sid: 'VC_stub' },
} = {}) {
  const calls = { start: [], check: [] };
  return {
    name: 'stub',
    isConfigured: () => configured,
    supportsChannel: () => true,
    startVerification: vi.fn(async (p) => { calls.start.push(p); return startResult; }),
    checkVerification: vi.fn(async (p) => { calls.check.push(p); return checkResult; }),
    calls,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _internal.clearCooldowns();
  prismaMock.user.update.mockReset();
  prismaMock.user.updateMany.mockReset();
  prismaMock.farmer.findFirst.mockReset();
  prismaMock.farmer.updateMany.mockReset();
  prismaMock.passwordResetToken.deleteMany.mockReset();
  prismaMock.userSession.updateMany.mockReset();
  // Sensible defaults: no farmer/user found.
  prismaMock.farmer.findFirst.mockResolvedValue(null);
});

// ─── E.164 normalizer ────────────────────────────────────────────
describe('toE164', () => {
  it('accepts a clean E.164 number', () => {
    expect(toE164('+254712345678')).toBe('+254712345678');
  });
  it('normalises spaces + punctuation', () => {
    expect(toE164(' +254 712-345.678 ')).toBe('+254712345678');
  });
  it('rejects missing plus', () => {
    expect(toE164('254712345678')).toBeNull();
  });
  it('rejects obviously bad input', () => {
    expect(toE164('')).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164('+12')).toBeNull();                 // too short
    expect(toE164('+123456789012345678')).toBeNull(); // too long
  });
});

// ─── startSmsVerification ────────────────────────────────────────
describe('startSmsVerification', () => {
  it('400s on invalid purpose / channel / phone', async () => {
    const provider = makeStubProvider();
    expect((await startSmsVerification({ phone: '+254712345678', purpose: 'bogus', provider })).code)
      .toBe('invalid_purpose');
    expect((await startSmsVerification({ phone: '+254712345678', channel: 'telepathy', provider })).code)
      .toBe('invalid_channel');
    expect((await startSmsVerification({ phone: 'no-plus', provider })).code)
      .toBe('invalid_phone');
  });

  it('503s when the provider is not configured', async () => {
    const provider = makeStubProvider({ configured: false });
    const r = await startSmsVerification({ phone: '+254712345678', provider });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('provider_unavailable');
    expect(r.status).toBe(503);
  });

  it('password_reset with no matching user → still returns sent (anti-enumeration)', async () => {
    const provider = makeStubProvider();
    prismaMock.farmer.findFirst.mockResolvedValueOnce(null);
    const r = await startSmsVerification({ phone: '+254712345678', provider });
    expect(r.ok).toBe(true);
    expect(r.code).toBe('sent');
    expect(provider.startVerification).not.toHaveBeenCalled();
  });

  it('password_reset with matching user → hits provider + returns sent', async () => {
    const provider = makeStubProvider();
    prismaMock.farmer.findFirst.mockResolvedValueOnce({ userId: "u1" });
    const r = await startSmsVerification({ phone: '+254712345678', provider });
    expect(r.ok).toBe(true);
    expect(provider.startVerification).toHaveBeenCalledTimes(1);
    expect(provider.calls.start[0].to).toBe('+254712345678');
    expect(provider.calls.start[0].channel).toBe('sms');
  });

  it('phone_verify always sends regardless of user match', async () => {
    const provider = makeStubProvider();
    const r = await startSmsVerification({
      phone: '+254712345678', purpose: SMS_PURPOSES.PHONE_VERIFY, provider,
    });
    expect(r.ok).toBe(true);
    expect(provider.startVerification).toHaveBeenCalledTimes(1);
  });

  it('phone_verify surfaces provider errors directly', async () => {
    const provider = makeStubProvider({
      startResult: { ok: false, status: 'error', error: 'Twilio rejected' },
    });
    const r = await startSmsVerification({
      phone: '+254712345678', purpose: SMS_PURPOSES.PHONE_VERIFY, provider,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('provider_error');
  });

  it('resend cooldown — second call inside 30s returns 429', async () => {
    const provider = makeStubProvider();
    prismaMock.farmer.findFirst.mockResolvedValue({ userId: "u1" });
    const first = await startSmsVerification({
      phone: '+254712345678', provider, now: 1000,
    });
    expect(first.ok).toBe(true);

    const second = await startSmsVerification({
      phone: '+254712345678', provider, now: 1000 + 5_000,
    });
    expect(second.ok).toBe(false);
    expect(second.code).toBe('cooldown');
    expect(second.status).toBe(429);
    expect(second.retryAfterSec).toBeGreaterThan(0);
  });

  it('resend cooldown expires after 30s', async () => {
    const provider = makeStubProvider();
    prismaMock.farmer.findFirst.mockResolvedValue({ userId: "u1" });
    await startSmsVerification({
      phone: '+254712345678', provider, now: 1000,
    });
    const later = await startSmsVerification({
      phone: '+254712345678', provider, now: 1000 + 31_000,
    });
    expect(later.ok).toBe(true);
  });
});

// ─── Abuse scenarios (hardening v1) ──────────────────────────────
describe('startSmsVerification — per-phone + per-IP throttles', () => {
  it('blocks the 4th request for the same phone in 10 minutes', async () => {
    const provider = makeStubProvider();
    prismaMock.farmer.findFirst.mockResolvedValue({ userId: 'u1' });
    const phone = '+254711111111';
    // Three legal requests spaced 31 s apart (past cooldown).
    let t = 1000;
    for (let i = 0; i < 3; i += 1) {
      const r = await startSmsVerification({ phone, provider, now: t });
      expect(r.ok).toBe(true);
      t += 31_000;
    }
    // Fourth: phone sliding window at limit.
    const blocked = await startSmsVerification({ phone, provider, now: t });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe('rate_limited');
    expect(blocked.status).toBe(429);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('blocks the 6th request from the same IP (different phones)', async () => {
    const provider = makeStubProvider();
    prismaMock.farmer.findFirst.mockResolvedValue({ userId: 'u1' });
    const ip = '203.0.113.9';
    const phones = [
      '+254711000001', '+254711000002', '+254711000003',
      '+254711000004', '+254711000005', '+254711000006',
    ];
    let t = 1000;
    // Five legal requests across five distinct phones → five within
    // IP quota, no cooldown conflict.
    for (let i = 0; i < 5; i += 1) {
      const r = await startSmsVerification({
        phone: phones[i], ip, provider, now: t,
      });
      expect(r.ok).toBe(true);
      t += 1_000;
    }
    // Sixth phone from same IP → blocked by per-IP rule.
    const blocked = await startSmsVerification({
      phone: phones[5], ip, provider, now: t,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe('rate_limited');
    expect(blocked.message).toMatch(/network/i);
  });

  it('non-existent phone still counts against the rate window', async () => {
    const provider = makeStubProvider();
    prismaMock.farmer.findFirst.mockResolvedValue(null);
    const phone = '+254711999999';
    let t = 1000;
    // Walker's trick: scripted enumeration shouldn't bypass limits
    // just because the phone has no account.
    for (let i = 0; i < 3; i += 1) {
      await startSmsVerification({ phone, provider, now: t });
      t += 31_000;
    }
    const blocked = await startSmsVerification({ phone, provider, now: t });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe('rate_limited');
    expect(provider.startVerification).not.toHaveBeenCalled();
  });

  it('provider throws → no crash, request still counted, generic response', async () => {
    const provider = {
      name: 'stub-throwing',
      isConfigured: () => true,
      supportsChannel: () => true,
      startVerification: vi.fn(async () => { throw new Error('Twilio exploded'); }),
      checkVerification: vi.fn(),
    };
    prismaMock.farmer.findFirst.mockResolvedValue({ userId: 'u1' });
    // Recovery flow swallows provider error (anti-enumeration).
    const r = await startSmsVerification({
      phone: '+254712222222', ip: '1.1.1.1', provider, now: 1000,
    });
    // Note the envelope: ok:true because the caller shouldn't learn
    // the provider failed. But the attempt is recorded.
    expect(r.ok).toBe(true);
    expect(r.code).toBe('sent');
    // Attempt should count in the IP bucket for abuse detection.
    const second = await startSmsVerification({
      phone: '+254712222222', ip: '1.1.1.1', provider, now: 1000 + 31_000,
    });
    // cooldown cleared but phone bucket now has 2 entries → still OK.
    expect(second.ok).toBe(true);
  });

  it('phone_verify SURFACES provider error (authenticated caller is linking their own number)', async () => {
    const provider = {
      name: 'stub-throwing',
      isConfigured: () => true,
      supportsChannel: () => true,
      startVerification: vi.fn(async () => { throw new Error('Twilio exploded'); }),
      checkVerification: vi.fn(),
    };
    const r = await startSmsVerification({
      phone: '+254713333333', purpose: SMS_PURPOSES.PHONE_VERIFY,
      ip: '1.1.1.1', provider, now: 2000,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('provider_error');
    expect(r.message).not.toMatch(/Twilio exploded/); // generic, not raw
  });

  it('redactPhone masks the middle of E.164', () => {
    expect(_internal.redactPhone('+254712345678')).toBe('+2547*****678');
    expect(_internal.redactPhone('')).toBe('***');
    expect(_internal.redactPhone(null)).toBe('***');
  });
});

describe('checkSmsVerification — error mapping', () => {
  it('max_attempts_reached → distinct code + generic message', async () => {
    const provider = makeStubProvider({
      checkResult: { ok: false, status: 'max_attempts_reached' },
    });
    const r = await checkSmsVerification({
      phone: '+254714444444', code: '123456', provider,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('max_attempts');
    expect(r.message).toMatch(/Too many attempts/i);
    expect(r.message).not.toMatch(/Twilio/i);
  });

  it('provider throws → no crash, 502', async () => {
    const provider = {
      name: 'stub-throwing',
      isConfigured: () => true,
      supportsChannel: () => true,
      startVerification: vi.fn(),
      checkVerification: vi.fn(async () => { throw new Error('boom'); }),
    };
    const r = await checkSmsVerification({
      phone: '+254715555555', code: '123456', provider,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('provider_error');
    expect(r.status).toBe(502);
    expect(r.message).not.toMatch(/boom/);
  });
});

// ─── checkSmsVerification ────────────────────────────────────────
describe('checkSmsVerification', () => {
  it('400s on missing code', async () => {
    const provider = makeStubProvider();
    const r = await checkSmsVerification({
      phone: '+254712345678', code: '', provider,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('invalid_code');
  });

  it('maps provider denial to invalid_or_expired', async () => {
    const provider = makeStubProvider({
      checkResult: { ok: false, status: 'denied', error: 'Invalid code' },
    });
    const r = await checkSmsVerification({
      phone: '+254712345678', code: '123456', provider,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('invalid_or_expired');
  });

  it('maps provider error (non-denial) to provider_error', async () => {
    const provider = makeStubProvider({
      checkResult: { ok: false, status: 'error', error: 'Twilio 500' },
    });
    const r = await checkSmsVerification({
      phone: '+254712345678', code: '123456', provider,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('provider_error');
    expect(r.status).toBe(502);
  });

  it('password_reset WITHOUT newPassword → verified-only', async () => {
    const provider = makeStubProvider();
    const r = await checkSmsVerification({
      phone: '+254712345678', code: '123456', provider,
    });
    expect(r.ok).toBe(true);
    expect(r.verified).toBe(true);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('password_reset WITH newPassword → updates user + revokes sessions', async () => {
    const provider = makeStubProvider();
    prismaMock.farmer.findFirst.mockResolvedValueOnce({ userId: "u1" });
    const r = await checkSmsVerification({
      phone: '+254712345678', code: '123456',
      newPassword: 'StrongPass9', provider,
    });
    expect(r.ok).toBe(true);
    expect(r.verified).toBe(true);
    expect(r.passwordReset).toBe(true);
    // Atomic bundle includes user.update + passwordResetToken.deleteMany
    // (+ userSession.updateMany on v2 schemas).
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const ops = prismaMock.$transaction.mock.calls[0][0];
    expect(ops.length).toBeGreaterThanOrEqual(2);
  });

  it('password_reset with no matching user → verified-only (anti-enum)', async () => {
    const provider = makeStubProvider();
    prismaMock.farmer.findFirst.mockResolvedValueOnce(null);
    const r = await checkSmsVerification({
      phone: '+254712345678', code: '123456',
      newPassword: 'StrongPass9', provider,
    });
    expect(r.ok).toBe(true);
    expect(r.verified).toBe(true);
    expect(r.passwordReset).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects weak password before any DB writes', async () => {
    const provider = makeStubProvider();
    prismaMock.farmer.findFirst.mockResolvedValueOnce({ userId: "u1" });
    const r = await checkSmsVerification({
      phone: '+254712345678', code: '123456',
      newPassword: 'short', provider,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('weak_password');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('login_verify → just returns verified', async () => {
    const provider = makeStubProvider();
    const r = await checkSmsVerification({
      phone: '+254712345678', code: '123456',
      purpose: SMS_PURPOSES.LOGIN_VERIFY, provider,
    });
    expect(r.ok).toBe(true);
    expect(r.verified).toBe(true);
  });
});
