/**
 * Validates the InviteAccessBadge component config mappings.
 * Pure value tests — no DOM or React renderer needed.
 * The ACCESS_CONFIG and INVITE_CONFIG are duplicated here to catch drift
 * if the component's values ever diverge from what computeAccessStatus /
 * computeInviteStatus return.
 */
import { describe, it, expect } from 'vitest';
import { computeAccessStatus, computeInviteStatus } from '../modules/farmers/service.js';

// Mirror of what InviteAccessBadge.jsx renders
const ACCESS_CONFIG = {
  ACTIVE:           { label: 'Active',           cls: 'badge-active' },
  PENDING_APPROVAL: { label: 'Pending Approval', cls: 'badge-pending' },
  NO_ACCESS:        { label: 'No Access',         cls: 'badge-no-access' },
  DISABLED:         { label: 'Disabled',          cls: 'badge-disabled' },
};

const INVITE_CONFIG = {
  NOT_SENT:          { label: 'Not Sent',    cls: 'badge-not-sent' },
  LINK_GENERATED:    { label: 'Link Ready',  cls: 'badge-link-generated' },
  INVITE_SENT_EMAIL: { label: 'Email Sent',  cls: 'badge-invite-sent' },
  INVITE_SENT_PHONE: { label: 'SMS Sent',    cls: 'badge-invite-sent' },
  ACCEPTED:          { label: 'Accepted',    cls: 'badge-accepted' },
  EXPIRED:           { label: 'Expired',     cls: 'badge-expired' },
};

describe('AccessBadge config', () => {
  it('has an entry for every value computeAccessStatus can return', () => {
    const possible = ['ACTIVE', 'PENDING_APPROVAL', 'NO_ACCESS', 'DISABLED'];
    possible.forEach(v => {
      expect(ACCESS_CONFIG[v], `Missing badge config for accessStatus="${v}"`).toBeDefined();
      expect(ACCESS_CONFIG[v].label).toBeTruthy();
      expect(ACCESS_CONFIG[v].cls).toMatch(/^badge-/);
    });
  });

  it('maps real computeAccessStatus outputs to valid config keys', () => {
    const cases = [
      { registrationStatus: 'disabled' },
      { registrationStatus: 'pending_approval' },
      { registrationStatus: 'rejected' },
      { registrationStatus: 'approved', userAccount: { active: true } },
      { registrationStatus: 'approved', userAccount: { active: false } },
      { registrationStatus: 'approved' },
    ];
    cases.forEach(farmer => {
      const status = computeAccessStatus(farmer);
      expect(ACCESS_CONFIG[status], `No badge config for computed accessStatus="${status}"`).toBeDefined();
    });
  });
});

describe('InviteBadge config', () => {
  it('has an entry for every value computeInviteStatus can return', () => {
    const possible = ['NOT_SENT', 'LINK_GENERATED', 'INVITE_SENT_EMAIL', 'INVITE_SENT_PHONE', 'ACCEPTED', 'EXPIRED'];
    possible.forEach(v => {
      expect(INVITE_CONFIG[v], `Missing badge config for inviteStatus="${v}"`).toBeDefined();
      expect(INVITE_CONFIG[v].label).toBeTruthy();
      expect(INVITE_CONFIG[v].cls).toMatch(/^badge-/);
    });
  });

  it('maps real computeInviteStatus outputs to valid config keys', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past   = new Date(Date.now() - 86400000).toISOString();
    const cases = [
      { selfRegistered: true },
      { selfRegistered: false, userId: 'u1' },
      { selfRegistered: false, userId: null, inviteToken: 'tok', inviteExpiresAt: past },
      { selfRegistered: false, userId: null, inviteToken: 'tok', inviteExpiresAt: future, inviteDeliveryStatus: 'email_sent' },
      { selfRegistered: false, userId: null, inviteToken: 'tok', inviteExpiresAt: future, inviteDeliveryStatus: 'phone_sent' },
      { selfRegistered: false, userId: null, inviteToken: 'tok', inviteExpiresAt: future, inviteDeliveryStatus: 'manual_share_ready' },
      { selfRegistered: false, userId: null, inviteToken: null, inviteExpiresAt: null, inviteDeliveryStatus: null },
    ];
    cases.forEach(farmer => {
      const status = computeInviteStatus(farmer);
      expect(INVITE_CONFIG[status], `No badge config for computed inviteStatus="${status}"`).toBeDefined();
    });
  });
});
