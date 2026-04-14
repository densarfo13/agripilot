/**
 * Admin MFA — structural and integration tests.
 *
 * Verifies:
 * - super_admin is in MFA_REQUIRED_ROLES
 * - farmer is exempt from MFA
 * - V2 login endpoint has MFA gate
 * - V2 MFA verify endpoint exists
 * - Login page handles MFA challenge step
 * - AuthContext exposes completeMfaChallenge
 * - MFA challenge token functions exist
 * - AccountPage has MFA enrollment UI
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// ── MFA role policy ──────────────────────────────────────────

describe('MFA role policy', () => {
  const src = read('server/src/modules/mfa/service.js');

  it('super_admin requires MFA', () => {
    expect(src).toContain("'super_admin'");
    const rolesLine = src.split('MFA_REQUIRED_ROLES')[1]?.split(';')[0] || '';
    expect(rolesLine).toContain('super_admin');
  });

  it('institutional_admin requires MFA', () => {
    const rolesLine = src.split('MFA_REQUIRED_ROLES')[1]?.split(';')[0] || '';
    expect(rolesLine).toContain('institutional_admin');
  });

  it('farmer is exempt from MFA', () => {
    const exemptLine = src.split('MFA_EXEMPT_ROLES')[1]?.split(';')[0] || '';
    expect(exemptLine).toContain('farmer');
  });
});

// ── V2 login MFA gate ────────────────────────────────────────

describe('V2 login endpoint — MFA gate', () => {
  const src = read('server/routes/auth.js');

  it('imports MFA challenge token functions', () => {
    expect(src).toContain('signMfaChallengeToken');
    expect(src).toContain('verifyMfaChallengeToken');
  });

  it('checks isMfaRequired after password verification', () => {
    const loginSection = src.split("router.post('/login'")[1]?.split("router.post(")[0] || '';
    expect(loginSection).toContain('isMfaRequired');
    expect(loginSection).toContain('mfaEnabled');
  });

  it('returns mfaChallengeRequired when MFA is enrolled', () => {
    const loginSection = src.split("router.post('/login'")[1]?.split("router.post(")[0] || '';
    expect(loginSection).toContain('mfaChallengeRequired: true');
    expect(loginSection).toContain('mfaToken');
  });

  it('does NOT set session cookies when MFA challenge is required', () => {
    // createSessionAndCookies should only be called AFTER MFA check
    const loginSection = src.split("router.post('/login'")[1]?.split("router.post(")[0] || '';
    const mfaGateIdx = loginSection.indexOf('mfaChallengeRequired');
    const cookieIdx = loginSection.indexOf('createSessionAndCookies');
    // The MFA gate check must come BEFORE session cookie creation
    expect(mfaGateIdx).toBeLessThan(cookieIdx);
  });
});

// ── V2 MFA verify endpoint ───────────────────────────────────

describe('V2 MFA verify endpoint', () => {
  const src = read('server/routes/auth.js');

  it('has POST /mfa/verify route', () => {
    expect(src).toContain("router.post('/mfa/verify'");
  });

  it('verifies MFA challenge token', () => {
    const verifySection = src.split("'/mfa/verify'")[1]?.split("router.")[0] || '';
    expect(verifySection).toContain('verifyMfaChallengeToken');
  });

  it('verifies TOTP code', () => {
    const verifySection = src.split("'/mfa/verify'")[1]?.split("router.")[0] || '';
    expect(verifySection).toContain('verifyMfaCode');
  });

  it('creates session cookies on successful MFA verification', () => {
    const verifySection = src.split("'/mfa/verify'")[1]?.split("router.")[0] || '';
    expect(verifySection).toContain('createSessionAndCookies');
  });

  it('returns clear error for invalid code', () => {
    const verifySection = src.split("'/mfa/verify'")[1]?.split("router.")[0] || '';
    expect(verifySection).toContain('Invalid code');
  });

  it('returns clear error for expired MFA session', () => {
    const verifySection = src.split("'/mfa/verify'")[1]?.split("router.")[0] || '';
    expect(verifySection).toContain('expired');
  });
});

// ── MFA challenge tokens ─────────────────────────────────────

describe('MFA challenge token functions', () => {
  const src = read('server/lib/tokens.js');

  it('signMfaChallengeToken sets purpose claim', () => {
    expect(src).toContain("purpose: 'mfa_challenge'");
  });

  it('signMfaChallengeToken expires in 5 minutes', () => {
    expect(src).toContain("expiresIn: '5m'");
  });

  it('verifyMfaChallengeToken checks purpose', () => {
    const fn = src.split('verifyMfaChallengeToken')[1] || '';
    expect(fn).toContain("purpose !== 'mfa_challenge'");
  });
});

// ── Login page MFA UI ────────────────────────────────────────

describe('V2 Login page — MFA challenge step', () => {
  const src = read('src/pages/Login.jsx');

  it('has MFA step state', () => {
    expect(src).toContain('mfaStep');
    expect(src).toContain('mfaToken');
    expect(src).toContain('mfaCode');
  });

  it('detects mfaChallengeRequired from login response', () => {
    expect(src).toContain('mfaChallengeRequired');
  });

  it('calls completeMfaChallenge from AuthContext', () => {
    expect(src).toContain('completeMfaChallenge');
  });

  it('shows two-factor authentication heading', () => {
    expect(src).toContain('Two-Factor Authentication');
  });

  it('has back to login button', () => {
    expect(src).toContain('Back to login');
  });

  it('shows backup code hint', () => {
    expect(src).toContain('backup code');
  });

  it('accepts 6-digit TOTP or 10-char backup code', () => {
    expect(src).toContain('maxLength={10}');
    expect(src).toContain('inputMode="numeric"');
  });
});

// ── AuthContext MFA support ──────────────────────────────────

describe('AuthContext — MFA integration', () => {
  const src = read('src/context/AuthContext.jsx');

  it('exports completeMfaChallenge function', () => {
    expect(src).toContain('completeMfaChallenge');
  });

  it('login() returns early for MFA challenge without setting user', () => {
    const loginFn = src.split('async function login')[1]?.split('async function')[0] || '';
    expect(loginFn).toContain('mfaChallengeRequired');
    expect(loginFn).toContain('return data');
  });

  it('completeMfaChallenge sets user and clears loading', () => {
    const fn = src.split('completeMfaChallenge')[1]?.split('async function')[0] || '';
    expect(fn).toContain('setUser');
    expect(fn).toContain('setAuthLoading(false)');
    expect(fn).toContain('cacheSession');
  });

  it('imports verifyMfaCode API function', () => {
    expect(src).toContain('verifyMfaCodeApi');
  });
});

// ── AccountPage MFA enrollment ───────────────────────────────

describe('AccountPage — MFA enrollment UI', () => {
  const src = read('src/pages/AccountPage.jsx');

  it('has MFA enrollment flow', () => {
    expect(src).toContain('/mfa/enroll/init');
    expect(src).toContain('/mfa/enroll/verify');
  });

  it('has MFA disable flow', () => {
    expect(src).toContain('/mfa/disable');
  });

  it('has backup code regeneration', () => {
    expect(src).toContain('/mfa/backup-codes/regenerate');
  });

  it('shows QR code for enrollment', () => {
    expect(src).toContain('otpauthUrl');
    expect(src).toContain('qrserver');
  });

  it('shows required badge for required roles', () => {
    expect(src).toContain('Required for your role');
  });
});

// ── API client MFA function ──────────────────────────────────

describe('V2 API — MFA verify function', () => {
  const src = read('src/lib/api.js');

  it('exports verifyMfaCode function', () => {
    expect(src).toContain('verifyMfaCode');
  });

  it('calls POST /api/v2/auth/mfa/verify', () => {
    expect(src).toContain('/api/v2/auth/mfa/verify');
  });
});
