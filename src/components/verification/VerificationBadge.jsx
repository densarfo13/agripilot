/**
 * VerificationBadge — small UI indicator for a record's
 * verification level (per spec § 8).
 *
 *   <VerificationBadge level={3} />   // green   "Verified"
 *   <VerificationBadge level={2} />   // yellow  "Location + time"
 *   <VerificationBadge level={1} />   // gray    "Time only"
 *   <VerificationBadge level={0} />   // red     "Unverified"
 *
 * Strict-rule audit
 *   * Pure presentation — no hooks, no fetching.
 *   * Calm copy: "Time only" / "Unverified" — never accuses
 *     a farmer of fraud, just reports what was witnessed.
 *   * Mobile-friendly tap target via padded pill, not a
 *     tiny icon-only badge.
 */

import React from 'react';

const LEVELS = Object.freeze({
  3: { label: 'Verified',         tone: 'green',  icon: '✓' },
  2: { label: 'Location + time',  tone: 'yellow', icon: '📍' },
  1: { label: 'Time only',        tone: 'gray',   icon: '🕒' },
  0: { label: 'Unverified',       tone: 'red',    icon: '⚠️' },
});

const TONE_STYLES = Object.freeze({
  green:  { bg: 'rgba(34,197,94,0.15)',  fg: '#86EFAC',
            border: 'rgba(34,197,94,0.40)' },
  yellow: { bg: 'rgba(245,158,11,0.18)', fg: '#FCD34D',
            border: 'rgba(245,158,11,0.45)' },
  gray:   { bg: 'rgba(255,255,255,0.05)', fg: 'rgba(255,255,255,0.7)',
            border: 'rgba(255,255,255,0.10)' },
  red:    { bg: 'rgba(239,68,68,0.10)',  fg: '#FCA5A5',
            border: 'rgba(239,68,68,0.30)' },
});

export default function VerificationBadge({
  level     = 0,
  showLabel = true,
  testId    = 'verification-badge',
  style,
}) {
  const meta = LEVELS[Number(level) || 0] || LEVELS[0];
  const tone = TONE_STYLES[meta.tone] || TONE_STYLES.gray;
  return (
    <span
      role="status"
      data-testid={testId}
      data-level={level}
      title={`Verification level ${level} — ${meta.label}`}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           '0.3rem',
        padding:       '0.15rem 0.55rem',
        borderRadius:  '999px',
        background:    tone.bg,
        color:         tone.fg,
        border:        `1px solid ${tone.border}`,
        fontSize:      '0.75rem',
        fontWeight:    700,
        ...(style || {}),
      }}
    >
      <span aria-hidden="true">{meta.icon}</span>
      <span aria-hidden="true">L{level}</span>
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}
