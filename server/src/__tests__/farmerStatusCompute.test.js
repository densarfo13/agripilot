import { describe, it, expect } from 'vitest';
import { computeAccessStatus, computeInviteStatus } from '../modules/farmers/service.js';

// ─── computeAccessStatus ────────────────────────────────────

describe('computeAccessStatus', () => {
  it('returns NO_ACCESS for null/undefined', () => {
    expect(computeAccessStatus(null)).toBe('NO_ACCESS');
    expect(computeAccessStatus(undefined)).toBe('NO_ACCESS');
  });

  it('returns DISABLED when registrationStatus is disabled', () => {
    expect(computeAccessStatus({ registrationStatus: 'disabled' })).toBe('DISABLED');
  });

  it('returns PENDING_APPROVAL when registrationStatus is pending_approval', () => {
    expect(computeAccessStatus({ registrationStatus: 'pending_approval' })).toBe('PENDING_APPROVAL');
  });

  it('returns NO_ACCESS when registrationStatus is rejected', () => {
    expect(computeAccessStatus({ registrationStatus: 'rejected' })).toBe('NO_ACCESS');
  });

  it('returns ACTIVE when approved and userAccount.active is true', () => {
    expect(computeAccessStatus({ registrationStatus: 'approved', userAccount: { active: true } })).toBe('ACTIVE');
  });

  it('returns NO_ACCESS when approved but userAccount.active is false', () => {
    expect(computeAccessStatus({ registrationStatus: 'approved', userAccount: { active: false } })).toBe('NO_ACCESS');
  });

  it('returns NO_ACCESS when approved but no userAccount', () => {
    expect(computeAccessStatus({ registrationStatus: 'approved', userAccount: null })).toBe('NO_ACCESS');
    expect(computeAccessStatus({ registrationStatus: 'approved' })).toBe('NO_ACCESS');
  });
});

// ─── computeInviteStatus ────────────────────────────────────

describe('computeInviteStatus', () => {
  it('returns NOT_SENT for null/undefined', () => {
    expect(computeInviteStatus(null)).toBe('NOT_SENT');
    expect(computeInviteStatus(undefined)).toBe('NOT_SENT');
  });

  it('returns NOT_SENT for self-registered farmers', () => {
    expect(computeInviteStatus({ selfRegistered: true, inviteDeliveryStatus: 'email_sent' })).toBe('NOT_SENT');
  });

  it('returns ACCEPTED when userId is set', () => {
    expect(computeInviteStatus({ selfRegistered: false, userId: 'user-123', inviteDeliveryStatus: 'manual_share_ready' })).toBe('ACCEPTED');
  });

  it('returns EXPIRED when inviteToken exists, inviteExpiresAt is in the past, and no userId', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(computeInviteStatus({ selfRegistered: false, userId: null, inviteToken: 'tok', inviteExpiresAt: past })).toBe('EXPIRED');
  });

  it('returns INVITE_SENT_EMAIL when inviteDeliveryStatus is email_sent', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(computeInviteStatus({ selfRegistered: false, userId: null, inviteToken: 'tok', inviteExpiresAt: future, inviteDeliveryStatus: 'email_sent' })).toBe('INVITE_SENT_EMAIL');
  });

  it('returns INVITE_SENT_PHONE when inviteDeliveryStatus is phone_sent', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(computeInviteStatus({ selfRegistered: false, userId: null, inviteToken: 'tok', inviteExpiresAt: future, inviteDeliveryStatus: 'phone_sent' })).toBe('INVITE_SENT_PHONE');
  });

  it('returns LINK_GENERATED when inviteDeliveryStatus is manual_share_ready', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(computeInviteStatus({ selfRegistered: false, userId: null, inviteToken: 'tok', inviteExpiresAt: future, inviteDeliveryStatus: 'manual_share_ready' })).toBe('LINK_GENERATED');
  });

  it('returns LINK_GENERATED when inviteToken exists but no delivery status', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(computeInviteStatus({ selfRegistered: false, userId: null, inviteToken: 'tok', inviteExpiresAt: future, inviteDeliveryStatus: null })).toBe('LINK_GENERATED');
  });

  it('returns NOT_SENT when no token and no delivery status', () => {
    expect(computeInviteStatus({ selfRegistered: false, userId: null, inviteToken: null, inviteExpiresAt: null, inviteDeliveryStatus: null })).toBe('NOT_SENT');
  });
});
