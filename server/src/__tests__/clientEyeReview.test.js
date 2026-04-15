import { describe, it, expect } from 'vitest';

/**
 * Phase 4 — Client-Eye Review Regression Tests
 *
 * Verifies exported contracts, config correctness, and key logic
 * for features added during the 4-phase client-eye review pass.
 * Does NOT mock prisma — tests only pure logic and config exports.
 */

// ─── 1. Org Scope Helpers ────────────────────────────────────

describe('Org Scope Helpers', () => {
  it('orgWhereFarmer returns empty object when isCrossOrg is true', async () => {
    const { orgWhereFarmer } = await import('../middleware/orgScope.js');
    expect(orgWhereFarmer({ isCrossOrg: true, organizationId: 'org-1' })).toEqual({});
  });

  it('orgWhereFarmer returns organizationId filter when scoped', async () => {
    const { orgWhereFarmer } = await import('../middleware/orgScope.js');
    expect(orgWhereFarmer({ isCrossOrg: false, organizationId: 'org-1' })).toEqual({ organizationId: 'org-1' });
  });

  it('orgWhereApplication wraps in farmer relation', async () => {
    const { orgWhereApplication } = await import('../middleware/orgScope.js');
    expect(orgWhereApplication({ isCrossOrg: false, organizationId: 'org-2' })).toEqual({
      farmer: { organizationId: 'org-2' },
    });
  });

  it('orgWhereUser returns organizationId filter', async () => {
    const { orgWhereUser } = await import('../middleware/orgScope.js');
    expect(orgWhereUser({ isCrossOrg: false, organizationId: 'org-3' })).toEqual({ organizationId: 'org-3' });
  });

  it('verifyOrgAccess allows cross-org access', async () => {
    const { verifyOrgAccess } = await import('../middleware/orgScope.js');
    expect(verifyOrgAccess({ isCrossOrg: true }, 'any-org')).toBe(true);
  });

  it('verifyOrgAccess allows matching org', async () => {
    const { verifyOrgAccess } = await import('../middleware/orgScope.js');
    expect(verifyOrgAccess({ isCrossOrg: false, organizationId: 'org-1', user: { sub: 'u1', role: 'admin' } }, 'org-1')).toBe(true);
  });

  it('verifyOrgAccess blocks mismatched org', async () => {
    const { verifyOrgAccess } = await import('../middleware/orgScope.js');
    const result = verifyOrgAccess({
      isCrossOrg: false, organizationId: 'org-1',
      user: { sub: 'u1', role: 'institutional_admin' },
      originalUrl: '/test', method: 'GET',
    }, 'org-2');
    expect(result).toBe(false);
  });

  it('org cache can be invalidated and cleared', async () => {
    const { invalidateOrgCache, clearOrgCache } = await import('../middleware/orgScope.js');
    // Should not throw
    invalidateOrgCache('user-1');
    invalidateOrgCache(null);
    clearOrgCache();
  });
});

// ─── 2. Pilot QA Route Configuration ─────────────────────────

describe('Pilot QA Route Config', () => {
  it('exports a default router', async () => {
    const mod = await import('../modules/pilotQA/routes.js');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function'); // Express router is a function
  });
});

// ─── 3. Farmer Status Computation — extended ──────────────────

describe('Farmer Status Computation (extended)', () => {
  it('computeAccessStatus returns DISABLED for disabled farmer', async () => {
    const { computeAccessStatus } = await import('../modules/farmers/service.js');
    expect(computeAccessStatus({ registrationStatus: 'disabled' })).toBe('DISABLED');
  });

  it('computeAccessStatus returns NO_ACCESS for rejected farmer', async () => {
    const { computeAccessStatus } = await import('../modules/farmers/service.js');
    expect(computeAccessStatus({ registrationStatus: 'rejected' })).toBe('NO_ACCESS');
  });

  it('computeInviteStatus returns EXPIRED when token exists but invite is expired', async () => {
    const { computeInviteStatus } = await import('../modules/farmers/service.js');
    const result = computeInviteStatus({
      inviteToken: 'tok',
      inviteExpiresAt: new Date(Date.now() - 86400000), // expired yesterday
    });
    expect(result).toBe('EXPIRED');
  });

  it('computeInviteStatus returns LINK_GENERATED when token exists and not expired', async () => {
    const { computeInviteStatus } = await import('../modules/farmers/service.js');
    const result = computeInviteStatus({
      inviteToken: 'tok',
      inviteExpiresAt: new Date(Date.now() + 86400000), // expires tomorrow
    });
    expect(result).toBe('LINK_GENERATED');
  });
});

// ─── 4. Rate Limiter — resendInviteLimiter exists ──────────

describe('Rate Limiter — resend invite', () => {
  it('resendInviteLimiter is exported and is a middleware function', async () => {
    const { resendInviteLimiter } = await import('../middleware/rateLimiters.js');
    expect(resendInviteLimiter).toBeDefined();
    expect(typeof resendInviteLimiter).toBe('function');
  });

  it('resendInviteLimiter is distinct from inviteLimiter', async () => {
    const { resendInviteLimiter, inviteLimiter } = await import('../middleware/rateLimiters.js');
    expect(resendInviteLimiter).not.toBe(inviteLimiter);
  });
});

// ─── 5. MFA Role Policy — consistency check ──────────────────

describe('MFA Role Policy (consistency)', () => {
  it('super_admin IS in MFA_REQUIRED_ROLES', async () => {
    const { MFA_REQUIRED_ROLES } = await import('../modules/mfa/service.js');
    expect(MFA_REQUIRED_ROLES.has('super_admin')).toBe(true);
  });

  it('farmer is MFA exempt', async () => {
    const { isMfaExempt } = await import('../modules/mfa/service.js');
    expect(isMfaExempt('farmer')).toBe(true);
  });

  it('investor_viewer does not require MFA', async () => {
    const { isMfaRequired } = await import('../modules/mfa/service.js');
    expect(isMfaRequired('investor_viewer')).toBe(false);
  });
});

// ─── 6. Phone Utils — edge cases ─────────────────────────────

describe('Phone Utils (edge cases)', () => {
  it('normalizePhoneForStorage handles +254 prefix', async () => {
    const { normalizePhoneForStorage } = await import('../utils/phoneUtils.js');
    const result = normalizePhoneForStorage('+254712345678');
    expect(result).toContain('254');
    expect(result.startsWith('+')).toBe(true);
  });

  it('validatePhone rejects null and undefined as invalid', async () => {
    const { validatePhone } = await import('../utils/phoneUtils.js');
    // null/undefined are falsy → caught by !phone guard
    expect(validatePhone(null).valid).toBe(false);
    expect(validatePhone(undefined).valid).toBe(false);
  });

  it('validatePhone throws on non-string truthy input (number)', async () => {
    const { validatePhone } = await import('../utils/phoneUtils.js');
    // number is truthy but has no .trim() — throws TypeError
    expect(() => validatePhone(12345)).toThrow();
  });

  it('validatePhone accepts valid Kenyan number', async () => {
    const { validatePhone } = await import('../utils/phoneUtils.js');
    const result = validatePhone('+254700123456');
    expect(result.valid).toBe(true);
  });
});
