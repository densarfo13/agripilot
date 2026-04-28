/**
 * RiskBadge — slim line-row that surfaces ONLY HIGH risks.
 *
 *   <RiskBadge pest="HIGH" drought="LOW" simple />
 *
 * Returns null when nothing is HIGH so the Today screen stays
 * uncluttered. When both are HIGH, both lines render with the
 * pest line first (more actionable).
 *
 * Strict-rule audit
 *   * Shows only high-priority signals
 *   * Icon-first; tSafe labels behind
 *   * Never crashes on missing inputs
 *   * Voice on render (Simple Mode only): a low-literacy farmer
 *     hears the alert without having to read it. Wrapped in
 *     try/catch so a browser without speechSynthesis still
 *     shows the visible badge — per the spec's fallback rule
 *     "If voice fails -> show text"
 *   * Speaks once per (pest, drought) combination so a re-render
 *     mid-alert doesn't re-announce the same warning
 */

import React, { useEffect, useRef } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { speak } from '../core/farroway/voice.js';

function _isHigh(v) {
  return String(v || '').toUpperCase() === 'HIGH';
}

export default function RiskBadge({ pest = '', drought = '', simple = false }) {
  const showPest    = _isHigh(pest);
  const showDrought = _isHigh(drought);

  // De-dup announcement: speak once per (pest|drought) combo.
  // The ref persists across re-renders; a real change in risk
  // (e.g. drought went LOW->HIGH after an outbreak fetch) is a
  // new combo and re-announces.
  const lastSpokenRef = useRef('');

  useEffect(() => {
    if (!simple) return;
    if (!showPest && !showDrought) return;
    const combo = `${showPest ? 'P' : ''}${showDrought ? 'D' : ''}`;
    if (lastSpokenRef.current === combo) return;
    lastSpokenRef.current = combo;

    const lines = [];
    if (showPest) {
      lines.push(tSafe('today.risk.pestHigh', 'Pest risk: HIGH'));
    }
    if (showDrought) {
      lines.push(tSafe('today.risk.droughtHigh', 'Drought risk: HIGH'));
    }
    if (!lines.length) return;
    try { speak(lines.join('. ')); } catch { /* swallow */ }
  }, [simple, showPest, showDrought]);

  if (!showPest && !showDrought) return null;

  return (
    <div style={S.wrap} role="status" aria-live="polite" data-testid="risk-badge">
      {showPest && (
        <p style={{ ...S.line, ...S.pest }} data-testid="risk-badge-pest">
          <span style={S.icon} aria-hidden="true">{'\uD83D\uDC1B'}</span>
          <span style={S.text}>{tSafe('today.risk.pestHigh', 'Pest risk: HIGH')}</span>
        </p>
      )}
      {showDrought && (
        <p style={{ ...S.line, ...S.drought }} data-testid="risk-badge-drought">
          <span style={S.icon} aria-hidden="true">{'\uD83C\uDF35'}</span>
          <span style={S.text}>{tSafe('today.risk.droughtHigh', 'Drought risk: HIGH')}</span>
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
    overflowWrap: 'break-word',
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
  icon: { fontSize: '1.125rem', lineHeight: 1, flexShrink: 0 },
  text: { flex: 1, minWidth: 0 },
};
