import React from 'react';

// ─── AccessBadge ────────────────────────────────────────────
// Values: ACTIVE | PENDING_APPROVAL | NO_ACCESS | DISABLED
const ACCESS_CONFIG = {
  ACTIVE:           { label: 'Active',          cls: 'badge-active' },
  PENDING_APPROVAL: { label: 'Pending Approval', cls: 'badge-pending' },
  NO_ACCESS:        { label: 'No Access',        cls: 'badge-no-access' },
  DISABLED:         { label: 'Disabled',         cls: 'badge-disabled' },
};

export function AccessBadge({ value }) {
  if (!value) return null;
  const cfg = ACCESS_CONFIG[value] || { label: value, cls: 'badge-no-access' };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}

// ─── InviteBadge ────────────────────────────────────────────
// Values: NOT_SENT | LINK_GENERATED | INVITE_SENT_EMAIL | INVITE_SENT_PHONE | ACCEPTED | EXPIRED
const INVITE_CONFIG = {
  NOT_SENT:          { label: 'Not Sent',     cls: 'badge-not-sent' },
  LINK_GENERATED:    { label: 'Link Ready',   cls: 'badge-link-generated' },
  INVITE_SENT_EMAIL: { label: 'Email Sent',   cls: 'badge-invite-sent' },
  INVITE_SENT_PHONE: { label: 'SMS Sent',     cls: 'badge-invite-sent' },
  CANCELLED:         { label: 'Cancelled',    cls: 'badge-expired' },
  ACCEPTED:          { label: 'Accepted',     cls: 'badge-accepted' },
  EXPIRED:           { label: 'Expired',      cls: 'badge-expired' },
};

export function InviteBadge({ value }) {
  if (!value) return null;
  const cfg = INVITE_CONFIG[value] || { label: value, cls: 'badge-not-sent' };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}
