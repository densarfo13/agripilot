/**
 * MissedDayBanner — gentle "let's get back on track" prompt.
 *
 * Reads `hasMissedYesterday()` synchronously and renders a small,
 * dismissable banner. Intentionally NOT punishing: no "you lost
 * your streak" copy, no red colour, no count of missed days.
 *
 * Storage key: farroway_missed_banner_dismissed   (Date.toDateString())
 *   The banner is dismissable per-day so a farmer who already
 *   acknowledged it doesn't see it again the same session, but
 *   it returns the next day if the gap continues.
 *
 * Usage:
 *
 *   <MissedDayBanner onContinue={() => navigate('/tasks')} />
 *
 * Strict rules respected:
 *   * additive       - mount it anywhere; nothing else changes
 *   * lightweight    - inline styles, no animation libs
 *   * not punishing  - encouragement only
 */

import React, { useState } from 'react';
import { hasMissedYesterday } from '../utils/streak.js';
import { tSafe } from '../i18n/tSafe.js';

const DISMISS_KEY = 'farroway_missed_banner_dismissed';

function _dismissedToday() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === new Date().toDateString();
  } catch { return false; }
}

function _stampDismissed() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DISMISS_KEY, new Date().toDateString());
  } catch { /* swallow */ }
}

export default function MissedDayBanner({ onContinue = null }) {
  const [hidden, setHidden] = useState(_dismissedToday());

  if (hidden) return null;
  if (!hasMissedYesterday()) return null;

  function handleDismiss() {
    _stampDismissed();
    setHidden(true);
  }

  function handleContinue() {
    _stampDismissed();
    setHidden(true);
    if (typeof onContinue === 'function') {
      try { onContinue(); }
      catch { /* never propagate from a click handler */ }
    }
  }

  return (
    <section style={S.banner} role="status" aria-live="polite" data-testid="missed-day-banner">
      <span style={S.icon} aria-hidden="true">{'\uD83C\uDF31'}</span>
      <div style={S.text}>
        <strong style={S.title}>
          {tSafe('reward.missed.title', 'Welcome back')}
        </strong>
        <span style={S.body}>
          {tSafe(
            'reward.missed.body',
            'You missed a day. Let\u2019s get back on track.',
          )}
        </span>
      </div>
      <div style={S.actions}>
        <button
          type="button"
          onClick={handleContinue}
          style={S.primaryBtn}
          data-testid="missed-day-continue"
        >
          {tSafe('reward.missed.cta', 'See today')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          style={S.dismissBtn}
          aria-label={tSafe('common.dismiss', 'Dismiss')}
          data-testid="missed-day-dismiss"
        >
          {'\u2715'}
        </button>
      </div>
    </section>
  );
}

const S = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(15,32,52,0.9) 100%)',
    border: '1px solid rgba(34,197,94,0.35)',
    color: '#EAF2FF',
    flexWrap: 'wrap',
  },
  icon: { fontSize: '1.5rem', flexShrink: 0 },
  text: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  title: { fontSize: '0.9375rem', fontWeight: 800, color: '#FFFFFF' },
  body:  { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 },
  actions: { display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 },
  primaryBtn: {
    background: '#22C55E',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '0.5rem 0.875rem',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  dismissBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 700,
    WebkitTapHighlightColor: 'transparent',
  },
};
