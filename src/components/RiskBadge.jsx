/**
 * RiskBadge — slim line-row that surfaces ONLY HIGH risks.
 *
 *   <RiskBadge pest="HIGH" drought="LOW" />
 *
 * Returns null when nothing is HIGH so the Today screen stays
 * uncluttered. When both are HIGH, both lines render with the
 * pest line first (more actionable).
 *
 * Strict-rule audit
 *   * shows only high-priority signals
 *   * icon-first; tSafe labels behind
 *   * never crashes on missing inputs
 *   * inline styles match the codebase
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';

function _isHigh(v) {
  return String(v || '').toUpperCase() === 'HIGH';
}

export default function RiskBadge({ pest = '', drought = '' }) {
  const showPest    = _isHigh(pest);
  const showDrought = _isHigh(drought);

  if (!showPest && !showDrought) return null;

  return (
    <div style={S.wrap} role="status" aria-live="polite" data-testid="risk-badge">
      {showPest && (
        <p style={{ ...S.line, ...S.pest }} data-testid="risk-badge-pest">
          <span style={S.icon} aria-hidden="true">{'\uD83D\uDC1B'}</span>
          <span>{tSafe('today.risk.pestHigh', 'Pest risk: HIGH')}</span>
        </p>
      )}
      {showDrought && (
        <p style={{ ...S.line, ...S.drought }} data-testid="risk-badge-drought">
          <span style={S.icon} aria-hidden="true">{'\uD83C\uDF35'}</span>
          <span>{tSafe('today.risk.droughtHigh', 'Drought risk: HIGH')}</span>
        </p>
      )}
    </div>
  );
}

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: 0,
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    fontSize: '0.9375rem',
    fontWeight: 700,
    border: '1px solid',
  },
  pest: {
    color: '#FCA5A5',
    background: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(248,113,113,0.45)',
  },
  drought: {
    color: '#FCD34D',
    background: 'rgba(245,158,11,0.14)',
    borderColor: 'rgba(245,158,11,0.45)',
  },
  icon: { fontSize: '1.125rem', lineHeight: 1 },
};
