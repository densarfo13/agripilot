/**
 * TrustRiskBadge
 *
 * Compact, explainable trust and risk indicators.
 * Used in farmer detail, season detail, and staff dashboards.
 *
 * Farmer-facing: only shows trust level in plain language.
 * Staff-facing: shows level + top reason.
 *
 * No raw numbers exposed to farmers.
 */

import React from 'react';

// ─── Trust Badge ───────────────────────────────────────────

const TRUST_STYLES = {
  'High Trust':     { background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: 'rgba(34,197,94,0.3)' },
  'Moderate Trust': { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  'Low Trust':      { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: 'rgba(239,68,68,0.3)' },
  'Needs Review':   { background: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: 'rgba(139,92,246,0.3)' },
};

/**
 * TrustBadge — shows trust level pill with optional top reason.
 *
 * Props:
 *   trustLevel      — 'High Trust' | 'Moderate Trust' | 'Low Trust' | 'Needs Review'
 *   topReason       — optional short string shown below the badge
 *   compact         — if true, badge only (no reason)
 */
export function TrustBadge({ trustLevel, topReason, compact = false }) {
  if (!trustLevel) return null;
  const style = TRUST_STYLES[trustLevel] || TRUST_STYLES['Needs Review'];

  return (
    <span style={{ display: 'inline-flex', flexDirection: compact ? 'row' : 'column', alignItems: compact ? 'center' : 'flex-start', gap: '0.25rem' }}>
      <span style={{
        display: 'inline-block',
        padding: '0.2rem 0.6rem',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: style.background,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
      }}>
        {trustLevel}
      </span>
      {!compact && topReason && (
        <span style={{ fontSize: '0.7rem', color: '#A1A1AA', fontStyle: 'italic' }}>
          {topReason}
        </span>
      )}
    </span>
  );
}

// ─── Risk Badge ────────────────────────────────────────────

const RISK_STYLES = {
  Critical: { background: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: 'rgba(139,92,246,0.3)', dot: '#7c3aed' },
  High:     { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: 'rgba(239,68,68,0.3)', dot: '#dc2626' },
  Medium:   { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)', dot: '#d97706' },
  Low:      { background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: 'rgba(34,197,94,0.3)', dot: '#16a34a' },
};

/**
 * RiskBadge — shows risk level pill with optional reason.
 *
 * Props:
 *   riskLevel   — 'Critical' | 'High' | 'Medium' | 'Low'
 *   riskReason  — optional short explanation
 *   compact     — if true, badge only
 */
export function RiskBadge({ riskLevel, riskReason, compact = false }) {
  if (!riskLevel || riskLevel === 'Low') return null; // Low risk not shown by default
  const style = RISK_STYLES[riskLevel] || RISK_STYLES.Medium;

  return (
    <span style={{ display: 'inline-flex', flexDirection: compact ? 'row' : 'column', alignItems: compact ? 'center' : 'flex-start', gap: '0.25rem' }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.2rem 0.6rem',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: style.background,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: style.dot, flexShrink: 0 }} />
        {riskLevel} Risk
      </span>
      {!compact && riskReason && (
        <span style={{ fontSize: '0.7rem', color: '#A1A1AA', fontStyle: 'italic', maxWidth: 260 }}>
          {riskReason}
        </span>
      )}
    </span>
  );
}

// ─── Combined compact summary ──────────────────────────────

/**
 * TrustRiskSummary — shows trust + risk side by side in a compact row.
 * Used in table rows and list views.
 */
export function TrustRiskSummary({ trustLevel, riskLevel, riskReason }) {
  return (
    <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <TrustBadge trustLevel={trustLevel} compact />
      {riskLevel && riskLevel !== 'Low' && (
        <RiskBadge riskLevel={riskLevel} riskReason={riskReason} compact />
      )}
    </span>
  );
}

// ─── Task priority badge ───────────────────────────────────

const PRIORITY_STYLES = {
  High:   { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: 'rgba(239,68,68,0.3)' },
  Medium: { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  Low:    { background: '#1E293B', color: '#FFFFFF', border: '#243041' },
};

export function PriorityBadge({ priority }) {
  if (!priority) return null;
  const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.Low;
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.15rem 0.5rem',
      borderRadius: '10px',
      fontSize: '0.7rem',
      fontWeight: 600,
      background: style.background,
      color: style.color,
      border: `1px solid ${style.border}`,
    }}>
      {priority}
    </span>
  );
}
