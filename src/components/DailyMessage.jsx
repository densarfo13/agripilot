/**
 * DailyMessage — top-of-Today retention banner.
 *
 *   <DailyMessage descriptor={getDailyMessage(ctx)} />
 *
 *   ┌──────────────────────────────────────┐
 *   │ 🐛  Pest risk today. Check your crops.│
 *   └──────────────────────────────────────┘
 *
 * Strict-rule audit
 *   * Single one-line banner; never overflows on phone width
 *   * tSafe friendly: caller supplies messageKey + fallback
 *   * Tone-aware styling: 'warning' tier gets the amber accent;
 *     'info' tier stays neutral
 *   * Defensive: descriptor can be null/undefined (the
 *     dailyMessage helper always returns a value, but a future
 *     caller might pass null) — component renders nothing then
 *   * No interaction; presentational only
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';

export default function DailyMessage({ descriptor = null }) {
  if (!descriptor || !descriptor.messageKey) return null;

  const text = tSafe(descriptor.messageKey, descriptor.fallback || '',
    descriptor.vars || undefined);

  if (!text) return null;

  const toneStyle = descriptor.tone === 'warning' ? S.banWarn : S.banInfo;

  return (
    <div
      style={{ ...S.banner, ...toneStyle }}
      role="status"
      aria-live="polite"
      data-testid="daily-message"
    >
      <span style={S.icon} aria-hidden="true">{descriptor.icon || ''}</span>
      <span style={S.text}>{text}</span>
    </div>
  );
}

const S = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    border: '1px solid',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },
  banInfo: {
    color: '#86EFAC',
    background: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.30)',
  },
  banWarn: {
    color: '#FCD34D',
    background: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.45)',
  },
  icon: {
    fontSize: '1.125rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
    lineHeight: 1.4,
  },
};
