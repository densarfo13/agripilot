/**
 * Focused security tests — MFA, token revocation, step-up, password reset
 *
 * These tests exercise the security-critical paths added in Phases 2–4.
 * All external dependencies (prisma, otplib, bcrypt, crypto, sendgrid) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Prisma mock ──────────────────────────────────────────
vi.mock('../config/database.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));

// ─── Config mock ──────────────────────────────────────────
vi.mock('../config/index.js', () => ({
  config: {
    jwt: { secret: 'test-secret-32-chars-minimum!!!!!', expiresIn: '24h' },
    mfa: {
      issuer: 'Farroway-Test',
      secretEncryptionKey: '0000000000000000000000000000000000000000000000000000000000000000',
      stepUpWindowMinutes: 30,
      challengeTokenMinutes: 5,
      backupCodeCount: 10,
    },
    passwordReset: { tokenExpiryMinutes: 60 },
    email: { sendgridApiKey: '', fromAddress: 'test@test.com', fromName: 'Test' },
    auth: { callbackBaseUrl: 'http://localhost:4000', frontendBaseUrl: 'http://localhost:5173' },
    oauthStateSecret: 'test-oauth-state-secret-for-tests',
    google: { clientId: '', clientSecret: '' },
    microsoft: { clientId: '', clientSecret: '', tenantId: 'common' },
    oidc: { issuerUrl: '', clientId: '', clientSecret: '', displayName: 'SSO', scopes: 'openid email profile' },
  },
}));

// ─── Audit log mock ───────────────────────────────────────
vi.mock('../modules/audit/service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ─── Ops logger mock ─────────────────────────────────────
vi.mock('../utils/opsLogger.js', () => ({
  opsEvent: vi.fn(),
  logAuthEvent: vi.fn(),
}));

// ─── SendGrid mock ───────────────────────────────────────
vi.mock('@sendgrid/mail', () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{ statusCode: 202 }]) },
}));

import prisma from '../config/database.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const TEST_SECRET = 'test-secret-32-chars-minimum!!!!!';

// ─── requireStepUp middleware tests ──────────────────────

describe('requireStepUp middleware', () => {
  let requireStepUp;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../middleware/requireStepUp.js');
    requireStepUp = mod.requireStepUp;
  });

  function makeReq(mfaVerifiedAt) {
    return { user: { sub: 'user-1', role: 'super_admin', mfaVerifiedAt }, originalUrl: '/test' };
  }

  it('blocks when mfaVerifiedAt is absent', () => {
    const middleware = requireStepUp(30);
    const req = makeReq(undefined);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'STEP_UP_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks when step-up window has expired', () => {
    const middleware = requireStepUp(30);
    // mfaVerifiedAt 31 minutes ago
    const stale = Math.floor((Date.now() - 31 * 60 * 1000) / 1000);
    const req = makeReq(stale);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'STEP_UP_EXPIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('passes when mfaVerifiedAt is within window', () => {
    const middleware = requireStepUp(30);
    const recent = Math.floor((Date.now() - 5 * 60 * 1000) / 1000); // 5 min ago
    const req = makeReq(recent);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('uses custom window override', () => {
    const middleware = requireStepUp(10); // 10 min window
    const elevenMinAgo = Math.floor((Date.now() - 11 * 60 * 1000) / 1000);
    const req = makeReq(elevenMinAgo);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'STEP_UP_EXPIRED' }));
  });
});

// ─── isMfaRequired / isMfaExempt ─────────────────────────

describe('MFA role policy', () => {
  let isMfaRequired, isMfaExempt;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../modules/mfa/service.js');
    isMfaRequired = mod.isMfaRequired;
    isMfaExempt = mod.isMfaExempt;
  });

  it('marks super_admin, institutional_admin, reviewer as required', () => {
    expect(isMfaRequired('super_admin')).toBe(true);
    expect(isMfaRequired('institutional_admin')).toBe(true);
    expect(isMfaRequired('reviewer')).toBe(true);
  });

  it('does not require MFA for field_officer and investor_viewer', () => {
    expect(isMfaRequired('field_officer')).toBe(false);
    expect(isMfaRequired('investor_viewer')).toBe(false);
  });

  it('marks farmer as exempt', () => {
    expect(isMfaExempt('farmer')).toBe(true);
    expect(isMfaExempt('super_admin')).toBe(false);
  });
});

// ─── Token revocation via tokenVersion ────────────────────

describe('Token revocation (tokenVersion)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a JWT whose tv claim is below DB tokenVersion', async () => {
    // Simulate: user logged out (tokenVersion bumped to 2), but holds old token with tv=0
    const oldToken = jwt.sign({ sub: 'u1', role: 'super_admin', tv: 0 }, TEST_SECRET, { expiresIn: '1h' });

    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', active: true, role: 'super_admin', organizationId: null, tokenVersion: 2,
    });

    const { authenticate } = await import('../middleware/auth.js');
    const req = { headers: { authorization: `Bearer ${oldToken}` }, ip: '::1', originalUrl: '/test' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authenticate(req, res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Session expired') }));
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a JWT whose tv matches DB tokenVersion', async () => {
    const token = jwt.sign({ sub: 'u2', role: 'reviewer', tv: 3 }, TEST_SECRET, { expiresIn: '1h' });

    prisma.user.findUnique.mockResolvedValue({
      id: 'u2', active: true, role: 'reviewer', organizationId: null, tokenVersion: 3,
    });

    const { authenticate } = await import('../middleware/auth.js');
    const req = { headers: { authorization: `Bearer ${token}` }, ip: '::1', originalUrl: '/test' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authenticate(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('accepts a legacy JWT (no tv claim) against tokenVersion=0', async () => {
    // Existing users who logged in before tokenVersion was added get tv=undefined → treated as 0
    const legacyToken = jwt.sign({ sub: 'u3', role: 'field_officer' }, TEST_SECRET, { expiresIn: '1h' });

    prisma.user.findUnique.mockResolvedValue({
      id: 'u3', active: true, role: 'field_officer', organizationId: null, tokenVersion: 0,
    });

    const { authenticate } = await import('../middleware/auth.js');
    const req = { headers: { authorization: `Bearer ${legacyToken}` }, ip: '::1', originalUrl: '/test' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authenticate(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(next).toHaveBeenCalled();
  });
});

// ─── OAuth state CSRF protection ──────────────────────────

describe('verifyOAuthState', () => {
  let verifyOAuthState, buildOAuthState;

  // Access internal buildOAuthState via the module (only verifyOAuthState is exported)
  // We test via verifyOAuthState — build a valid state manually for the happy path

  beforeEach(async () => {
    vi.resetModules();
    // Need to re-import with the config mock in place
    const mod = await import('../modules/auth/federated.js');
    verifyOAuthState = mod.verifyOAuthState;
  });

  it('rejects a tampered state signature', () => {
    expect(() => verifyOAuthState('validpayload.invalidsig')).toThrow();
  });

  it('rejects an empty state', () => {
    expect(() => verifyOAuthState('')).toThrow();
    expect(() => verifyOAuthState(null)).toThrow();
  });

  it('rejects a state with no dot separator', () => {
    expect(() => verifyOAuthState('nodotinthisstring')).toThrow();
  });
});

// ─── Password reset service ───────────────────────────────

describe('initiatePasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the same message whether email exists or not (anti-enumeration)', async () => {
    // Case 1: user not found
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const { initiatePasswordReset } = await import('../modules/auth/resetService.js');
    const r1 = await initiatePasswordReset({ email: 'nobody@example.com' });
    expect(r1.message).toBeTruthy();

    // Case 2: user found (but no token created since sendgrid key is empty in test)
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', email: 'user@example.com', active: true });
    prisma.passwordResetToken.create.mockResolvedValueOnce({ id: 'tok1' });
    const r2 = await initiatePasswordReset({ email: 'user@example.com' });
    expect(r2.message).toBe(r1.message); // same message regardless
  });
});

describe('completePasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a token that does not exist in DB', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);
    const { completePasswordReset } = await import('../modules/auth/resetService.js');
    await expect(completePasswordReset({ rawToken: 'badtoken', newPassword: 'Valid1!pass' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a token that has already been used', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'tok2', tokenHash, userId: 'u1', usedAt: new Date(), expiresAt: new Date(Date.now() + 3600000),
    });
    const { completePasswordReset } = await import('../modules/auth/resetService.js');
    await expect(completePasswordReset({ rawToken, newPassword: 'Valid1!pass' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a token that has expired', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'tok3', tokenHash, userId: 'u1', usedAt: null,
      expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
    });
    const { completePasswordReset } = await import('../modules/auth/resetService.js');
    await expect(completePasswordReset({ rawToken, newPassword: 'Valid1!pass' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─── generateCallbackHtml — MFA payload forwarding ───────

describe('generateCallbackHtml', () => {
  let generateCallbackHtml;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../modules/auth/federated.js');
    generateCallbackHtml = mod.generateCallbackHtml;
  });

  it('includes accessToken in success payload', () => {
    const html = generateCallbackHtml({ user: { id: 'u1' }, accessToken: 'tok123' });
    expect(html).toContain('tok123');
    expect(html).toContain('farroway-auth');
  });

  it('includes mfaChallengeRequired and mfaToken in challenge payload, excludes accessToken', () => {
    const html = generateCallbackHtml({ user: { id: 'u1' }, mfaChallengeRequired: true, mfaToken: 'challenge-jwt' });
    expect(html).toContain('mfaChallengeRequired');
    expect(html).toContain('challenge-jwt');
    expect(html).not.toContain('"accessToken"');
  });

  it('includes mfaSetupRequired in setup payload', () => {
    const html = generateCallbackHtml({ user: { id: 'u1' }, mfaSetupRequired: true, mfaToken: 'setup-jwt' });
    expect(html).toContain('mfaSetupRequired');
    expect(html).toContain('setup-jwt');
  });

  it('returns error HTML on error result', () => {
    const html = generateCallbackHtml({ error: 'Auth failed' });
    expect(html).toContain('Authentication failed');
  });
});
