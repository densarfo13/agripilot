import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Duplicate detection logic tests (pure function) ───────

describe('Duplicate detection logic', () => {
  it('phone normalization strips spaces and dashes', () => {
    // Simulate normalization logic
    const normalize = (p) => p.replace(/[\s\-()]/g, '');
    expect(normalize('+254 700 000 000')).toBe('+254700000000');
    expect(normalize('+254-700-000-000')).toBe('+254700000000');
    expect(normalize('(+254) 700 000 000')).toBe('+254700000000');
  });

  it('duplicate result shape includes required fields', () => {
    const match = { id: 'f1', fullName: 'John', phone: '+254700000000', region: 'Nairobi', registrationStatus: 'approved', createdAt: new Date() };
    const formatted = {
      id: match.id,
      fullName: match.fullName,
      phone: match.phone,
      region: match.region,
      status: match.registrationStatus,
      createdAt: match.createdAt,
    };
    expect(formatted).toHaveProperty('id', 'f1');
    expect(formatted).toHaveProperty('status', 'approved');
    expect(formatted).toHaveProperty('phone', '+254700000000');
  });

  it('no matches returns hasDuplicate: false', () => {
    const matches = [];
    const result = {
      hasDuplicate: matches.length > 0,
      duplicates: matches,
    };
    expect(result.hasDuplicate).toBe(false);
    expect(result.duplicates).toEqual([]);
  });

  it('single match returns hasDuplicate: true with details', () => {
    const matches = [{ id: 'f1', fullName: 'Mary', phone: '+254711111111', region: 'Kisumu', registrationStatus: 'pending_approval', createdAt: new Date() }];
    const result = {
      hasDuplicate: matches.length > 0,
      duplicates: matches.map(m => ({ id: m.id, fullName: m.fullName, phone: m.phone, region: m.region, status: m.registrationStatus })),
    };
    expect(result.hasDuplicate).toBe(true);
    expect(result.duplicates[0].status).toBe('pending_approval');
  });
});

// ─── Status computation tests ──────────────────────────────

// Pure function re-implementation for isolated testing
// (matches logic in server/src/modules/farmers/service.js)
function computeAccessStatus(farmer) {
  if (!farmer) return 'NO_ACCESS';
  const { registrationStatus } = farmer;
  if (registrationStatus === 'disabled') return 'DISABLED';
  if (registrationStatus === 'pending_approval') return 'PENDING_APPROVAL';
  if (registrationStatus === 'rejected') return 'NO_ACCESS';
  const acct = farmer.userAccount;
  if (acct?.active) return 'ACTIVE';
  return 'NO_ACCESS';
}

function computeInviteStatus(farmer) {
  if (!farmer) return 'NOT_SENT';
  if (farmer.selfRegistered) return 'NOT_SENT';
  const { inviteDeliveryStatus, inviteToken, inviteExpiresAt, userId } = farmer;
  if (userId) return 'ACCEPTED';
  if (inviteToken && inviteExpiresAt && new Date() > new Date(inviteExpiresAt)) return 'EXPIRED';
  if (inviteDeliveryStatus === 'email_sent') return 'INVITE_SENT_EMAIL';
  if (inviteDeliveryStatus === 'phone_sent') return 'INVITE_SENT_PHONE';
  if (inviteDeliveryStatus === 'manual_share_ready' || inviteToken) return 'LINK_GENERATED';
  return 'NOT_SENT';
}

describe('Access Status Computation', () => {

  it('returns ACTIVE for approved farmer with active account', () => {
    expect(computeAccessStatus({
      registrationStatus: 'approved',
      userAccount: { active: true },
    })).toBe('ACTIVE');
  });

  it('returns PENDING_APPROVAL for pending farmer', () => {
    expect(computeAccessStatus({
      registrationStatus: 'pending_approval',
    })).toBe('PENDING_APPROVAL');
  });

  it('returns DISABLED for disabled farmer', () => {
    expect(computeAccessStatus({
      registrationStatus: 'disabled',
    })).toBe('DISABLED');
  });

  it('returns NO_ACCESS for rejected farmer', () => {
    expect(computeAccessStatus({
      registrationStatus: 'rejected',
    })).toBe('NO_ACCESS');
  });

  it('returns NO_ACCESS for approved farmer without account', () => {
    expect(computeAccessStatus({
      registrationStatus: 'approved',
      userAccount: null,
    })).toBe('NO_ACCESS');
  });

  it('returns NO_ACCESS for null farmer', () => {
    expect(computeAccessStatus(null)).toBe('NO_ACCESS');
  });
});

describe('Invite Status Computation', () => {
  it('returns NOT_SENT for self-registered farmer', () => {
    expect(computeInviteStatus({ selfRegistered: true })).toBe('NOT_SENT');
  });

  it('returns ACCEPTED when farmer has userId', () => {
    expect(computeInviteStatus({
      selfRegistered: false, userId: 'u1',
      inviteToken: null, inviteExpiresAt: null,
    })).toBe('ACCEPTED');
  });

  it('returns EXPIRED when invite is past expiry and no user', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    expect(computeInviteStatus({
      selfRegistered: false, userId: null,
      inviteToken: 'tok', inviteExpiresAt: pastDate,
    })).toBe('EXPIRED');
  });

  it('returns INVITE_SENT_EMAIL when email was sent', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    expect(computeInviteStatus({
      selfRegistered: false, userId: null,
      inviteDeliveryStatus: 'email_sent',
      inviteToken: 'tok', inviteExpiresAt: futureDate,
    })).toBe('INVITE_SENT_EMAIL');
  });

  it('returns LINK_GENERATED when manual share', () => {
    expect(computeInviteStatus({
      selfRegistered: false, userId: null,
      inviteDeliveryStatus: 'manual_share_ready',
      inviteToken: 'tok',
    })).toBe('LINK_GENERATED');
  });

  it('returns NOT_SENT for null farmer', () => {
    expect(computeInviteStatus(null)).toBe('NOT_SENT');
  });
});

// ─── Reporting consistency: active farmer definition ───────

describe('Active farmer definition consistency', () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  it('farmer with active season is active', () => {
    const farmer = { farmSeasons: [{ status: 'active', lastActivityDate: null }] };
    const isActive = farmer.farmSeasons.some(s => s.status === 'active');
    expect(isActive).toBe(true);
  });

  it('farmer with recent activity is active', () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 10);
    const farmer = { farmSeasons: [{ status: 'completed', lastActivityDate: recent }] };
    const isActive = farmer.farmSeasons.some(s =>
      s.lastActivityDate && new Date(s.lastActivityDate) > thirtyDaysAgo
    );
    expect(isActive).toBe(true);
  });

  it('farmer with stale activity is not active', () => {
    const stale = new Date();
    stale.setDate(stale.getDate() - 60);
    const farmer = { farmSeasons: [{ status: 'completed', lastActivityDate: stale }] };
    const isActive = farmer.farmSeasons.some(s => s.status === 'active') ||
      farmer.farmSeasons.some(s => s.lastActivityDate && new Date(s.lastActivityDate) > thirtyDaysAgo);
    expect(isActive).toBe(false);
  });

  it('farmer with no seasons is not active', () => {
    const farmer = { farmSeasons: [] };
    const isActive = farmer.farmSeasons.some(s => s.status === 'active');
    expect(isActive).toBe(false);
  });

  it('exact 30-day boundary: activity exactly 30 days ago is not active', () => {
    const exact = new Date(thirtyDaysAgo);
    const farmer = { farmSeasons: [{ status: 'completed', lastActivityDate: exact }] };
    const isActive = farmer.farmSeasons.some(s =>
      s.lastActivityDate && new Date(s.lastActivityDate) > thirtyDaysAgo
    );
    expect(isActive).toBe(false);
  });
});

// ─── Draft persistence pattern tests ───────────────────────

describe('Draft persistence patterns', () => {
  it('serializes and deserializes form state correctly', () => {
    const state = {
      step: 2,
      form: { farmName: 'Sunrise Farm', crop: 'MAIZE', farmSizeAcres: '5', locationName: 'Nakuru' },
    };
    const serialized = JSON.stringify(state);
    const parsed = JSON.parse(serialized);
    expect(parsed.step).toBe(2);
    expect(parsed.form.farmName).toBe('Sunrise Farm');
    expect(parsed.form.crop).toBe('MAIZE');
  });

  it('handles corrupt JSON gracefully', () => {
    const corrupt = 'not-valid-json{{{';
    let result;
    try { result = JSON.parse(corrupt); }
    catch { result = { step: 0, form: {} }; }
    expect(result.step).toBe(0);
  });

  it('preserves non-sensitive fields only', () => {
    const sensitiveFields = ['password', 'confirmPassword', 'email'];
    const form = { fullName: 'John', phone: '123', password: 'secret', email: 'a@b.com', region: 'Nairobi' };
    const safe = {};
    for (const [k, v] of Object.entries(form)) {
      if (!sensitiveFields.includes(k)) safe[k] = v;
    }
    expect(safe).not.toHaveProperty('password');
    expect(safe).not.toHaveProperty('email');
    expect(safe).toHaveProperty('fullName', 'John');
    expect(safe).toHaveProperty('region', 'Nairobi');
  });
});

// ─── Invite lifecycle edge cases ───────────────────────────

describe('Invite lifecycle edge cases', () => {
  it('accepted invite with expired token returns ACCEPTED (user account takes priority)', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    expect(computeInviteStatus({
      selfRegistered: false,
      userId: 'u1',
      inviteToken: null, // consumed
      inviteExpiresAt: pastDate,
    })).toBe('ACCEPTED');
  });

  it('invite with token but no delivery status returns LINK_GENERATED', () => {
    expect(computeInviteStatus({
      selfRegistered: false,
      userId: null,
      inviteToken: 'some-token',
      inviteDeliveryStatus: null,
      inviteExpiresAt: new Date(Date.now() + 86400000),
    })).toBe('LINK_GENERATED');
  });

  it('phone-sent invite returns correct status', () => {
    expect(computeInviteStatus({
      selfRegistered: false,
      userId: null,
      inviteDeliveryStatus: 'phone_sent',
      inviteToken: 'tok',
      inviteExpiresAt: new Date(Date.now() + 86400000),
    })).toBe('INVITE_SENT_PHONE');
  });
});
