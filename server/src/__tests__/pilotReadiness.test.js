import { describe, it, expect } from 'vitest';

/**
 * Phase 5 — Pilot Readiness Regression Tests
 *
 * Focused on configuration correctness and exported contract verification.
 * Does NOT mock prisma — tests only pure logic and config exports.
 */

// ─── 1. Rate Limiter Config ──────────────────────────────────

describe('Rate Limiter Configuration', () => {
  it('exports all expected limiters', async () => {
    const mod = await import('../middleware/rateLimiters.js');
    expect(mod.inviteLimiter).toBeDefined();
    expect(mod.resendInviteLimiter).toBeDefined();
    expect(mod.loginLimiter).toBeDefined();
    expect(mod.registrationLimiter).toBeDefined();
    expect(mod.inviteAcceptLimiter).toBeDefined();
    expect(mod.passwordResetLimiter).toBeDefined();
    expect(mod.mfaEnrollLimiter).toBeDefined();
    expect(mod.mfaVerifyLimiter).toBeDefined();
    expect(mod.workflowLimiter).toBeDefined();
    expect(mod.securityLimiter).toBeDefined();
    expect(mod.uploadLimiter).toBeDefined();
    expect(mod.submissionLimiter).toBeDefined();
  });

  it('resendInviteLimiter is a distinct function from inviteLimiter', async () => {
    const mod = await import('../middleware/rateLimiters.js');
    expect(mod.resendInviteLimiter).not.toBe(mod.inviteLimiter);
    expect(typeof mod.resendInviteLimiter).toBe('function');
    expect(typeof mod.inviteLimiter).toBe('function');
  });

  it('all limiters are express middleware functions', async () => {
    const mod = await import('../middleware/rateLimiters.js');
    const limiters = [
      mod.inviteLimiter, mod.resendInviteLimiter, mod.loginLimiter,
      mod.registrationLimiter, mod.inviteAcceptLimiter, mod.passwordResetLimiter,
      mod.mfaEnrollLimiter, mod.mfaVerifyLimiter, mod.workflowLimiter,
      mod.securityLimiter, mod.uploadLimiter, mod.submissionLimiter,
    ];
    for (const limiter of limiters) {
      expect(typeof limiter).toBe('function');
    }
  });
});

// ─── 2. MFA Role Policy ─────────────────────────────────────

describe('MFA Role Policy', () => {
  it('requires MFA for institutional_admin, reviewer', async () => {
    const { isMfaRequired } = await import('../modules/mfa/service.js');
    expect(isMfaRequired('institutional_admin')).toBe(true);
    expect(isMfaRequired('reviewer')).toBe(true);
  });

  it('does not require MFA for super_admin, farmer, field_officer, investor_viewer', async () => {
    const { isMfaRequired } = await import('../modules/mfa/service.js');
    expect(isMfaRequired('super_admin')).toBe(false);
    expect(isMfaRequired('farmer')).toBe(false);
    expect(isMfaRequired('field_officer')).toBe(false);
    expect(isMfaRequired('investor_viewer')).toBe(false);
  });

  it('exempts farmer from MFA', async () => {
    const { isMfaExempt } = await import('../modules/mfa/service.js');
    expect(isMfaExempt('farmer')).toBe(true);
    expect(isMfaExempt('super_admin')).toBe(false);
  });

  it('MFA_REQUIRED_ROLES set contains exactly 2 roles', async () => {
    const { MFA_REQUIRED_ROLES } = await import('../modules/mfa/service.js');
    expect(MFA_REQUIRED_ROLES.size).toBe(2);
    expect(MFA_REQUIRED_ROLES.has('institutional_admin')).toBe(true);
    expect(MFA_REQUIRED_ROLES.has('reviewer')).toBe(true);
  });
});

// ─── 3. Farmer Status Compute — access + invite status ───────

describe('Farmer Status Computation', () => {
  it('exports computeAccessStatus and computeInviteStatus', async () => {
    const mod = await import('../modules/farmers/service.js');
    expect(typeof mod.computeAccessStatus).toBe('function');
    expect(typeof mod.computeInviteStatus).toBe('function');
  });

  it('computeAccessStatus returns PENDING_APPROVAL for pending farmers', async () => {
    const { computeAccessStatus } = await import('../modules/farmers/service.js');
    expect(computeAccessStatus({ registrationStatus: 'pending_approval' })).toBe('PENDING_APPROVAL');
  });

  it('computeAccessStatus returns ACTIVE for approved farmer with active user', async () => {
    const { computeAccessStatus } = await import('../modules/farmers/service.js');
    expect(computeAccessStatus({
      registrationStatus: 'approved',
      userAccount: { active: true },
    })).toBe('ACTIVE');
  });

  it('computeInviteStatus returns ACCEPTED when userId exists', async () => {
    const { computeInviteStatus } = await import('../modules/farmers/service.js');
    expect(computeInviteStatus({ userId: 'u-1' })).toBe('ACCEPTED');
  });

  it('computeInviteStatus returns NOT_SENT for self-registered', async () => {
    const { computeInviteStatus } = await import('../modules/farmers/service.js');
    expect(computeInviteStatus({ selfRegistered: true })).toBe('NOT_SENT');
  });
});

// ─── 4. Region Config ────────────────────────────────────────

describe('Region Config', () => {
  it('exports DEFAULT_COUNTRY_CODE as 2-char string', async () => {
    const { DEFAULT_COUNTRY_CODE } = await import('../modules/regionConfig/service.js');
    expect(typeof DEFAULT_COUNTRY_CODE).toBe('string');
    expect(DEFAULT_COUNTRY_CODE.length).toBe(2);
  });
});

// ─── 5. Phone Utils ─────────────────────────────────────────

describe('Phone Utils', () => {
  it('normalizePhoneForStorage handles Kenyan numbers', async () => {
    const { normalizePhoneForStorage } = await import('../utils/phoneUtils.js');
    const normalized = normalizePhoneForStorage('+254700123456');
    expect(normalized).toContain('254');
  });

  it('validatePhone rejects empty input', async () => {
    const { validatePhone } = await import('../utils/phoneUtils.js');
    const result = validatePhone('');
    expect(result.valid).toBe(false);
  });
});
