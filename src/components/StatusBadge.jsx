import React from 'react';
import { tStatus, tFraudRisk } from '../utils/i18n.js';

// English fallbacks — used when i18n translations haven't loaded yet
const FALLBACK_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  needs_more_evidence: 'Needs Evidence',
  field_review_required: 'Field Review',
  fraud_hold: 'Fraud Hold',
  approved: 'Approved',
  conditional_approved: 'Conditional',
  rejected: 'Rejected',
  escalated: 'Escalated',
  disbursed: 'Disbursed',
  // Risk/score levels
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  // Actions
  approve: 'Approve',
  conditional_approve: 'Conditional',
  reject: 'Reject',
  escalate: 'Escalate',
};

// Status keys that map to status.* translations
const STATUS_KEYS = new Set([
  'draft', 'submitted', 'under_review', 'needs_more_evidence', 'field_review_required',
  'fraud_hold', 'approved', 'conditional_approved', 'rejected', 'escalated', 'disbursed',
]);

// Risk keys that map to fraud.risk.* translations
const RISK_KEYS = new Set(['low', 'medium', 'high', 'critical']);

export default function StatusBadge({ value }) {
  if (!value) return null;

  let label;
  if (STATUS_KEYS.has(value)) {
    // Try i18n first, fall back to English
    const translated = tStatus(value);
    label = (translated && translated !== 'status.' + value) ? translated : FALLBACK_LABELS[value];
  } else if (RISK_KEYS.has(value)) {
    const translated = tFraudRisk(value);
    label = (translated && translated !== 'fraud.risk.' + value) ? translated : FALLBACK_LABELS[value];
  } else {
    label = FALLBACK_LABELS[value];
  }

  if (!label) label = value.replace(/_/g, ' ');
  return <span className={`badge badge-${value}`}>{label}</span>;
}
