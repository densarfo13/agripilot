import React from 'react';

const LABELS = {
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

export default function StatusBadge({ value }) {
  if (!value) return null;
  const label = LABELS[value] || value.replace(/_/g, ' ');
  return <span className={`badge badge-${value}`}>{label}</span>;
}
